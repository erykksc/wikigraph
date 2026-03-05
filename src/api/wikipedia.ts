import type { ExpandResponse } from "../types";
import { getLocalStorageJson, setLocalStorageJson } from "./cache";

export const WIKIPEDIA_LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "pl", label: "Polish", flag: "🇵🇱" },
  { code: "de", label: "German", flag: "🇩🇪" },
  { code: "fr", label: "French", flag: "🇫🇷" },
  { code: "es", label: "Spanish", flag: "🇪🇸" },
  { code: "it", label: "Italian", flag: "🇮🇹" },
  { code: "ja", label: "Japanese", flag: "🇯🇵" },
  { code: "zh", label: "Chinese", flag: "🇨🇳" },
  { code: "tr", label: "Turkish", flag: "🇹🇷" },
] as const;

export type WikipediaLanguage = (typeof WIKIPEDIA_LANGUAGES)[number]["code"];

const CACHE_PREFIX = "wg:cache:";
const RESOLVE_TITLE_CACHE_PREFIX = `${CACHE_PREFIX}resolve-title:v1:`;
const EXPAND_CACHE_PREFIX = `${CACHE_PREFIX}expand:v1:`;

const cacheKeyForTitle = (
  prefix: string,
  language: WikipediaLanguage,
  title: string,
) => `${prefix}${language}:${encodeURIComponent(title)}`;

type WikiPage = {
  pageid?: number;
  title: string;
  links?: Array<{ title: string }>;
  missing?: boolean;
};

type WikiResponse = {
  continue?: {
    plcontinue?: string;
  };
  query?: {
    pages?: WikiPage[] | Record<string, WikiPage>;
  };
  error?: {
    info?: string;
  };
};

type QueryOutlinksResponse = {
  plcontinue: string | undefined;
  outLinks: Array<{ srcTitle: string; targetTitle: string }>;
};

const wikiApiBase = (language: WikipediaLanguage): string =>
  `https://${language}.wikipedia.org/w/api.php`;

const getPages = (res: WikiResponse): WikiPage[] => {
  const pages = res.query?.pages;
  if (!pages) {
    return [];
  }
  if (Array.isArray(pages)) {
    return pages;
  }
  return Object.values(pages);
};

const fetchWikiJson = async (
  language: WikipediaLanguage,
  params: Record<string, string>,
): Promise<WikiResponse> => {
  const url = new URL(wikiApiBase(language));
  url.search = new URLSearchParams({
    format: "json",
    formatversion: "2",
    origin: "*",
    ...params,
  }).toString();

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Wikipedia API error: ${res.status}`);
  }

  const payload = (await res.json()) as WikiResponse;
  if (payload.error?.info) {
    throw new Error(payload.error.info);
  }
  return payload;
};

const queryOutlinks = async (
  title: string,
  language: WikipediaLanguage,
  plcontinue?: string,
): Promise<QueryOutlinksResponse> => {
  const params: Record<string, string> = {
    action: "query",
    prop: "links",
    titles: title,
    pllimit: "max",
    plnamespace: "0",
  };

  if (plcontinue) {
    params.plcontinue = plcontinue;
  }

  const res = await fetchWikiJson(language, params);
  const pages = getPages(res);

  const outLinks: Array<{ srcTitle: string; targetTitle: string }> = [];
  for (const page of pages) {
    if (page.missing || !page.links) {
      continue;
    }
    for (const link of page.links) {
      outLinks.push({ srcTitle: page.title, targetTitle: link.title });
    }
  }

  return {
    plcontinue: res.continue?.plcontinue,
    outLinks,
  };
};

const resolveTitle = async (
  title: string,
  language: WikipediaLanguage,
): Promise<string> => {
  const resolveKey = cacheKeyForTitle(
    RESOLVE_TITLE_CACHE_PREFIX,
    language,
    title.trim(),
  );
  const cached = getLocalStorageJson<string>(resolveKey);
  if (cached) {
    return cached;
  }

  const res = await fetchWikiJson(language, {
    action: "query",
    titles: title,
  });

  const page = getPages(res)[0];
  if (!page || page.missing || !page.title) {
    throw new Error("Wikipedia article not found");
  }

  setLocalStorageJson(resolveKey, page.title);
  return page.title;
};

export const expandTitleFromWikipedia = async (
  title: string,
  language: WikipediaLanguage,
): Promise<ExpandResponse> => {
  const normalizedTitle = await resolveTitle(title, language);

  const expandKey = cacheKeyForTitle(
    EXPAND_CACHE_PREFIX,
    language,
    normalizedTitle,
  );
  const cached = getLocalStorageJson<ExpandResponse>(expandKey);
  if (cached) {
    return cached;
  }

  let plcontinue: string | undefined;
  const outLinks: Array<{ srcTitle: string; targetTitle: string }> = [];

  do {
    const response = await queryOutlinks(normalizedTitle, language, plcontinue);
    outLinks.push(...response.outLinks);
    plcontinue = response.plcontinue;
  } while (plcontinue);

  const uniqueTargets = new Set<string>();
  outLinks.forEach((edge) => {
    uniqueTargets.add(edge.targetTitle);
  });

  const payload: ExpandResponse = {
    newNodes: [normalizedTitle, ...uniqueTargets],
    newEdges: outLinks.map((edge) => ({
      fromNode: edge.srcTitle,
      targetNode: edge.targetTitle,
    })),
  };

  setLocalStorageJson(expandKey, payload);
  return payload;
};

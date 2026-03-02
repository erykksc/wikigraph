import type { ExpandResponse } from "../types";

export const WIKIPEDIA_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "pl", label: "Polish" },
  { code: "de", label: "German" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
  { code: "it", label: "Italian" },
  { code: "ja", label: "Japanese" },
  { code: "zh", label: "Chinese" },
  { code: "tr", label: "Turkish" },
] as const;

export type WikipediaLanguage = (typeof WIKIPEDIA_LANGUAGES)[number]["code"];

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
  const res = await fetchWikiJson(language, {
    action: "query",
    titles: title,
  });

  const page = getPages(res)[0];
  if (!page || page.missing || !page.title) {
    throw new Error("Wikipedia article not found");
  }

  return page.title;
};

export const expandTitleFromWikipedia = async (
  title: string,
  language: WikipediaLanguage,
): Promise<ExpandResponse> => {
  const normalizedTitle = await resolveTitle(title, language);

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

  return {
    newNodes: [normalizedTitle, ...uniqueTargets],
    newEdges: outLinks.map((edge) => ({
      fromNode: edge.srcTitle,
      targetNode: edge.targetTitle,
    })),
  };
};

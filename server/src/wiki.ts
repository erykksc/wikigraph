import { fetch } from "undici";

const WIKI_API = "https://en.wikipedia.org/w/api.php";

type NormalizedPage = {
  pageid: number;
  title: string;
};

type WikiPage = {
  pageid?: number;
  title?: string;
  missing?: string;
  links?: Array<{ title: string }>;
};

type WikiResponse = {
  query?: {
    normalized?: Array<{ from: string; to: string }>;
    pages?: Record<string, WikiPage>;
    backlinks?: Array<{ title: string }>;
  };
  continue?: Record<string, string>;
};

const buildUrl = (params: Record<string, string>): string => {
  const url = new URL(WIKI_API);
  url.search = new URLSearchParams({
    format: "json",
    formatversion: "2",
    origin: "*",
    ...params,
  }).toString();
  return url.toString();
};

const fetchJson = async (
  params: Record<string, string>,
): Promise<WikiResponse> => {
  const res = await fetch(buildUrl(params));
  if (!res.ok) {
    throw new Error(`Wikipedia API error: ${res.status}`);
  }
  return (await res.json()) as WikiResponse;
};

export const resolveTitle = async (title: string): Promise<NormalizedPage> => {
  const data = await fetchJson({
    action: "query",
    titles: title,
  });

  const pages = data.query?.pages ?? {};
  const firstPage = Object.values(pages)[0];
  if (!firstPage?.pageid || !firstPage.title || firstPage.missing) {
    throw new Error("Article not found");
  }

  return { pageid: firstPage.pageid, title: firstPage.title };
};

const collectTitles = async (
  baseParams: Record<string, string>,
): Promise<string[]> => {
  let titles: string[] = [];
  let cont: Record<string, string> | undefined;

  do {
    const params = cont ? { ...baseParams, ...cont } : baseParams;
    const data = await fetchJson(params);

    let items: Array<{ title: string }> = [];
    if (baseParams.prop === "links") {
      const pages = data.query?.pages ?? {};
      for (const pageId in pages) {
        const page = pages[pageId];
        if (page.links) {
          items = items.concat(page.links);
        }
      }
    } else {
      items = data.query?.backlinks ?? [];
    }

    titles = titles.concat(items.map((item) => item.title));
    cont = data.continue;
  } while (cont);

  return titles;
};

export const fetchOutlinks = async (title: string): Promise<string[]> =>
  collectTitles({
    action: "query",
    prop: "links",
    titles: title,
    pllimit: "max",
    plnamespace: "0",
  });

export const fetchInlinks = async (title: string): Promise<string[]> =>
  collectTitles({
    action: "query",
    list: "backlinks",
    bltitle: title,
    bllimit: "max",
    blnamespace: "0",
  });

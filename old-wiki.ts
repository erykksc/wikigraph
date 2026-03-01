import { fetch } from "undici";

const WIKI_API = "https://en.wikipedia.org/w/api.php";

type WikiPage = {
  pageid: number;
  ns: number;
  title: string;
  links?: Array<{ title: string }>;
};

type WikiResponse = {
  continue?: {
    plcontinue: string;
  };
  query: {
    normalized?: Array<{ from: string; to: string }>;
    pages: Record<string, WikiPage>;
  };
};

const fetchJson = async (
  params: Record<string, string>,
): Promise<WikiResponse> => {
  // build URL
  const url = new URL(WIKI_API);
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
  return (await res.json()) as any;
};

type OutLink = {
  srcTitle: string;
  targetTitle: string;
};

type QueryOutlinksResponse = {
  plcontinue: string | undefined;
  outLinks: Array<OutLink>;
  normalized: Record<string, string>; // Record<from, to>
};

// This function queries links one time, but the response may return
// 'plcontinue' tag, which would mean that we need to query again
export const queryOutlinks = async (
  titles: string[],
  plcontinue?: string,
): Promise<QueryOutlinksResponse> => {
  let query: Record<string, string> = {
    action: "query",
    prop: "links",
    titles: titles.join("|"),
    pllimit: "max",
    plnamespace: "0",
  };
  if (plcontinue) {
    query["plcontinue"] = plcontinue;
  }
  const res = (await fetchJson(query)) as WikiResponse;
  if (!res.query || !res.query.pages) {
    console.error("Wrong wikipedia api response", res);
    throw Error("Wrong wikipedia api response");
  }

  const normalized: Record<string, string> = {};
  for (const normalization of Object.values(res.query.normalized || [])) {
    normalized[normalization.from] = normalization.to;
  }

  const outLinks: Array<OutLink> = [];
  for (const wikipage of Object.values(res.query.pages)) {
    if (!wikipage.links) {
      continue;
    }
    for (const link of wikipage.links) {
      outLinks.push({
        srcTitle: wikipage.title,
        targetTitle: link.title,
      });
    }
  }

  return {
    plcontinue: res.continue?.plcontinue,
    outLinks,
    normalized,
  };
};

export const wikiQueryLinksFully = async (
  titles: string[],
): Promise<QueryOutlinksResponse> => {
  let { outLinks, normalized, plcontinue } = await queryOutlinks(titles);

  while (plcontinue) {
    let res = await queryOutlinks(titles, plcontinue);
    outLinks.push(...res.outLinks);
    for (const [from, to] of Object.entries(res.normalized)) {
      normalized[from] = to;
    }
    plcontinue = res.plcontinue;
  }

  return {
    outLinks,
    normalized,
    plcontinue: undefined,
  };
};

export const resolveTitle = async (
  title: string,
): Promise<{ normalizedTitle: string; pageId: number }> => {
  let query: Record<string, string> = {
    action: "query",
    titles: title,
  };
  const res = (await fetchJson(query)) as WikiResponse;

  const firstPage = res.query.pages[0];
  if (firstPage) {
    return {
      pageId: firstPage.pageid,
      normalizedTitle: firstPage.title,
    };
  } else {
    throw new Error("Couldn't get the first page, api is broken");
  }
};

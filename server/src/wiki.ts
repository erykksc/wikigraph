import { cache } from './cache.js';

type OutLink = {
  srcTitle: string;
  targetTitle: string;
};

type QueryOutlinksResponse = {
  plcontinue: undefined;
  outLinks: Array<OutLink>;
  normalized: Record<string, string>;
};

const titleCandidates = (title: string): string[] => {
  const trimmed = title.trim();
  if (!trimmed) {
    return [];
  }

  const addCandidate = (set: Set<string>, value: string): void => {
    if (!value) {
      return;
    }
    set.add(value);

    const capitalized = value.charAt(0).toUpperCase() + value.slice(1);
    set.add(capitalized);
  };

  const candidates = new Set<string>();
  addCandidate(candidates, trimmed);
  addCandidate(candidates, trimmed.replace(/ /g, '_'));
  addCandidate(candidates, trimmed.replace(/_/g, ' '));

  return [...candidates];
};

const getPageIdByTitle = async (title: string): Promise<number | null> => {
  const pageIdRaw = await cache.get(`page:${title}`);
  if (!pageIdRaw) {
    return null;
  }

  const pageId = Number(pageIdRaw);
  if (!Number.isInteger(pageId)) {
    throw new Error(`Invalid page id for title '${title}'`);
  }

  return pageId;
};

const getOutLinksForTitle = async (title: string): Promise<Array<OutLink>> => {
  const pageId = await getPageIdByTitle(title);
  if (!pageId) {
    return [];
  }

  const targetIds = await cache.smembers(`pagelinks:${pageId}`);
  if (targetIds.length === 0) {
    return [];
  }

  const targetTitles = await cache.mget(
    targetIds.map((targetId) => `linktarget:${targetId}`),
  );

  const outLinks: Array<OutLink> = [];
  for (const targetTitle of targetTitles) {
    if (!targetTitle) {
      continue;
    }
    outLinks.push({ srcTitle: title, targetTitle });
  }

  return outLinks;
};

export const wikiQueryLinksFully = async (
  titles: string[],
): Promise<QueryOutlinksResponse> => {
  const outLinks: Array<OutLink> = [];
  for (const title of titles) {
    const titleOutLinks = await getOutLinksForTitle(title);
    outLinks.push(...titleOutLinks);
  }

  return {
    outLinks,
    normalized: {},
    plcontinue: undefined,
  };
};

export const resolveTitle = async (
  title: string,
): Promise<{ normalizedTitle: string; pageId: number }> => {
  const candidates = titleCandidates(title);
  for (const candidate of candidates) {
    const pageId = await getPageIdByTitle(candidate);
    if (pageId) {
      return {
        pageId,
        normalizedTitle: candidate,
      };
    }
  }

  throw new Error(`Title '${title}' was not found in Redis`);
};

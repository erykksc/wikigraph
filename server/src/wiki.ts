import { cache } from "./cache.js";

type OutLink = {
  srcTitle: string;
  targetTitle: string;
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
): Promise<Array<OutLink>> => {
  const outLinks: Array<OutLink> = [];
  for (const title of titles) {
    const titleOutLinks = await getOutLinksForTitle(title);
    outLinks.push(...titleOutLinks);
  }

  return outLinks;
};

// Normalizes the title for wiki search in redis
export const normalizeTitle = (title: string) => {
  const normTitle = title.replace(/ /g, "_");
  return normTitle.charAt(0).toUpperCase() + normTitle.slice(1);
};

// Denormalizes the title to make it human readable
export const denormalizeTitle = (normalizedTitle: string) => {
  return normalizedTitle.replace(/_/g, " ");
};

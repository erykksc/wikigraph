import {
  expandTitleFromWikipedia,
  type WikipediaLanguage,
  WIKIPEDIA_LANGUAGES,
} from "./wikipedia";
import type { ExpandResponse } from "../types";

export type { WikipediaLanguage };
export { WIKIPEDIA_LANGUAGES };

export const expandTitle = async (
  title: string,
  language: WikipediaLanguage,
): Promise<ExpandResponse> => {
  return expandTitleFromWikipedia(title, language);
};

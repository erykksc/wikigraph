import type { ExpandResponse } from '@wikipedia-graph/shared';
import { expandTitleFromServer } from './server';
import {
  expandTitleFromWikipedia,
  type WikipediaLanguage,
  WIKIPEDIA_LANGUAGES,
} from './wikipedia';

export type { WikipediaLanguage };
export { WIKIPEDIA_LANGUAGES };

export type BackendMode = 'server' | 'wikipedia';

type ExpandTitleOptions = {
  backend: BackendMode;
  language: WikipediaLanguage;
};

export const expandTitle = async (
  title: string,
  options: ExpandTitleOptions,
): Promise<ExpandResponse> => {
  if (options.backend === 'server') {
    return expandTitleFromServer(title);
  }

  return expandTitleFromWikipedia(title, options.language);
};

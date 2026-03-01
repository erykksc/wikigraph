import type { ExpandResponse } from '@wikipedia-graph/shared';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3000';

export const expandTitleFromServer = async (
  title: string,
): Promise<ExpandResponse> => {
  const url = new URL('/expand', API_BASE);
  url.searchParams.set('title', title);

  const res = await fetch(url);
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(data?.error || 'Failed to expand title');
  }

  return (await res.json()) as ExpandResponse;
};

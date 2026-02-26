import Redis from 'ioredis'
import type { ExpandResponse } from '@wikipedia-graph/shared'

const redisUrl = process.env.VALKEY_URL || process.env.REDIS_URL || 'redis://localhost:6379'

export const cache = new Redis(redisUrl)

const DEFAULT_TTL_SECONDS = 60 * 60 * 24

export const getCachedLinks = async (pageId: number): Promise<ExpandResponse | null> => {
  const value = await cache.get(`wiki:links:${pageId}`)
  if (!value) {
    return null
  }
  return JSON.parse(value) as ExpandResponse
}

export const setCachedLinks = async (pageId: number, payload: ExpandResponse): Promise<void> => {
  await cache.setex(`wiki:links:${pageId}`, DEFAULT_TTL_SECONDS, JSON.stringify(payload))
}

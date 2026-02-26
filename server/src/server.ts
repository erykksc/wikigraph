import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import { z } from 'zod'
import { fetchInlinks, fetchOutlinks, resolveTitle } from './wiki.js'
import { getCachedLinks, setCachedLinks } from './cache.js'
import type { ExpandResponse } from '@wikipedia-graph/shared'

const app = Fastify({ logger: true })

const querySchema = z.object({
  title: z.string().min(1),
})

app.get('/expand', async (request, reply) => {
  const parsed = querySchema.safeParse(request.query)
  if (!parsed.success) {
    return reply.status(400).send({ error: 'Missing title query parameter' })
  }

  const rawTitle = parsed.data.title.trim()

  try {
    const normalized = await resolveTitle(rawTitle)
    const cached = await getCachedLinks(normalized.pageid)
    if (cached) {
      return cached
    }

    const [outlinks, inlinks] = await Promise.all([
      fetchOutlinks(normalized.title),
      fetchInlinks(normalized.title),
    ])

    const payload: ExpandResponse = {
      node: { id: normalized.pageid, title: normalized.title },
      outlinks,
      inlinks,
    }

    await setCachedLinks(normalized.pageid, payload)
    return payload
  } catch (error) {
    request.log.error(error)
    return reply.status(404).send({ error: 'Article not found' })
  }
})

const start = async () => {
  await app.register(cors, { origin: true })
  await app.register(helmet)

  const port = Number(process.env.PORT ?? 3000)
  const host = process.env.HOST ?? '0.0.0.0'

  await app.listen({ port, host })
}

void start()

import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { z } from "zod";
import {
  denormalizeTitle,
  normalizeTitle,
  wikiQueryLinksFully,
} from "./wiki.js";
import type { ExpandResponse } from "@wikipedia-graph/shared";

const app = Fastify({ logger: true });

const querySchema = z.object({
  title: z.string().min(1),
});

app.get("/expand", async (request, reply) => {
  const parsed = querySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply.status(400).send({ error: "Missing title query parameter" });
  }

  const rawTitle = parsed.data.title.trim();

  try {
    const normTitle = normalizeTitle(rawTitle);
    let outLinks = await wikiQueryLinksFully([normTitle]);
    outLinks = outLinks.map((l) => ({
      srcTitle: denormalizeTitle(l.srcTitle),
      targetTitle: denormalizeTitle(l.targetTitle),
    }));

    const newNodes: ExpandResponse["newNodes"] = [
      normTitle,
      ...outLinks.map((l) => l.targetTitle),
    ];
    const newEdges: ExpandResponse["newEdges"] = outLinks.map((outLink) => ({
      fromNode: outLink.srcTitle,
      targetNode: outLink.targetTitle,
    }));

    // // second run, just to get the links between the new nodes
    // const newTitles = outLinks.map((l) => l.targetTitle);
    // const batchSize = 50;
    // for (let i = 0; i < newTitles.length; i += batchSize) {
    //   const batch = newTitles.slice(i, i + batchSize);
    //   console.log("Processing batch:", batch);
    //   const secondRes = await wikiQueryLinksFully(batch);
    //   newEdges.push(
    //     ...secondRes.outLinks.map((l) => ({
    //       fromNode: l.srcTitle,
    //       targetNode: l.targetTitle,
    //     })),
    //   );
    //   await new Promise((resolve) => setTimeout(resolve, 1000));
    // }

    const payload: ExpandResponse = {
      newNodes,
      newEdges,
    };

    return payload;
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: "Server Error" });
  }
});

const start = async () => {
  await app.register(cors, { origin: true });
  await app.register(helmet);

  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? "localhost";

  await app.listen({ port, host });
};

void start();

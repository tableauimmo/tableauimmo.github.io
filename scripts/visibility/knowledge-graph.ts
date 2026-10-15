// Google Knowledge Graph : Google connaît-il « Tableau Immo » comme une entité (chaîne, organisation) ?
// C'est ce qui permet un panneau de connaissances et des réponses directes, y compris dans les IA de Google.
import { z } from 'astro/zod';
import { fetchWithRetry } from '../lib/http.ts';
import type { KnowledgeGraphData } from './schema.ts';

const payloadSchema = z.object({
  itemListElement: z
    .array(
      z.object({
        resultScore: z.number().default(0),
        result: z.object({ name: z.string().default(''), '@type': z.array(z.string()).default([]), description: z.string().optional() }),
      }),
    )
    .default([]),
});

export function parseKnowledgeGraph(payload: unknown, brand: string): KnowledgeGraphData {
  const { itemListElement } = payloadSchema.parse(payload);
  const entites = itemListElement.map((item) => ({
    nom: item.result.name,
    types: item.result['@type'],
    score: item.resultScore,
    ...(item.result.description ? { description: item.result.description } : {}),
  }));
  const needle = brand.toLowerCase();
  return { reconnu: entites.some((entity) => entity.nom.toLowerCase().includes(needle)), entites };
}

export async function collectKnowledgeGraph(query: string, brand: string, apiKey: string): Promise<KnowledgeGraphData> {
  const url = new URL('https://kgsearch.googleapis.com/v1/entities:search');
  url.searchParams.set('query', query);
  url.searchParams.set('languages', 'fr');
  url.searchParams.set('limit', '5');
  url.searchParams.set('key', apiKey);
  return parseKnowledgeGraph(await (await fetchWithRetry(url.href)).json(), brand);
}

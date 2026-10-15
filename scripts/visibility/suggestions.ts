// Ce que les investisseurs tapent vraiment : suggestions de saisie de Google et de YouTube pour les requêtes cibles.
// Volume volontairement faible (une requête à la fois, avec une pause) : c'est l'équivalent d'une personne qui tape.
import { z } from 'astro/zod';
import { fetchWithRetry } from '../lib/http.ts';
import type { SuggestionsData } from './schema.ts';

const ENDPOINT = 'https://suggestqueries.google.com/complete/search';
const PAUSE_MS = 300;
/** Début du nom de la marque : quand Google ou YouTube complètent en « tableau immo », la marque est connue. */
export const BRAND_PREFIX = 'tableau imm';
const BRAND = 'tableau immo';

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const responseSchema = z.tuple([z.string(), z.array(z.string())], z.unknown());

export function parseSuggestions(payload: unknown): string[] {
  const parsed = responseSchema.safeParse(payload);
  if (!parsed.success) throw new Error('Réponse de suggestions inattendue');
  return parsed.data[1];
}

async function suggest(query: string, source: 'google' | 'youtube'): Promise<string[]> {
  const url = new URL(ENDPOINT);
  url.searchParams.set('client', 'firefox');
  url.searchParams.set('hl', 'fr');
  url.searchParams.set('gl', 'fr');
  if (source === 'youtube') url.searchParams.set('ds', 'yt');
  url.searchParams.set('q', query);
  const response = await fetchWithRetry(url.href, { retries: 2 });
  return parseSuggestions(await response.json());
}

export async function collectSuggestions(seeds: string[]): Promise<SuggestionsData> {
  const graines: SuggestionsData['graines'] = [];
  for (const requete of seeds) {
    const google = await suggest(requete, 'google');
    await sleep(PAUSE_MS);
    const youtube = await suggest(requete, 'youtube');
    await sleep(PAUSE_MS);
    graines.push({ requete, google, youtube });
  }
  const brandGoogle = await suggest(BRAND_PREFIX, 'google');
  await sleep(PAUSE_MS);
  const brandYoutube = await suggest(BRAND_PREFIX, 'youtube');
  const containsBrand = (list: string[]) => list.some((item) => item.toLowerCase().includes(BRAND));
  return { graines, marque: { saisie: BRAND_PREFIX, google: containsBrand(brandGoogle), youtube: containsBrand(brandYoutube) } };
}

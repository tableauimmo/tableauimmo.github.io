// IndexNow : prévient immédiatement Bing (qui alimente ChatGPT et Copilot), Yandex, Seznam, Naver…
// qu'une page est nouvelle ou modifiée. Google n'utilise pas IndexNow (il passe par le sitemap et Search Console).
import { fetchWithRetry } from '../lib/http.ts';

export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
export const INDEXNOW_MAX_URLS = 10_000;

export interface IndexNowPayload {
  host: string;
  key: string;
  keyLocation: string;
  urlList: string[];
}

export function keyFileUrl(site: string, key: string): string {
  return `${site}/${key}.txt`;
}

export function indexNowPayload(site: string, key: string, urls: string[]): IndexNowPayload {
  const host = new URL(site).host;
  const unique = [...new Set(urls)];
  if (unique.length === 0) throw new Error('Aucune adresse à soumettre');
  if (unique.length > INDEXNOW_MAX_URLS) throw new Error(`IndexNow accepte au plus ${INDEXNOW_MAX_URLS} adresses par envoi`);
  for (const url of unique) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error(`Adresse invalide : ${url}`);
    }
    if (parsed.host !== host || parsed.protocol !== 'https:') throw new Error(`Adresse hors du site ${site} : ${url}`);
  }
  return { host, key, keyLocation: keyFileUrl(site, key), urlList: unique };
}

/** Envoie les adresses ; renvoie le statut (200 : reçu, 202 : reçu, clé en cours de vérification). */
export async function submitIndexNow(payload: IndexNowPayload): Promise<number> {
  const response = await fetchWithRetry(INDEXNOW_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
    acceptStatus: [202],
  });
  return response.status;
}

/** Le fichier de clé doit être servi tel quel à la racine du site, sinon les moteurs rejettent les envois. */
export async function keyFileServed(site: string, key: string): Promise<boolean> {
  const response = await fetchWithRetry(keyFileUrl(site, key), { acceptStatus: [404], retries: 1 });
  return response.status === 200 && (await response.text()).trim() === key;
}

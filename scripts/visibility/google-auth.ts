// Jeton d'accès Google pour un compte de service (fichier JSON téléchargé depuis Google Cloud).
// Signature JWT RS256 avec node:crypto : aucune dépendance, la clé privée ne quitte jamais la machine.
import { createSign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { z } from 'astro/zod';
import { fetchWithRetry } from '../lib/http.ts';

const serviceAccountSchema = z.object({
  type: z.literal('service_account'),
  client_email: z.email(),
  private_key: z.string().includes('PRIVATE KEY'),
  token_uri: z.url().default('https://oauth2.googleapis.com/token'),
});
export type ServiceAccount = z.infer<typeof serviceAccountSchema>;

const TOKEN_LIFETIME_SECONDS = 3600;

export async function readServiceAccount(path: string): Promise<ServiceAccount> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch {
    throw new Error(`Fichier du compte de service introuvable : ${path}`);
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error(`Fichier du compte de service illisible (JSON invalide) : ${path}`);
  }
  const parsed = serviceAccountSchema.safeParse(json);
  if (!parsed.success) throw new Error(`Fichier du compte de service invalide (${path}) : ${parsed.error.issues.map((issue) => issue.path.join('.')).join(', ')}`);
  return parsed.data;
}

const base64url = (value: string | Buffer) => Buffer.from(value).toString('base64url');

/** Assertion JWT signée (RFC 7523) échangée contre un jeton d'accès. */
export function signedAssertion(account: ServiceAccount, scope: string, nowSeconds: number): string {
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({ iss: account.client_email, scope, aud: account.token_uri, iat: nowSeconds, exp: nowSeconds + TOKEN_LIFETIME_SECONDS }),
  );
  const signature = createSign('RSA-SHA256').update(`${header}.${claims}`).sign(account.private_key);
  return `${header}.${claims}.${base64url(signature)}`;
}

export async function accessToken(account: ServiceAccount, scope: string): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: signedAssertion(account, scope, Math.floor(Date.now() / 1000)),
  });
  const response = await fetchWithRetry(account.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const payload: { access_token?: unknown } = await response.json();
  if (typeof payload.access_token !== 'string' || !payload.access_token) throw new Error('Réponse de Google sans jeton d’accès');
  return payload.access_token;
}

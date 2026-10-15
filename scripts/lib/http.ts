// Requêtes HTTP avec délai maximal et nouvelles tentatives (erreurs réseau et réponses 5xx/429).
export class HttpError extends Error {
  readonly status: number;

  constructor(url: string, status: number, detail = '') {
    super(`HTTP ${status} pour ${url}${detail ? ` : ${detail}` : ''}`);
    this.status = status;
  }
}

export interface FetchOptions {
  timeoutMs?: number;
  retries?: number;
  /** Statuts considérés comme une réponse valide (404 pour tester l'existence d'une miniature, par ex.) */
  acceptStatus?: number[];
  method?: 'GET' | 'POST' | 'PUT';
  headers?: Record<string, string>;
  body?: string;
}

const USER_AGENT = 'tableau-immo-site/1.0 (+https://tableauimmo.github.io)';
const DETAIL_MAX_LENGTH = 300;

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

/** Début du corps d'une réponse en erreur (les API Google y expliquent la cause). */
async function errorDetail(response: Response): Promise<string> {
  try {
    return (await response.text()).replace(/\s+/g, ' ').trim().slice(0, DETAIL_MAX_LENGTH);
  } catch {
    return '';
  }
}

export async function fetchWithRetry(url: string, options: FetchOptions = {}): Promise<Response> {
  const { timeoutMs = 15_000, retries = 3, acceptStatus = [], method = 'GET', headers = {}, body } = options;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        method,
        ...(body === undefined ? {} : { body }),
        signal: AbortSignal.timeout(timeoutMs),
        headers: { 'User-Agent': USER_AGENT, ...headers },
      });
      if (response.ok || acceptStatus.includes(response.status)) return response;
      const error = new HttpError(url, response.status, await errorDetail(response));
      const retryable = response.status >= 500 || response.status === 429;
      if (!retryable) throw error;
      lastError = error;
    } catch (error) {
      if (error instanceof HttpError && error.status < 500 && error.status !== 429) throw error;
      lastError = error;
    }
    if (attempt < retries) await sleep(500 * 2 ** attempt);
  }
  throw lastError instanceof Error ? lastError : new Error(`Échec de la requête ${url}`);
}

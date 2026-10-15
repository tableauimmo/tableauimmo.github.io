// Résumé du site pour les assistants et moteurs de réponse (format llms.txt).
import type { APIRoute } from 'astro';
import { llmsSummary } from '../lib/llms.ts';

export const GET: APIRoute = async () => new Response(await llmsSummary(), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

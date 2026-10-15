// Contenu complet du site en texte (épisodes, calculateurs, lexique) pour les assistants IA.
import type { APIRoute } from 'astro';
import { llmsFull } from '../lib/llms.ts';

export const GET: APIRoute = async () => new Response(await llmsFull(), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

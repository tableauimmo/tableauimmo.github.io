// Échappement XML pour les flux et sitemaps générés à la main.
const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };

export function xmlEscape(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ENTITIES[character] ?? character);
}

export function xmlResponse(body: string, contentType = 'application/xml'): Response {
  return new Response(body, { headers: { 'Content-Type': `${contentType}; charset=utf-8` } });
}

// Adresses du site : tous les liens internes passent par href() et toutes les URL absolues
// (canonique, Open Graph, données structurées, sitemaps) par absoluteUrl(). Le chemin de base
// (site.config.mjs → BASE_PATH) n'est ainsi écrit qu'à un seul endroit.
import { SITE } from '../../site.config.mjs';

const PREFIX = SITE.base.replace(/\/$/, '');

/** Lien interne : « /outils/ » → « /outils/ » (site à la racine) ou « /depot/outils/ ». */
export function href(path: string): string {
  if (!path.startsWith('/')) return path;
  if (PREFIX && (path === PREFIX || path.startsWith(`${PREFIX}/`))) return path;
  return `${PREFIX}${path}`;
}

/** URL absolue d'une page ou d'un fichier du site (laisse passer les URL déjà absolues). */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return new URL(href(path.startsWith('/') ? path : `/${path}`), SITE.url).href;
}

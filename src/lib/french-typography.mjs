// Typographie française du HTML produit : espaces insécables avant « : ; ! ? » et dans « … »,
// entre un nombre et « € » ou « % », et dans les milliers (« 23 000 € » ne se coupe plus en fin de ligne).
// Appliqué au texte seulement (jamais aux balises, attributs, scripts ni styles) à la fin du build.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const NBSP = '\u00a0';
const NNBSP = '\u202f';
/** Éléments dont le contenu n'est jamais retouché (le CSS minifié contient par exemple « (width<=960px) »). */
const RAW_ELEMENT = /<(script|style|pre|code|textarea)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;

/** Corrige un fragment de texte (sans balise). */
export function frenchText(text) {
  return text
    .replace(/ :(?=[\s<]|$)/g, `${NBSP}:`)
    .replace(/ ([;!?])(?=[\s<)]|$)/g, `${NNBSP}$1`)
    .replace(/« /g, `«${NBSP}`)
    .replace(/ »/g, `${NBSP}»`)
    .replace(/(\d) (?=\d{3}(?!\d))/g, `$1${NNBSP}`)
    .replace(/(\d) (€|%|k€)/g, `$1${NBSP}$2`);
}

function markup(fragment) {
  return fragment
    .split(/(<[^>]*>)/)
    .map((part) => (part.startsWith('<') ? part : frenchText(part)))
    .join('');
}

/** Applique frenchText aux nœuds texte d'un document HTML (hors balises, attributs, scripts, styles, code). */
export function frenchHtml(html) {
  let result = '';
  let last = 0;
  for (const match of html.matchAll(RAW_ELEMENT)) {
    result += markup(html.slice(last, match.index)) + match[0];
    last = (match.index ?? 0) + match[0].length;
  }
  return result + markup(html.slice(last));
}

async function htmlFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return htmlFiles(full);
      return entry.name.endsWith('.html') ? [full] : [];
    }),
  );
  return files.flat();
}

/** Intégration Astro : corrige toutes les pages HTML générées. */
export function frenchTypography() {
  return {
    name: 'tableau-immo:typographie-francaise',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const files = await htmlFiles(fileURLToPath(dir));
        for (const file of files) {
          const html = await readFile(file, 'utf8');
          const fixed = frenchHtml(html);
          if (fixed !== html) await writeFile(file, fixed, 'utf8');
        }
        logger.info(`Typographie française appliquée à ${files.length} pages.`);
      },
    },
  };
}

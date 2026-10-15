// Plugins rehype appliqués à tout le Markdown du site (épisodes, lexique).
// JavaScript simple (pas de dépendance) : importé par astro.config.mjs.

/** @typedef {{ type: string, tagName?: string, properties?: Record<string, unknown>, children?: Node[], value?: string }} Node */

/** @param {Node} node */
function textOf(node) {
  if (node.type === 'text') return node.value ?? '';
  return (node.children ?? []).map(textOf).join('');
}

/** @param {Node} node @param {(node: Node) => void} visit */
function walk(node, visit) {
  visit(node);
  for (const child of node.children ?? []) walk(child, visit);
}

/**
 * Préfixe les liens internes (« /lexique/lmnp/ ») par le chemin de base du site
 * (utile seulement si le site n'est pas servi à la racine du domaine).
 * @param {{ base: string }} options
 */
export function rehypeBaseLinks({ base }) {
  const prefix = base.replace(/\/$/, '');
  return (/** @type {Node} */ tree) => {
    walk(tree, (node) => {
      if (node.type !== 'element' || node.tagName !== 'a' || !node.properties) return;
      const href = node.properties.href;
      if (typeof href !== 'string') return;
      if (href.startsWith('/') && !href.startsWith('//')) {
        if (prefix && !href.startsWith(`${prefix}/`)) node.properties.href = `${prefix}${href}`;
      } else if (/^https?:\/\//.test(href)) {
        node.properties.rel = ['noopener', 'external'];
      }
    });
  };
}

/** Les tableaux Markdown défilent horizontalement sur mobile au lieu de déborder. */
export function rehypeScrollableTables() {
  /** @param {Node} node */
  const wrap = (node) => {
    if (!node.children) return;
    node.children = node.children.map((child) => {
      if (child.type === 'element' && child.tagName === 'table') {
        return { type: 'element', tagName: 'div', properties: { className: ['table-scroll'], tabIndex: 0, role: 'region', ariaLabel: 'Tableau (défilement horizontal)' }, children: [child] };
      }
      wrap(child);
      return child;
    });
  };
  return (/** @type {Node} */ tree) => wrap(tree);
}

const TRANSCRIPT_HEADING = /^transcription/i;

/**
 * Épisodes : tout ce qui suit le titre « ## Transcription » est replié dans un bloc <details>
 * (le texte reste dans la page pour les moteurs, sans allonger la lecture).
 */
export function rehypeTranscript() {
  return (/** @type {Node} */ tree) => {
    const children = tree.children ?? [];
    const index = children.findIndex((node) => node.type === 'element' && node.tagName === 'h2' && TRANSCRIPT_HEADING.test(textOf(node).trim()));
    if (index < 0) return;
    const body = children.slice(index + 1);
    const details = {
      type: 'element',
      tagName: 'details',
      properties: { className: ['transcript'], id: 'transcription' },
      children: [
        {
          type: 'element',
          tagName: 'summary',
          properties: { className: ['transcript__summary'] },
          children: [{ type: 'element', tagName: 'h2', properties: { className: ['transcript__title'] }, children: [{ type: 'text', value: 'Transcription intégrale' }] }],
        },
        { type: 'element', tagName: 'div', properties: { className: ['transcript__body'] }, children: body },
      ],
    };
    tree.children = [...children.slice(0, index), details];
  };
}

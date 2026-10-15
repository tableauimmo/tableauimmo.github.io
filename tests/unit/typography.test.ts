import { describe, expect, it } from 'vitest';
import { frenchHtml, frenchText } from '../../src/lib/french-typography.mjs';
import { rehypeBaseLinks, rehypeScrollableTables, rehypeTranscript } from '../../src/lib/markdown-plugins.mjs';

const visible = (text: string) => text.replace(/ /g, '[_]').replace(/ /g, '[.]');

describe('typographie française', () => {
  it('insère les espaces insécables', () => {
    expect(visible(frenchText('Statut : 23 000 € et 5,56 % ! « oui »'))).toBe('Statut[_]: 23[.]000[_]€ et 5,56[_]%[.]! «[_]oui[_]»');
  });

  it('ne touche ni aux balises, ni aux attributs, ni aux scripts', () => {
    const html = '<p title="a : b">Prix : 1 000 €</p><script>a = b ? c : d;</script><style>@media (width<=960px){a:hover{color:red}}</style><p>0:32 OK : fin</p>';
    expect(visible(frenchHtml(html))).toBe('<p title="a : b">Prix[_]: 1[.]000[_]€</p><script>a = b ? c : d;</script><style>@media (width<=960px){a:hover{color:red}}</style><p>0:32 OK[_]: fin</p>');
  });
});

type Node = { type: string; tagName?: string; properties?: Record<string, unknown>; children?: Node[]; value?: string };
const el = (tagName: string, children: Node[] = [], properties: Record<string, unknown> = {}): Node => ({ type: 'element', tagName, properties, children });
const text = (value: string): Node => ({ type: 'text', value });

describe('plugins Markdown', () => {
  it('replie la transcription dans un bloc <details>', () => {
    const tree = { type: 'root', children: [el('h2', [text('Article')]), el('p', [text('a')]), el('h2', [text('Transcription')]), el('p', [text('b')]), el('p', [text('c')])] };
    rehypeTranscript()(tree);
    expect(tree.children).toHaveLength(3);
    const details = tree.children[2]!;
    expect(details.tagName).toBe('details');
    expect(details.children?.[1]?.children?.map((child) => child.children?.[0]?.value)).toEqual(['b', 'c']);
  });

  it('préfixe les liens internes par le chemin de base et marque les liens externes', () => {
    const tree = { type: 'root', children: [el('a', [], { href: '/lexique/lmnp/' }), el('a', [], { href: 'https://www.legifrance.gouv.fr/' }), el('a', [], { href: '/depot/outils/' })] };
    rehypeBaseLinks({ base: '/depot/' })(tree);
    expect(tree.children.map((child) => child.properties?.href)).toEqual(['/depot/lexique/lmnp/', 'https://www.legifrance.gouv.fr/', '/depot/outils/']);
    expect(tree.children[1]?.properties?.rel).toEqual(['noopener', 'external']);
  });

  it('les tableaux défilent sur mobile', () => {
    const tree = { type: 'root', children: [el('table')] };
    rehypeScrollableTables()(tree);
    expect(tree.children[0]?.tagName).toBe('div');
    expect(tree.children[0]?.children?.[0]?.tagName).toBe('table');
  });
});

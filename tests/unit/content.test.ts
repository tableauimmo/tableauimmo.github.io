import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { CATEGORY_LIST } from '../../src/data/categories.ts';
import { TOOL_LIST } from '../../src/data/tools.ts';
import { episodeFileSchema, lexiconObject } from '../../src/lib/schemas.ts';
import { OG_IMAGES } from '../../src/data/og.ts';
import { loadEpisodes } from '../../scripts/lib/store.ts';

const LEXICON_DIR = 'src/content/lexique';

async function lexicon(): Promise<{ id: string; data: Record<string, unknown>; body: string }[]> {
  const files = (await readdir(LEXICON_DIR)).filter((file) => file.endsWith('.md')).sort();
  return Promise.all(
    files.map(async (file) => {
      const source = await readFile(path.join(LEXICON_DIR, file), 'utf8');
      const [, yaml = '', body = ''] = source.split(/^---$/m);
      return { id: file.replace(/\.md$/, ''), data: parseYaml(yaml) as Record<string, unknown>, body };
    }),
  );
}

describe('lexique', async () => {
  const terms = await lexicon();
  const ids = new Set(terms.map((term) => term.id));

  it('contient les 30 termes attendus', () => {
    expect(terms).toHaveLength(30);
    for (const id of ['lmnp', 'lmp', 'sci-a-l-ir', 'sci-a-l-is', 'jeanbrun', 'hcsf', 'ptz', 'loi-le-meur', 'compromis-de-vente', 'prelevements-sociaux']) expect(ids).toContain(id);
  });

  it.each(terms.map((term) => [term.id, term] as const))('%s : fiche valide, sourcée et datée', (_id, term) => {
    const parsed = lexiconObject().safeParse(term.data);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    for (const related of (term.data.related as string[] | undefined) ?? []) expect(ids, `terme lié inconnu : ${related}`).toContain(related);
    for (const source of term.data.sources as { url: string }[]) expect(source.url).toMatch(/^https:\/\/(?:www\.)?(legifrance\.gouv\.fr|bofip\.impots\.gouv\.fr|impots\.gouv\.fr|economie\.gouv\.fr|service-public\.fr|anil\.org|ecologie\.gouv\.fr|inc-conso\.fr|banque-france\.fr|insee\.fr|paris\.notaires\.fr)\//);
    // Liens internes du texte : uniquement vers des pages qui existent.
    for (const [, target] of term.body.matchAll(/\]\((\/[^)]+)\)/g)) {
      const lexiconLink = target?.match(/^\/lexique\/([a-z0-9-]+)\/$/);
      if (lexiconLink) expect(ids, target).toContain(lexiconLink[1]);
      else expect(target).toMatch(/^\/(outils|categories|episodes|methode)\//);
    }
    expect(term.body.trim().length).toBeGreaterThan(400);
  });
});

describe('épisodes', () => {
  it('le site se construit sans aucun épisode (dossier vide toléré)', async () => {
    await expect(loadEpisodes('src/content/episodes')).resolves.toBeInstanceOf(Array);
  });

  it('les épisodes de démonstration respectent le schéma et contiennent une transcription', async () => {
    const episodes = await loadEpisodes('tests/fixtures/episodes');
    expect(episodes).toHaveLength(2);
    for (const { folder, frontmatter, body } of episodes) {
      const parsed = episodeFileSchema.safeParse(frontmatter);
      expect(parsed.success, `${folder} : ${JSON.stringify(parsed.error?.issues)}`).toBe(true);
      expect(body).toMatch(/^## Transcription$/m);
      expect(existsSync(path.join('tests/fixtures/episodes', folder, 'thumbnail.jpg'))).toBe(true);
    }
  });

  const valid = {
    number: 3,
    title: 'Un épisode de test',
    slug: 'un-episode-de-test',
    status: 'upcoming',
    summary: 'Un résumé suffisamment long pour respecter la règle des soixante-dix caractères minimum.',
    teaser: 'Une accroche de test assez longue.',
    category: 'fiscalite',
    keyTakeaways: ['Premier point à retenir.', 'Deuxième point à retenir.', 'Troisième point à retenir.'],
    tableau: { caption: 'Le tableau', columns: ['A', 'B'], rows: [['1', '2']] },
    sources: [{ title: 'Légifrance', url: 'https://www.legifrance.gouv.fr/' }],
  };

  it('accepte une fiche annoncée minimale', () => {
    expect(episodeFileSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    ['résumé trop court', { summary: 'Trop court.' }, 'summary'],
    ['résumé trop long', { summary: 'x'.repeat(161) }, 'summary'],
    ['thème inconnu', { category: 'crypto' }, 'category'],
    ['tableau mal formé', { tableau: { caption: 'Le tableau', columns: ['A', 'B'], rows: [['1']] } }, 'tableau'],
    ['publié sans vidéo', { status: 'published', publishedAt: '2026-10-01' }, 'youtubeId'],
    ['chapitres dans le désordre', { chapters: [{ t: '0:00', title: 'Début' }, { t: '2:00', title: 'B' }, { t: '1:00', title: 'C' }] }, 'chapters'],
    ['premier chapitre après 0:00', { chapters: [{ t: '0:10', title: 'Début' }, { t: '2:00', title: 'Suite' }] }, 'chapters'],
    ['source non sécurisée', { sources: [{ title: 'Source', url: 'http://exemple.fr/' }] }, 'sources'],
    ['slug invalide', { slug: 'Un Slug' }, 'slug'],
  ])('refuse une fiche invalide : %s', (_label, change, field) => {
    const parsed = episodeFileSchema.safeParse({ ...valid, ...change });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues.map((issue) => issue.path[0])).toContain(field);
  });
});

describe('métadonnées des pages', () => {
  it('descriptions des thèmes et des calculateurs : 70 à 160 caractères', () => {
    for (const item of [...CATEGORY_LIST, ...TOOL_LIST]) {
      expect(item.description.length, item.description).toBeGreaterThanOrEqual(70);
      expect(item.description.length, item.description).toBeLessThanOrEqual(160);
    }
  });

  it('toutes les images de partage existent (npm run assets:og)', () => {
    for (const name of OG_IMAGES) expect(existsSync(`public/og/${name}.jpg`), name).toBe(true);
    for (const icon of ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png']) expect(existsSync(`public/${icon}`), icon).toBe(true);
  });
});

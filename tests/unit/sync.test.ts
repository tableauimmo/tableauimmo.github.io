import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseFeed } from '../../scripts/lib/feed.ts';
import { episodeNumberIn, loadEpisodes, matchUpcoming, parseEpisodeFile, publishUpcoming, serializeEpisode, type EpisodeFile } from '../../scripts/lib/store.ts';
import { parseStudioEpisode, studioToEpisodeFile } from '../../scripts/lib/studio.ts';
import { episodeFileSchema } from '../../src/lib/schemas.ts';

const upcoming = (number: number, title: string, slug = `ep-${number}`): EpisodeFile => ({
  dir: `/tmp/ep${number}`,
  folder: `ep0${number}-${slug}`,
  frontmatter: { number, title, slug, status: 'upcoming', summary: 'Résumé', chapters: [] },
  body: '\n## Article\n',
});

const video = (title: string, description = '') => ({ youtubeId: 'TIfixture02', title, description, publishedAt: new Date('2026-10-14T16:00:00Z') });

describe('flux YouTube', () => {
  it('lit les vidéos et repère les Shorts', async () => {
    const videos = parseFeed(await readFile('tests/fixtures/feed.xml', 'utf8'));
    expect(videos.map((item) => [item.youtubeId, item.isShort])).toEqual([
      ['TIshort0001', true],
      ['TIunknown01', false],
      ['TIfixture02', false],
      ['TIfixture01', false],
    ]);
    expect(videos[2]?.description).toContain('0:28 Le micro-BIC en 2026');
    expect(videos[2]?.publishedAt.toISOString()).toBe('2026-10-14T16:00:00.000Z');
  });

  it('accepte un flux vide et refuse un document qui n’est pas un flux', () => {
    expect(parseFeed('<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Tableau Immo</title></feed>')).toEqual([]);
    expect(() => parseFeed('<html></html>')).toThrow(/feed/);
  });
});

describe('rapprochement vidéo ↔ fiche préparée', () => {
  const fiches = [upcoming(1, 'Rendement brut ou net', 'rendement-brut-ou-net'), upcoming(2, 'LMNP en 2026', 'lmnp-2026')];

  it('par le lien de la page dans la description (le plus fiable)', () => {
    expect(matchUpcoming(video('Un autre titre', 'Tout est ici : https://tableauimmo.github.io/episodes/lmnp-2026/'), fiches)?.folder).toBe('ep02-lmnp-2026');
  });

  it('par le titre', () => {
    expect(matchUpcoming(video('Rendement brut ou net : le calcul | Tableau Immo'), fiches)?.folder).toBe('ep01-rendement-brut-ou-net');
  });

  it('par le numéro d’épisode', () => {
    expect(matchUpcoming(video('Nouveau titre', 'Épisode 2 de la chaîne'), fiches)?.folder).toBe('ep02-lmnp-2026');
    expect(episodeNumberIn('Tableau Immo – Épisode 12')).toBe(12);
    expect(episodeNumberIn('EP03 : la SCI')).toBe(3);
    expect(episodeNumberIn('Sans numéro')).toBeNull();
  });

  it('aucune correspondance, ou refus de deviner entre deux fiches', () => {
    expect(matchUpcoming(video('Questions des abonnés'), fiches)).toBeNull();
    expect(() => matchUpcoming(video('Doublon'), [upcoming(1, 'Doublon'), upcoming(2, 'Doublon')])).toThrow(/plusieurs/);
  });
});

describe('publication d’une fiche', () => {
  it('garde le contenu éditorial, ajoute la vidéo et les chapitres de la description', () => {
    const file = publishUpcoming(upcoming(2, 'LMNP en 2026'), { ...video('LMNP en 2026', '0:00 A\n0:28 B\n3:15 C'), duration: 'PT10M5S' });
    expect(file.frontmatter).toMatchObject({ status: 'published', youtubeId: 'TIfixture02', publishedAt: '2026-10-14T16:00:00.000Z', duration: 'PT10M5S', summary: 'Résumé' });
    expect(file.frontmatter.chapters).toEqual([
      { t: '0:00', title: 'A' },
      { t: '0:28', title: 'B' },
      { t: '3:15', title: 'C' },
    ]);
  });

  it('relit ce qu’elle écrit', () => {
    const original = upcoming(1, 'Rendement : brut ou net ?');
    const reread = parseEpisodeFile(serializeEpisode(original), original.folder, original.dir);
    expect(reread.frontmatter).toEqual(original.frontmatter);
    expect(reread.body.trim()).toBe(original.body.trim());
  });

  it('synchronisation complète sur le flux de démonstration (dossier temporaire)', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'ti-sync-'));
    await cp('tests/fixtures/episodes', dir, { recursive: true });
    const run = spawnSync(process.execPath, ['scripts/youtube-sync.ts', '--feed', 'tests/fixtures/feed.xml', '--episodes-dir', dir], { encoding: 'utf8' });
    expect(run.status, run.stderr).toBe(0);
    expect(run.stdout).toContain('Short ignoré');
    expect(run.stdout).toContain('Vidéo sans fiche préparée');
    const episodes = await loadEpisodes(dir);
    const ep02 = episodes.find((episode) => episode.frontmatter.slug === 'lmnp-2026-ce-qui-change');
    expect(ep02?.frontmatter).toMatchObject({ status: 'published', youtubeId: 'TIfixture02', thumbnail: './thumbnail.jpg' });
    expect(episodeFileSchema.safeParse(ep02?.frontmatter).success).toBe(true);
    expect((ep02?.frontmatter.chapters as unknown[]).length).toBe(5);
    expect(episodes).toHaveLength(2);
  });

  it('sans identifiant de chaîne, la synchro s’arrête proprement', () => {
    const run = spawnSync(process.execPath, ['scripts/youtube-sync.ts', '--episodes-dir', 'tests/fixtures/episodes'], { encoding: 'utf8' });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('YOUTUBE.channelId est vide');
  });
});

describe('ajout d’un épisode depuis le studio (site_episode.json)', () => {
  const studio = {
    number: 4,
    slug: 'sci-is-ou-ir',
    title: 'SCI à l’IS ou à l’IR : le match au tableau',
    summary: 'Impôt, amortissement, revente : ce qui change vraiment entre une SCI à l’IR et une SCI à l’IS, chiffres à l’appui.',
    teaser: 'Deux SCI, un même immeuble, deux fiscalités : le match au tableau.',
    category: 'patrimoine',
    tags: ['SCI'],
    keyTakeaways: ['La SCI à l’IR est transparente.', 'La SCI à l’IS amortit le bien.', 'La revente coûte plus cher à l’IS.'],
    tableau: { caption: 'SCI à l’IR ou à l’IS', columns: ['Critère', 'IR', 'IS'], rows: [['Amortissement', 'non', 'oui']] },
    chapters: [{ t: '0:00', title: 'L’accroche' }],
    sources: [{ title: 'impots.gouv.fr', url: 'https://www.impots.gouv.fr/professionnel/questions/comment-declarer-les-resultats-de-ma-sci', date: '2026-10-15' }],
    terms: ['sci-a-l-ir', 'sci-a-l-is'],
    updatedAt: '2026-10-15',
    thumbnail: 'miniature.jpg',
    article: '## Le match\n\nUne SCI à l’IR et une SCI à l’IS ne paient pas l’impôt de la même façon.',
    transcript: 'Deux sociétés, un même immeuble. Laquelle paie le moins d’impôt ? Posons-le au tableau.',
  };

  it('valide le JSON et produit une fiche « bientôt sur YouTube »', () => {
    const file = studioToEpisodeFile(parseStudioEpisode(studio), '/tmp/episodes', { thumbnailName: 'thumbnail.jpg' });
    expect(file.folder).toBe('ep04-sci-is-ou-ir');
    expect(file.frontmatter).toMatchObject({ status: 'upcoming', thumbnail: './thumbnail.jpg', category: 'patrimoine' });
    expect(file.body).toContain('## Transcription\n\nDeux sociétés');
  });

  it('explique chaque erreur du JSON', () => {
    expect(() => parseStudioEpisode({ ...studio, summary: 'court', category: 'crypto' })).toThrow(/summary[\s\S]*category/);
  });

  it('commande complète : copie la miniature et refuse d’écraser sans --force', async () => {
    const work = await mkdtemp(path.join(tmpdir(), 'ti-add-'));
    const publication = path.join(work, 'ep04_sci-is-ou-ir', 'publication');
    await mkdir(publication, { recursive: true });
    await cp('tests/fixtures/episodes/ep01-rendement-brut-ou-net/thumbnail.jpg', path.join(publication, 'miniature.jpg'));
    await writeFile(path.join(publication, 'site_episode.json'), JSON.stringify(studio));
    const episodesDir = path.join(work, 'episodes');
    const add = (...extra: string[]) => spawnSync(process.execPath, ['scripts/episode-add.ts', path.join(work, 'ep04_sci-is-ou-ir'), '--episodes-dir', episodesDir, ...extra], { encoding: 'utf8' });
    const first = add();
    expect(first.status, first.stderr).toBe(0);
    expect(existsSync(path.join(episodesDir, 'ep04-sci-is-ou-ir', 'thumbnail.jpg'))).toBe(true);
    const [created] = await loadEpisodes(episodesDir);
    expect(episodeFileSchema.safeParse(created?.frontmatter).success).toBe(true);
    expect(add().status).toBe(1);
    const published = add('--force', '--youtube', 'https://youtu.be/TIfixture04', '--date', '2026-10-20');
    expect(published.status, published.stderr).toBe(0);
    const [updated] = await loadEpisodes(episodesDir);
    expect(updated?.frontmatter).toMatchObject({ status: 'published', youtubeId: 'TIfixture04', publishedAt: '2026-10-20T12:00:00.000Z' });
    // La date de mise à jour (15/10) précède la publication (20/10) : elle est retirée.
    expect(updated?.frontmatter.updatedAt).toBeUndefined();
  });
});

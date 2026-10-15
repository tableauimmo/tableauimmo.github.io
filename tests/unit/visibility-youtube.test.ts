import { describe, expect, it } from 'vitest';
import { parseFeed } from '../../scripts/lib/feed.ts';
import { indexNowPayload, keyFileUrl } from '../../scripts/visibility/indexnow.ts';
import { parseSuggestions } from '../../scripts/visibility/suggestions.ts';
import { auditVideo, videoEntry, type EpisodeLink } from '../../scripts/visibility/youtube.ts';

const EPISODE: EpisodeLink = { numero: 1, url: 'https://tableauimmo.github.io/episodes/rendement-brut-ou-net/', youtubeId: 'TIfixture01' };
const GOOD_DESCRIPTION = `Pourquoi un studio affiché à 6 % rapporte souvent moins de 4,5 %.
▶ Le tableau, les sources et la transcription : https://tableauimmo.github.io/episodes/rendement-brut-ou-net/
0:00 L'accroche
0:32 Le rendement des annonces
2:05 Le vrai coût d'achat
Illustrations et voix générées avec l’aide de l’IA ; contenu vérifié et sourcé.
#immobilier #investissementlocatif #tableauimmo`;

describe('flux YouTube', () => {
  it('lit le nombre de vues publié dans le flux', () => {
    const xml = `<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/"><entry>
      <yt:videoId>TIfixture01</yt:videoId><title>Rendement brut ou net | Tableau Immo</title>
      <link rel="alternate" href="https://www.youtube.com/watch?v=TIfixture01"/><published>2026-10-20T16:00:00+00:00</published>
      <media:group><media:description>Description</media:description>
        <media:community><media:starRating count="12" average="5.00" min="1" max="5"/><media:statistics views="1234"/></media:community>
      </media:group></entry></feed>`;
    expect(parseFeed(xml)[0]).toMatchObject({ youtubeId: 'TIfixture01', views: 1234, isShort: false });
  });
});

describe('contrôle des vidéos', () => {
  it('une vidéo d’épisode bien renseignée n’a aucun problème', () => {
    expect(auditVideo({ title: 'Rendement brut ou net | Tableau Immo', description: GOOD_DESCRIPTION, isShort: false, tags: ['tableau immo'], madeForKids: false }, EPISODE)).toEqual([]);
  });

  it('signale ce qui fait perdre des vues et des visites, avec la correction à faire', () => {
    const problems = auditVideo({ title: 'Rendement brut ou net : le calcul que les annonces oublient toujours, au tableau', description: 'Un épisode.', isShort: false, tags: [], madeForKids: true }, EPISODE);
    expect(problems.map((problem) => problem.code)).toEqual(['titre-sans-marque', 'titre-long', 'audience-enfants', 'hashtags-absents', 'tags-absents', 'mention-ia-absente', 'lien-site-absent', 'chapitres-absents']);
    expect(problems.find((problem) => problem.code === 'lien-site-absent')?.correction).toContain(EPISODE.url);
  });

  it('les Shorts et les vidéos hors épisode ne demandent ni lien ni chapitres', () => {
    expect(auditVideo({ title: 'Le piège du rendement brut | Tableau Immo #shorts', description: '#immobilier', isShort: true }, undefined)).toEqual([]);
    expect(auditVideo({ title: 'Bande-annonce | Tableau Immo', description: 'Voix générée avec l’aide de l’IA. #tableauimmo', isShort: false }, undefined)).toEqual([]);
  });

  it('associe les statistiques de l’API et le numéro d’épisode', () => {
    const entry = videoEntry(
      { youtubeId: 'TIfixture01', title: 'Rendement brut ou net | Tableau Immo', description: GOOD_DESCRIPTION, publishedAt: new Date('2026-10-20T16:00:00Z'), url: 'https://www.youtube.com/watch?v=TIfixture01', isShort: false, views: 10 },
      { id: 'TIfixture01', snippet: { tags: ['tableau immo'] }, statistics: { viewCount: '1500', likeCount: '80', commentCount: '4' }, status: { madeForKids: false } },
      EPISODE,
    );
    expect(entry).toEqual({ id: 'TIfixture01', titre: 'Rendement brut ou net | Tableau Immo', publieeLe: '2026-10-20T16:00:00.000Z', short: false, vues: 1500, jaime: 80, commentaires: 4, episode: 1, problemes: [] });
  });
});

describe('suggestions de recherche', () => {
  it('lit la réponse de l’autocomplétion', () => {
    expect(parseSuggestions(['rendement locatif', ['rendement locatif net', 'rendement locatif calcul'], [], {}])).toEqual(['rendement locatif net', 'rendement locatif calcul']);
    expect(() => parseSuggestions({ erreur: true })).toThrow(/inattendue/);
  });
});

describe('IndexNow', () => {
  const KEY = 'eb812ec57786993cc265c5bb9c1acaa4';

  it('prépare un envoi conforme au protocole', () => {
    expect(indexNowPayload('https://tableauimmo.github.io', KEY, ['https://tableauimmo.github.io/', 'https://tableauimmo.github.io/outils/', 'https://tableauimmo.github.io/'])).toEqual({
      host: 'tableauimmo.github.io',
      key: KEY,
      keyLocation: `https://tableauimmo.github.io/${KEY}.txt`,
      urlList: ['https://tableauimmo.github.io/', 'https://tableauimmo.github.io/outils/'],
    });
    expect(keyFileUrl('https://tableauimmo.github.io', KEY)).toBe(`https://tableauimmo.github.io/${KEY}.txt`);
  });

  it('refuse les adresses hors du site ou invalides', () => {
    expect(() => indexNowPayload('https://tableauimmo.github.io', KEY, [])).toThrow(/Aucune adresse/);
    expect(() => indexNowPayload('https://tableauimmo.github.io', KEY, ['https://exemple.com/'])).toThrow(/hors du site/);
    expect(() => indexNowPayload('https://tableauimmo.github.io', KEY, ['http://tableauimmo.github.io/'])).toThrow(/hors du site/);
    expect(() => indexNowPayload('https://tableauimmo.github.io', KEY, ['pas une adresse'])).toThrow(/invalide/);
  });
});

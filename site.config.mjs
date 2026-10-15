// Configuration centrale du site Tableau Immo — SOURCE UNIQUE.
// Utilisée par astro.config.mjs, le code du site, les tests et les scripts (synchro YouTube, visibilité).
//
// Passer à un domaine personnalisé (ex. tableauimmo.fr) : changer DEFAULT_SITE_URL ci-dessous
// (et garder BASE_PATH = '/'), puis créer public/CNAME (voir README, « Domaine personnalisé »).

/** Adresse publique du site, sans « / » final. */
const DEFAULT_SITE_URL = 'https://tableauimmo.github.io';

/**
 * Chemin de base du site : « / » pour un site à la racine du domaine (GitHub Pages d'organisation
 * ou domaine personnalisé), « /nom-du-depot/ » pour un site de projet GitHub Pages.
 */
const BASE_PATH = '/';

/** URL publique du site. Surchargeable par la variable SITE_URL (prévisualisation). */
function resolveSiteUrl() {
  const raw = process.env.SITE_URL?.trim() || DEFAULT_SITE_URL;
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`SITE_URL invalide : « ${raw} » (attendu : https://domaine.tld)`);
  }
  if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    throw new Error(`SITE_URL doit être en https : « ${raw} »`);
  }
  return url.origin;
}

function normalizeBase(base) {
  const trimmed = `/${base}/`.replace(/\/{2,}/g, '/');
  if (!/^\/(?:[a-z0-9._-]+\/)*$/i.test(trimmed)) throw new Error(`BASE_PATH invalide : « ${base} »`);
  return trimmed;
}

export const SITE = Object.freeze({
  url: resolveSiteUrl(),
  base: normalizeBase(BASE_PATH),
  name: 'Tableau Immo',
  shortName: 'Tableau Immo',
  tagline: "L'investissement immobilier en France, expliqué au tableau.",
  locale: 'fr-FR',
  language: 'fr',
  themeColor: '#141516',
  contactEmail: 'tableauimmo@gmail.com',
  /** Auteur des commits automatiques (synchro YouTube). */
  gitAuthor: Object.freeze({ name: 'Tableau Immo', email: 'tableauimmo@gmail.com' }),
});

/**
 * Lecteur vidéo des pages d'épisode :
 *  - 'facade' : vignette + bouton (rapide, aucune requête vers YouTube avant le clic) ;
 *  - 'iframe' : lecteur youtube-nocookie chargé dès l'ouverture (meilleure détection par Google Vidéos).
 */
export const VIDEO_EMBED = 'facade';

/** Chaîne YouTube. channelId vide = synchronisation désactivée (le script s'arrête proprement). */
export const YOUTUBE = Object.freeze({
  /** Identifiant « UC… » de la chaîne (YouTube Studio → Paramètres → Chaîne → Paramètres avancés). */
  channelId: '',
  handle: '@TableauImmo',
  get channelUrl() {
    return this.channelId ? `https://www.youtube.com/channel/${this.channelId}` : `https://www.youtube.com/${this.handle}`;
  },
  get subscribeUrl() {
    return `${this.channelUrl}?sub_confirmation=1`;
  },
  /** Flux Atom public de la chaîne (null tant que channelId est vide). */
  get feedUrl() {
    return this.channelId ? `https://www.youtube.com/feeds/videos.xml?channel_id=${this.channelId}` : null;
  },
});

/**
 * Réseaux sociaux (ordre d'affichage). `verified: false` = adresse provisoire : le lien est affiché
 * mais n'est pas déclaré aux moteurs (sameAs des données structurées). Passer à true une fois le compte créé.
 */
export const SOCIAL = Object.freeze([
  { id: 'youtube', label: 'YouTube', url: YOUTUBE.subscribeUrl, verified: false },
  { id: 'tiktok', label: 'TikTok', url: 'https://www.tiktok.com/@tableauimmo', verified: false },
  { id: 'instagram', label: 'Instagram', url: 'https://www.instagram.com/tableauimmo/', verified: false },
  { id: 'facebook', label: 'Facebook', url: 'https://www.facebook.com/tableauimmo', verified: false },
  { id: 'linkedin', label: 'LinkedIn', url: 'https://www.linkedin.com/company/tableauimmo/', verified: false },
  { id: 'x', label: 'X', url: 'https://x.com/tableauimmo', verified: false },
]);

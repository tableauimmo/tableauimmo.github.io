# Routine de visibilité (SEO + GEO)

Une routine lancée à la main. Elle mesure la visibilité de Tableau Immo (Google, YouTube, réponses des IA),
contrôle la fraîcheur des pages financières, apprend de ses essais passés, améliore le site et dit quoi faire ensuite.

## Lancer la routine

- **Dans Claude Code**, à la racine du site : `/visibilite`.
- **Collecte seule**, sans actions : `npm run visibilite` (rapport dans `visibilite/rapports/`).

À relancer juste après chaque nouvel épisode, et au moins une fois par mois (fraîcheur des règles fiscales).

## Ce que fait un passage

1. Synchronise les épisodes avec la chaîne YouTube.
2. Sonde les IA (recherche web, Perplexity, ChatGPT) : Tableau Immo est-il cité pour les questions des investisseurs ?
3. Collecte toutes les sources connectées, calcule le score de visibilité et les opportunités classées,
   dont les pages à revérifier (dates de vérification trop anciennes, règles « à surveiller »).
4. Apprend : chaque expérience arrivée à échéance (28 jours) reçoit un verdict chiffré, noté dans `playbook.md`.
5. Agit : corrections, mises à jour datées, au plus 3 expériences mesurables ; `npm run verify` ; mise en ligne.
6. Prévient les moteurs : IndexNow (Bing, Copilot, ChatGPT…), sitemaps et demandes d’indexation Google.
7. Prépare les textes que seul le propriétaire publie (YouTube, réseaux), sans jamais rien envoyer.

## Fichiers

| Fichier | Rôle |
|---|---|
| `config.json` | Propriété Search Console, clé IndexNow (servie par `public/<clé>.txt`), pages mesurées, limites |
| `cibles.json` | Requêtes Google/YouTube et questions aux IA suivies ; la routine en ajoute |
| `experiences.json` | Journal des expériences : hypothèse, mesure avant, verdict après 28 jours |
| `playbook.md` | Mémoire : règles, tactiques, leçons apprises, évolutions de la routine |
| `geo/AAAA-MM-JJ.json` | Sondages des IA |
| `historique/*.json` | Instantanés complets de chaque passage (comparaisons) |
| `rapports/*.md` | Rapports lisibles de chaque passage |

Code : `scripts/visibility/` ; compétence : `.claude/skills/visibilite/SKILL.md`.

**Changement de domaine** : mettre à jour `searchConsoleProperty` (ex. `sc-domain:tableauimmo.fr`) en même temps
que `site.config.mjs`.

## Score de visibilité (sur 100)

| Partie | Poids | Calcul |
|---|---|---|
| Technique | 15 | 100 − 10 par erreur (max 60) − 2 par avertissement (max 40) |
| Performance | 10 | Score Lighthouse mobile moyen |
| Indexation | 20 | % des pages inspectées présentes dans Google |
| Audience Google | 25 | Impressions sur 28 jours, échelle logarithmique (10 000 = 100) |
| YouTube | 15 | 70 % vues (échelle logarithmique) + 30 % vidéos bien référencées |
| Réponses des IA | 15 | Nommés = 60 points, cités avec lien = 40 points, en moyenne par question |

Une source non connectée ne compte pas (le score indique sa couverture).

## Connecteurs

| Source | Sans configuration | Pour l’activer |
|---|---|---|
| Audit du site, suggestions, IndexNow, fraîcheur | actifs | — |
| Flux YouTube | inactif | `YOUTUBE.channelId` dans `site.config.mjs` |
| Performance | Lighthouse local si installé (`npm install --no-save lighthouse chrome-launcher`) | Clé Google : PageSpeed Insights |
| YouTube détaillé, Knowledge Graph | — | Clé Google (`GOOGLE_API_KEY` dans `.env`) |
| Google Search Console | — | Compte de service (`.secrets/search-console.json`) |

### Clé Google et compte de service (une fois, environ 10 minutes)

Tout se fait avec le compte tableauimmo@gmail.com, sans aucun nom personnel.

1. [console.cloud.google.com](https://console.cloud.google.com) : créer un projet « tableau-immo-visibilite ».
2. Activer : Google Search Console API, PageSpeed Insights API, YouTube Data API v3, Knowledge Graph Search API.
3. Créer une clé API (restreinte à PageSpeed, YouTube Data et Knowledge Graph) et l’écrire dans `.env` :
   `GOOGLE_API_KEY=…` (jamais versionné).
4. Créer un compte de service « visibilite » (sans rôle), ajouter une clé JSON, l’enregistrer sous
   `.secrets/search-console.json` (jamais versionné).
5. Dans Search Console → propriété du site → Paramètres → Utilisateurs : ajouter l’adresse du compte de service
   (…@…iam.gserviceaccount.com), autorisation « Totale ».

### Bing Webmaster Tools

Se connecter avec tableauimmo@gmail.com puis « Importer depuis Google Search Console ». Les envois IndexNow
fonctionnent même sans ce compte.

## Confidentialité

Le dépôt du site est **public** : les instantanés (`historique/`), rapports (`rapports/`) et sondages (`geo/`)
restent sur la machine (ignorés par Git). Seuls la configuration, les cibles, le journal des expériences et le
playbook sont versionnés. Aucune donnée personnelle de visiteur (Search Console ne donne que des totaux).
Les identifiants (`.env`, `.secrets/`) ne sont jamais versionnés.

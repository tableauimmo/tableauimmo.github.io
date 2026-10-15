# Tableau Immo — le site

Site de la chaîne **Tableau Immo** (YouTube, TikTok, Instagram, Facebook, LinkedIn, X) : l'investissement immobilier
en France expliqué au tableau. Pages des épisodes (vidéo, « le tableau de l'épisode », points clés, chapitres, FAQ,
sources officielles, transcription), 4 calculateurs, un lexique de 30 définitions sourcées, et tout ce qu'il faut pour
Google et les moteurs de réponse IA (données structurées, sitemaps, `llms.txt`).

- **Technique** : [Astro 7](https://astro.build), 100 % statique, TypeScript strict. Aucun cookie, aucun pistage,
  aucune publicité. Polices auto-hébergées (`@fontsource`). JavaScript seulement pour les calculateurs, le filtre du
  lexique et le lecteur vidéo (amélioration progressive : tout reste lisible sans).
- **Hébergement** : GitHub Pages, déployé par GitHub Actions à chaque mise à jour de `main`.
- **Contact** : tableauimmo@gmail.com. Le site est signé « Tableau Immo » : aucun nom de personne.

## Commandes

| Commande | Rôle |
|---|---|
| `npm ci` | Installe les dépendances (Node ≥ 22.12, voir `.nvmrc`) |
| `npm run dev` | Site en local avec rechargement (http://localhost:4321) |
| `npm run build` | Construit le site dans `dist/` (échoue si un contenu est invalide) |
| `npm run preview` | Sert `dist/` (http://localhost:4321) |
| `npm run check` | Vérification TypeScript et contenu (`astro check`) |
| `npm test` | Tests unitaires (Vitest) : calculateurs, schémas, synchro YouTube, visibilité… |
| `npm run test:e2e` | Construit le site réel et le site de démonstration, puis tests de bout en bout (Playwright) |
| `npm run verify` | Tout ce qui précède : à lancer avant chaque commit |
| `npm run episode:add -- <site_episode.json>` | Crée la fiche d'un épisode à partir du fichier du studio |
| `npm run sync:youtube` | Publie les fiches dont la vidéo est sortie (aussi fait toutes les heures par GitHub Actions) |
| `npm run assets:og` | Régénère les images de partage (`public/og/`) et les icônes |
| `npm run screens -- / /outils/` | Captures d'écran ordinateur et mobile dans `.screens/` (contrôle visuel) |
| `npm run visibilite` | Mesure de visibilité SEO/GEO (voir `visibilite/README.md`) |
| `npm run visibilite:soumettre -- indexnow --toutes` | Envoie les pages à IndexNow (Bing, Copilot, ChatGPT…) |

Tests de bout en bout : Playwright utilise le Chromium installé par `npx playwright install chromium`, ou
`/opt/pw-browsers/chromium` s'il existe (variable `PW_CHROMIUM_PATH` pour un autre chemin).

## Organisation

```
site.config.mjs              SOURCE UNIQUE : URL du site, chemin de base, chaîne YouTube, réseaux, lecteur vidéo
astro.config.mjs             Astro : sitemap, CSP, Markdown (plugins), typographie française
src/content.config.ts        schémas du contenu (un contenu invalide fait échouer le build)
src/content/episodes/        une fiche par épisode : <epNN-slug>/index.md + thumbnail.jpg (vide au départ)
src/content/lexique/         les 30 termes du lexique (Markdown, sources officielles, date de vérification)
src/data/                    thèmes (8), calculateurs (4), mentions légales, images de partage
src/tools/<outil>/logic.ts   logique pure des calculateurs (testée) ; tool.ts = champs + rendu du résultat
src/tools/shared/            nombres à la française, validation, interface (amélioration progressive)
src/lib/                     épisodes, JSON-LD, SEO, YouTube, adresses, llms.txt, plugins Markdown
src/components/, layouts/    composants (tableau noir, notes scotchées, lecteur, FAQ, sources…)
src/pages/                   pages + robots.txt, rss.xml, video-sitemap.xml, llms.txt, llms-full.txt, manifest
src/styles/                  identité visuelle (global.css) et composants partagés (components.css)
scripts/                     ajout d'épisode, synchro YouTube, site de démonstration, captures, visibilité, images
tests/unit, tests/e2e        Vitest et Playwright ; tests/fixtures = 2 épisodes et un flux YouTube de démonstration
visibilite/                  routine SEO/GEO : configuration, cibles, expériences, playbook (mesures locales)
.claude/skills/visibilite/   la routine « /visibilite » pour Claude Code
studio/                      dépôt PRIVÉ séparé du studio vidéo (ignoré par Git, jamais publié)
```

## Publier un épisode

1. **Le studio produit le fichier du site** : `studio/TableauImmo_Studio/episodes/epNN_slug/publication/site_episode.json`
   (format ci-dessous), avec la miniature à côté.
2. **Créer la fiche** (statut « upcoming » : l'épisode apparaît comme « Bientôt sur YouTube ») :
   ```bash
   npm run episode:add -- studio/TableauImmo_Studio/episodes/ep01_mon-sujet
   npm run verify
   git add src/content/episodes && git commit -m "Épisode 1 : fiche préparée" && git push
   ```
3. **Publier la vidéo sur YouTube** avec, dans la description, le lien de la page :
   `https://<site>/episodes/<slug>/` (c'est ce lien qui relie la vidéo à la fiche), les chapitres (`0:00 …`, au
   moins 3), les sources et la mention « Illustrations et voix générées avec l'aide de l'IA ; contenu vérifié et sourcé ».
4. **C'est automatique** : toutes les heures, le workflow « Synchronisation YouTube » lit le flux de la chaîne, passe la
   fiche en « published » (identifiant, date, durée si `YOUTUBE_API_KEY`, chapitres de la description si la fiche n'en a
   pas), vérifie le site, enregistre le changement (auteur « Tableau Immo ») et redéploie.
   - Une vidéo sans fiche préparée n'est **pas** publiée sur le site (contenu financier : il doit être relu et sourcé).
   - Pour publier sans attendre : `npm run episode:add -- <…> --force --youtube <lien> --date AAAA-MM-JJ`.
   - Tant que `YOUTUBE.channelId` est vide dans `site.config.mjs`, la synchro s'arrête proprement sans rien faire.

### Format de `site_episode.json`

```json
{
  "number": 1,
  "slug": "rendement-brut-ou-net",
  "title": "Rendement brut ou net : le calcul que les annonces oublient",
  "summary": "Description Google : 70 à 160 caractères, obligatoire.",
  "teaser": "Accroche des cartes (20 à 240 caractères).",
  "category": "strategie",
  "tags": ["rendement", "studio"],
  "keyTakeaways": ["3 à 7 points clés (« En bref »)…"],
  "tableau": {
    "caption": "Studio à 150 000 € : du brut au net",
    "columns": ["Étape", "Calcul", "Résultat"],
    "rows": [["Loyers annuels", "750 € × 12", "9 000 €"], ["Rendement net", "7 234 ÷ 162 000", "**4,47 %**"]],
    "note": "Cas d'école, chiffres arrondis."
  },
  "chapters": [{ "t": "0:00", "title": "L'accroche" }, { "t": "0:32", "title": "Le rendement des annonces" }],
  "faq": [{ "q": "Question ?", "a": "Réponse complète." }],
  "sources": [{ "title": "Titre — site officiel", "url": "https://www.legifrance.gouv.fr/…", "date": "2026-10-15" }],
  "tools": ["rendement", "cashflow"],
  "terms": ["rendement-brut", "rendement-net"],
  "duration": "PT10M24S",
  "updatedAt": "2026-10-15",
  "thumbnail": "miniature.jpg",
  "shorts": [{ "platform": "tiktok", "url": "https://www.tiktok.com/@tableauimmo/video/…" }],
  "article": "## Intertitre\n\nTexte de l'article (Markdown).",
  "transcript": "Texte intégral dit par le narrateur."
}
```

- `category` : `financement`, `fiscalite`, `strategie`, `marche`, `juridique`, `travaux`, `location`, `patrimoine`.
- `tools` : `credit`, `capacite`, `rendement`, `cashflow` (lien « voir l'épisode lié » sur la page du calculateur).
- `terms` : identifiants des fichiers de `src/content/lexique/` (sans `.md`).
- Dans `tableau.rows`, une cellule `**entre doubles astérisques**` est un chiffre clé (craie jaune).
- `thumbnail` : chemin relatif au JSON (jpg, png ou webp, 16:9, 1280×720 conseillé).
- Facultatifs : `tags`, `chapters`, `faq`, `tools`, `terms`, `duration`, `updatedAt`, `thumbnail`, `shorts`.
  Le script valide tout et explique chaque erreur.

## Déploiement (GitHub Pages)

1. Créer le dépôt GitHub (compte de la chaîne) et pousser `main`.
2. Settings → Pages → Source : **GitHub Actions**.
3. Le workflow « Déploiement » (`.github/workflows/deploy.yml`) vérifie tout (`npm run verify`) puis publie `dist/`.
4. Secret facultatif pour la synchro : `YOUTUBE_API_KEY` (durée exacte des vidéos).

Adresse par défaut : `https://tableauimmo.github.io` (dépôt nommé `tableauimmo.github.io` sous un compte ou une
organisation `tableauimmo`). Pour un dépôt de projet (`https://<compte>.github.io/<depot>/`), mettre
`BASE_PATH = '/<depot>/'` dans `site.config.mjs` : tous les liens suivent (robots.txt n'est alors pas à la racine du
domaine, un domaine personnalisé est préférable).

### Domaine personnalisé (ex. tableauimmo.fr)

1. Dans `site.config.mjs` : `DEFAULT_SITE_URL = 'https://tableauimmo.fr'` (garder `BASE_PATH = '/'`). C'est le seul
   changement de code : canoniques, sitemaps, JSON-LD, flux et tests suivent.
2. Créer `public/CNAME` contenant une seule ligne : `tableauimmo.fr`.
3. Chez le registraire : enregistrements `A` vers les adresses de GitHub Pages (185.199.108.153, 185.199.109.153,
   185.199.110.153, 185.199.111.153) et `CNAME www` vers `<compte>.github.io`.
4. Settings → Pages → Custom domain : `tableauimmo.fr`, puis cocher « Enforce HTTPS ».
5. Mettre à jour `visibilite/config.json` (`searchConsoleProperty` : `sc-domain:tableauimmo.fr`), puis déclarer le
   domaine dans Google Search Console et Bing Webmaster Tools (compte tableauimmo@gmail.com) et soumettre
   `sitemap-index.xml` (et `video-sitemap.xml` dès le premier épisode publié).

## À renseigner dans `site.config.mjs`

- `YOUTUBE.channelId` : identifiant « UC… » de la chaîne (active la synchro horaire et le suivi YouTube).
- `YOUTUBE.handle` et `SOCIAL` : adresses définitives des comptes, puis `verified: true` pour les déclarer aux moteurs
  (`sameAs` des données structurées). Les adresses actuelles sont provisoires.
- `VIDEO_EMBED` : `'facade'` (par défaut, plus rapide) ou `'iframe'` (lecteur chargé dès l'ouverture, plus favorable à
  la détection par Google Vidéos).

## Contenu : règles

- **Pédagogique, sourcé, daté** : chaque règle renvoie à une source officielle (Légifrance, BOFiP, impots.gouv.fr,
  service-public.fr, economie.gouv.fr, Banque de France, INSEE, ANIL) ; chaque page porte sa date de vérification ;
  un projet de loi est signalé comme tel (encadré « À surveiller » du lexique, champ `watch`).
- **Jamais de conseil personnalisé**, risques toujours mentionnés, exemples chiffrés présentés comme des cas d'école.
- **IA déclarée** : « Illustrations et voix générées avec l'aide de l'IA ; contenu vérifié et sourcé ».
- La fiscalité change chaque année : la routine `/visibilite` signale les pages à revérifier.

## Mentions légales

Le site est signé « Tableau Immo » ; la page Mentions légales publie l'hébergeur (GitHub) et l'adresse de contact, en
s'appuyant sur le régime de l'éditeur **non professionnel** (LCEN, article 1-1, II). Ce régime n'est plus possible dès
qu'il y a une activité économique : si la chaîne est monétisée (revenus publicitaires YouTube, partenariats) ou exercée
dans un cadre professionnel, il faut publier l'identité de l'éditeur (nom ou dénomination sociale, adresse, numéro
SIREN/RCS, directeur de la publication) dans `src/data/legal.ts` et `src/pages/mentions-legales.astro`. À vérifier
avant la monétisation.

## Licence

Contenus (textes, tableaux, illustrations, vidéos, logo) : tous droits réservés. Polices : SIL Open Font License 1.1.
Voir [LICENSE.md](LICENSE.md).

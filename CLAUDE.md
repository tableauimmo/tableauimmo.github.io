# Projet : site de Tableau Immo

Spécificités de ce projet (s'ajoutent aux règles globales, ne les remplacent pas).

## Contexte
- Site de la chaîne « Tableau Immo » : l'investissement immobilier en France expliqué au tableau (épisodes de 10 min,
  calculateurs, lexique). Contenu financier (YMYL) : pédagogique, sourcé (sources officielles), daté, jamais de
  conseil personnalisé, risques toujours mentionnés, aucun rendement promis.
- Dossier `studio/` : dépôt **privé** séparé (moteur vidéo, voix, rendus), ignoré par Git. Ne rien y modifier ; seule
  la spécification commune `studio/TableauImmo_Studio/SPEC_COMMUNE.md` se lit (§0 identité, §2 identité visuelle).
- Design : tableau noir (ardoise `#1C2321`/`#26302D`), craie `#EDEDE6`, jaune `#F2D45C` (chiffres clés, appels à
  l'action), papier `#F3EBDD` + scotch (notes), orange `#EE8A5B` (mises en garde). Cabin Sketch pour un seul grand titre
  par page, Kalam pour les annotations, Inter pour tout le reste. Animations neutralisées si l'appareil demande moins
  de mouvement. Contraste AA partout (jaune jamais en texte sur fond clair : surligneur `.marker` à la place).

## Commandes
- Vérification complète avant de dire « fini » : `npm run verify` (types, unitaires, bout en bout).
- Le serveur de prévisualisation (`.claude/launch.json`, port 4321) sert `dist/` : relancer `npm run build` après une
  modification. Site de démonstration avec épisodes : `npm run build:fixture` puis
  `npx astro preview --ignore-lock --outDir dist-fixture --port 4322` (Astro 7 : `--ignore-lock` pour deux aperçus en même temps).
- Contrôle visuel : `npm run screens -- <chemins>` (ordinateur 1440 px et mobile 390 px, signale tout débordement
  horizontal), puis regarder les images de `.screens/`.

## Conventions
- **Source unique** : `site.config.mjs` (URL, chemin de base, chaîne YouTube, réseaux). Liens internes via `href()`,
  URL absolues via `absoluteUrl()` (`src/lib/url.ts`) : jamais d'URL du site écrite en dur.
- Contenu validé par `src/content.config.ts` et `src/lib/schemas.ts` (partagé avec les scripts) : un contenu invalide
  doit faire échouer le build, jamais casser une page.
- Toute page passe par `BaseLayout` → `Seo` (description de 70 à 160 caractères imposée au build, canonique avec
  « / » final). En-tête des pages intérieures : `PageHead` (tableau noir).
- Calculateurs : logique pure dans `src/tools/<outil>/logic.ts` (testée avec des valeurs connues), champs et rendu du
  résultat dans `tool.ts` (même rendu au build et dans le navigateur), interface dans `shared/ui.ts`.
- Chiffres : formatage via `src/tools/shared/numbers.ts` (espaces fines insécables, virgule décimale). La typographie
  française (espaces insécables avant « : ; ! ? ») est appliquée à tout le HTML à la fin du build
  (`src/lib/french-typography.mjs`) : écrire des espaces normales dans les sources.
- Markdown : processeur `unified` (`@astrojs/markdown-remark`) avec les plugins de `src/lib/markdown-plugins.mjs`.
  Une erreur de plugin peut produire une page vide sans faire échouer le build : les tests e2e vérifient que chaque
  terme du lexique a un corps. Après une erreur de rendu, vider le cache : `rm -rf node_modules/.astro`.
- Épisodes : fiche `src/content/episodes/<epNN-slug>/index.md`, créée par `npm run episode:add` depuis le JSON du studio ;
  le corps = article + `## Transcription` (repliée automatiquement). Le dossier peut être vide : le site doit se
  construire et rester utile sans épisode.
- Tests de bout en bout : le site réel (projets `site-*`) ne doit jamais dépendre de l'état des épisodes ; tout ce qui
  concerne les épisodes passe par le site de démonstration (`tests/fixtures/episodes` + `tests/fixtures/feed.xml`).
- Lexique : chaque terme a une définition d'une phrase (70-160 caractères), 1 à 3 sources officielles, `updatedAt`, et
  un encadré `watch` (avec date) si la règle est en discussion. Vérifier chaque chiffre sur la source avant de modifier.
- Images de partage : `npm run assets:og` (script Python reproductible), jamais retouchées à la main.
- Déploiement : GitHub Pages via `.github/workflows/deploy.yml` à chaque mise à jour de `main` ; synchro YouTube horaire
  (`youtube-sync.yml`) qui appelle le déploiement quand un épisode est publié.
- Git : auteur des commits `git config --local user.name "Tableau Immo"` / `user.email tableauimmo@gmail.com`
  (jamais l'identité Git globale de la machine).
- Routine de visibilité : `/visibilite` (`.claude/skills/visibilite/SKILL.md`), code dans `scripts/visibility/`, données
  dans `visibilite/` (instantanés et rapports locaux, ignorés par Git : le dépôt est public). Changement du format des
  instantanés : incrémenter `SNAPSHOT_VERSION`.
- **Identité** : aucun nom de personne nulle part (site, métadonnées, JSON-LD, commits, comptes) et aucun lien avec les
  autres activités du propriétaire. Le site est signé « Tableau Immo », contact tableauimmo@gmail.com. Les tests e2e le
  vérifient.

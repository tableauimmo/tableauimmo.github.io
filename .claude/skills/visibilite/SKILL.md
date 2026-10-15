---
name: visibilite
description: Routine de visibilité de Tableau Immo (SEO Google, YouTube et GEO / réponses des IA), lancée à la main. Synchronise les épisodes, contrôle la fraîcheur des pages financières (règles fiscales datées), sonde les IA, collecte toutes les sources (Search Console, PageSpeed, YouTube, suggestions, Knowledge Graph, IndexNow, audit du site), apprend des expériences passées, applique les meilleures actions sur le site, les vérifie, les met en ligne et rédige le rapport. À utiliser quand le propriétaire demande d'augmenter la visibilité, de lancer la routine SEO/GEO, ou après la publication d'un épisode.
---

# Routine de visibilité de Tableau Immo

Tu travailles dans le dépôt du site (dossier racine du projet, jamais dans `studio/`). Tu exécutes un passage
complet, de la synchronisation des épisodes au rapport final, en suivant les étapes dans l'ordre.
Le propriétaire a lancé la routine lui-même : il t'autorise à faire les actions décrites ici, pas au-delà
(voir « Interdits »).

## Avant tout

- Lis `CLAUDE.md` (règles du projet) et `visibilite/playbook.md` (mémoire de la routine).
- Vérifie l'identité Git du dépôt : `git config user.name` doit afficher « Tableau Immo ». Sinon, arrête-toi et
  signale-le, sans committer.
- `git status` : s'il y a des modifications locales qui ne viennent pas de la routine, arrête-toi et demande.
- `git pull --ff-only` ; si `package-lock.json` a changé ou si `node_modules` manque : `npm ci`.

## 1. Épisodes à jour

`npm run sync:youtube` (s'arrête proprement tant que `YOUTUBE.channelId` est vide). Si des fiches changent :
`npm run verify`, commit (« Épisodes : synchronisation avec la chaîne YouTube »), push.
Une vidéo signalée « sans fiche préparée » est une priorité : créer la fiche depuis le studio
(`npm run episode:add -- <…>/publication/site_episode.json --youtube <id> --date AAAA-MM-JJ`).

## 2. Fraîcheur des contenus financiers (YMYL)

Le rapport (étape 4) liste les opportunités `fraicheur` : pages dont la date de vérification dépasse le délai de
leur thème (fiscalité et financement : 120 jours) et encadrés « À surveiller » de plus de 30 jours.
Pour chacune :
1. vérifie chaque règle et chaque chiffre sur les sources officielles (Légifrance, BOFiP, impots.gouv.fr,
   service-public.fr, economie.gouv.fr, Banque de France, INSEE, ANIL) avec WebSearch / WebFetch ;
2. corrige la page si besoin (et les épisodes, calculateurs ou termes qui citent la même règle) ;
3. mets à jour `updatedAt` (et les `date` des sources consultées) ; un projet de loi voté ou abandonné fait
   disparaître ou réécrire l'encadré `watch` ;
4. note dans le rapport ce qui a changé, avec la source.
Ne change jamais une date sans avoir réellement vérifié la page.

## 3. Sondage des IA (GEO)

Pour chaque question de `visibilite/cibles.json` → `prompts` de priorité 1 et 2 (au plus 6), interroge :
- **`recherche-web`** (obligatoire) : WebSearch avec la question telle quelle ;
- **`perplexity`** (si le navigateur est disponible) : `https://www.perplexity.ai/search?q=<question encodée>` ;
- **`chatgpt`** (facultatif, si une session est ouverte) : conversation temporaire, aucune autre interaction.

Pour chaque réponse : `mentionne` (Tableau Immo nommé), `cite` (lien vers le site ou la chaîne), `position`,
`concurrents` (autres sources citées), `extrait` (300 caractères au plus). Écris le tout dans
`visibilite/geo/AAAA-MM-JJ.json` (format `geoSchema` de `scripts/visibility/schema.ts`). Budget : 10 minutes.

## 4. Collecte

`npm run visibilite` : interroge les sources, calcule le score et les opportunités (dont la fraîcheur), reporte
les verdicts des expériences échues, écrit `visibilite/historique/<horodatage>.json` et
`visibilite/rapports/<horodatage>.md`. Lis le rapport en entier. En cas d'échec, corrige la cause avant de continuer.

## 5. Apprendre

- Chaque expérience qui vient de recevoir un verdict : leçon dans `visibilite/playbook.md` (date, page,
  changement, résultat chiffré, conclusion réutilisable).
- Expérience **perdante** : remets l'ancienne version (décrite dans `changement`) à l'étape 7.

## 6. Décider

Plan du passage, dans cet ordre :
1. **Corrections** (`correction`) : toutes les erreurs, puis les avertissements simples.
2. **Fraîcheur** (`fraicheur`) : toutes (étape 2).
3. **Nouveaux épisodes** (`nouvel-episode`) : indexation, maillage interne (lexique, calculateur, thème), kit YouTube.
4. **Au plus 3 expériences** parmi `requete-proche`, `ctr-faible`, `contenu` et `geo` : plus fort potentiel,
   jamais une expérience déjà perdante sur la même cible, une seule modification par page.
   Idées GEO typiques : définition en une phrase en tête de page, ligne de tableau qui répond à la question,
   question ajoutée à la FAQ, nouveau terme du lexique (sourcé), lien interne depuis une page forte.
5. **Hors site** (`youtube`, propositions, réseaux) : textes prêts à coller seulement.

## 7. Agir sur le site

- Respecte `CLAUDE.md` : descriptions de 70 à 160 caractères, contenu validé par `src/content.config.ts`,
  aucun nom de personne, aucun conseil personnalisé, risques mentionnés, sources officielles, dates exactes.
- Chaque expérience : entrée dans `visibilite/experiences.json` (`id`, `date`, `type`, `cible`, `hypothese`,
  `changement` avant/après, `mesure` exactement comme dans Search Console, `avant` ou `null`,
  `evaluerApresJours: 28`, `statut: en-cours`).
- `npm run verify` doit passer entièrement (ne désactive jamais un test).
- Commit en français, auteur « Tableau Immo », puis push : GitHub Pages déploie en 1 à 3 minutes
  (workflow « Déploiement »).
- Quand la nouvelle version est en ligne (`curl` d'une page modifiée) :
  - `npm run visibilite:soumettre -- indexnow <adresses modifiées ou nouvelles>` ;
  - si Search Console est connectée et que des pages ont été ajoutées : `npm run visibilite:soumettre -- sitemaps` ;
  - pour chaque nouvelle page importante (5 au plus) : Search Console → Inspection de l'URL → « Demander une
    indexation » (compte tableauimmo@gmail.com, dans Chrome).

## 8. Kit hors site (prêt à coller)

Section « À faire par le propriétaire » du rapport :
- **YouTube** : pour chaque vidéo à problème, titre corrigé et description complète (accroche, lien vers la page,
  chapitres, sources, mention IA, 3 hashtags).
- **Nouvel épisode** : 2 ou 3 messages courts pour les réseaux (TikTok, Instagram, Facebook, LinkedIn, X).
- **Sources tierces utiles au GEO** : au plus 3 propositions honnêtes (forums, médias, annuaires de ressources).

Ne publie rien, n'envoie rien, ne crée aucun compte.

## 9. Mettre à jour les cibles

Dans `visibilite/cibles.json`, au plus 10 ajouts : requêtes Search Console (≥ 5 impressions, pertinentes),
suggestions Google/YouTube pertinentes (sans marques tierces), questions GEO où nous sommes absents.
Le fichier est validé par les tests : garde son format.

## 10. Améliorer la routine

Connecteur en échec, contrôle manquant, étape manuelle répétée : améliore `scripts/visibility/` (avec tests
`tests/unit/visibility-*.test.ts`) et/ou ce fichier. Changement du format des instantanés : incrémente
`SNAPSHOT_VERSION`. Note chaque évolution dans le playbook. `npm run verify` doit passer.

## 11. Clôturer

- Dans le rapport, remplace « _Complété par la routine à la fin du passage._ » par les actions réalisées (liens,
  commits, adresses soumises, pages revérifiées, expériences lancées).
- Commit de `visibilite/` (fichiers versionnés) et des autres fichiers modifiés (« Visibilité : passage du
  AAAA-MM-JJ »), push.
- Message final au propriétaire, en français, court : score et évolution, 3 faits marquants, ce que tu as fait
  (preuves : commandes, statuts HTTP), ce qu'il doit faire lui-même (textes prêts à coller), connecteurs à
  configurer, prochain passage conseillé (après chaque épisode, sinon tous les 15 à 30 jours).

## Interdits

- **Publier ou envoyer quoi que ce soit** au nom de Tableau Immo (YouTube, réseaux, e-mails, commentaires,
  formulaires) sans accord explicite donné dans la conversation.
- **Créer des comptes**, saisir des mots de passe ou des clés (identifiants dans `.env` et `.secrets/`).
- **Inventer ou « rafraîchir » une règle sans source officielle**, promettre un rendement, donner un conseil
  personnalisé.
- **Les méthodes interdites par le playbook** : bourrage de mots-clés, texte caché, faux avis, achat de liens,
  API Indexing de Google pour des pages ordinaires, détournement d'une autre marque.
- **Écrire un nom de personne** dans un fichier du dépôt, ou committer avec une autre identité que « Tableau Immo ».
- **Toucher au dossier `studio/`** (dépôt privé séparé), sauf pour lire la spécification commune.
- **Désactiver ou affaiblir un test** pour faire passer une modification.

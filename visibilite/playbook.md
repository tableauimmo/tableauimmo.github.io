# Playbook de visibilité de Tableau Immo

Mémoire de la routine `/visibilite`. Elle le lit au début de chaque passage et le complète à la fin :
les règles de départ ci-dessous sont des hypothèses, les sections « Appris » sont des faits mesurés.

## Objectif

Être la source pédagogique la plus visible et la plus citée en français sur l’investissement immobilier :
Google (recherche, vidéos), YouTube, et les réponses des IA (ChatGPT, Perplexity, Gemini, Copilot, Claude).

## Règles intangibles

- **Contenu financier (YMYL)** : exact, sourcé (sources officielles), daté. Jamais de conseil personnalisé,
  jamais de rendement promis, risques toujours mentionnés. Une page fausse coûte plus cher qu’une page absente.
- **Fraîcheur** : la fiscalité change au moins une fois par an (loi de finances, LFSS). Chaque page porte sa date
  de vérification ; une règle en discussion (projet de loi) est signalée comme telle, avec sa date.
- **Anonymat** : aucun nom de personne nulle part. Tout est signé « Tableau Immo ».
- **Uniquement des méthodes honnêtes** :
  - pas de bourrage de mots-clés, pas de texte caché ni de contenu différent pour les robots ;
  - pas de faux avis, pas d’achat ni d’échange de liens, pas de commentaires promotionnels automatisés ;
  - pas d’usage détourné de l’API Indexing de Google (réservée aux offres d’emploi et aux diffusions en direct) ;
  - ne jamais détourner le nom d’une autre marque (banque, courtier, plateforme).
- **Rien de public sans accord** : la routine prépare les textes (YouTube, messages, réseaux), mais ne publie
  ni n’envoie rien sans l’accord explicite du propriétaire.

## Méthode d’expérimentation

1. Une seule modification par page et par passage, sinon on ne sait pas ce qui a marché.
2. Toute modification d’un titre, d’une description ou d’un contenu ciblé est inscrite dans
   `experiences.json`, avec l’hypothèse, l’indicateur (clics, impressions, CTR, position) et sa valeur avant.
3. Évaluation après 28 jours (fenêtre de Search Console). La collecte calcule le verdict toute seule :
   gagnante (≥ +10 %, ou au moins une place gagnée), perdante, ou neutre.
4. Une expérience perdante est annulée (on remet l’ancienne version), et la leçon est notée plus bas.
5. Au plus 3 nouvelles expériences par passage.

## Tactiques de départ (à confirmer par les mesures)

### Google
- **Titres** : la requête principale au début, avec l’année quand la règle est datée (« LMNP en 2026 »),
  au plus 60 à 65 caractères.
- **Descriptions** : 140 à 155 caractères, avec un chiffre clé et le bénéfice concret.
- **Pages d’épisode** : le tableau HTML (« Le tableau de l’épisode »), les points clés, la FAQ, les sources et la
  transcription donnent assez de texte utile ; VideoObject complet avec moments clés.
- **Maillage interne** : chaque épisode renvoie vers ses termes du lexique, son calculateur et son thème ;
  chaque terme renvoie vers ses termes liés. Une nouvelle page doit recevoir au moins 3 liens internes.
- **Requêtes proches du haut de page** (positions 4 à 20) : renforcer la page qui ressort (premier paragraphe
  qui répond à la question, ligne du tableau, FAQ).

### YouTube
- **Titre** : « Sujet précis + année ou chiffre | Tableau Immo ».
- **Description**, dans l’ordre : l’accroche ; le lien vers la page de l’épisode ; les chapitres (« 0:00 ») ;
  les sources ; la mention « Illustrations et voix générées avec l’aide de l’IA ; contenu vérifié et sourcé » ;
  3 hashtags.
- Audience : « Non, pas conçue pour les enfants ».

### Réponses des IA (GEO)
- Les IA reprennent des faits clairs, chiffrés et datés : une définition en une phrase en tête de page,
  un tableau HTML, une FAQ qui répond mot pour mot aux questions.
- Même phrase de présentation partout (site, YouTube, llms.txt, profils).
- `llms.txt` et `llms-full.txt` à jour à chaque build ; Bing alimente ChatGPT et Copilot : IndexNow le jour même.
- Mesure : sondage des mêmes questions à chaque passage (`cibles.json` → `prompts`).

## Appris — ce qui marche

_Aucune mesure pour l’instant : première expérience à lancer quand Search Console sera connectée._

## Appris — ce qui ne marche pas

_Rien pour l’instant._

## Évolutions de la routine

- 2026-10-15 : création, reprise de la routine éprouvée d’un autre site et adaptée à un contenu financier :
  contrôle de fraîcheur des pages datées (épisodes, lexique, encadrés « À surveiller »), contrôles YouTube
  (mention IA, audience adulte), cibles investissement immobilier.

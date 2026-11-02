# ADR 0012 — Compatibilité ascendante de l'API : un contrat vérifié par la CI

- **Statut** : Proposé
- **Date** : 2026-11-02
- **Décideur** : mauvaisetroupe

## Contexte

Une seule API (`https://step-api.architech.lu`) sert en même temps tous ses clients :

- toutes les versions de l'application encore installées, sur Google Play et sur AppGallery. Certaines ont plusieurs mois : une mise à jour n'est jamais obligatoire, et une version publiée ne peut pas être retirée ;
- le travailleur Kotlin de l'[ADR 0009](0009-native-background-sync.md), qui appelle `POST /api/me/steps` toutes les 6 heures, même quand l'application n'a pas été ouverte depuis longtemps ;
- plus tard, le client web de l'[ADR 0008](0008-web-client.md).

La règle est écrite dans [Versions et livraisons](../explanation/versions-and-releases.md#pourquoi-lapi-reste-compatible) : ajouter, ne jamais retirer ni renommer un champ ou une route tant qu'une version qui s'en sert peut tourner. **Rien ne la vérifie** :

- les routes n'ont pas de schéma de réponse : la forme d'une réponse est celle que renvoie la requête SQL. Renommer un alias de colonne (`AS "firstDay"`) casse les clients sans qu'aucun test du backend n'échoue, puisque les tests sont écrits en même temps que le changement ;
- on ne sait pas quelles versions de l'application appellent encore l'API, donc jamais quand un champ peut être retiré ;
- les badges ([spécification](../reference/badges.md)) vont ajouter des routes et des champs, et faire évoluer le catalogue sans nouvelle version de l'application.

Deux sens de compatibilité :

- **ascendante** (une API récente, une application ancienne) : le cas courant, et l'objet de cette décision ;
- **descendante** (une application récente, une API plus ancienne) : après un retour en arrière de l'API, ou une application publiée avant son API. Plus rare, mais déjà rencontré : les classements passés (1.10.0) détectent une API qui ignore `offset` par l'absence de `start`.

Ce qui protège déjà : Fastify retire les champs d'une requête que le schéma ne déclare pas (`removeAdditional`, réglage par défaut, vérifié par `auth.test.ts`), au lieu de répondre 400. Une application récente qui envoie un champ nouveau à une API ancienne n'est donc pas refusée ; le champ est seulement ignoré.

## Options étudiées

### Option A — La discipline seule (aujourd'hui)

- ✅ Rien à construire.
- ❌ Repose sur la relecture d'un mainteneur seul. Une erreur ne se voit qu'en production, sur le téléphone de quelqu'un qui n'a pas mis à jour.

### Option B — Versions dans l'adresse (`/api/v2/…`)

- ✅ Une rupture devient possible sans casser les anciennes versions.
- ❌ Deux versions des routes à maintenir et à tester, pour un seul mainteneur.
- ❌ Ne détecte pas une rupture involontaire : c'est une façon de rompre proprement, pas un garde-fou.

Écartée comme pratique courante ; reste le recours si une vraie rupture devient un jour inévitable.

### Option C — Contrat OpenAPI produit par le code, comparé par la CI à la dernière version publiée

- ✅ Une rupture fait échouer la CI avant la fusion, quel que soit le relecteur.
- ✅ Le contrat devient lisible (et utilisable par le client web).
- ❌ Il faut écrire un schéma de réponse pour chacune des 23 routes.
- ❌ Le contrat ne dit pas ce que les clients utilisent vraiment : un champ peut changer de sens sans changer de forme.

### Option D — Tests de contrat pilotés par les clients (Pact)

- ✅ Vérifie ce que chaque client utilise vraiment.
- ❌ Un courtier de contrats à héberger et des tests à écrire côté application et côté Kotlin : disproportionné pour un projet de cette taille.

Une version légère en est retenue : des requêtes de référence, rejouées par les tests du backend (ci-dessous).

## Décision

**Option C, complétée par des requêtes de référence, la version du client dans chaque requête et une règle de lecture tolérante côté application.**

### 1. Schéma de réponse sur chaque route

Chaque route déclare le schéma de ses réponses (`schema.response`, par code HTTP), comme elle déclare déjà celui de ses requêtes.

Effet de bord voulu : Fastify sérialise la réponse d'après ce schéma et **n'envoie que les champs déclarés**. Une colonne ajoutée à une requête SQL ne fuit plus par accident ; un champ oublié dans le schéma disparaît de la réponse, et les tests existants le voient.

### 2. Contrat OpenAPI versionné et comparé

- `@fastify/swagger` produit le contrat à partir des schémas ; `npm run openapi` l'écrit dans `backend/openapi.json`, **commité**. Aucune page de documentation n'est exposée (rien de nouveau dans [`exposure.md`](../reference/exposure.md)).
- La CI vérifie deux choses :
  1. le fichier est à jour : régénéré, il ne doit pas différer de celui du commit (`git diff --exit-code`) ;
  2. **aucune rupture** depuis la dernière version publiée : [`oasdiff breaking`](https://github.com/oasdiff/oasdiff) compare `openapi.json` à celui du dernier tag `api-v*` et échoue sur un champ ou une route retirés, un champ renommé ou devenu obligatoire, un type changé, une valeur d'énumération retirée d'une réponse…
- La comparaison se fait avec la dernière version **publiée**, pas avec le commit précédent : deux changements compatibles chacun peuvent rompre ensemble.

### 3. Requêtes de référence des clients publiés

`backend/src/test/compat/` garde, pour chaque client publié qui change la façon d'appeler l'API (une version de l'application, le travailleur Kotlin), les requêtes qu'il envoie et ce qu'il lit dans la réponse : codes HTTP attendus et champs utilisés. Les tests du backend les rejouent à chaque exécution.

Elles complètent le contrat là où il ne voit rien : un champ facultatif devenu obligatoire dans la pratique, une valeur par défaut qui change, un code d'erreur que le client interprète (`duplicate_date`, 401 qui déconnecte).

On ajoute un jeu à chaque version publiée qui change ses appels. On ne retire un jeu que quand cette version a disparu (point 4).

### 4. La version du client dans chaque requête

L'application (`apiFetch`) et le travailleur Kotlin envoient un en-tête `X-Client: <type>/<version>`, par exemple `app/1.10.0`, `worker/1.10.0`, plus tard `web/…`. L'API l'ajoute au journal de chaque requête (le sérialiseur par défaut de Fastify ne garde que la méthode, l'adresse, l'hôte et l'IP, aucun en-tête).

C'est ce qui permet de **décider** d'un retrait : un champ ne se retire que quand plus aucune version qui s'en sert n'a appelé l'API depuis 8 semaines. Le travailleur tourne même sans ouverture de l'application : une version installée mais oubliée reste visible.

Le numéro de version n'identifie personne ; il rejoint l'adresse IP, déjà présente dans le journal. Les versions publiées avant cette décision n'envoient rien : une requête sans en-tête vient d'une version antérieure.

### 5. Lecture tolérante dans l'application

Règles pour le code de l'application (`src/api/`), écrites dans [`architecture.md`](../explanation/architecture.md) :

- ignorer les champs inconnus d'une réponse (déjà le cas en TypeScript) ;
- une **valeur d'énumération inconnue** (famille ou icône d'un badge, par exemple) ne fait pas planter l'écran : elle prend un affichage par défaut ;
- une fonction nouvelle traite l'absence de sa route (**404**) ou de son champ comme « pas encore disponible sur ce serveur » et se masque, comme les classements passés le font déjà. Pas de route de découverte des fonctions : l'absence suffit.

### 6. Rompre quand même

Si un retrait est nécessaire :

1. le journal (point 4) montre qu'aucune version qui s'en sert n'a appelé l'API depuis 8 semaines ;
2. le commit est marqué `!` avec une ligne `BREAKING CHANGE: …` (la convention des notes de version), qui dit quelles versions de l'application cessent de fonctionner ;
3. la rupture est déclarée à `oasdiff` dans un fichier d'exceptions commité (`backend/openapi-breaking-ignore.txt`), qui garde la trace de chaque rupture acceptée ;
4. les requêtes de référence de ces versions sont retirées dans le même commit.

### Ordre de mise en place

1. Schémas de réponse, route par route (sans changer les réponses : les tests existants le vérifient).
2. `openapi.json` et sa vérification « à jour ». La comparaison `oasdiff` démarre au premier tag `api-v*` qui contient le fichier.
3. En-tête `X-Client` dans l'API (journal), puis dans l'application et le travailleur, à la version suivante.
4. Requêtes de référence : travailleur Kotlin, application 1.10.0, puis chaque version suivante qui change ses appels.

## Conséquences

- ✅ Une rupture involontaire de l'API est arrêtée par la CI, avant d'arriver sur un téléphone.
- ✅ On saura quelles versions appellent encore l'API, donc quand on peut retirer quelque chose.
- ✅ Le contrat sert de documentation de l'API, au client web et aux badges.
- ✅ Plus de champ envoyé par accident dans une réponse.
- ⚠️ Chaque changement de route touche son schéma de réponse et `openapi.json` : un peu plus de travail par changement.
- ⚠️ Écrire les schémas des 23 routes est un chantier en soi, à faire avant les badges.
- ⚠️ Une action GitHub ou un binaire de plus (`oasdiff`) dans la CI, à figer par version.
- ⚠️ Le contrat ne voit pas un changement de sens d'un champ ; les requêtes de référence en couvrent une partie seulement.

## Hors de cette décision

- **Mise à jour obligatoire** : refuser une version trop ancienne (réponse 426 et message dans l'application). Possible plus tard grâce à `X-Client`, si une rupture l'impose.
- **Versions dans l'adresse** (option B), en dernier recours.
- **Compatibilité du schéma de la base** entre versions de l'API (retour en arrière après une migration) : traitée par l'exploitation ([`exploitation.md`](../exploitation.md)) et la règle des commits `!`.

# ADR 0011 — Hébergement du backend : une image de conteneur, hébergée par un exploitant

- **Statut** : Accepté
- **Date** : 2026-10-09, révisé le 2026-10-25 (image et exploitant) et le 2026-10-26 (migrations par Flyway)
- **Décideur** : mauvaisetroupe

## Contexte

L'API (Fastify) et la base (PostgreSQL) tournent dans deux conteneurs LXC du home lab du mainteneur, exposés par un tunnel Cloudflare sous `step-api.architech.lu` (ADR 0005). Le site public est déjà chez OVH (hébergement web mutualisé).

Limites de la situation actuelle :

- **disponibilité** : l'API dépend de la connexion, de l'électricité et du matériel du domicile, alors que la synchronisation en arrière-plan (ADR 0009) tourne jour et nuit ;
- **séparation** : le home lab porte des données de santé de tiers ;
- **sauvegardes** : aucune sauvegarde automatique de la base (voir `STATUS.md`), le risque principal aujourd'hui.

La première version de cet ADR (2026-10-09) mettait dans ce dépôt toute la production : composition à trois services (API, base, `cloudflared`), `docker-compose.prod.yml`, `deploy.sh` sur le VPS, sauvegardes. Or ce dépôt est public et décrit une application ; la machine qui l'héberge, ses ports, ses utilisateurs, son tunnel et ses sauvegardes sont propres à un hébergement, et changeraient avec lui.

L'application n'a pas encore de version publique : quelques testeurs, une interruption de quelques minutes est acceptable.

## Options étudiées

### Option A — Rester sur le home lab

- ✅ Rien à faire, coût nul.
- ❌ Disponibilité, séparation et sauvegardes restent à régler.

### Option B — VPS, installation directe (Node.js et PostgreSQL par paquets, systemd)

- ✅ Comme aujourd'hui : `deploy.sh` et l'unité systemd restent valables.
- ❌ Versions de Node.js et PostgreSQL à installer et tenir identiques à la main, en dev et en production ; un futur changement d'hébergeur refait tout.

### Option C — Conteneurs, avec la production décrite dans ce dépôt

Version du 2026-10-09 : `Dockerfile`, `docker-compose.prod.yml` avec `cloudflared`, `deploy.sh` qui construit l'image sur le VPS.

- ✅ Mêmes versions figées en dev, en test et en production.
- ❌ Le dépôt public décrit une machine précise ; changer d'hébergement ou de tunnel modifie l'application.
- ❌ L'image est construite sur le serveur, sans version : pas de retour en arrière simple, pas de trace de ce qui tourne.

### Option D — Le dépôt livre une image versionnée et sa documentation ; un exploitant l'héberge

Ce que livre un éditeur pour être hébergé par quelqu'un d'autre.

- ✅ Mêmes versions figées partout ; retour en arrière en changeant de tag ; ce qui tourne est identifié (version, commit).
- ✅ Le dépôt ne sait rien de l'hôte : changer d'hébergeur, de proxy ou de méthode de sauvegarde ne touche pas l'application.
- ✅ La documentation d'exploitation est un contrat explicite (variables, port, santé, données), lisible sans connaître le code.
- ❌ Deux endroits à tenir : ce dépôt et la configuration de l'exploitant. Ici, c'est la même personne.

### Migrations : dans l'API ou par Flyway

Aujourd'hui, les migrations (`backend/migrations/NNN_*.sql`) sont appliquées à la main avec `psql`, et rien en base ne dit lesquelles sont passées.

- **Code de migration dans l'API**, au démarrage : écrit puis retiré le 2026-10-25. Une seule image, qui se suffit à elle-même ; mais un outil maison, sans contrôle d'un fichier modifié après coup, sans outils pour l'exploitant.
- **Flyway, dans une image de migration séparée** : retenu. Outil connu des exploitants, qui fait déjà tout ce qu'il faut ici : historique en base, verrou contre deux migrations simultanées, une transaction par migration, ligne de base pour une base migrée à la main, migration de base (`B…`) pour une base vide, et **sommes de contrôle** (un fichier déjà appliqué puis modifié est refusé). Flyway étant en Java, il reste hors de l'image de l'API : une étape de migration, puis l'application, comme il est classique.

### Passerelle d'API (Kong, Traefik…) — écartée

Cloudflare tient déjà le rôle de périphérie (TLS, WAF, limitation de débit, statistiques) ; il n'y a qu'un backend, pas de clients tiers ni de clés d'API ; l'authentification est dans le backend (ADR 0001). Une passerelle ajouterait un composant à tenir à jour sans rien apporter. **À reconsidérer** : plusieurs services (par exemple une synchronisation Huawei séparée), une API ouverte à d'autres développeurs (clés, quotas), ou des déploiements sans coupure.

## Décision

**Option D**, avec les migrations par **Flyway**. Ce dépôt livre deux images, `ghcr.io/mauvaisetroupe/step-challenge-api` et `ghcr.io/mauvaisetroupe/step-challenge-migrations`, et leur documentation d'exploitation ([`docs/exploitation.md`](../exploitation.md)). Rien de plus : ni port publié, ni utilisateur Linux, ni tunnel, ni sauvegarde, ni chemin d'un autre dépôt.

### Ce que livre ce dépôt

**L'image de l'API** (`backend/Dockerfile`) :

- plusieurs étapes, Node.js 24 « slim » à version figée, dépendances de production seulement, utilisateur non root ;
- un seul port HTTP, **3000** ;
- arrêt propre sur `SIGTERM` : Fastify termine les requêtes en cours, puis le pool PostgreSQL est fermé ;
- amd64 et arm64.

**L'image de migration** :

- `flyway/flyway` (édition Community) à version figée, avec les fichiers SQL du dépôt copiés dedans ; elle applique les migrations puis s'arrête ;
- configurée par les variables standard de Flyway (`FLYWAY_URL`, `FLYWAY_USER`, `FLYWAY_PASSWORD`…) ;
- **base vide** : la migration de base `B006__schema.sql` (l'actuel `schema.sql`) crée le schéma complet, puis les migrations suivantes s'appliquent ;
- **base existante sans historique** (celle d'aujourd'hui, migrée à la main) : Flyway **refuse** de migrer, sauf avec `FLYWAY_BASELINE_ON_MIGRATE=true` et `FLYWAY_BASELINE_VERSION=6`, donnés **une seule fois**, à la reprise de la base. La ligne de base est notée dans l'historique, sans rien exécuter, puis les migrations suivantes s'appliquent ;
- les fichiers actuels sont **renommés** au format de Flyway (`001_auth.sql` → `V001__auth.sql`), sans changer leur contenu ; ils ne s'exécutent plus jamais (ligne de base ou `B006`) et restent comme historique ;
- `B006__schema.sql` est **figé** (Flyway contrôle aussi sa somme) : le schéma évolue ensuite par `V007__…` et suivantes, écrites sans `BEGIN;` ni `COMMIT;` (Flyway ouvre la transaction). Le schéma complet n'est plus tenu à jour dans un fichier : une fois l'application stable, un nouveau `B<n>__schema.sql` pourra le résumer, écrit à partir d'un `pg_dump --schema-only` d'une base migrée (l'édition Community ne le génère pas). Une base vide part alors du plus haut `B` ; les bases existantes l'ignorent. Les anciens `V` et `B` restent : ils sont dans l'historique des bases déjà migrées ;
- en dev et dans la CI, les bases de développement et de test sont créées par la même image de migration, au lieu de `psql -f schema.sql`.

**L'ordre : migrations, puis API.** Le démarrage de l'API vérifie l'historique de Flyway (`flyway_schema_history`) :

- l'API refuse de démarrer, avec un message qui les nomme, si des variables obligatoires manquent ;
- elle refuse aussi si la base n'a pas atteint la version de schéma qu'elle attend (inscrite dans l'image à la construction : la dernière migration du dépôt) ou si une migration a échoué ;
- une base plus récente que l'API est acceptée, avec un avertissement : c'est le retour à l'image précédente après une migration compatible.

**Une configuration uniquement par variables d'environnement**, dont deux dépendances jusqu'ici implicites :

- **le fuseau** (`APP_TIMEZONE`, `Europe/Paris` par défaut) : le classement (semaine, mois) et le refus des dates futures reposent sur `CURRENT_DATE`. L'API fixe le fuseau de chaque connexion PostgreSQL, au lieu de dépendre de celui du conteneur ou du serveur ;
- **l'adresse du client** (`CLIENT_IP_HEADER`, `cf-connecting-ip` par défaut) : l'en-tête lu par les limites de débit, écrit en dur jusqu'ici. Un autre proxy devient possible (`x-forwarded-for` : la dernière adresse de la liste, celle écrite par le proxy) ; vide, l'adresse de la connexion.

**`/api/health`** sans authentification : 200 si l'API et la base répondent, 503 sinon.

**Les versions** :

- un tag git `api-vX.Y.Z` (le dépôt contient aussi l'application mobile, versionnée à part) publie **les deux images** sous `X.Y.Z` et `X.Y` ; chaque commit sur `main` les publie sous l'empreinte du commit. Une version de l'API va avec l'image de migration du même tag. Pas de `latest` : l'exploitant choisit sa version. Première version : `api-v1.0.0` ;
- les images ne sont publiées qu'après les tests de la CI ; elles sont publiques, comme le dépôt ;
- chaque version a ses **notes** (GitHub Releases, tirées de `backend/CHANGELOG.md`) avec ce qui change pour l'exploitant : variable ajoutée ou retirée, migration lourde, version de PostgreSQL exigée.

**Une composition d'exemple** (base, migration, API) pour essayer les images, présentée comme un exemple et non comme la production.

### Ce que tient l'exploitant, hors de ce dépôt

Pour Step Challenge, l'exploitant est le mainteneur. Ses choix, décrits ici pour mémoire et tenus ailleurs :

- un **VPS OVH au Canada** ; le transfert hors de l'Union européenne repose sur la décision d'adéquation de la Commission européenne pour le Canada (politique de confidentialité mise à jour) ;
- Docker **sans root** ; la composition de production (base, migration, API), ses volumes et ses secrets ;
- le **tunnel Cloudflare** sur l'hôte, hors de la composition ; `step-api.architech.lu` ne change pas, donc **aucune nouvelle version de l'application** ;
- la sécurisation du système (SSH par clé, pare-feu, mises à jour), les **sauvegardes** de PostgreSQL (chiffrées, hors du VPS, restauration testée), la supervision de `/api/health`, les mises à jour de l'image et de PostgreSQL ;
- les règles de Cloudflare (WAF, débit) et un éventuel retrait de Cloudflare de l'API : `CLIENT_IP_HEADER` le permet sans toucher au code.

### Retiré de la version du 2026-10-09

`cloudflared` dans la composition, `docker-compose.prod.yml`, `deploy.sh` sur le VPS, la procédure de sécurisation du VPS et celle des sauvegardes : ils relèvent de l'exploitant.

L'ancien `deploy.sh` et `install-step-challenge.sh` (LXC, systemd) **restent** jusqu'à la bascule : ils servent la production actuelle.

### Limitation de débit par compte (indépendant de l'hébergement)

Les routes authentifiées limitées (création d'invitation, signalement) devraient compter par compte plutôt que par adresse IP : clé infalsifiable, pas de gêne entre personnes qui partagent une IP. Les routes sans compte (connexion, accès démo, consultation d'un code d'invitation) gardent l'adresse IP. À faire plus tard.

## Procédure de migration

1. **Sur le Mac** : les images et la composition d'exemple, une copie de la base de production restaurée dedans, migration avec la ligne de base (`FLYWAY_BASELINE_ON_MIGRATE=true`, `FLYWAY_BASELINE_VERSION=6`) la première fois, l'application de dev pointée dessus : connexion, synchronisation, classement.
2. **Chez l'exploitant** : VPS, composition de production, sauvegardes et supervision, hors de ce dépôt.
3. **Bascule** (quelques minutes) : arrêt de l'API du home lab, `pg_dump`, restauration sur le VPS, migration avec la ligne de base (une fois), démarrage de l'API, bascule du tunnel ; vérifier `/api/health`, une connexion, une synchronisation, le classement.
4. **Retour en arrière possible** : le home lab reste arrêté mais intact quelques jours.

Aucune perte de pas pendant l'arrêt : les synchronisations échouées sont refaites, et le serveur garde le plus grand total de chaque jour.

## Conséquences

- ✅ API disponible sans dépendre du domicile ; données de santé hors du home lab.
- ✅ Ce qui tourne est une version identifiée ; retour en arrière par le tag précédent (sauf migration non compatible, signalée dans les notes de version).
- ✅ Le dépôt reste celui d'une application, utilisable par un autre hébergeur.
- ✅ Migrations par un outil standard : historique, sommes de contrôle, `flyway info` et `repair` pour l'exploitant.
- ⚠️ Deux images à exploiter, dans l'ordre : migration, puis API.
- ⚠️ Chaque mise à jour peut migrer la base : sauvegarde avant, par l'exploitant.
- ⚠️ 100 % Flyway : `schema.sql` devient `B006__schema.sql`, figé. Le schéma complet ne se lit plus dans un seul fichier à jour, jusqu'au prochain `B<n>` écrit à la main.
- À mettre à jour : `exploitation.md` (documentation de l'image ; la partie mainteneur passe dans `publication.md`), `STATUS.md`, `README`, `exposure.md` à la bascule, la politique de confidentialité (sous-traitants : OVH au Canada, Cloudflare, Google).

## Points ouverts

- Fuseau du home lab actuel (`timedatectl`), à comparer à `Europe/Paris` avant la bascule.
- Visibilité des paquets GHCR : à passer en public une fois, à la première publication.
- Version de Flyway à figer : vérifier qu'elle prend en charge PostgreSQL 18 sans avertissement.
- Édition Community de Flyway : Redgate a déjà fait passer des fonctions dans ses éditions payantes ; surveiller `migrate`, `baseline`, `validate` et les migrations de base, les seules utilisées ici.
- **Fuseau de chaque utilisateur** (ADR à écrire) : plutôt que `APP_TIMEZONE` pour tous, l'application enverrait son fuseau (en-tête de type `X-Time-Zone`, par l'application, le travailleur Kotlin et le client web), et le serveur calculerait « aujourd'hui », la semaine et le mois du classement dans ce fuseau (`(now() AT TIME ZONE $tz)::date` au lieu de `CURRENT_DATE`), sans rien stocker. `APP_TIMEZONE` resterait le repli des clients qui ne l'envoient pas. Décision de produit : entre amis de fuseaux différents, chacun voit sa semaine, décalée de quelques heures le dimanche soir. Peu d'intérêt tant que les utilisateurs partagent un fuseau.

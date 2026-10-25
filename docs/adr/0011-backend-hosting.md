# ADR 0011 — Hébergement du backend : une image de conteneur, hébergée par un exploitant

- **Statut** : Accepté
- **Date** : 2026-10-09, révisé le 2026-10-25
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

### Passerelle d'API (Kong, Traefik…) — écartée

Cloudflare tient déjà le rôle de périphérie (TLS, WAF, limitation de débit, statistiques) ; il n'y a qu'un backend, pas de clients tiers ni de clés d'API ; l'authentification est dans le backend (ADR 0001). Une passerelle ajouterait un composant à tenir à jour sans rien apporter. **À reconsidérer** : plusieurs services (par exemple une synchronisation Huawei séparée), une API ouverte à d'autres développeurs (clés, quotas), ou des déploiements sans coupure.

## Décision

**Option D.** Ce dépôt livre l'image `ghcr.io/mauvaisetroupe/step-challenge-api` et sa documentation d'exploitation ([`docs/exploitation.md`](../exploitation.md)). Rien de plus : ni port publié, ni utilisateur Linux, ni tunnel, ni sauvegarde, ni chemin d'un autre dépôt.

### Ce que livre ce dépôt

**L'image** (`backend/Dockerfile`) :

- plusieurs étapes, Node.js 24 « slim » à version figée, dépendances de production seulement, utilisateur non root ;
- un seul port HTTP, **3000** ;
- arrêt propre sur `SIGTERM` : Fastify termine les requêtes en cours, puis le pool PostgreSQL est fermé ;
- amd64 et arm64.

**Un démarrage autonome** :

- l'API refuse de démarrer, avec un message qui les nomme, si des variables obligatoires manquent ;
- les **migrations sont appliquées au démarrage**, avant d'écouter. Un registre en base (`schema_migrations`) garde celles qui sont faites ; un verrou PostgreSQL empêche deux instances de migrer en même temps ; chaque migration s'exécute dans sa transaction. Au premier échec, l'API s'arrête ;
- **base vide** : `schema.sql` est appliqué, et toutes les migrations qu'il contient sont notées comme faites ;
- **base existante sans registre** (celle d'aujourd'hui, migrée à la main) : l'API **refuse de démarrer**, sauf si `MIGRATIONS_BASELINE=<numéro>` est donné. Les migrations jusqu'à ce numéro sont alors notées comme faites, **sans être lancées**, puis les suivantes s'appliquent. La variable ne sert qu'une fois, à la reprise d'une base existante. Les migrations 001 à 006 ne sont ni réécrites ni rejouées.

**Une configuration uniquement par variables d'environnement**, dont deux dépendances jusqu'ici implicites :

- **le fuseau** (`APP_TIMEZONE`, `Europe/Paris` par défaut) : le classement (semaine, mois) et le refus des dates futures reposent sur `CURRENT_DATE`. L'API fixe le fuseau de chaque connexion PostgreSQL, au lieu de dépendre de celui du conteneur ou du serveur ;
- **l'adresse du client** (`CLIENT_IP_HEADER`, `cf-connecting-ip` par défaut) : l'en-tête lu par les limites de débit, écrit en dur jusqu'ici. Un autre proxy devient possible (`x-forwarded-for` : la dernière adresse de la liste, celle écrite par le proxy) ; vide, l'adresse de la connexion.

**`/api/health`** sans authentification : 200 si l'API et la base répondent, 503 sinon.

**Les versions** :

- un tag git `api-vX.Y.Z` (le dépôt contient aussi l'application mobile, versionnée à part) publie l'image sous `X.Y.Z` et `X.Y` ; chaque commit sur `main` la publie sous l'empreinte du commit. Pas de `latest` : l'exploitant choisit sa version. Première version : `api-v1.0.0` ;
- l'image n'est publiée qu'après les tests de la CI ; elle est publique, comme le dépôt ;
- chaque version a ses **notes** (GitHub Releases, tirées de `backend/CHANGELOG.md`) avec ce qui change pour l'exploitant : variable ajoutée ou retirée, migration lourde, version de PostgreSQL exigée.

**Une composition d'exemple** (API et base) pour essayer l'image, présentée comme un exemple et non comme la production.

### Ce que tient l'exploitant, hors de ce dépôt

Pour Step Challenge, l'exploitant est le mainteneur. Ses choix, décrits ici pour mémoire et tenus ailleurs :

- un **VPS OVH au Canada** ; le transfert hors de l'Union européenne repose sur la décision d'adéquation de la Commission européenne pour le Canada (politique de confidentialité mise à jour) ;
- Docker **sans root** ; la composition de production, ses volumes et ses secrets ;
- le **tunnel Cloudflare** sur l'hôte, hors de la composition ; `step-api.architech.lu` ne change pas, donc **aucune nouvelle version de l'application** ;
- la sécurisation du système (SSH par clé, pare-feu, mises à jour), les **sauvegardes** de PostgreSQL (chiffrées, hors du VPS, restauration testée), la supervision de `/api/health`, les mises à jour de l'image et de PostgreSQL ;
- les règles de Cloudflare (WAF, débit) et un éventuel retrait de Cloudflare de l'API : `CLIENT_IP_HEADER` le permet sans toucher au code.

### Retiré de la version du 2026-10-09

`cloudflared` dans la composition, `docker-compose.prod.yml`, `deploy.sh` sur le VPS, la procédure de sécurisation du VPS et celle des sauvegardes : ils relèvent de l'exploitant.

L'ancien `deploy.sh` et `install-step-challenge.sh` (LXC, systemd) **restent** jusqu'à la bascule : ils servent la production actuelle.

### Limitation de débit par compte (indépendant de l'hébergement)

Les routes authentifiées limitées (création d'invitation, signalement) devraient compter par compte plutôt que par adresse IP : clé infalsifiable, pas de gêne entre personnes qui partagent une IP. Les routes sans compte (connexion, accès démo, consultation d'un code d'invitation) gardent l'adresse IP. À faire plus tard.

## Procédure de migration

1. **Sur le Mac** : l'image et la composition d'exemple, une copie de la base de production restaurée dedans (première fois avec `MIGRATIONS_BASELINE=6`), l'application de dev pointée dessus : connexion, synchronisation, classement.
2. **Chez l'exploitant** : VPS, composition de production, sauvegardes et supervision, hors de ce dépôt.
3. **Bascule** (quelques minutes) : arrêt de l'API du home lab, `pg_dump`, restauration sur le VPS, démarrage de l'image (`MIGRATIONS_BASELINE=6` une fois), bascule du tunnel ; vérifier `/api/health`, une connexion, une synchronisation, le classement.
4. **Retour en arrière possible** : le home lab reste arrêté mais intact quelques jours.

Aucune perte de pas pendant l'arrêt : les synchronisations échouées sont refaites, et le serveur garde le plus grand total de chaque jour.

## Conséquences

- ✅ API disponible sans dépendre du domicile ; données de santé hors du home lab.
- ✅ Ce qui tourne est une version identifiée ; retour en arrière par le tag précédent (sauf migration non compatible, signalée dans les notes de version).
- ✅ Le dépôt reste celui d'une application, utilisable par un autre hébergeur.
- ⚠️ Les migrations au démarrage exigent une sauvegarde avant chaque mise à jour de l'image : c'est l'exploitant qui la fait.
- À mettre à jour : `exploitation.md` (documentation de l'image ; la partie mainteneur passe dans `publication.md`), `STATUS.md`, `README`, `exposure.md` à la bascule, la politique de confidentialité (sous-traitants : OVH au Canada, Cloudflare, Google).

## Points ouverts

- Fuseau du home lab actuel (`timedatectl`), à comparer à `Europe/Paris` avant la bascule.
- Visibilité du paquet GHCR : à passer en public une fois, à la première publication.

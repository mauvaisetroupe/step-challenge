# ADR 0011 — Hébergement du backend : VPS OVH et Docker

- **Statut** : Proposé
- **Date** : 2026-10-09
- **Décideur** : mauvaisetroupe

## Contexte

L'API (Fastify) et la base (PostgreSQL) tournent dans deux conteneurs LXC du home lab du mainteneur, exposés par un tunnel Cloudflare sous `step-api.architech.lu` (ADR 0005). Le site public est déjà chez OVH (hébergement web mutualisé).

Limites de la situation actuelle :

- **disponibilité** : l'API dépend de la connexion, de l'électricité et du matériel du domicile, alors que la synchronisation en arrière-plan (ADR 0009) tourne jour et nuit ;
- **séparation** : le home lab porte des données de santé de tiers ;
- **sauvegardes** : aucune sauvegarde automatique de la base (voir `STATUS.md`), le risque principal aujourd'hui.

Le mainteneur envisage, pour d'autres raisons, une offre **VPS-1 d'OVH** : 2 vCores, 4 Go de RAM, 40 Go de SSD NVMe, sauvegarde quotidienne des dernières 24 heures, trafic illimité, 500 Mbit/s ; environ 4,50 à 5 € par mois selon l'engagement. C'est largement suffisant : la base fait quelques Mo (100 utilisateurs sur un an ≈ 36 000 lignes dans `daily_steps`), Node.js et PostgreSQL occupent environ 0,5 Go de mémoire.

L'application n'a pas encore de version publique : quelques testeurs, une interruption de quelques minutes est acceptable.

## Options étudiées

### Option A — Rester sur le home lab

- ✅ Rien à faire, coût nul.
- ❌ Disponibilité, séparation et sauvegardes restent à régler.

### Option B — VPS, installation directe (Node.js et PostgreSQL par paquets, systemd)

- ✅ Comme aujourd'hui : `deploy.sh` et l'unité systemd restent valables.
- ❌ Versions de Node.js et PostgreSQL à installer et tenir identiques à la main, en dev et en production ; un futur changement d'hébergeur refait tout.

### Option C — VPS, tout dans Docker (API, base, connecteur du tunnel)

- ✅ Mêmes versions figées en dev, en test et en production ; la base de dev et de test est déjà dans Docker (`backend/docker-compose.dev.yml`, `postgres:18`).
- ✅ Migration plus simple (installer Docker seulement), retour en arrière par l'image précédente, portabilité vers un autre hébergeur.
- ❌ Docker contourne `ufw` pour les ports publiés ; les images ne profitent pas des mises à jour automatiques du système ; journaux sans limite par défaut ; fuseau horaire UTC par défaut (voir les précautions).

### Passerelle d'API (Kong, Traefik…) — écartée

Cloudflare tient déjà le rôle de périphérie (TLS, WAF, limitation de débit, statistiques) ; il n'y a qu'un backend, pas de clients tiers ni de clés d'API ; l'authentification est dans le backend (ADR 0001). Une passerelle ajouterait un composant à tenir à jour sans rien apporter. **À reconsidérer** : plusieurs services (par exemple une synchronisation Huawei séparée), une API ouverte à d'autres développeurs (clés, quotas), ou des déploiements sans coupure (un petit proxy local suffirait alors).

## Décision

**Option C**, en gardant d'abord le tunnel Cloudflare.

### Le VPS

- Offre VPS-1, **centre de données dans l'Union européenne** (Gravelines, Roubaix, Strasbourg…), **sans engagement** au début ; engagement de 12 mois une fois le backend stable dessus.
- **Debian** (ou Ubuntu LTS, la même famille que les conteneurs LXC actuels).
- Clé SSH ajoutée à la commande : jamais de mot de passe SSH.

### Sécurisation du système

1. Mises à jour, utilisateur personnel avec `sudo`.
2. SSH par clé uniquement (`/etc/ssh/sshd_config.d/hardening.conf`) : `PermitRootLogin no`, `PasswordAuthentication no`, `KbdInteractiveAuthentication no`. Vérifier dans un second terminal avant de fermer la session ; la console KVM d'OVH en dernier recours.
3. **Pare-feu Linux (`ufw`, interface de netfilter/nftables)** : tout refusé en entrée sauf SSH ; tout autorisé en sortie. Le tunnel sort vers Cloudflare : ni 80 ni 443 à ouvrir. Le pare-feu est à états : les réponses aux connexions sortantes reviennent.
4. **Pare-feu réseau d'OVH** (espace client, par IP, en amont du VPS) : facultatif tant que le tunnel est là. Il est sans états : une règle « TCP established » est indispensable, sinon le tunnel et `apt` cessent de fonctionner.
5. `unattended-upgrades` pour les mises à jour de sécurité du système ; `fail2ban` facultatif (réduit le bruit des journaux).
6. Plus tard : SSH par Cloudflare Access, et port 22 fermé lui aussi.

### Docker

- **`backend/Dockerfile`** en plusieurs étapes : image Node.js « slim » à version figée, dépendances de production seulement, utilisateur non root. Les secrets restent dans un `.env` sur le VPS (droits `600`), jamais dans l'image.
- **`docker-compose.prod.yml`** : trois services sur un réseau interne, **aucun port publié** :
  - `api` : le backend, joint par le tunnel sur le réseau interne ;
  - `db` : `postgres:18` (même version majeure qu'en dev et en test), volume nommé, contrôle de santé ;
  - `cloudflared` : le connecteur du tunnel.
- **Précautions** :
  - **fuseau horaire** : `TZ` dans les conteneurs et `timezone` de PostgreSQL égaux à celui du home lab actuel. Le backend utilise `CURRENT_DATE` (dates refusées dans le futur, semaines et mois du classement) : en UTC, le classement changerait de semaine à une autre heure ;
  - **journaux** : pilote `json-file` limité (`max-size`, `max-file`), sinon le disque de 40 Go se remplit ;
  - **mises à jour des images** : reconstruction et relance une fois par mois, et à chaque alerte de sécurité (Node.js, PostgreSQL, cloudflared) ;
  - **montée de version majeure de PostgreSQL** : sauvegarde et restauration, jamais un simple changement d'image.
- **`deploy.sh`** : `git pull`, construction de l'image sur le VPS, `docker compose up -d`, attente de `/api/health`. Plus tard, l'image peut être construite par une GitHub Action.
- **En dev** : la même composition, l'API accessible pour l'application de dev (`192.168.1.109:3001`).

### Sauvegardes

- La sauvegarde quotidienne d'OVH (dernières 24 heures, chez le même fournisseur) sert à restaurer vite tout le VPS ; elle ne suffit pas seule : une erreur remarquée le surlendemain y serait déjà.
- **`pg_dump` chaque nuit, chiffré (`age`), récupéré par le home lab** (le home lab vient chercher : le VPS n'a aucun accès au réseau du domicile), **30 jours** d'historique.
- Une **restauration testée** au moins une fois, puis après chaque changement de la procédure.

### Supervision

`/api/health` surveillé de l'extérieur (Uptime Kuma sur le home lab, ou contrôle de santé Cloudflare), avec alerte.

### Cloudflare

- **Étape 1 (cette migration)** : le tunnel est gardé et déplacé sur le VPS. `step-api.architech.lu` ne change pas : **aucune nouvelle version de l'application**.
- **Règles WAF** (Security → WAF), applicables dès maintenant :
  - bloquer tout chemin qui ne commence pas par `/api/` (robots qui cherchent `/wp-admin`, `/.env`…) ;
  - limiter le débit sur `/api/auth/*`, en plus de `rateLimit.ts`.
- **À ne pas activer** sur l'API : « Bot Fight Mode » et les défis (l'application ne peut pas les résoudre : la synchronisation échouerait sans message clair) ; le filtrage par pays (il bloquerait les examinateurs Google et Huawei et les testeurs en voyage).
- **Étape 2 (à décider plus tard)** : retirer Cloudflare de l'API. Argument : Cloudflare déchiffre le trafic de l'API (pas, minutes actives, jetons) ; sans lui, le trafic est chiffré du téléphone jusqu'au VPS en France, et la politique de confidentialité peut dire que les données de santé ne transitent que par un hébergeur de l'Union européenne. Ce qu'il faudrait alors :
  - **Caddy** devant l'API (certificats Let's Encrypt, seul `/api/*` transmis, limites de taille et de délai), ports 80 et 443 ouverts ;
  - le **pare-feu réseau d'OVH** devient utile (22, 80, 443) ; l'anti-DDoS d'OVH protège le réseau, pas l'applicatif ; `fail2ban` sur les journaux de Caddy ;
  - **`rateLimit.ts`** : lire l'adresse transmise par Caddy (`X-Forwarded-For`, `trustProxy` limité au proxy local) et ne plus faire confiance à `CF-Connecting-IP`, qu'un client pourrait sinon falsifier pour contourner les limites. À déployer avant la bascule ;
  - le DNS : soit Cloudflare reste pour le site seul, soit la zone `architech.lu` passe chez OVH (revérifier alors les App Links, qui dépendent de `assetlinks.json` en HTTPS) ;
  - un nouvel ADR remplaçant en partie l'ADR 0005, et `exposure.md` réécrit.

### Limitation de débit par compte (indépendant de l'hébergement)

Les routes authentifiées limitées (création d'invitation, signalement) devraient compter par compte plutôt que par adresse IP : clé infalsifiable, pas de gêne entre personnes qui partagent une IP. Les routes sans compte (connexion, accès démo, consultation d'un code d'invitation) gardent l'adresse IP.

## Procédure de migration

1. **En local** : `Dockerfile` et `docker-compose.prod.yml` ; lancer la composition sur le Mac, y restaurer une copie de la base, vérifier l'application de dev contre elle.
2. **Préparer le VPS** : sécurisation, Docker, fuseau horaire, `.env`, composition démarrée sans le connecteur du tunnel ; sauvegardes et supervision en place.
3. **Bascule** (quelques minutes) :
   1. arrêter l'API du home lab ;
   2. `pg_dump` du home lab, restauration sur le VPS ;
   3. démarrer l'API sur le VPS, puis basculer le tunnel (connecteur du home lab arrêté, celui du VPS démarré) ;
   4. vérifier `/api/health`, une connexion, une synchronisation, le classement.
4. **Retour en arrière possible** : le home lab reste arrêté mais intact quelques jours ; revenir, c'est rebasculer le connecteur (et reprendre les données écrites entre-temps).

Aucune perte de pas pendant l'arrêt : les synchronisations échouées sont refaites, et le serveur garde le plus grand total de chaque jour.

## Conséquences

- ✅ API disponible sans dépendre du domicile ; données de santé hors du home lab, dans l'Union européenne.
- ✅ Sauvegardes enfin automatiques, chiffrées, hors du VPS, testées.
- ✅ Mêmes versions en dev et en production ; changement d'hébergeur futur en une heure.
- ⚠️ Mises à jour des images à faire soi-même, chaque mois.
- ⚠️ Environ 5 € par mois.
- À mettre à jour : `exposure.md` (le home lab ne sert plus l'API), `STATUS.md`, `README` (déploiement), la politique de confidentialité (« hébergé dans l'Union européenne »), et le dossier Huawei s'il mentionne le lieu de traitement.

## Points ouverts

- Système des conteneurs LXC actuels et fuseau horaire du home lab (`timedatectl`), à reprendre tels quels.
- Version de Node.js en production, à figer dans le `Dockerfile`.
- Centre de données choisi à la commande.

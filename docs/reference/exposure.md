# Surface d'exposition

Inventaire de tout ce qui est accessible **sans authentification**, et de l'endroit où c'est hébergé. À mettre à jour à chaque nouvelle route ou page publique.

## Règle

**Ce qui est hébergé avec l'API (home lab jusqu'au 2026-10-27, VPS depuis) est authentifié.** Les seules exceptions sont celles qui ne peuvent pas l'être par nature (l'entrée dans l'authentification elle-même), listées ci-dessous avec leur justification. Tout contenu public est servi par l'hébergement public, pas par le home lab.

Voir l'[ADR 0005 — Site public et séparation des domaines](../adr/0005-public-site-and-domains.md) et l'[ADR 0014 — Site public sur `sport.architech.lu`](../adr/0014-public-site-on-sport-architech.md).

## Hébergement public : `sport.architech.lu` (OVH, derrière Cloudflare)

Site statique généré par Hugo, publié par le dépôt [`architech-sport`](https://github.com/mauvaisetroupe/architech-sport), commun aux applications de sport. Aucun code serveur, aucune base de données, aucun secret. Pour Step Challenge :

| Chemin | Contenu | Pourquoi public |
|---|---|---|
| `/step-challenge/`, `/step-challenge/help/…`, `/step-challenge/faq.html` et leurs équivalents `/fr/step-challenge/…` | Présentation de l'application, aide (Huawei, HMS Core…), FAQ | Contenu marketing et d'aide |
| `/step-challenge/privacy.html`, `/step-challenge/agreement.html`, `/step-challenge/delete-account.html` (et `/fr/step-challenge/…`) | Pages légales, aux URL déclarées dans la Play Console et chez Google Cloud | Doivent être lisibles par les examinateurs Google et Huawei, partout dans le monde |
| `/step-challenge/i/<code>` | Page d'atterrissage d'une invitation : explique comment installer l'application | Ouverte par un invité qui n'a pas encore l'application ni de compte. Le code n'est que dans l'adresse ; la page ne contacte aucun serveur. Seul le lien vers Google Play porte le code (`referrer`), pour que l'application ouvre l'invitation après l'installation ([ADR 0015](../adr/0015-invitation-through-install.md)) |
| `/.well-known/assetlinks.json` | Package et empreintes des certificats de signature (publics), une entrée par application du domaine | Lu par Android et les serveurs de Google pour vérifier les App Links, sans identifiant |

`step.architech.lu`, l'ancien site, n'est plus qu'une redirection 301 de Cloudflare vers ces pages (depuis le 2026-11-26).

## API : `step-api.architech.lu` (VPS, tunnel Cloudflare)

Toutes les routes `/api/*` exigent une session (`requireAuth`), **sauf** :

| Route | Rôle | Pourquoi sans session | Protections |
|---|---|---|---|
| `POST /api/auth/google` | Connexion : échange un jeton d'identité Google contre une session | C'est l'entrée de l'authentification. La requête porte un jeton signé par Google pour le client OAuth de l'application, vérifié par le serveur | Limite de débit (`RATE_LIMITS.signIn`), schéma strict (taille du jeton bornée) |
| `POST /api/auth/demo` | Accès de démonstration des examinateurs ([ADR 0006](../adr/0006-review-demo-access.md)) : un code d'accès contre une session sur le compte de démonstration, et sur lui seul | Les examinateurs Google et Huawei ne peuvent pas se connecter avec Google depuis leurs appareils de test. Le compte ne contient que des données fictives | **N'existe pas** (404) sans `DEMO_ACCESS_CODE` dans la configuration ; code d'au moins 20 caractères (sinon le serveur refuse de démarrer), comparé en temps constant ; limite de débit stricte (`RATE_LIMITS.demoSignIn`, 10 par heure) ; schéma strict. Changer ou retirer le code coupe l'accès |
| `GET /api/health` | Contrôle de vie : 200 `{"status":"ok"}` si la base répond, 503 sinon | Utilisé par le contrôle de santé de l'image, `deploy-app` (dépôt `vps-infra`) et la supervision | Ne renvoie aucune donnée. Peut être restreint par une règle Cloudflare si besoin |

Réponses génériques, inévitables pour tout serveur HTTP : `404` pour une route inconnue, réponses CORS aux requêtes `OPTIONS`.

## Historique

Jusqu'à la bascule du 2026-10-06, le home lab servait aussi, sans authentification, les pages publiques (`backend/public/`, via `@fastify/static`), `GET /i/:code` et `GET /.well-known/assetlinks.json`. Ils ont été supprimés du backend : ce contenu est servi par le site public.

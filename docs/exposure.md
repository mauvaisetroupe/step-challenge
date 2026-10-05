# Surface d'exposition

Inventaire de tout ce qui est accessible **sans authentification**, et de l'endroit où c'est hébergé. À mettre à jour à chaque nouvelle route ou page publique.

## Règle

**Ce qui est hébergé sur le home lab est authentifié.** Les seules exceptions sont celles qui ne peuvent pas l'être par nature (l'entrée dans l'authentification elle-même), listées ci-dessous avec leur justification. Tout contenu public est servi par l'hébergement public, pas par le home lab.

Voir l'[ADR 0005 — Site public et séparation des domaines](adr/0005-public-site-and-domains.md).

## Hébergement public : `step.architech.lu` (OVH, derrière Cloudflare)

Site statique généré par Hugo (`site/`). Aucun code serveur, aucune base de données, aucun secret.

| Chemin | Contenu | Pourquoi public |
|---|---|---|
| `/`, `/help/…`, `/faq.html` et leurs équivalents `/fr/…` (accueil, aide, guide) | Présentation de l'application, aide (Huawei, HMS Core…), guide utilisateur | Contenu marketing et d'aide |
| `/sitemap.xml`, `/robots.txt` | Liste des pages publiques pour les moteurs de recherche | Référencement du contenu public |
| `/privacy.html`, `/agreement.html`, `/delete-account.html` (et `/fr/…`) | Pages légales, aux URL déclarées dans la Play Console et chez Huawei | Doivent être lisibles par les examinateurs Google et Huawei, partout dans le monde |
| `/i/<code>` | Page d'atterrissage d'une invitation : explique comment installer l'application | Ouverte par un invité qui n'a pas encore l'application ni de compte. Le code n'est que dans l'adresse ; la page ne contacte aucun serveur |
| `/.well-known/assetlinks.json` | Package et empreintes des certificats de signature (publics) | Lu par Android et les serveurs de Google pour vérifier les App Links, sans identifiant |

## Home lab : API (`step-api.architech.lu`, tunnel Cloudflare)

Toutes les routes `/api/*` exigent une session (`requireAuth`), **sauf** :

| Route | Rôle | Pourquoi sans session | Protections |
|---|---|---|---|
| `POST /api/auth/google` | Connexion : échange un jeton d'identité Google contre une session | C'est l'entrée de l'authentification. La requête porte un jeton signé par Google pour le client OAuth de l'application, vérifié par le serveur | Limite de débit (`RATE_LIMITS.signIn`), schéma strict (taille du jeton bornée) |
| `GET /api/health` | Contrôle de vie (`{"status":"ok"}`) | Utilisé par `deploy.sh` et la supervision | Ne renvoie aucune donnée. Peut être restreint par une règle Cloudflare si besoin |

Réponses génériques, inévitables pour tout serveur HTTP : `404` pour une route inconnue, réponses CORS aux requêtes `OPTIONS`.

## État actuel (avant la bascule de l'ADR 0005)

Tant que la bascule n'est pas faite, le home lab sert aussi, sans authentification, le contenu qui doit partir sur l'hébergement public :

- les pages de `backend/public/` (`index.html`, pages légales), via `@fastify/static` ;
- `GET /.well-known/assetlinks.json` et `GET /i/:code` (`backend/src/routes/appLinks.ts`).

Après la bascule, ces routes et ce dossier sont supprimés du backend.

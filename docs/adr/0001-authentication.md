# ADR 0001 — Authentification des utilisateurs

- **Statut** : Accepté
- **Date** : 2026-10-04
- **Décideur** : mauvaisetroupe

## Contexte

Step Challenge passe d'une application de test entre amis à une application publiée en production sur le Google Play Store, gratuite, financée par des pourboires facultatifs. Son facteur différenciant est le support de Huawei Health, absent des applications concurrentes.

### Fonctionnement actuel

- À l'onboarding, l'utilisateur saisit un prénom. Si ce prénom existe, l'application **récupère le compte existant** ; sinon elle le crée. L'UUID obtenu est stocké dans AsyncStorage.
- Toutes les routes `/api/*` exigent un header `X-API-Key`, dont la valeur est embarquée dans l'APK (`EXPO_PUBLIC_API_KEY`).
- `POST /api/steps` reçoit le `userId` dans le corps de la requête, sans vérifier qui l'envoie.
- `GET /api/leaderboard` renvoie l'`id` de tous les utilisateurs.

### Problèmes

1. **Usurpation triviale** : saisir le prénom de quelqu'un donne accès à son compte.
2. **Écriture pour autrui** : les UUID sont publics (classement) et la clé API est extractible de l'APK. N'importe qui peut donc écrire des pas au nom de n'importe quel utilisateur.
3. **Aucune récupération** : un changement de téléphone ou une réinstallation fait perdre l'accès au compte (sauf à ressaisir le prénom, ce qui est précisément la faille 1).
4. **Prénom unique global** : intenable au-delà d'un cercle restreint.
5. **Obligations du Store** : une application qui crée des comptes doit permettre leur suppression, dans l'application et via une URL web.
6. **Données de santé** : les pas relèvent du RGPD (données de santé). Il faut collecter le minimum.

### Critères de décision

- Sécurité : l'identité de l'appelant est établie par le serveur, jamais déclarée par le client.
- Récupération du compte et multi-appareils sans support manuel.
- Minimisation des données personnelles.
- Effort d'implémentation et de maintenance raisonnable pour un développeur seul.
- Compatibilité avec la cible principale : Android avec services Google, y compris les utilisateurs de montres Huawei sur téléphone non-Huawei.
- Extensibilité vers d'autres modes de connexion sans migration de données.

## Options étudiées

### Option A — Jeton anonyme par appareil

À la création du compte, le serveur génère un secret aléatoire renvoyé une seule fois ; l'application le stocke dans `expo-secure-store`.

- ✅ Très simple, aucune dépendance externe, aucune donnée personnelle.
- ❌ Pas de récupération : perte du téléphone = perte du compte. Support manuel ou code de récupération à gérer par l'utilisateur.
- ❌ Pas de multi-appareils.
- ❌ Ne règle pas l'unicité du prénom comme identifiant.

### Option B — OpenID Connect avec Google (flux natif)

L'application obtient un ID token Google via Credential Manager (feuille système Android, sans navigateur). Le backend, en tant que Relying Party, valide le jeton et émet sa propre session.

- ✅ Récupération et multi-appareils natifs (on se reconnecte avec son compte Google).
- ✅ Code serveur réduit : validation d'un JWT signé.
- ✅ Familier pour les utilisateurs.
- ✅ Minimisation possible : seul le `sub` (identifiant Google opaque) est nécessaire.
- ❌ Dépendance à Google pour la connexion (pas pour les appels API ensuite).
- ❌ Indisponible sur les téléphones sans services Google (Huawei récents) — hors cible actuelle.
- ❌ Configuration d'un client OAuth dans Google Cloud.

### Option C — Passkeys (WebAuthn / FIDO2)

Le serveur est lui-même Relying Party WebAuthn ; la passkey est synchronisée par le gestionnaire de mots de passe de l'utilisateur.

- ✅ Aucun fournisseur d'identité tiers, résistant au phishing.
- ✅ Minimisation maximale : une clé publique.
- ✅ Changement de téléphone couvert si la passkey est synchronisée.
- ❌ Protocole plus riche côté serveur (challenges, enregistrement, assertions, compteurs).
- ❌ Digital Asset Links à publier (`/.well-known/assetlinks.json`, empreinte de la clé Play App Signing).
- ❌ Module natif Expo à identifier (support SDK 57 non vérifié).
- ❌ Si la passkey est perdue, aucun moyen d'identifier l'utilisateur : un mécanisme de secours reste nécessaire.

### Option D — Lien magique par e-mail

- ✅ Universel, indépendant des services Google.
- ❌ Service d'envoi d'e-mails à opérer (délivrabilité, coût, spam).
- ❌ Stockage d'une adresse e-mail, UX plus lente (aller-retour dans la messagerie).

## Décision

**Option B : OpenID Connect avec Google comme premier fournisseur, en flux natif, avec une session applicative opaque gérée par le backend.**

Le modèle de données identifie les utilisateurs par leurs **identifiants de connexion** (`(issuer, subject)` pour OIDC), afin de pouvoir ajouter ultérieurement des passkeys (option C), Huawei ID ou Apple sans migration.

## Conception

### Flux de connexion

```text
App Android                         Backend                      Google
    │  Credential Manager                │                            │
    │──────────── sélection du compte ──────────────────────────────▶│
    │◀─────────────────────────── ID token (JWT signé) ──────────────│
    │                                    │                            │
    │  POST /api/auth/google { idToken } │                            │
    │───────────────────────────────────▶│  vérifie signature (JWKS)  │
    │                                    │  iss, aud, exp             │
    │                                    │  (iss, sub) → user         │
    │                                    │  crée une session          │
    │◀──── { sessionToken, user } ───────│                            │
    │                                    │                            │
    │  Authorization: Bearer <session>   │                            │
    │───────────────────────────────────▶│  hash → session → user     │
```

- L'ID token est demandé avec le **client ID Web** comme `serverClientId` ; le backend vérifie que `aud` correspond à ce client ID.
- `iss` doit valoir `https://accounts.google.com` (ou `accounts.google.com`).
- Le backend n'utilise ni access token ni refresh token Google : OIDC sert uniquement à authentifier, une fois par connexion.
- L'e-mail Google n'est **pas stocké**.

### Session applicative

- Jeton opaque de 256 bits aléatoires, renvoyé une seule fois à l'application.
- Le serveur ne stocke que son **hash SHA-256** (un secret aléatoire de haute entropie ne nécessite pas de hachage lent).
- Stocké côté application dans `expo-secure-store` (Android Keystore), pas dans AsyncStorage.
- **Expiration glissante de 180 jours**, prolongée à chaque utilisation : la synchronisation en arrière-plan doit fonctionner sans interaction de l'utilisateur.
- Révocable individuellement (déconnexion) ou en masse (suppression du compte).
- Une session expirée ou révoquée renvoie `401` ; l'application redemande alors la connexion Google.

### Client web

Un site web (consultation des statistiques et du classement, suppression de compte) utilise le même mécanisme, seul le transport de la session change.

- **Connexion** : Google Identity Services fournit le même ID token OIDC, avec le même client ID Web. Le backend le valide de la même façon et retrouve le même utilisateur via `(issuer, subject)`.
- **Transport de la session** : pas de jeton dans `localStorage` (exposé en cas de XSS). Le backend pose un cookie `HttpOnly; Secure; SameSite=Lax` après `/api/auth/google`.
- **Middleware** : la session est lue depuis l'en-tête `Authorization: Bearer` (mobile) **ou** depuis le cookie (web) ; la recherche par hash est identique.
- **CSRF** : `SameSite=Lax` et API sur le même site que le front ; les écritures exigent `Content-Type: application/json`.
- **CORS** : la configuration actuelle (`origin: true`) est remplacée par une liste blanche explicite d'origines, obligatoire dès que les cookies sont envoyés avec `credentials`.
- **Durée** : 30 jours glissants pour une session web (pas de synchronisation en arrière-plan à maintenir).
- La page de suppression de compte exigée par le Play Store devient une page de ce site : connexion Google, puis suppression.

### Nom affiché

Le prénom n'est plus un identifiant : il devient un **nom affiché libre et non unique**, modifiable par l'utilisateur (`PATCH /api/me`). L'identité repose sur `users.id` et sur les identifiants de connexion.

Un pseudo unique (`@handle`) permettrait de rechercher des utilisateurs, mais imposerait de gérer un espace de noms (squat, renommage, modération) et créerait un annuaire consultable, peu souhaitable pour une application de santé. Il n'est pas retenu ; il reste ajoutable plus tard (colonne + index unique) sans remettre en cause cette décision.

Pour distinguer deux homonymes ou repérer un ami qui prend le nom d'un autre, l'ADR 0002 prévoit une pastille de couleur dérivée de l'identifiant et des alias locaux (section « Reconnaître ses amis »), plutôt qu'un nom unique.

### Modèle de données

```sql
-- users.name devient un nom affiché libre : l'index unique est supprimé.
DROP INDEX users_name_unique;

CREATE TABLE user_credentials (
    id           uuid        PRIMARY KEY,
    user_id      uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    type         text        NOT NULL CHECK (type IN ('oidc')),  -- 'passkey' plus tard
    issuer       text        NOT NULL,
    subject      text        NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    last_used_at timestamptz,
    UNIQUE (issuer, subject)
);

CREATE TABLE sessions (
    id           uuid        PRIMARY KEY,
    user_id      uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash   bytea       NOT NULL UNIQUE,
    created_at   timestamptz NOT NULL DEFAULT now(),
    last_used_at timestamptz NOT NULL DEFAULT now(),
    expires_at   timestamptz NOT NULL
);

-- La suppression d'un compte supprime ses pas.
ALTER TABLE daily_steps
    DROP CONSTRAINT daily_steps_user_fk,
    ADD CONSTRAINT daily_steps_user_fk
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;
```

### API

| Route | Changement |
|---|---|
| `POST /api/auth/google` | **Nouveau** : `{ idToken, displayName? }` → `{ sessionToken, user, isNewUser }`. Crée l'utilisateur au premier passage ; `displayName` est alors obligatoire (`422` sinon), puis ignoré aux connexions suivantes. |
| `POST /api/auth/logout` | **Nouveau** : révoque la session courante. |
| `GET /api/me` | **Nouveau** : profil de l'utilisateur connecté. |
| `PATCH /api/me` | **Nouveau** : modification du nom affiché. |
| `DELETE /api/me` | **Nouveau** : suppression du compte, de ses sessions et de ses pas. |
| `POST /api/me/steps` | **Remplace `POST /api/steps`** : plus de `userId`, l'utilisateur est celui de la session. Envoi groupé (jusqu'à 31 jours) ; le serveur conserve le maximum par jour. |
| `GET /api/me/steps` | **Remplace `GET /api/steps/:userId`** : historique limité par défaut (environ 13 mois). |
| `GET /api/leaderboard` | Requiert une session ; ajoute un indicateur `isMe`. Les `id` restent renvoyés : une fois les sessions en place, ils ne permettent plus d'écrire au nom d'autrui. Leur visibilité sera restreinte aux amis par l'ADR 0002. |
| `POST /api/users`, `GET /api/users/by-name/:name`, `GET /api/users/:id`, `POST /api/steps`, `GET /api/steps/:userId` | **Supprimées.** |

Les routes `/api/auth/*` sont soumises à une limite de débit (`@fastify/rate-limit`).

La clé API (`X-API-Key`) n'apporte plus rien une fois les sessions en place ; elle est supprimée lors de la bascule.

### Migration des testeurs existants : bascule franche

*Révisé le 2026-10-04 pendant l'implémentation.* La version initiale prévoyait une période de cohabitation entre anciennes et nouvelles routes. Elle est abandonnée :

- les anciennes routes **sont** les failles que cet ADR corrige : tant qu'elles existent, la nouvelle authentification se contourne simplement en passant par elles ;
- la cohabitation exige du code jetable (authentification facultative, unicité du prénom conservée, migration de nettoyage) ;
- l'application est en test fermé avec **4 testeurs**, joignables directement : une courte interruption de service est acceptable.

Déroulement :

1. Préparer la nouvelle version de l'application (connexion Google, nouvelles routes) et la publier en test fermé.
2. Le même jour, déployer le backend : migrations, suppression des anciennes routes et de la clé API.
3. Prévenir les testeurs : mettre à jour l'application, puis se connecter avec Google. Entre le déploiement et leur mise à jour, l'ancienne version affiche des erreurs.
4. À la première connexion d'un testeur, un nouvel utilisateur est créé. L'administrateur rattache ensuite en SQL l'historique de l'ancien compte au nouveau (déplacement des lignes `daily_steps`, suppression de l'ancien compte).

**Pas de rattachement automatique par UUID** : les UUID sont exposés par le classement actuel, ce serait réintroduire la faille.

Cette approche n'est valable que tant que les utilisateurs sont peu nombreux et joignables. Une évolution cassante future de l'API, avec des utilisateurs en production, nécessitera une période de compatibilité.

## Conséquences

### Positives

- L'identité est établie par le serveur ; les failles 1 et 2 disparaissent.
- Récupération et multi-appareils sans support manuel.
- Le prénom n'est plus un identifiant : homonymes possibles (voir « Nom affiché »).
- Le même compte est utilisable depuis l'application et depuis un site web.
- La suppression de compte exigée par le Store est couverte côté application.
- Ajouter passkeys, Huawei ID ou Apple revient à ajouter un type d'identifiant, sans migration.

### Négatives

- Dépendance à Google pour la connexion ; les téléphones sans services Google ne sont pas couverts tant qu'un second fournisseur n'est pas ajouté.
- Un client OAuth Google Cloud à configurer et à maintenir (client Web + client Android avec empreinte SHA-1 de la clé de signature Play).
- Ajout d'un module natif dans l'application.
- La politique de confidentialité et la déclaration « Sécurité des données » du Play Store doivent être mises à jour (identifiant de compte).
- La suppression de compte doit aussi être accessible via une URL web (exigence Play Store) : page à prévoir.

## Hors périmètre

À traiter dans des décisions ou travaux séparés :

- Anti-triche au-delà de la borne simple de `POST /api/me/steps` (100 000 pas par jour, pas de date future) : limite de débit sur les écritures, détection d'anomalies.
- **Système d'amis (ADR 0002)** : invitations, visibilité des pas limitée à soi et à ses amis, classement entre amis. Il repose sur l'identité établie par cet ADR. Les groupes de défi pourront venir ensuite, au-dessus du graphe d'amis.
- Hébergement hors du home lab.

## Points ouverts

- **Module natif de connexion Google** : choisir la bibliothèque à partir de la documentation Expo SDK 57 (config plugin disponible, support de Credential Manager).
- **Bibliothèque de validation côté serveur** : `google-auth-library` ou validation générique OIDC (`jose` + JWKS), plus adaptée à plusieurs fournisseurs.
- **Durée de session** : 180 jours glissants à confirmer à l'usage.

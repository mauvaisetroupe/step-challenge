# ADR 0002 — Amis et visibilité des pas

- **Statut** : Accepté
- **Date** : 2026-10-04
- **Décideur** : mauvaisetroupe
- **Dépend de** : [ADR 0001 — Authentification](0001-authentication.md)

## Contexte

Aujourd'hui, le classement est global : chaque utilisateur voit les pas de tous les autres. C'est acceptable entre quelques testeurs qui se connaissent, mais pas pour une application publique :

- les pas sont des **données de santé** : un utilisateur ne doit les partager qu'avec des personnes qu'il a choisies ;
- un classement global perd son sens au-delà d'un cercle restreint ;
- le produit visé est un défi **entre amis**.

L'ADR 0001 établit l'identité de l'appelant côté serveur. Cet ADR définit l'**autorisation** : qui peut voir les pas de qui.

### Contraintes héritées de l'ADR 0001

- Aucune adresse e-mail n'est stockée.
- Le nom affiché n'est pas unique.
- Il n'y a donc **aucun moyen de rechercher un utilisateur** — et c'est voulu : pas d'annuaire dans une application de santé.

### Critères de décision

- Partage uniquement avec des personnes explicitement acceptées, des deux côtés.
- Ajout d'amis simple, y compris pour inviter plusieurs personnes d'un coup (groupe WhatsApp, famille, collègues).
- Pas d'annuaire, pas de recherche d'utilisateurs.
- Possibilité de retirer un ami à tout moment, avec effet immédiat.
- Règles d'accès appliquées côté serveur uniquement.

## Options étudiées

### Option A — Recherche et demande d'ami

Rechercher un utilisateur (par pseudo ou e-mail), lui envoyer une demande, qu'il accepte.

- ✅ Modèle familier.
- ❌ Nécessite un identifiant recherchable (pseudo unique ou e-mail), écarté par l'ADR 0001.
- ❌ Crée un annuaire et ouvre la porte aux sollicitations non désirées.

### Option B — Lien d'invitation à usage unique

- ✅ Sécurité maximale : un lien = une personne.
- ❌ Fastidieux pour inviter un groupe : un lien par personne.

### Option C — Lien d'invitation multi-usage, expirant et révocable

Un utilisateur génère un lien, valable quelques jours, qu'il peut partager à une ou plusieurs personnes. Chaque personne qui l'ouvre et confirme devient son amie.

- ✅ Simple pour inviter un groupe d'un coup.
- ✅ Pas d'annuaire : on ne peut devenir ami qu'avec quelqu'un qui a partagé un lien.
- ✅ Double consentement : l'invitant en créant le lien, l'invité en confirmant.
- ❌ Un lien qui fuit permet à un inconnu de devenir ami pendant sa durée de validité — atténué par l'expiration, la révocation, la liste d'amis visible et le retrait d'un ami.

### Option D — Code ami permanent avec approbation

Chaque utilisateur a un code permanent ; les autres l'utilisent pour envoyer une demande, qu'il approuve.

- ✅ Contrôle total de l'invitant.
- ❌ Une étape d'approbation en plus, une notion de demande en attente à gérer.
- ❌ Un code permanent qui circule nécessite une régénération.

## Décision

**Option C : liens d'invitation multi-usage, expirant au bout de 7 jours, révocables.**

Une amitié est **symétrique** : si A et B sont amis, chacun voit les pas de l'autre. Le classement ne contient que l'utilisateur et ses amis.

## Conception

### Parcours d'invitation

```text
Invitant                         Backend                          Invité
   │ « Inviter des amis »           │                                │
   │ POST /api/invitations ────────▶│ code aléatoire, hash stocké    │
   │◀── { url, code, expiresAt } ───│                                │
   │                                │                                │
   │ partage https://step.architech.lu/i/K7F3-M9QX (WhatsApp, SMS…)  │
   │────────────────────────────────────────────────────────────────▶│
   │                                │                                │
   │                                │◀── GET /api/invitations/:code ─│ (App Link → appli)
   │                                │── { inviterName } ────────────▶│
   │                                │                                │ « Devenir ami avec Marie ? »
   │                                │◀── POST …/:code/accept ────────│
   │                                │ crée l'amitié                  │
```

- **Lien** : `https://step.architech.lu/i/<code>`, déclaré comme **Android App Link** (vérifié via `/.well-known/assetlinks.json`, le même fichier que pour les passkeys éventuelles). Le lien ouvre directement l'application.
- **Application non installée** : le lien ouvre une page web qui renvoie vers le Play Store et affiche le code. Après installation et connexion, l'utilisateur saisit le code dans l'écran « J'ai un code d'invitation ». Le deep link différé (Play Install Referrer) n'est pas retenu : trop complexe pour le gain.
- **Code** : 8 caractères en base32 Crockford, sans caractères ambigus, affiché `K7F3-M9QX` (~40 bits). Suffisant vu l'expiration à 7 jours et la limite de débit ; seul son hash SHA-256 est stocké.
- **Confirmation obligatoire** : ouvrir le lien n'ajoute pas l'ami ; l'invité voit le nom affiché de l'invitant et confirme.
- Accepter sa propre invitation, ou une invitation d'un ami existant, est sans effet.

### Règles d'accès

- Un utilisateur voit : **ses propres pas** et **les totaux journaliers de ses amis**.
- Toute requête qui renvoie des pas d'autres utilisateurs filtre côté SQL sur l'ensemble `{moi} ∪ amis(moi)`. Aucune route ne prend en paramètre un utilisateur arbitraire sans ce filtre.
- Le nom affiché d'un utilisateur n'est visible que par ses amis, et par les porteurs d'une invitation valide de sa part (aperçu avant confirmation).

### Retrait d'un ami

- Supprime l'amitié, des deux côtés, avec effet immédiat. Pas de notification.
- **Révoque toutes les invitations actives du demandeur**, pour qu'un ami retiré ne puisse pas revenir avec un lien encore valide. L'utilisateur peut en recréer.
- Supprime les **alias** que les deux anciens amis s'étaient donnés (voir ci-dessous), pour qu'un ami qui revient ne retrouve pas un ancien surnom.

### Reconnaître ses amis

*Ajouté le 2026-10-04.* Le nom affiché n'est ni unique ni figé (ADR 0001). Dans un classement, deux amis peuvent donc porter le même nom, et un ami peut prendre le nom d'un autre, par jeu ou pour semer la confusion.

**Option écartée : l'unicité du nom affiché.** Rendre le nom unique (même modifiable, avec un nom libéré dès qu'il change) règle les homonymes simultanés, mais :

- c'est une contrainte **globale** pour un problème **local** : un inconnu qui s'appelle déjà « Marie » empêche un nouvel utilisateur, qui n'a aucun lien avec lui, de prendre ce nom ;
- elle se contourne facilement : caractères visuellement identiques (`Lionel` avec un i cyrillique), ou récupération d'un nom abandonné par un autre ;
- elle n'apporte plus rien une fois les deux mécanismes ci-dessous en place.

**Décision : une pastille de couleur et des alias locaux.**

1. **Pastille de couleur** : chaque utilisateur est représenté par un rond portant l'initiale de son nom, dont la couleur est **dérivée de son identifiant** (et non de son nom). Deux homonymes ont deux couleurs différentes ; changer de nom ne change pas de couleur. Aucune donnée supplémentaire : la couleur est calculée côté application. Indépendante des amis, elle peut être livrée avant le reste de cet ADR.
2. **Alias locaux** : chacun peut donner **son propre surnom** à chacun de ses amis, comme dans les contacts d'un téléphone. Le classement affiche ce surnom, quel que soit le nom que l'ami se donne ; le nom choisi par l'ami reste visible en petit lorsqu'il diffère. Un alias est **orienté** : celui que je donne à Marion n'est pas celui que Marion me donne. Il n'est visible que par la personne qui l'a créé.

### Limites

- Limite de débit sur la création, l'aperçu et l'acceptation d'invitations (protection contre l'énumération des codes), par adresse IP du client, selon le même mécanisme que l'ADR 0001 (clé `CF-Connecting-IP`, stockage en mémoire, valeurs dans `backend/src/rateLimit.ts`). L'aperçu et l'acceptation ont chacun leur compteur : le nombre d'essais possibles reste très loin de ce que demanderait la découverte d'un code parmi ~10¹² en 7 jours.
- Au plus **10 invitations actives** par utilisateur.
- Au plus **200 amis** par utilisateur (garde-fou, ajustable).

### Modèle de données

```sql
CREATE TABLE invitations (
    id          uuid        PRIMARY KEY,
    inviter_id  uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    code_hash   bytea       NOT NULL UNIQUE,
    created_at  timestamptz NOT NULL DEFAULT now(),
    expires_at  timestamptz NOT NULL,
    revoked_at  timestamptz,
    use_count   integer     NOT NULL DEFAULT 0
);

-- Paire canonique (user_low < user_high) : une seule ligne par amitié,
-- pas de doublon A→B / B→A possible.
CREATE TABLE friendships (
    user_low      uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    user_high     uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at    timestamptz NOT NULL DEFAULT now(),
    invitation_id uuid        REFERENCES invitations (id) ON DELETE SET NULL,
    PRIMARY KEY (user_low, user_high),
    CHECK (user_low < user_high)
);

CREATE INDEX friendships_user_high_idx ON friendships (user_high);

-- Surnom que owner_id donne à friend_id (relation orientée).
-- Une ligne seulement lorsqu'un alias est défini.
CREATE TABLE friend_aliases (
    owner_id   uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    friend_id  uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    alias      text        NOT NULL CHECK (length(trim(alias)) BETWEEN 1 AND 50),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (owner_id, friend_id),
    CHECK (owner_id <> friend_id)
);
```

La suppression d'un compte (ADR 0001) supprime en cascade ses invitations, ses amitiés et les alias qu'il a donnés ou reçus. Le retrait d'un ami supprime les alias dans les deux sens (dans la même transaction que l'amitié).

### API

Toutes les routes exigent une session (ADR 0001).

| Route | Rôle |
|---|---|
| `POST /api/invitations` | Crée une invitation → `{ id, code, url, expiresAt }` |
| `GET /api/invitations` | Liste mes invitations actives (sans les codes, non stockés en clair) |
| `DELETE /api/invitations/:id` | Révoque une invitation |
| `GET /api/invitations/:code` | Aperçu : nom affiché de l'invitant, validité |
| `POST /api/invitations/:code/accept` | Crée l'amitié |
| `GET /api/friends` | Liste de mes amis `{ id, name, alias, since }` |
| `PUT /api/friends/:id/alias` | Définit le surnom que je donne à cet ami `{ alias }` |
| `DELETE /api/friends/:id/alias` | Revient au nom choisi par l'ami |
| `DELETE /api/friends/:id` | Retire un ami (révoque mes invitations actives, supprime les alias dans les deux sens) |
| `GET /api/leaderboard?period=` | Classement restreint à `{moi} ∪ amis(moi)` ; chaque entrée porte `name` (choisi par l'ami) et `alias` (le mien, s'il existe) |

### Application

- Écran **Amis** : liste des amis, bouton « Inviter » (feuille de partage Android), « J'ai un code d'invitation », retrait d'un ami.
- Écran de **confirmation** ouvert par l'App Link.
- Le classement affiche « toi et tes amis » ; avec zéro ami, un état vide invite à partager un lien.
- Chaque ami est affiché avec sa **pastille de couleur** et son **alias** s'il en a un (le nom qu'il s'est choisi apparaît en petit lorsqu'il diffère) ; « Renommer » depuis l'écran Amis (ou un appui long dans le classement).
- Le lien d'invitation fonctionne aussi depuis le site web (ADR 0001, client web).

### Migration des testeurs existants

Les testeurs actuels voient déjà tous les pas des autres dans le classement global. Lors de la migration, une **amitié est créée entre chaque paire de testeurs existants**, pour ne pas vider leur classement. Ils sont prévenus et peuvent retirer qui ils veulent.

## Conséquences

### Positives

- Les pas ne sont visibles que par des personnes choisies, avec un double consentement.
- Aucun annuaire, aucune recherche d'utilisateurs, aucune donnée de contact stockée.
- Invitation d'un groupe entier avec un seul lien.
- Règles d'accès centralisées dans les requêtes serveur.

### Négatives

- Un lien qui fuit pendant sa validité peut ajouter un inconnu ; l'utilisateur doit le repérer dans sa liste et le retirer.
- Configuration des App Links (`assetlinks.json` avec l'empreinte de la clé Play App Signing, intent filter `autoVerify` dans `app.json`).
- Page web d'atterrissage à prévoir pour les invités sans l'application.
- Pas de « demande d'ami » possible sans lien : c'est un choix de confidentialité, mais aussi une limite de découvrabilité.

## Hors périmètre

- Groupes de défi (défis datés, objectifs collectifs), construits plus tard au-dessus du graphe d'amis.
- Notifications (nouvel ami, dépassement au classement).
- Visibilité différenciée par ami (masquer ses pas à un ami sans le retirer).
- Blocage d'un utilisateur au-delà du retrait et de la révocation des invitations (voir l'[ADR 0004](0004-user-reporting-and-blocking.md)).

## Points ouverts

- **Durée de validité** : 7 jours, à ajuster à l'usage.
- **Plafonds** (10 invitations actives, 200 amis) : à ajuster à l'usage.
- **Configuration Expo des App Links** : `android.intentFilters` dans `app.json`, à vérifier dans la documentation SDK 57.
- ~~**Règle Google Play sur le contenu généré par les utilisateurs**~~ : traité par l'[ADR 0004 — Signalement et blocage des utilisateurs](0004-user-reporting-and-blocking.md).

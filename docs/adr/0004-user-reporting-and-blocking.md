# ADR 0004 — Signalement et blocage des utilisateurs

- **Statut** : Accepté
- **Date** : 2026-10-05
- **Décideur** : mauvaisetroupe
- **Dépend de** : [ADR 0002 — Amis et visibilité des pas](0002-friends.md)

## Contexte

L'ADR 0002 a laissé un point ouvert : la règle Google Play sur le contenu généré par les utilisateurs (*User Generated Content*, UGC). Google le définit comme du contenu qu'un utilisateur apporte à l'application et qui est visible par au moins une partie des autres utilisateurs.

Dans Step Challenge, ce contenu se limite au **nom affiché** :

- il est choisi librement à la création du compte et modifiable dans les Paramètres ;
- il est visible par les **amis** (classement, liste d'amis) ;
- il est aussi visible par **toute personne qui ouvre un lien d'invitation**, avant même d'accepter (écran « Devenir amis ? »), donc potentiellement par un inconnu si le lien circule.

Les **surnoms** (ADR 0002) ne sont visibles que par leur auteur : ce n'est pas du contenu généré par les utilisateurs au sens de la règle. Les **pas** sont des données de santé importées, pas du contenu rédigé.

### Ce que demande la règle Google Play

D'après la page d'aide « User Generated Content » (consultée le 2026-10-05), une application avec UGC doit :

1. faire **accepter ses conditions d'utilisation** avant que l'utilisateur puisse créer du contenu ;
2. y **définir et interdire** les contenus et comportements inacceptables ;
3. modérer « de façon raisonnable et adaptée au type de contenu », notamment avec un **système dans l'application pour signaler et bloquer** les contenus et les utilisateurs, et **agir** quand c'est justifié ;
4. éviter que la **monétisation** n'encourage les comportements inacceptables.

Une application qui « ne traite pas durablement les plaintes » des utilisateurs est citée comme exemple d'infraction. La règle ne fixe ni délai de traitement ni obligation de modération préalable.

### État actuel

- **Aucune acceptation des conditions** : la connexion Google puis le choix du nom se font sans renvoi vers les conditions d'utilisation.
- **`backend/public/agreement.html`** ne dit rien des noms affichés ni du comportement envers les autres utilisateurs, et son contact est encore un texte provisoire (`REPLACE-WITH-YOUR-PRIVACY-EMAIL`).
- **Blocage partiel** : retirer un ami supprime l'amitié et révoque mes liens d'invitation actifs. Mais la personne retirée peut redevenir mon amie si elle obtient plus tard un **nouveau** lien que j'ai partagé ailleurs (un groupe de discussion, par exemple), ou si j'accepte un lien venant d'elle par inadvertance.
- **Aucun signalement** possible.

### Critères de décision

- Conformité à la règle Google Play, sans en faire plus que ce que justifie un contenu limité à un nom.
- Charge de modération supportable pour un mainteneur seul.
- Confidentialité : un signalement ne doit rien révéler au signalé, et ne collecter que le nécessaire (RGPD).
- Simplicité d'usage : signaler ou bloquer en deux gestes.

## Options étudiées

### Option A — Minimum : conditions d'utilisation et signalement par e-mail

Acceptation des conditions à la création du compte, mise à jour d'`agreement.html`. Le bouton « Signaler » ouvre l'application de messagerie avec un e-mail prérempli vers le support. Le retrait d'un ami tient lieu de blocage.

- ✅ Presque rien à développer côté serveur.
- ❌ Le signalement sort de l'application et révèle l'adresse e-mail du signaleur ; la règle demande un système « dans l'application ».
- ❌ Le blocage reste contournable (nouveau lien).

### Option B — Signalement enregistré par le serveur, blocage persistant, modération manuelle

Acceptation des conditions, mise à jour d'`agreement.html`, signalement envoyé à l'API et stocké, blocage qui empêche toute nouvelle amitié entre les deux personnes. Le mainteneur traite les signalements à la main, selon une procédure écrite.

- ✅ Conforme à la lettre de la règle : signalement et blocage dans l'application, action possible.
- ✅ Le blocage n'est plus contournable par un nouveau lien.
- ✅ Volume de développement modéré (deux tables, quatre routes, deux écrans touchés).
- ❌ La modération repose sur la vigilance du mainteneur (pas de notification au départ).

### Option C — Option B, plus modération automatique

Liste de mots interdits à la saisie du nom, masquage automatique d'un nom après plusieurs signalements, notifications au mainteneur.

- ✅ Réaction plus rapide.
- ❌ Une liste de mots interdits produit des faux positifs (prénoms, autres langues) et se contourne facilement.
- ❌ Le masquage automatique permet à quelques comptes de faire taire un utilisateur.
- ❌ Disproportionné pour un contenu limité à un nom, visible seulement par des amis.

## Décision

**Option B.** La modération automatique (option C) pourra être reconsidérée si le volume de signalements le justifie.

## Conception

### Conditions d'utilisation

- **Acceptation** : à la création du compte, l'écran de choix du nom affiche « En créant ton compte, tu acceptes les conditions d'utilisation » avec un lien vers `agreement.html`, au-dessus du bouton de validation. Les comptes existants ne sont pas interrompus : les conditions mises à jour s'appliquent selon la clause de modification de l'accord, et la date de mise à jour est affichée sur la page.
- **Lien permanent** : les Paramètres donnent accès aux conditions d'utilisation et à la politique de confidentialité.
- **`agreement.html`**, nouvelle section « Contenus et comportement » :
  - le nom affiché ne doit pas être injurieux, haineux, sexuel, discriminatoire, ni usurper l'identité d'une autre personne ;
  - harcèlement et intimidation interdits, y compris par le biais des liens d'invitation ;
  - tout utilisateur peut signaler un autre utilisateur et le bloquer ;
  - en cas de manquement, le nom peut être réinitialisé et le compte suspendu ou supprimé.
- Correction du contact provisoire (`support@architech.lu`, comme les autres pages).

### Signalement

- **Où** : dans le menu d'un ami (écran Amis, à côté de « Renommer » et « Retirer »), et sur l'écran d'une invitation (« Signaler cette invitation »), sans avoir à l'accepter.
- **Motifs** : nom offensant, usurpation d'identité, harcèlement, autre. Commentaire facultatif (500 caractères au plus), lu seulement par le mainteneur.
- **Après le signalement**, l'application propose de **bloquer** la personne (proposition, pas automatique : on peut signaler un nom sans vouloir perdre un ami).
- **Le signalé n'est pas informé**, ni du signalement ni de son auteur.
- **Instantané** : le serveur enregistre le nom affiché au moment du signalement, car il peut changer ensuite.
- **Limite de débit** : comme les autres routes sensibles (`rateLimit.ts`), par exemple 10 signalements par heure et par utilisateur.

### Blocage

- **Bloquer** = retirer l'ami (si c'en est un) + empêcher toute nouvelle amitié entre les deux personnes, **dans les deux sens** :
  - accepter un lien d'invitation d'une personne bloquée, ou bloqueuse, échoue ;
  - l'aperçu d'une invitation n'indique pas l'existence d'un blocage : il affiche la même erreur qu'un lien invalide, pour ne pas révéler qu'on a été bloqué.
- **Retirer** reste distinct : on peut retirer un ami sans le bloquer (simple ménage).
- **Débloquer** : section « Personnes bloquées » dans l'écran Amis, avec le nom au moment du blocage (on ne voit plus le nom actuel d'une personne bloquée).

### Modération

- **Traitement manuel** par le mainteneur, avec une procédure écrite (`docs/moderation.md`) : requêtes SQL pour lister les signalements en attente, actions possibles, et traçabilité de la décision dans la table.
- **Actions** :
  - **réinitialiser le nom** de la personne signalée (« Utilisateur ») ; elle pourra le changer à nouveau ;
  - **supprimer le compte** dans les cas graves ou répétés, avec la procédure existante de suppression ;
  - **classer sans suite**.
- **Fréquence** : au moins une fois par semaine. Une notification au mainteneur (sans donnée personnelle, par exemple « 1 nouveau signalement ») est un point ouvert.

### Modèle de données

```sql
CREATE TABLE user_blocks (
    blocker_id   uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    blocked_id   uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    blocked_name text        NOT NULL,  -- nom affiché au moment du blocage
    created_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT user_blocks_pkey PRIMARY KEY (blocker_id, blocked_id),
    CONSTRAINT user_blocks_not_self CHECK (blocker_id <> blocked_id)
);

CREATE INDEX user_blocks_blocked_id_idx ON user_blocks (blocked_id);

CREATE TABLE user_reports (
    id            uuid        PRIMARY KEY,
    reporter_id   uuid        REFERENCES users (id) ON DELETE SET NULL,
    reported_id   uuid        REFERENCES users (id) ON DELETE SET NULL,
    reported_name text        NOT NULL,  -- instantané du nom affiché
    reason        text        NOT NULL,  -- offensive_name | impersonation | harassment | other
    comment       text,
    invitation_id uuid        REFERENCES invitations (id) ON DELETE SET NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),
    resolved_at   timestamptz,
    resolution    text,                  -- name_reset | account_deleted | dismissed
    CONSTRAINT user_reports_comment_length CHECK (length(comment) <= 500)
);
```

- `ON DELETE SET NULL` sur les deux personnes : un signalement survit à la suppression d'un compte, pour garder la trace d'une modération, sans rester rattaché à quelqu'un.
- **Conservation** : un signalement traité est supprimé au bout de 12 mois. Le nom instantané et le commentaire sont des données personnelles ; la politique de confidentialité doit le mentionner.

### API

| Méthode | Route | Rôle |
|---|---|---|
| `POST` | `/reports` | Signaler `{ userId, reason, comment?, invitationCode? }` → `201`. Signaler quelqu'un que je ne connais pas n'est possible que via une invitation dont il est l'auteur. |
| `POST` | `/blocks` | Bloquer `{ userId }` → `201` ; retire l'amitié, les surnoms dans les deux sens, révoque mes invitations actives (comme le retrait). |
| `GET` | `/blocks` | Mes blocages `[{ userId, name, since }]`. |
| `DELETE` | `/blocks/:userId` | Débloquer → `204`. Ne rétablit pas l'amitié. |

`POST /invitations/:code/accept` et `GET /invitations/:code` vérifient l'absence de blocage dans les deux sens ; s'il y en a un, ils répondent `404 invitation_not_found`, comme pour un lien invalide.

### Application

- Écran **Amis** : menu d'un ami → « Renommer », « Signaler », « Bloquer », « Retirer », « Annuler » ; section « Personnes bloquées » (si non vide).
- Écran **Invitation** : lien discret « Signaler cette invitation ».
- Écran de **choix du nom** : mention d'acceptation des conditions.
- **Paramètres** : liens vers les conditions d'utilisation et la politique de confidentialité.

## Conséquences

### Positives

- Conformité à la règle Google Play sur les contenus générés par les utilisateurs.
- Le blocage protège réellement : plus de retour possible par un nouveau lien.
- Les conditions d'utilisation deviennent explicites et acceptées.

### Négatives

- Une charge de modération, même faible, et l'engagement de la tenir.
- De nouvelles données personnelles (signalements) à déclarer : politique de confidentialité, et peut-être formulaire Data safety de Google Play.
- Un menu d'ami plus chargé.

## Hors périmètre

- Modération automatique (option C) : liste de mots interdits, masquage automatique.
- Suspension temporaire d'un compte (seules la réinitialisation du nom et la suppression sont prévues).
- Recours du signalé contre une décision, autrement que par e-mail au support.
- Monétisation : les dons envisagés pour financer l'hébergement ne donnent aucun avantage dans l'application ; rien à prévoir aujourd'hui pour le quatrième point de la règle. À revoir si cela change.

## Points ouverts

- **Notification du mainteneur** à chaque signalement : e-mail, ou service de notification, sans donnée personnelle dans le message.
- **Formulaire Data safety** : vérifier si les signalements (motif, commentaire) doivent y être déclarés.
- **Langue des conditions d'utilisation** : `agreement.html` est en anglais alors que l'application est en français ; une version française serait plus claire pour les utilisateurs.
- **Seuils** : limite de débit des signalements, durée de conservation (12 mois), à ajuster à l'usage.

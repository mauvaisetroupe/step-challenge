# ADR 0006 — Accès de démonstration pour les examinateurs

- **Statut** : Proposé
- **Date** : 2026-10-05
- **Décideur** : mauvaisetroupe
- **Dépend de** : [ADR 0001 — Authentification](0001-authentication.md)

## Contexte

L'application n'accepte que la connexion Google (ADR 0001). Pour examiner une version, Google Play demande un compte de démonstration (Play Console → Contenu de l'application → Accès à l'application) : un compte Gmail dédié a été créé à cet effet.

Ce compte ne permet pas aux examinateurs d'entrer :

- pour se connecter, l'examinateur doit ajouter le compte Google sur **son** appareil de test. Google y voit une connexion depuis un appareil inconnu et la **bloque** (« Sign-in attempt was blocked », « Suspicious sign-in attempt prevented », 2026-10-05) ;
- l'alerte arrive au propriétaire du compte **après** le blocage : répondre « c'était moi » n'aide pas l'examinateur en cours, et chaque examen arrive d'un nouvel appareil ;
- au 2026-10-05, la base de production ne contient **aucune session d'examinateur** pour ce compte : seule celle du mainteneur, à sa création.

En test fermé, les versions ont été acceptées malgré tout. L'examen d'une version en production publique est plus poussé, notamment sur la règle concernant le contenu généré par les utilisateurs (ADR 0004) : un refus pour « impossible d'accéder à l'application » est probable. Les examinateurs Huawei (AppGallery) rencontreront le même problème.

Utiliser une adresse d'un autre domaine (par exemple `@architech.lu`) ne change rien : un compte Google créé avec une adresse non Gmail reste un compte Google, soumis aux mêmes contrôles.

### Critères de décision

- Un examinateur entre dans l'application, depuis n'importe quel appareil et n'importe quel pays, avec des identifiants fournis dans la Play Console.
- Aucun affaiblissement de la connexion des vrais utilisateurs ; aucune donnée personnelle nouvelle (pas d'adresse e-mail, ADR 0001).
- Surface d'attaque minimale : l'accès de démonstration ne mène qu'à un compte sans donnée réelle (règle de [`docs/exposure.md`](../exposure.md)).
- L'examinateur voit l'application **en fonctionnement** (classement, amis), pas un écran vide.

## Options étudiées

### Option A — Ne rien changer, répondre aux alertes de sécurité

- ✅ Aucun développement.
- ❌ L'alerte arrive après le blocage ; l'examen en cours échoue quand même.

### Option B — Ajouter d'autres fournisseurs d'identité (Facebook, GitHub…)

- ❌ Mêmes contrôles de connexion suspecte (Facebook) ou code de vérification envoyé par e-mail à chaque nouvel appareil (GitHub) : l'examinateur reste bloqué.
- ❌ Un client OAuth de plus à maintenir, des données et des déclarations (confidentialité, Data safety) en plus, des comptes en double pour un même utilisateur ; Meta dans une application de données de santé est un mauvais signal.

### Option C — Connexion par e-mail et mot de passe pour tous

- ❌ Stocke des adresses e-mail et des mots de passe, ce que l'ADR 0001 a évité ; impose la réinitialisation de mot de passe, la vérification d'adresse, etc.
- ❌ Disproportionné : le besoin ne concerne que les examinateurs.

### Option D — Code d'accès de démonstration, réservé à un seul compte

Le serveur accepte un **code d'accès** secret, défini dans sa configuration, qui ouvre une session sur le **compte de démonstration**, et sur lui seul. L'écran de connexion propose une entrée discrète « Accès démonstration ».

- ✅ Fonctionne depuis n'importe quel appareil : aucun contrôle Google n'intervient.
- ✅ Aucune donnée personnelle ; le compte ne contient que des données fictives.
- ✅ Désactivable à tout moment en retirant le code de la configuration.
- ❌ Une route de connexion de plus, sans fournisseur d'identité : à protéger (code long et aléatoire, limite de débit).
- ❌ Une entrée visible par tous les utilisateurs sur l'écran de connexion.

## Décision

**Option D.**

## Conception

### Configuration du serveur

- `DEMO_ACCESS_CODE` (`.env` de production) : code d'au moins 20 caractères aléatoires. **Absent = accès de démonstration désactivé** (la route répond `404`), y compris en développement par défaut.
- Le code n'est jamais stocké en base ni commité ; il est donné aux examinateurs dans la Play Console (et AppGallery Connect), et conservé dans le gestionnaire de mots de passe du mainteneur.

### Compte de démonstration

- Un compte unique, reconnu par un identifiant de connexion dédié : `user_credentials` avec `type = 'demo'` (nouvelle valeur autorisée par une migration), `issuer = 'step-challenge'`, `subject = 'demo'`.
- **Recréé à la volée** : si le compte n'existe pas (premier usage, ou suppression du compte par un examinateur qui teste « Supprimer mon compte »), la connexion de démonstration le recrée, avec ses données fictives. Tester la suppression de compte ne casse donc pas l'examen suivant.
- **Données fictives** créées avec lui : nom « Demo », quelques amis fictifs (comptes sans identifiant de connexion, donc inaccessibles) avec des prénoms inventés et des pas crédibles sur plusieurs semaines, pour que le classement, les statistiques et l'écran Amis montrent l'application en fonctionnement.
- Les pas du compte de démonstration lui-même viennent, comme pour tout utilisateur, de Santé Connect sur l'appareil de l'examinateur.
- Le compte Gmail de démonstration actuel et son compte Step Challenge sont supprimés une fois l'accès de démonstration en place.

### API

| Méthode | Route | Rôle |
|---|---|---|
| `POST` | `/api/auth/demo` | `{ code }` → `200 { sessionToken, user }`, comme `POST /api/auth/google`. `401` si le code est faux, `404` si l'accès est désactivé. |

- Comparaison du code **en temps constant** (`crypto.timingSafeEqual` sur des empreintes SHA-256 de même longueur).
- **Limite de débit stricte**, par exemple 10 tentatives par heure et par adresse IP (`rateLimit.ts`).
- Session ordinaire (ADR 0001) : même durée, mêmes droits.

### Application

- Écran de connexion : lien discret en bas, « Accès démonstration », qui ouvre un champ « Code d'accès » et un bouton « Entrer ».
- Après la connexion, parcours normal (pas d'écran de choix du nom : le compte existe déjà).

### Instructions pour les examinateurs (Play Console → Accès à l'application)

> Step Challenge uses Google sign-in. For review, tap **"Accès démonstration"** at the bottom of the sign-in screen and enter the access code below. The demo account has fictitious friends and step history.

### Documentation

- [`docs/exposure.md`](../exposure.md) : ajouter `POST /api/auth/demo` aux exceptions sans session du home lab, avec ses protections.
- Politique de confidentialité : rien à ajouter (aucune donnée réelle).

## Conséquences

### Positives

- Les examinateurs Google et Huawei entrent dans l'application, depuis n'importe où.
- Ils voient l'application en fonctionnement grâce aux données fictives.
- La connexion des vrais utilisateurs ne change pas.

### Négatives

- Une route de connexion de plus, exposée sans fournisseur d'identité, protégée par un secret partagé.
- Le code circule (Play Console, AppGallery Connect) : s'il fuit, n'importe qui accède au compte de démonstration, qui ne contient rien de réel. Le changer suffit à couper l'accès.
- Des comptes fictifs en base, à exclure de toute statistique d'usage.

## Hors périmètre

- Plusieurs comptes de démonstration, ou un mode démonstration hors ligne.
- Restreindre les actions du compte de démonstration (inviter de vrais utilisateurs, signaler) : il agit comme un utilisateur ordinaire ; la limite de débit et la modération s'appliquent.

## Points ouverts

- **Libellé et emplacement** de l'entrée « Accès démonstration » : assez visible pour un examinateur guidé par les instructions, assez discret pour ne pas intriguer les utilisateurs.
- **Examinateurs Huawei** : vérifier qu'AppGallery Connect permet de fournir un code d'accès de la même façon.
- **Signalements venant du compte de démonstration** (un examinateur qui teste la fonction) : les reconnaître et les classer sans suite dans la procédure de modération.

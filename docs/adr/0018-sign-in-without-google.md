# ADR 0018 — Se connecter sans services Google : un code par e-mail

- **Statut** : Proposé
- **Date** : 2026-11-26
- **Décideur** : mauvaisetroupe
- **Lié à** : [ADR 0001 — Authentification](0001-authentication.md) (identifiants de connexion, option D écartée alors), [ADR 0006 — Accès de démonstration](0006-review-demo-access.md), [ADR 0008 — Client web](0008-web-client.md), [ADR 0013 — Choix de la source des pas](0013-step-source-choice.md), [ADR 0016 — HUAWEI Health par le serveur](0016-huawei-health-through-the-server.md) (OAuth web), [ADR 0017 — Accord explicite et droits](0017-consent-and-user-rights.md)

## Contexte

La seule façon de créer un compte est la connexion Google (ADR 0001), par le SDK Google du téléphone. Elle demande les **services Google Play**. Les téléphones Huawei vendus depuis 2019 n'en ont pas : sur eux, Step Challenge est inutilisable, sauf pour les examinateurs avec le code de démonstration (ADR 0006).

Ce sont précisément les utilisateurs pour qui le support de HUAWEI Health (ADR 0013) a le plus d'intérêt : montre **et** téléphone Huawei. La version AppGallery n'a donc pas de vrais utilisateurs possibles.

La même limite vaudra pour le client web (ADR 0008), qui ne peut pas utiliser le SDK Android, et pour un iPhone un jour.

L'ADR 0001 a prévu plusieurs identifiants par compte : la table `user_credentials` porte `(type, issuer, subject)`, avec `type` limité aujourd'hui à `'oidc'` et `'demo'`.

## Options étudiées

### Option A — HUAWEI ID

Connexion avec le compte HUAWEI, par OpenID Connect : le SDK Account Kit de HMS, ou le navigateur (flux « authorization code » par le serveur, le même que l'ADR 0016).

- ✅ Un tap ; tout utilisateur concerné en a un, pour HUAWEI Health et sa montre.
- ✅ Aucun nouveau tiers : HUAWEI voit déjà ses pas.
- ✅ Aucun changement de schéma (`type = 'oidc'`, émetteur HUAWEI).
- ❌ Spécifique à Huawei : ne règle ni le web ni l'iPhone.
- ❌ Plusieurs inconnues : format et vérification du jeton d'identité HUAWEI, flux web accepté pour une application Android (secret client, comme le point ouvert 1 de l'ADR 0016), un SDK HMS de plus.

### Option B — Autres fournisseurs OAuth (Facebook, GitHub, Microsoft, Apple)

Par le navigateur, donc sans services Google.

- ❌ Le public concerné n'en a pas plus que de compte Google (GitHub), ou c'est un mauvais signal pour une application de santé (Facebook, avec en plus l'examen de Meta).
- ❌ Facebook et GitHub ne sont pas OpenID Connect : un adaptateur par fournisseur.

### Option C — Passkeys

- ❌ Sous Android 9 à 13, le Credential Manager passe par les services Google Play. Les téléphones Huawei sans services Google tournent sous EMUI ou HarmonyOS 2 à 4, sur une base Android antérieure à 14 (où il fait partie du système) : pas de passkeys. Le FIDO Kit de HMS est une interface propre à Huawei.
- ❌ Un passkey non synchronisé disparaît avec le téléphone.

### Option D — Empreinte digitale (clé du Keystore)

Une paire de clés créée dans le Keystore, déverrouillée par l'empreinte ; le serveur garde la clé publique.

- ✅ Sans services Google.
- ❌ Ce n'est pas une identité : téléphone perdu, changé ou réinitialisé, compte perdu ; pas de second appareil ni de web. Il faudrait un moyen de récupération, donc une autre option.

### Option E — Code par e-mail

L'utilisateur saisit son adresse ; le serveur envoie un code à 6 chiffres ; l'utilisateur le saisit dans l'application.

- ✅ Universel : Huawei avec ou sans services Google, client web, iPhone, tablette.
- ✅ Aucun fournisseur d'identité tiers ; le compte survit au changement de téléphone.
- ✅ L'adresse n'a pas besoin d'être conservée (voir « Modèle de données »).
- ✅ Aucune inconnue technique : du travail d'exploitation seulement.
- ❌ Un service d'envoi à choisir, qui voit passer les adresses (sous-traitant à déclarer).
- ❌ Délivrabilité : SPF, DKIM et DMARC à régler sur le domaine d'envoi.
- ❌ Moins fluide qu'un tap : aller lire le code dans sa messagerie.
- ❌ Qui contrôle la boîte e-mail contrôle le compte.

Un code plutôt qu'un **lien magique** (l'option D de l'ADR 0001) : un lien doit s'ouvrir sur le téléphone même, et les messageries réécrivent ou ouvrent les liens, ce qui casse les App Links ou consomme le lien.

## Décision

**Option E, le code par e-mail**, proposé à tous, à côté de Google. HUAWEI ID (option A) reste possible plus tard, en confort pour les utilisateurs Huawei, sans changement de schéma.

### Modèle de données

**L'adresse e-mail n'est conservée nulle part.** Le serveur garde une empreinte de l'adresse normalisée (espaces retirés, minuscules), calculée avec une clé secrète :

```
subject = HMAC-SHA256(EMAIL_HASH_KEY, adresse normalisée), en hexadécimal
```

L'adresse saisie ne sert qu'à envoyer le code, puis elle est oubliée. Conséquence voulue : Step Challenge ne peut jamais écrire à un utilisateur de lui-même (il ne le fait pas aujourd'hui).

Migration `V009` :

```sql
-- user_credentials : un type de plus.
ALTER TABLE user_credentials DROP CONSTRAINT user_credentials_type_check;
ALTER TABLE user_credentials ADD CONSTRAINT user_credentials_type_check
    CHECK (type IN ('oidc', 'demo', 'email'));

-- Codes envoyés : pas de user_id, le compte n'existe peut-être pas encore.
CREATE TABLE email_sign_in_codes (
    id          uuid        PRIMARY KEY,
    email_hash  text        NOT NULL,
    code_hash   bytea       NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    expires_at  timestamptz NOT NULL,
    attempts    smallint    NOT NULL DEFAULT 0,
    used_at     timestamptz
);

CREATE INDEX email_sign_in_codes_hash_idx
    ON email_sign_in_codes (email_hash, created_at);
```

Une ligne `user_credentials` d'e-mail : `type = 'email'`, `issuer = 'email'`, `subject` = l'empreinte. L'unicité `(issuer, subject)` garantit une adresse par compte.

Le reste du modèle ne change pas : `users`, pas, amis, badges, journal des accords.

### Les codes

- 6 chiffres aléatoires (générateur cryptographique), valables **10 minutes**, à usage unique. Seule leur empreinte est gardée.
- **5 essais** par code ; au-delà, le code est refusé et il faut en demander un autre.
- Demander un nouveau code invalide les précédents de la même adresse.
- Limites : **5 codes par heure et par adresse** (comptés dans la table), et une limite par adresse IP (`rateLimit.ts`), contre l'envoi massif de codes à quelqu'un.
- Les codes sont supprimés 24 heures après leur création (tâche périodique du serveur, ou à chaque envoi).
- Ni l'adresse ni le code n'apparaissent jamais dans les journaux.

### API

- `POST /api/auth/email/code` `{ email }` : envoie un code dans la langue de l'application (`Accept-Language`). Répond **202** dans tous les cas où l'adresse est valide, que le compte existe ou non : la réponse ne révèle pas si une adresse a un compte. 429 au-delà des limites.
- `POST /api/auth/email` `{ email, code, displayName?, acceptedLegal? }` : comme `POST /api/auth/google` (ADR 0001 et 0017).
  - Adresse connue et code valide : session, 200.
  - Adresse inconnue et code valide, sans nom : **422** `display_name_required` avec les versions des documents ; le code **n'est pas consommé**, l'application le renvoie avec le nom.
  - Adresse inconnue, code valide et nom : compte créé, accords enregistrés, 201.
  - Code faux, expiré ou épuisé : 401 `invalid_code`.
- **Ajouter l'e-mail à un compte existant** (Plus → Compte) : `POST /api/me/credentials/email/code` `{ email }` puis `POST /api/me/credentials/email` `{ email, code }`. 409 si l'adresse est déjà liée à un autre compte. Utile à qui passe d'un téléphone avec Google à un téléphone Huawei sans services Google : il garde son compte, ses amis et son historique.
- Pas de retrait d'identifiant pour l'instant : un compte garde au moins une façon de se connecter.

### Application

- Écran de connexion : **Continuer avec Google** (si les services Google sont présents), puis **Continuer avec un e-mail**, toujours visible. Sans services Google, l'e-mail passe en premier.
- Deux écrans : l'adresse, puis le code (avec « Renvoyer le code » après 60 secondes). Pour un nouveau compte, l'écran du nom et de l'accord existant (ADR 0017).
- Plus → Compte : **Ajouter la connexion par e-mail**, et la liste des façons de se connecter du compte (Google, e-mail), sans afficher l'adresse, que le serveur ne connaît pas.

### Envoi des e-mails

- Par **SMTP**, avec un fournisseur d'envoi transactionnel (point ouvert 1). Le serveur ne dépend pas d'un fournisseur : hôte, port, utilisateur, mot de passe et expéditeur en variables d'environnement.
- Un e-mail court, texte et HTML, en français ou en anglais : le code, sa durée de validité, et « si tu n'as rien demandé, ignore ce message ».
- Expéditeur sur un domaine à nous, réglé pour la délivrabilité : SPF, DKIM et DMARC (point ouvert 2).

### Configuration (dans l'environnement, secrets)

| Variable | Rôle |
|---|---|
| `EMAIL_HASH_KEY` | Clé du HMAC des adresses. **Secret, définitive** : la changer rend toutes les adresses introuvables. À garder aussi dans le gestionnaire de mots de passe. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | Fournisseur d'envoi. |
| `EMAIL_FROM` | Expéditeur, par exemple `Step Challenge <no-reply@architech.lu>`. |

Sans ces variables, la connexion par e-mail est désactivée (routes en 404, bouton masqué par l'application), comme l'accès de démonstration.

## Conséquences

- Step Challenge devient utilisable sur un téléphone Huawei sans services Google, et le client web aura une connexion.
- Politique de confidentialité, changement de fond (nouvelle version, ADR 0017) : la connexion par e-mail, l'adresse non conservée (seule son empreinte), le service d'envoi comme sous-traitant, la durée de vie des codes. La section 1 dit aujourd'hui que l'adresse e-mail n'est pas conservée : c'est toujours vrai.
- Export (ADR 0017) : les identifiants y apparaissent avec leur type, sans adresse.
- Un nouveau service à exploiter : compte chez le fournisseur, enregistrements DNS, surveillance des rebonds.
- Les examinateurs Huawei pourraient se connecter par e-mail plutôt qu'avec le code de démonstration.

## Points ouverts

1. **Fournisseur d'envoi** : européen de préférence (Brevo, Mailjet, Scaleway Transactional Email), ou l'envoi d'e-mails d'OVH, qui héberge déjà le site public. Critères : hébergement des données dans l'UE, offre gratuite suffisante, clés DKIM fournies.
2. **Domaine d'envoi et DNS** : `architech.lu` ou un sous-domaine dédié (`mail.architech.lu`), pour ne pas mêler la réputation d'envoi au domaine principal ; où sont gérés ses enregistrements DNS (Cloudflare, ADR 0005 ? à vérifier).
3. **Source des pas par défaut** sur un téléphone sans Santé Connect : HUAWEI Health plutôt que le podomètre du téléphone (ADR 0013), puisque ces utilisateurs pourront désormais se connecter.
4. **Invitations sans Google Play** : l'ADR 0015 passe par le `referrer` de Google Play ; depuis AppGallery, seul le code d'invitation fonctionne. À dire sur la page des invitations.
5. **Test** : un téléphone Huawei sans services Google, ou un émulateur sans Google Play, pour vérifier l'ordre des boutons et tout le parcours.
6. **HUAWEI ID** (option A) plus tard, si le code par e-mail freine les utilisateurs Huawei : par le flux OpenID Connect générique, qui servirait aussi l'ADR 0016.

# ADR 0005 — Site public et séparation des domaines

- **Statut** : Accepté
- **Date** : 2026-10-05
- **Décideur** : mauvaisetroupe
- **Lié à** : [ADR 0002 — Amis](0002-friends.md) (liens d'invitation, App Links), [ADR 0004 — Signalement et blocage](0004-user-reporting-and-blocking.md) (conditions d'utilisation)

## Contexte

Tout est aujourd'hui servi par le backend, hébergé sur le home lab du mainteneur et exposé par un tunnel Cloudflare sous `step.architech.lu` :

- l'API (`/api/*`) ;
- les pages publiques : accueil, politique de confidentialité, conditions d'utilisation, suppression de compte (`backend/public/`) ;
- la page d'atterrissage des invitations (`/i/<code>`) et le fichier des App Links (`/.well-known/assetlinks.json`).

Deux besoins nouveaux :

- **Du contenu** : présentation de l'application, aide (notamment pour Huawei : installer AppGallery, HMS Core, Huawei Santé), guide utilisateur, en français et en anglais. Écrire ces pages en HTML à la main, dans le dossier du backend, ne tient pas la distance.
- **Réduire l'exposition du home lab** : n'y laisser que ce qui est authentifié, et pouvoir le filtrer (par pays, par exemple) sans gêner les visiteurs légitimes du contenu public (examinateurs Google et Huawei, invités à l'étranger, vérification des App Links par Google).

### Contraintes

- Les URL des pages légales sont **déclarées dans la Play Console et chez Huawei** (dont une demande Health Kit en cours d'examen) : elles doivent continuer à fonctionner.
- Les **App Links** sont déclarés dans l'application pour `https://step.architech.lu/i/` : changer ce nom demanderait une nouvelle version et une nouvelle vérification.
- L'URL de l'API est **compilée dans l'application** : la changer demande une nouvelle version, et les versions installées cessent de fonctionner quand l'ancienne adresse ne répond plus. Avec quelques testeurs en test fermé, c'est gérable à condition de respecter l'ordre de bascule ; ce le sera beaucoup moins une fois l'application publique.
- Pas d'achat de nom de domaine avant plusieurs mois : rester sous `architech.lu`.
- Le mainteneur dispose d'un hébergement web OVH (Apache, accès SFTP) et passe ses domaines par Cloudflare.

### Critères de décision

- Le home lab n'expose que de l'authentifié (voir la règle ci-dessous).
- Aucune URL déclarée à Google ou Huawei ne cesse de fonctionner.
- Le contenu est écrit en Markdown, versionné dans le dépôt, publié automatiquement.
- Une seule migration douloureuse : la faire maintenant, tant qu'il n'y a que des testeurs.

## Règle

**Ce qui est hébergé sur le home lab est authentifié.** Les seules exceptions sont celles qui ne peuvent pas l'être par nature : l'entrée dans l'authentification (`POST /api/auth/google`, protégée par le jeton Google et une limite de débit) et le contrôle de vie (`GET /api/health`, sans donnée). Tout contenu public est servi par l'hébergement public. L'inventaire est tenu dans [`docs/exposure.md`](../exposure.md).

## Options étudiées

### Option A — Tout garder sur le backend, site Hugo servi par Fastify

Hugo génère les pages dans le dossier statique du backend ; rien ne change de domaine.

- ✅ Aucune bascule, aucune nouvelle version de l'application.
- ❌ Le contenu public reste sur le home lab : contraire à la règle, et impossible à filtrer par pays sans bloquer examinateurs et invités.

### Option B — Site public sur un nouveau nom, API inchangée

Site Hugo chez OVH sous `stepchallenge.architech.lu` ; `step.architech.lu` garde l'API, les invitations et les App Links ; les anciennes pages légales sont redirigées par Cloudflare.

- ✅ Aucune nouvelle version de l'application.
- ❌ Deux noms presque identiques, des redirections permanentes à maintenir, et `/i/` et `/.well-known/` restent sur le home lab, sans authentification.

### Option C — Le nom actuel devient le site public, l'API passe sur un nom technique

`step.architech.lu` est servi par OVH (site Hugo, pages légales aux mêmes URL, invitations, App Links) ; l'API passe sur `step-api.architech.lu`, seul nom servi par le home lab.

- ✅ Respecte la règle : le home lab ne sert plus que l'API.
- ✅ Les URL déclarées restent valides (redirection vers les nouvelles pages) ; les App Links restent valides (même nom, nouvel hébergeur).
- ✅ Les invités ne touchent plus le home lab.
- ❌ Une nouvelle version de l'application (nouvelle URL d'API), et une bascule à orchestrer.
- ❌ La page `/i/<code>` devient statique : plus de vérification côté serveur de l'existence du code (l'application le vérifie à l'ouverture).

## Décision

**Option C.** La nouvelle version de l'application est de toute façon nécessaire pour l'ADR 0004 ; la bascule se fait maintenant, tant que seuls des testeurs sont concernés.

## Conception

### Noms

| Nom | Hébergement | Contenu |
|---|---|---|
| `step.architech.lu` | OVH (Apache), derrière Cloudflare | Site Hugo, pages légales, `/i/<code>`, `/.well-known/assetlinks.json` |
| `step-api.architech.lu` | Home lab, tunnel Cloudflare | `/api/*` uniquement |

Sous-domaine **à un seul niveau** pour l'API : le certificat Cloudflare gratuit couvre `*.architech.lu`, pas `*.step.architech.lu`.

### Site Hugo

- Dans le dépôt, sous `site/` ; version de Hugo figée (dans la GitHub Action).
- **Langues** : anglais (langue par défaut) et français, chacune dans son dossier (`defaultContentLanguageInSubdir`) : `/en/…` et `/fr/…`. La racine `/` redirige vers `/en/`. Un sélecteur de langue (drapeau) dans l'en-tête mène à la même page dans l'autre langue.
- **Mêmes chemins dans les deux langues** : seul le préfixe change (`/en/privacy/`, `/fr/privacy/`, `/en/help/huawei/`, `/fr/help/huawei/`). Pas de chemins traduits.
- **Pages légales** : `/en/privacy/`, `/en/agreement/`, `/en/delete-account/` et leurs équivalents `/fr/…`. Les conditions d'utilisation de l'ADR 0004 y sont rédigées directement.
- **Anciennes URL** (déclarées chez Google et Huawei) : redirection permanente par Apache, dans le `.htaccess` : `/privacy.html` → `/en/privacy/`, `/agreement.html` → `/en/agreement/`, `/delete-account.html` → `/en/delete-account/`. Une vraie redirection HTTP (301), plutôt que les pages de redirection HTML de Hugo (`aliases`), que certains robots suivent mal. Les URL déclarées dans les consoles seront mises à jour plus tard, sans urgence (après l'examen Huawei en cours).
- **Contenu initial** : accueil, aide Huawei (AppGallery, HMS Core, Huawei Santé, compte HUAWEI), aide Santé Connect, foire aux questions.
- **Pas de service tiers** : ni statistiques, ni polices ou scripts externes. Aucun cookie.
- **Thème** : à choisir ; de préférence un thème minimal ou des gabarits maison, pour ne pas dépendre d'un thème tiers.

### Invitations et App Links sur le site statique

- `static/.well-known/assetlinks.json` : même contenu qu'aujourd'hui (package et empreintes Google Play et d'importation, voir [`docs/signing.md`](../signing.md)). Servi en `application/json`, en HTTPS, **sans redirection** (Android ne les suit pas pour ce fichier).
- `static/.htaccess` :

  ```apache
  RewriteEngine On
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteRule ^i/[^/]+/?$ /i/index.html [L]

  Redirect 301 /privacy.html /en/privacy/
  Redirect 301 /agreement.html /en/agreement/
  Redirect 301 /delete-account.html /en/delete-account/

  <Files "assetlinks.json">
    ForceType application/json
  </Files>
  ```

  *Précisé le 2026-10-05 à l'implémentation :* la condition `RewriteCond %{REQUEST_FILENAME} !-f` est nécessaire. Sans elle, `/i/index.html` correspond aussi à la règle : Apache la réapplique en boucle et toute adresse `/i/…` renvoie une erreur 500 (constaté avec Apache 2.4).

- `/i/index.html` : page fixe ; un script lit le code dans l'adresse pour le bouton « Ouvrir dans l'application », avec le lien vers le Play Store. `noindex`, `<meta name="referrer" content="no-referrer">`, aucune ressource externe (le code d'invitation ne doit fuiter vers personne).
- Le nom de l'invitant n'est plus affiché sur la page web (la page actuelle ne l'affiche pas non plus) ; l'application l'affiche après ouverture.
- Les fichiers cachés (`.htaccess`, `.well-known/`) doivent être présents dans le site généré et envoyés par la GitHub Action (certaines actions SFTP les ignorent par défaut).

### Déploiement

- **GitHub Action** : à chaque modification de `site/` sur `main`, construction avec Hugo, puis envoi vers l'hébergement OVH. Identifiants dans les secrets GitHub, jamais dans le dépôt.
- **Modèle** : l'action du site personnel du mainteneur, qui fonctionne déjà avec OVH : [`hugo-mauvaisetroupe/.github/workflows/deploy.yml`](https://github.com/mauvaisetroupe/hugo-mauvaisetroupe/blob/master/.github/workflows/deploy.yml) (`peaceiris/actions-hugo` pour Hugo, `SamKirkland/FTP-Deploy-Action` pour l'envoi en différentiel). Adaptations pour ce dépôt :
  - déclenchement limité à `site/**` (`on.push.paths`), construction dans `site/` (`working-directory`), envoi de `site/public/` ;
  - **version de Hugo figée** (pas `latest`), pour des constructions reproductibles ;
  - **envoi chiffré** : `protocol: ftps` si l'hébergement OVH l'accepte, ou une action SFTP ; le FTP en clair fait passer le mot de passe sur le réseau ;
  - vérifier que `.htaccess` et `.well-known/` sont envoyés (exclusions par défaut de l'action) ;
  - **pas de commit de l'état de synchronisation** dans le dépôt depuis la CI : l'action conserve déjà son état sur le serveur (`.ftp-deploy-sync-state.json`), et un commit automatique sur `main` entrerait en concurrence avec les push du mainteneur ;
  - secrets du dépôt : `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD` ; dossier distant dédié au site sur l'hébergement OVH.
- **Préversion** : avant la bascule, le site est publié sous un nom temporaire pour vérification.

### Backend

- `PUBLIC_BASE_URL` reste `https://step.architech.lu` (base des liens d'invitation partagés).
- Après la bascule, suppression de `@fastify/static`, de `backend/public/` et des routes `appLinks.ts` (et de leurs tests).
- `deploy.sh` vérifie la santé via `step-api.architech.lu`.

### Application

- `EXPO_PUBLIC_API_URL` = `https://step-api.architech.lu` (variable EAS de production).
- Aucun autre changement : App Links et liens d'invitation restent sur `step.architech.lu`.

### Ordre de bascule

1. Ajouter `step-api.architech.lu` au tunnel Cloudflare : les deux noms mènent au backend.
2. Publier le site Hugo chez OVH sous un nom temporaire ; vérifier pages, `.htaccess`, `assetlinks.json`.
3. Publier la version de l'application qui utilise `step-api.architech.lu` ; attendre que les testeurs l'aient installée.
4. Faire pointer `step.architech.lu` vers OVH ; retirer ce nom du tunnel.
5. Vérifier : App Links (`adb shell pm get-app-links`, après réinstallation ou nouvelle vérification), pages légales et redirections des anciennes URL, `/i/<code>` avec et sans l'application.
6. Nettoyer le backend (routes et dossier statiques).
7. Éventuellement, filtrer `step-api.architech.lu` par pays dans Cloudflare (voir les points ouverts).

## Conséquences

### Positives

- Le home lab n'expose plus que l'API authentifiée, plus deux exceptions justifiées.
- Le contenu public est hébergé hors du home lab, accessible partout, et peut rester disponible si le home lab est en panne.
- Contenu en Markdown, bilingue, publié automatiquement.
- Les URL déclarées à Google et Huawei restent valides.

### Négatives

- Une version de l'application et une bascule à orchestrer.
- Deux hébergements à maintenir (OVH et home lab) et une GitHub Action de plus.
- Les versions de l'application antérieures à la bascule cessent de fonctionner.
- La page d'invitation ne vérifie plus l'existence du code.

## Hors périmètre

- Achat d'un nom de domaine propre : il fera l'objet d'un ADR dédié (nouveaux noms, App Links, URL déclarées).
- Contenu marketing détaillé, captures d'écran, traduction de l'application elle-même.

## Points ouverts

- **Filtrage par pays de l'API** : les rapports de pré-lancement et les examinateurs Google se connectent depuis des pays inconnus ; un filtrage trop strict peut faire échouer un examen. À tester prudemment (par exemple en mode journalisation avant blocage).
- **`GET /api/health`** : le restreindre par une règle Cloudflare, ou le laisser public (il ne renvoie rien).
- **Mise en cache Cloudflare** du site : durée, purge après déploiement.
- **Choix du thème Hugo.**

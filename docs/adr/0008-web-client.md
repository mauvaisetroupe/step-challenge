# ADR 0008 — Client web

- **Statut** : Proposé
- **Date** : 2026-10-06
- **Décideur** : mauvaisetroupe
- **Dépend de** : [ADR 0001 — Authentification](0001-authentication.md) (section « Client web »), [ADR 0005 — Site public et domaines](0005-public-site-and-domains.md)

## Contexte

Step Challenge n'existe que sous forme d'application Android. Consulter le classement depuis un ordinateur, ou depuis un téléphone sans l'application (iPhone, téléphone d'un ami), n'est pas possible.

L'application est écrite avec Expo, qui sait produire, à partir du même code, un **site web** (react-native-web, `npx expo export --platform web`). Le code le prévoit en partie : branches `Platform.OS === 'web'`, fichiers `.web.ts`. Mais cette version web n'a jamais fonctionné :

- la connexion Google utilise un module **natif Android** ; sa variante web (`auth/google.web.ts`) se contente d'un message « disponible seulement dans l'application » ;
- la session y est gardée **en mémoire** (`auth/session.web.ts`) et disparaît au rechargement de la page ;
- elle n'est publiée nulle part.

L'ADR 0001 a esquissé un client web : même jeton d'identité Google, session par **cookie `HttpOnly`** plutôt que jeton accessible au JavaScript, protection CSRF, liste blanche CORS. Cet ADR en fixe la conception.

### État du backend

- Les sessions sont lues dans l'en-tête `Authorization: Bearer` (`auth/authenticate.ts`), avec une durée glissante de 180 jours (`SESSION_TTL_DAYS`).
- CORS accepte toutes les origines (`origin: true`). L'application Android n'en a pas besoin : seul un navigateur applique CORS.
- L'API est sur `step-api.architech.lu`, le site public sur `step.architech.lu` (ADR 0005). Les deux sont sous `architech.lu` : pour un navigateur, ils sont **le même site** (*same-site*), ce qui simplifie les cookies.

### Critères de décision

- Aucune donnée de session lisible par le JavaScript de la page (résistance aux failles XSS).
- Aucun affaiblissement de l'application Android ni de la règle d'exposition ([`docs/exposure.md`](../exposure.md)) : le home lab ne sert que l'API authentifiée, le client web est du contenu statique chez OVH.
- Le même code pour l'application et le site, autant que possible.
- Une première version utile rapidement : **le classement** d'abord.

## Options étudiées

### Option A — Site écrit à part (Hugo, ou une autre technologie)

- ❌ Tout serait à réécrire (classement, amis, thème, traductions) et à maintenir deux fois.

### Option B — Export web d'Expo, session par jeton dans le navigateur

Le jeton de session, comme sur Android, mais gardé dans `localStorage`.

- ✅ Aucun changement du backend.
- ❌ Un jeton lisible par le JavaScript : toute faille XSS, dans le code ou dans une dépendance, permet de le voler et d'usurper le compte pendant 180 jours. Écarté par l'ADR 0001.

### Option C — Export web d'Expo, session par cookie `HttpOnly`

- ✅ Le même code que l'application.
- ✅ Le jeton n'est jamais accessible au JavaScript.
- ❌ Des changements du backend touchant à la sécurité (cookie, CSRF, CORS), à tester soigneusement.

## Décision

**Option C.**

## Conception

### Adresse du client web

**`https://step-app.architech.lu`** : un sous-domaine dédié, servi par l'hébergement OVH (dossier propre en multisite), derrière Cloudflare.

- Indépendant du site Hugo : la GitHub Action du site public envoie son dossier en miroir et supprimerait tout contenu qu'elle ne connaît pas ; un dossier `/app/` dans `step.architech.lu` imposerait de fusionner les deux constructions.
- Même site que l'API (`architech.lu`) : le cookie de session part avec les requêtes.
- Alternative possible, au prix d'une construction commune : `https://step.architech.lu/app/` (`experiments.baseUrl` d'Expo).

### Session par cookie

À la connexion depuis le web, le backend pose :

```
Set-Cookie: __Host-session=<jeton>; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=2592000
```

- **`HttpOnly`** : le jeton n'est pas lisible par le JavaScript.
- **Préfixe `__Host-`** : le navigateur exige `Secure`, `Path=/` et l'absence d'attribut `Domain` ; le cookie ne part que vers `step-api.architech.lu`, et aucun autre sous-domaine ne peut l'écraser.
- **`SameSite=Strict`** : le cookie n'est jamais envoyé par une requête venant d'un autre site. L'ADR 0001 prévoyait `Lax` ; `Strict` est plus sûr et suffit, car l'API n'est jamais ouverte par une navigation, seulement appelée par le client web, qui est sur le même site.
- **Durée** : 30 jours glissants pour une session web (ADR 0001), contre 180 pour l'application. Même table `sessions`, même empreinte SHA-256 du jeton.
- Le jeton n'apparaît **pas** dans le corps de la réponse pour une connexion web.

### API

| Route | Changement |
|---|---|
| `POST /api/auth/google` | Champ `client: 'web'` : pose le cookie, durée de 30 jours, ne renvoie pas le jeton. Sans ce champ : comportement actuel (jeton dans la réponse). |
| `POST /api/auth/demo` | Même champ `client: 'web'`, pour les examinateurs qui testeraient le web. |
| `POST /api/auth/logout` | Supprime aussi le cookie (`Max-Age=0`). |
| `DELETE /api/me` | Supprime aussi le cookie. |

`requireAuth` lit la session dans l'en-tête `Authorization` **ou**, à défaut, dans le cookie `__Host-session`. Même recherche par empreinte.

### CSRF et CORS

- **CORS** : `origin: true` est remplacé par une liste blanche, `https://step-app.architech.lu` (plus l'origine du serveur de développement local), avec `credentials: true`. L'application Android n'est pas concernée.
- **CSRF** : `SameSite=Strict` empêche l'envoi du cookie depuis un autre site. En complément, les requêtes qui modifient des données et s'authentifient **par cookie** doivent porter `Content-Type: application/json` (ce qui impose une requête préalable CORS, que la liste blanche refuse aux autres origines) ; les autres sont refusées.

### Connexion Google sur le web

- **Google Identity Services** (bouton « Se connecter avec Google » de Google) fournit le même jeton d'identité OIDC, avec le **même client ID Web** que l'application : le backend le vérifie déjà (`aud`).
- Dans Google Cloud, ajouter `https://step-app.architech.lu` aux **origines JavaScript autorisées** du client OAuth Web.
- Le script de Google Identity Services est chargé depuis `accounts.google.com` : seule ressource externe du client web.

### Application : ce qui change sur le web

| Fonction | Web |
|---|---|
| Classement, amis, invitations (lien copié plutôt que partagé), signalement et blocage | Identique |
| Accueil | Pas du jour, rang et séries **depuis la base** (pas de Santé Connect) |
| Statistiques | 7 jours, 30 jours et 1 an depuis la base ; vue 1 jour masquée (le détail heure par heure n'existe que sur le téléphone) |
| Paramètres | Compte, apparence, langue, informations légales, à propos ; synchronisation, Huawei et diagnostic masqués |
| Onglets | Barre d'onglets JavaScript (`(tabs)/_layout.web.tsx`) si les onglets natifs ne fonctionnent pas sur le web |
| Session | Plus de stockage du jeton : le cookie suffit (`auth/session.web.ts` et `api/client.ts`, `credentials: 'include'`) |

Le client web **affiche** les pas synchronisés par le téléphone ; il n'en ajoute pas. Un utilisateur sans l'application Android voit le classement de ses amis, avec 0 pas pour lui-même.

### Publication

- `npx expo export --platform web` produit des fichiers statiques, envoyés chez OVH par une GitHub Action, sur le modèle de celle du site public (SFTP, dossier marqué, version figée).
- `.htaccess` : toute adresse inconnue renvoie `index.html` (routes de l'application).
- `EXPO_PUBLIC_API_URL` = `https://step-api.architech.lu`, comme l'application.

### Documentation

- [`docs/exposure.md`](../exposure.md) : le client web dans l'hébergement public ; aucune nouvelle route sans session côté home lab.
- Politique de confidentialité : accès par le web, et cookie de session (strictement nécessaire au service : pas de bannière de consentement).

## Conséquences

### Positives

- Le classement est consultable depuis n'importe quel navigateur, y compris sur iPhone.
- Le même code que l'application : thème, traductions et écrans suivent.
- Une session web plus sûre qu'un jeton dans le navigateur.

### Négatives

- Des changements de sécurité dans le backend (cookie, CSRF, CORS), à couvrir par des tests.
- Un hébergement et une GitHub Action de plus.
- Les écrans doivent fonctionner en largeur d'ordinateur ; quelques ajustements propres au web (onglets, bouton retour du navigateur).

## Hors périmètre

- Saisie des pas sur le web, ou lecture d'une source de santé depuis le navigateur.
- Application iOS.
- Ouverture des liens d'invitation dans le client web pour un invité sans l'application (amélioration possible de la page `/i/<code>` du site public, plus tard).

## Points ouverts

- **Adresse** : sous-domaine `step-app.architech.lu` ou chemin `/app/` du site public.
- **Onglets natifs** (`NativeTabs`) : vérifier leur comportement sur le web avant d'écrire une variante.
- **Mise en page large** : largeur maximale du contenu sur ordinateur.
- **Examinateurs** : l'accès de démonstration sur le web, utile seulement si une boutique examine le client web.

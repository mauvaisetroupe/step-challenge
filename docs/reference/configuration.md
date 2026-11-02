# Configuration

La configuration de **production** de l'API et de l'image de migration (variables des conteneurs) est dans
[`exploitation.md`](../exploitation.md). Cette page décrit le développement et l'application.

## Backend

| Fichier | Lu par | Contenu |
|---|---|---|
| `backend/.env.development` | `npm run dev:local`, `npm run seed:demo` | Versionné, sans secret : la base de dev de `docker-compose.dev.yml` (port 55433), le client OAuth Web, `PORT=3001` |
| `backend/.env` | `npm run dev` | Ignoré par git. Facultatif en développement ; c'était la configuration de l'ancienne production (LXC) |

Variables lues et vérifiées au démarrage par `backend/src/config.ts` (toutes décrites dans
[`exploitation.md`](../exploitation.md#variables-denvironnement-de-lapi)). Rôle de certaines :

| Variable | Rôle |
|---|---|
| `DATABASE_*` | Connexion PostgreSQL |
| `GOOGLE_CLIENT_ID` | Client ID OAuth **Web** du projet Google Cloud `step-challenge` ; vérifié dans le champ `aud` des ID tokens Google. Pas un secret |
| `PORT`, `HOST` | Port (3000 par défaut, 3001 en dev) et interface d'écoute (`0.0.0.0`, à garder dans le conteneur) |
| `PUBLIC_BASE_URL` | Base des liens d'invitation (`<base>/i/<code>`) et des App Links, `https://step.architech.lu` par défaut |
| `DEMO_ACCESS_CODE` | Code d'accès de démonstration des examinateurs des boutiques ([ADR 0006](../adr/0006-review-demo-access.md)). **Secret**, au moins 20 caractères aléatoires (sinon le serveur refuse de démarrer), par exemple `openssl rand -base64 30`. Absent : l'accès de démonstration est désactivé (`POST /api/auth/demo` répond 404) |
| `APP_TIMEZONE` | Fuseau du jour, de la semaine et du mois du classement (`Europe/Paris`) |
| `CLIENT_IP_HEADER` | En-tête de l'adresse du client pour la limite de débit (`cf-connecting-ip`) |

Tests d'intégration : `TEST_DATABASE_URL` (donné par `npm run test:local`), jamais les `DATABASE_*`.

## Application : variables EAS

Stockées sur EAS, par environnement ; chaque profil de `eas.json` déclare son `environment`, et EAS CLI injecte ses
variables dans le bundle au build.

| Variable | `development` | `production` | Visibilité |
|---|---|---|---|
| `EXPO_PUBLIC_API_URL` | `http://<IP du Mac>:3001` | `https://step-api.architech.lu` | Plain text |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | client ID OAuth Web | client ID OAuth Web | Plain text |
| `AGCONNECT_SERVICES_JSON` | — | contenu de `agconnect-services.json` | Texte (secret) |

`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` est le même client que `GOOGLE_CLIENT_ID` côté backend : l'application le
transmet à Google, qui l'inscrit dans le champ `aud` de l'ID token.

```bash
cd apps/mobile
npx eas-cli env:list --environment development
npx eas-cli env:pull --environment development     # génère un .env local
```

La connexion Google (`react-native-nitro-google-signin`, Android Credential Manager) n'a **pas** son config plugin
dans `app.json` : sans Firebase, ce plugin ne configure que iOS et échoue s'il ne reçoit pas `iosUrlScheme`. Sur
Android, l'autolinking suffit et le client ID Web est passé dans le code. Une future version iOS devra l'ajouter avec
l'option `iosUrlScheme`.

## Application : `app.json` et `eas.json`

- `app.json` : `version` (seule version à monter), configuration native (le dossier `android/` est généré par
  `expo prebuild`, non versionné), `extraProguardRules` (R8).
- `eas.json` : profils `development`, `preview`, `production` (`autoIncrement` du `versionCode`), `appgallery` (APK,
  `PHONE_STEP_COUNTER`) ; `cli.appVersionSource: remote` (le `versionCode` est tenu par EAS) et
  `cli.requireCommit: true` (pas de build avec des modifications non commitées).
- `APP_VARIANT=development` : variante de développement, package `.dev`, installable à côté de l'application du Store.

## Site

`site/hugo.toml` (langues, adresse, lien Play Store, e-mail de contact), et les secrets et variables GitHub du
déploiement : [Mettre à jour le site](../how-to/update-the-public-site.md#secrets-et-variables-à-créer).

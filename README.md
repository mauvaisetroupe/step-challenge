# Step Challenge

Application de défi de pas entre amis : chaque téléphone lit ses pas (Health Connect ou Huawei Health), les synchronise vers un serveur, et un classement hebdomadaire / mensuel compare les participants.

```text
apps/mobile   Expo (SDK 57) / React Native — Android
   ├─ Health Connect (Android, Garmin…)
   ├─ Huawei Health Kit (en cours d'intégration, voir huawei/README.md)
   └─ tâche de fond quotidienne : synchro des 30 derniers jours
            │  HTTPS + session (connexion Google, ADR 0001)
            ▼
backend       Fastify + PostgreSQL — https://step.architech.lu
```

## Structure

| Dossier | Contenu |
|---|---|
| `apps/mobile` | Application Expo (expo-router, onglets Accueil / Stats / Classement / Paramètres) |
| `backend` | API Fastify (`/api/auth/*`, `/api/me`, `/api/me/steps`, `/api/leaderboard`, `/api/health`) et pages `privacy` / `agreement` |
| `huawei` | Notes et documents de la demande d'accès Huawei Health Kit |
| `icons` | Sources des icônes et visuels Google Play |

## Backend

### Configuration

Créer `backend/.env` :

```dotenv
DATABASE_HOST=
DATABASE_PORT=
DATABASE_NAME=
DATABASE_USER=
DATABASE_PASSWORD=
GOOGLE_CLIENT_ID=
# PORT=3000
# HOST=0.0.0.0
# PUBLIC_BASE_URL=https://step.architech.lu
```

| Variable | Rôle |
|---|---|
| `DATABASE_*` | Connexion PostgreSQL |
| `GOOGLE_CLIENT_ID` | Client ID OAuth **Web** du projet Google Cloud `step-challenge` ; vérifié dans le champ `aud` des ID tokens Google. Pas un secret |
| `PORT` | Port d'écoute, 3000 par défaut |
| `HOST` | Interface d'écoute, `0.0.0.0` (toutes) par défaut. En production, `127.0.0.1` : seul `cloudflared`, sur la même machine, joint le backend, ce qui garantit que l'en-tête `CF-Connecting-IP` utilisé par la limite de débit vient bien de Cloudflare |
| `PUBLIC_BASE_URL` | Base des liens d'invitation (`<base>/i/<code>`) et des App Links, `https://step.architech.lu` par défaut |

Créer les tables avec `psql -d <base> -f backend/schema.sql` (base neuve) ; faire évoluer une base existante avec [`backend/migrations/`](backend/migrations/README.md).

### Lancer en local

Le développement local utilise des bases PostgreSQL dans Docker ([`docker-compose.dev.yml`](backend/docker-compose.dev.yml)), **jamais la base de production** :

```bash
cd backend
npm install
npm run db:up        # bases de dev et de test, schéma appliqué à la création
npm run dev:local    # backend sur la base de dev, port 3001
```

`dev:local` lit [`backend/.env.development`](backend/.env.development) (versionné, sans secret) et non `.env`. Le backend écoute sur toutes les interfaces : un téléphone du même réseau le joint via `http://<IP du Mac>:3001` (variable `EXPO_PUBLIC_API_URL` de l'environnement EAS `development`).

| Commande | Effet |
|---|---|
| `npm run db:up` | Démarre les bases de dev (port 55433, persistante) et de test (port 55432, en mémoire) |
| `npm run db:reset` | Recrée les bases vides : **supprime les données de dev** |
| `npm run db:down` | Arrête les bases (les données de dev sont conservées) |

### Tests

```bash
cd backend
npm run db:up
npm run test:local
```

`npm test` seul n'exécute que les tests unitaires : les tests d'intégration (routes + PostgreSQL) ne tournent que si `TEST_DATABASE_URL` est défini, ce que fait `test:local`. Ils **vident les tables** et n'utilisent jamais les variables `DATABASE_*`.

### Déploiement

Sur le serveur (`/opt/step-challenge`, service systemd `step-challenge-api`) :

- `install-step-challenge.sh` : installation initiale (Node.js, service systemd) ;
- `deploy.sh` : `git pull`, `npm ci`, build, redémarrage et vérification de `/api/health`.

## Application mobile

L'application utilise des modules natifs (Health Connect, Huawei Health, connexion Google) : elle ne fonctionne **pas dans Expo Go**, il faut un development build.

### Configuration

Les variables d'environnement sont stockées sur EAS, par environnement :

| Variable | `development` | `production` | Visibilité |
|---|---|---|---|
| `EXPO_PUBLIC_API_URL` | `http://<IP du Mac>:3001` | `https://step.architech.lu` | Plain text |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | client ID OAuth Web | client ID OAuth Web | Plain text |

`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` est le client ID **Web** du projet Google Cloud `step-challenge`, le même que `GOOGLE_CLIENT_ID` côté backend : l'application le transmet à Google, qui l'inscrit dans le champ `aud` de l'ID token. Ce n'est pas un secret.

Chaque profil de `eas.json` déclare son `environment` : lors d'un build, EAS CLI récupère les variables correspondantes et les injecte dans le bundle.

```bash
cd apps/mobile
npx eas-cli env:list --environment development
npx eas-cli env:pull --environment development   # génère un .env local
```

### Lancer en local

Prérequis : Android SDK installé, avec dans `~/.zshrc` :

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
```

```bash
cd apps/mobile
npm install
npx expo run:android
```

Le dossier `android/` est généré par `expo prebuild` et n'est pas versionné : toute configuration native passe par `app.json` et les config plugins de `apps/mobile/plugins/`.

La connexion Google (`react-native-nitro-google-signin`, Android Credential Manager) n'a **pas** son config plugin dans `app.json` : sans Firebase, ce plugin ne configure que iOS et échoue s'il ne reçoit pas `iosUrlScheme`. Sur Android, l'autolinking suffit et le client ID Web est passé dans le code. Une future version iOS devra l'ajouter avec l'option `iosUrlScheme`.

### Build et publication

Distribution via le Google Play Store (test fermé). Les builds sont faits **en local**, EAS cloud ne sert qu'à stocker :

- les **credentials** Android (keystore de signature, alias, mots de passe) ;
- les **variables d'environnement** (voir ci-dessus) ;
- le numéro de version Android (`versionCode`), incrémenté automatiquement (`appVersionSource: remote`, `autoIncrement`).

```bash
cd apps/mobile
npx eas-cli build --platform android --profile production --local
```

Le build produit un `.aab` signé à téléverser dans la Google Play Console. Les credentials se consultent ou se modifient avec `npx eas-cli credentials`.

Clés de signature, empreintes et services où elles sont déclarées (Play, connexion Google, Huawei) : voir [`docs/signing.md`](docs/signing.md).

## Licence

[GNU AGPL-3.0-or-later](LICENSE), avec une permission additionnelle autorisant la liaison avec les SDK propriétaires des plateformes (Google Play services, Huawei HMS) — voir [NOTICE](NOTICE).

Le nom « Step Challenge » et son logo ne sont pas couverts par la licence : voir [TRADEMARKS.md](TRADEMARKS.md).

Les choix de licence sont expliqués dans l'[ADR 0003](docs/adr/0003-open-source-license.md). Les versions publiées avant ce changement restent disponibles sous licence MIT.

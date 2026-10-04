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
```

| Variable | Rôle |
|---|---|
| `DATABASE_*` | Connexion PostgreSQL |
| `GOOGLE_CLIENT_ID` | Client ID OAuth **Web** du projet Google Cloud `step-challenge` ; vérifié dans le champ `aud` des ID tokens Google. Pas un secret |
| `PORT` | Port d'écoute, 3000 par défaut |

Créer les tables avec `psql -d <base> -f backend/schema.sql` (base neuve) ; faire évoluer une base existante avec [`backend/migrations/`](backend/migrations/README.md).

### Lancer en local

```bash
cd backend
npm install
npm run dev      # tsx watch, port 3000 (ou $PORT)
```

### Tests

```bash
cd backend
npm test
```

Les tests d'intégration (routes + PostgreSQL) ne tournent que si `TEST_DATABASE_URL` est défini ; ils **vident les tables** et n'utilisent jamais les variables `DATABASE_*` du `.env`. Avec Docker :

```bash
docker run -d --name step-challenge-test-db -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=step_challenge_test -p 55432:5432 postgres:18
docker exec -i step-challenge-test-db psql -U postgres -d step_challenge_test < backend/schema.sql

cd backend
TEST_DATABASE_URL=postgres://postgres:test@localhost:55432/step_challenge_test npm test
```

### Déploiement

Sur le serveur (`/opt/step-challenge`, service systemd `step-challenge-api`) :

- `install-step-challenge.sh` : installation initiale (Node.js, service systemd) ;
- `deploy.sh` : `git pull`, `npm ci`, build, redémarrage et vérification de `/api/health`.

## Application mobile

L'application utilise des modules natifs (Health Connect, Huawei Health) : elle ne fonctionne **pas dans Expo Go**, il faut un development build.

### Configuration

Les variables d'environnement sont stockées sur EAS, par environnement :

| Variable | `development` | `production` | Visibilité |
|---|---|---|---|
| `EXPO_PUBLIC_API_URL` | `http://<IP locale>:3000` | `https://step.architech.lu` | Plain text |
| `EXPO_PUBLIC_API_KEY` | clé de dev | clé de prod | Sensitive |

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

## Licence

[GNU AGPL-3.0-or-later](LICENSE), avec une permission additionnelle autorisant la liaison avec les SDK propriétaires des plateformes (Google Play services, Huawei HMS) — voir [NOTICE](NOTICE).

Le nom « Step Challenge » et son logo ne sont pas couverts par la licence : voir [TRADEMARKS.md](TRADEMARKS.md).

Les choix de licence sont expliqués dans l'[ADR 0003](docs/adr/0003-open-source-license.md). Les versions publiées avant ce changement restent disponibles sous licence MIT.

# Step Challenge

Application de défi de pas entre amis : chaque téléphone lit ses pas (Health Connect ou Huawei Health), les synchronise vers un serveur, et un classement hebdomadaire / mensuel compare les participants.

```text
apps/mobile   Expo (SDK 57) / React Native — Android
   ├─ Health Connect (Android, Garmin…)
   ├─ Huawei Health Kit (en cours d'intégration, voir huawei/README.md)
   └─ tâche de fond quotidienne : synchro des 30 derniers jours
            │  HTTPS + X-API-Key
            ▼
backend       Fastify + PostgreSQL — https://step.architech.lu
```

## Structure

| Dossier | Contenu |
|---|---|
| `apps/mobile` | Application Expo (expo-router, onglets Accueil / Stats / Classement / Paramètres) |
| `backend` | API Fastify (`/api/users`, `/api/steps`, `/api/leaderboard`, `/api/health`) et pages `privacy` / `agreement` |
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
API_KEY=
```

Créer les tables avec `psql -d <base> -f backend/schema.sql`.

`API_KEY` doit correspondre à `EXPO_PUBLIC_API_KEY` côté mobile : toutes les routes `/api/*` exigent le header `X-API-Key`.

### Lancer en local

```bash
cd backend
npm install
npm run dev      # tsx watch, port 3000
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

MIT — voir [LICENSE](LICENSE).

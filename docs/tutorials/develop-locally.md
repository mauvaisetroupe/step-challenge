# Développer en local

D'un Mac sans rien au backend qui tourne sur une base de développement, et à l'application de développement sur un
téléphone Android qui s'y connecte.

```
téléphone (development build) ──► backend :3001 (npm run dev:local) ──► PostgreSQL dev :55433 (Docker)
                                                                        PostgreSQL test :55432 (Docker)
```

La base de production n'est **jamais** utilisée en développement.

## 0. Les outils (une fois)

| Outil | Pour | Installer |
|---|---|---|
| Git | Le dépôt | `xcode-select --install` |
| Node.js **24** (celui de la CI et de l'image) | Backend et application | `brew install node@24`, ou nvm : `nvm install 24` |
| Docker avec Compose | Les bases de dev et de test, les migrations | Docker Desktop ou OrbStack |
| Android Studio (SDK Android) | L'application | `brew install --cask android-studio`, puis l'assistant installe le SDK |
| Un compte Expo | Variables d'environnement et credentials EAS | `npx eas-cli login` |
| Hugo (version de la CI) | Seulement pour le site | [Mettre à jour le site](../how-to/update-the-public-site.md) |

Dans `~/.zshrc` :

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
```

```bash
git clone https://github.com/mauvaisetroupe/step-challenge.git
cd step-challenge
```

## 1. Les bases

```bash
cd backend
npm install
npm run db:up
```

Démarre les bases de dev (port 55433, persistante) et de test (port 55432, en mémoire), puis leur applique les
migrations avec l'image de migration (Flyway). À relancer après l'ajout d'une migration.

Une base de dev créée avant Flyway (sans table `flyway_schema_history`) est refusée par l'image de migration : la
reprendre une fois avec
`docker compose -f docker-compose.dev.yml run --rm -e FLYWAY_BASELINE_ON_MIGRATE=true -e FLYWAY_BASELINE_VERSION=6 dev-migrations`,
ou la recréer avec `npm run db:reset`.

## 2. Le backend

```bash
npm run dev:local
```

Backend sur la base de dev, port 3001, relancé à chaque modification. Il lit
[`backend/.env.development`](../../backend/.env.development) (versionné, sans secret), pas `.env`. Il écoute sur
toutes les interfaces : un téléphone du même réseau le joint via `http://<IP du Mac>:3001`.

```bash
curl http://localhost:3001/api/health          # {"status":"ok"}
```

Pour tester l'accès de démonstration (ADR 0006) : `DEMO_ACCESS_CODE=<au moins 20 caractères> npm run dev:local`.

## 3. Les tests

```bash
npm run test:local
```

`npm test` seul n'exécute que les tests unitaires : les tests d'intégration (routes + PostgreSQL) ne tournent que si
`TEST_DATABASE_URL` est défini, ce que fait `test:local`. Ils **vident les tables** de la base de test et n'utilisent
jamais les variables `DATABASE_*`.

## 4. L'application

L'application utilise des modules natifs (Santé Connect, Huawei Health, connexion Google) : elle ne fonctionne **pas
dans Expo Go**, il faut un development build.

Les variables d'environnement sont sur EAS, par environnement ([Configuration](../reference/configuration.md)). Dans
l'environnement `development`, `EXPO_PUBLIC_API_URL` doit valoir `http://<IP du Mac>:3001` :

```bash
cd apps/mobile
npm install
npx eas-cli env:list --environment development
```

Brancher le téléphone (débogage USB activé, `adb devices`), puis :

```bash
npm run android:dev            # variante de développement (package .dev), à côté de l'application du Store
npm run start:dev              # ensuite, pour relancer Metro seul
```

Le dossier `android/` est généré par `expo prebuild` et n'est pas versionné : toute configuration native passe par
`app.json` et les config plugins de `apps/mobile/plugins/`. Ne jamais lancer `expo prebuild --clean`
([l'intégration Huawei](../explanation/huawei-integration.md), section 11).

## 5. Essayer

Se connecter avec Google dans l'application de développement (client OAuth Android de la clé de debug, package
`.dev` : [Signature Android](../reference/android-signing.md)), synchroniser, ouvrir le classement. Vérifier dans la
base :

```bash
docker compose -f backend/docker-compose.dev.yml exec dev-db psql -U step_challenge -d step_challenge_dev -c 'SELECT count(*) FROM daily_steps'
```

## Arrêter

```bash
cd backend
npm run db:down                # arrête les bases ; les données de dev restent
npm run db:reset               # recrée des bases vides : supprime les données de dev
```

## Et ensuite

- Comprendre : [l'architecture](../explanation/architecture.md), puis les ADR.
- Avant de livrer : `npx tsc --noEmit` dans `backend/` et `apps/mobile/`, `npm test`, `npm run check:i18n` dans
  `apps/mobile/` (ce que fait la CI).
- Livrer : [l'API](../how-to/release-the-api.md), [Google Play](../how-to/publish-on-google-play.md),
  [AppGallery](../how-to/publish-on-appgallery.md).

# Step Challenge

Application de défi de pas entre amis : chaque téléphone lit ses pas (Health Connect ou Huawei Health), les synchronise vers un serveur, et un classement hebdomadaire / mensuel compare les participants.

```text
apps/mobile   Expo (SDK 57) / React Native — Android
   ├─ Health Connect (Android, Garmin…)
   ├─ Huawei Health Kit (en cours d'intégration, voir docs/explanation/huawei-integration.md)
   └─ tâche de fond quotidienne : synchro des 30 derniers jours
            │  HTTPS + session (connexion Google, ADR 0001)
            ▼
backend       Fastify + PostgreSQL — https://step-api.architech.lu
```

## Structure

| Dossier | Contenu |
|---|---|
| `apps/mobile` | Application Expo (expo-router, onglets Accueil / Stats / Classement / Paramètres) |
| `backend` | API Fastify (`/api/auth/*`, `/api/me`, `/api/me/steps`, `/api/leaderboard`, `/api/health`) |
| `huawei` | Documents de la demande d'accès Huawei Health Kit |
| `site` | Site public `step.architech.lu` (Hugo) |
| `docs` | Documentation, ADR, état du projet |
| `icons` | Sources des icônes et visuels Google Play |

## Documentation

Toute la documentation est dans [`docs/`](docs/README.md), rangée en tutoriel, guides, référence et explications.

- **Comprendre** : [l'architecture](docs/explanation/architecture.md), puis les [ADR](docs/adr/).
- **Démarrer** : [développer en local](docs/tutorials/develop-locally.md).
- **Livrer** : [l'API](docs/how-to/release-the-api.md), [Google Play](docs/how-to/publish-on-google-play.md),
  [AppGallery](docs/how-to/publish-on-appgallery.md), [le site](docs/how-to/update-the-public-site.md).
- **Héberger le backend** : [exploitation](docs/exploitation.md) (le backend est auto-hébergeable).
- **Où on en est** : [`docs/STATUS.md`](docs/STATUS.md).

## En bref

Prérequis : Node.js 24, Docker avec Compose, Android Studio.

```bash
cd backend && npm install && npm run db:up && npm run dev:local     # bases de dev et de test, backend sur :3001
cd apps/mobile && npm install && npm run android:dev                # application de développement (pas d'Expo Go)
```

Tests du backend : `npm run test:local` dans `backend/`.

## Licence

[GNU AGPL-3.0-or-later](LICENSE), avec une permission additionnelle autorisant la liaison avec les SDK propriétaires des plateformes (Google Play services, Huawei HMS) — voir [NOTICE](NOTICE).

Le nom « Step Challenge » et son logo ne sont pas couverts par la licence : voir [TRADEMARKS.md](TRADEMARKS.md).

Les choix de licence sont expliqués dans l'[ADR 0003](docs/adr/0003-open-source-license.md). Les versions publiées avant ce changement restent disponibles sous licence MIT.

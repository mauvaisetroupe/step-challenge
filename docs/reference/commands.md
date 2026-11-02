# Commandes

## Backend (`backend/`)

| Commande | Fait |
|---|---|
| `npm run db:up` | Bases de dev (55433) et de test (55432) dans Docker, puis les migrations (Flyway) |
| `npm run db:down` | Arrête les bases, garde les données de dev |
| `npm run db:reset` | Recrée des bases vides et les migre : **supprime les données de dev** |
| `npm run dev:local` | Backend sur la base de dev, port 3001 (`.env.development`), relancé à chaque modification |
| `npm run dev` | Backend avec `.env` |
| `npm test` | Tests unitaires |
| `npm run test:local` | Tests unitaires et d'intégration sur la base de test (**la vident**) |
| `npm run seed:demo` | Données fictives dans la base de dev ([captures d'écran](../how-to/prepare-store-screenshots.md)) |
| `npx tsc --noEmit` | Vérification des types (comme la CI) |
| `npm run build`, `npm start` | Compile vers `dist/`, lance l'API compilée (commande de l'image) |

## Application (`apps/mobile/`)

| Commande | Fait |
|---|---|
| `npm run android:dev` | Variante de développement (package `.dev`) sur le téléphone branché |
| `npm run start:dev` | Metro pour la variante de développement |
| `npm test` | Tests unitaires (`src/**/*.test.ts`) |
| `npm run check:i18n` | Vérifie que les langues ont les mêmes clés (comme la CI) |
| `npx tsc --noEmit` | Vérification des types (comme la CI) |
| `npx eas-cli build --platform android --profile production --local` | `.aab` pour Google Play ([guide](../how-to/publish-on-google-play.md)) |
| `npx eas-cli build --platform android --profile appgallery --local` | APK pour AppGallery ([guide](../how-to/publish-on-appgallery.md)) |
| `npx eas-cli env:list --environment <env>` | Variables EAS d'un environnement |
| `npx eas-cli credentials` | Clé d'importation (Android, production) |

## Site (`site/`)

| Commande | Fait |
|---|---|
| `hugo server` | Site sur `http://localhost:1313/`, rechargé à chaque modification |
| `hugo --minify` | Construction complète dans `site/public/` |
| `scripts/deploy-sftp.sh` | Envoi à la main chez OVH ([guide](../how-to/update-the-public-site.md#envoyer-à-la-main)) |

## Publier

| Commande | Fait |
|---|---|
| `git tag api-vX.Y.Z && git push origin api-vX.Y.Z` | Publie une version de l'API ([guide](../how-to/release-the-api.md)) |
| `.github/release-notes.sh api-vX.Y.Z` | Les notes de version d'un tag, comme la CI |
| `ssh -t vps-ovh sudo -iu step deploy-app X.Y.Z` | Déploie l'API en production (dépôt `vps-infra`) |
| `git tag mobile-vX.Y.Z && git push origin mobile-vX.Y.Z` | Marque le code d'une version de l'application envoyée |
| `gh run watch` | Suit la CI |

# État du projet

Point d'étape pour reprendre le travail, notamment dans une nouvelle session d'assistant (Claude Code en local ou dans le cloud). À mettre à jour à chaque étape importante.

**Dernière mise à jour : 2026-10-05**

## En bref

Step Challenge est une application Android de défi de pas entre amis : gratuite, open source (AGPL, voir [ADR 0003](adr/0003-open-source-license.md)), en test fermé sur Google Play. L'objectif est une vraie application publique. Le support de Huawei Health, que Santé Connect ne reçoit pas, doit la distinguer des autres.

| Partie | Technologie | Dossier |
|---|---|---|
| Backend | Node.js, Fastify 5, PostgreSQL 18 | `backend/` |
| Application | Expo SDK 57, expo-router, React Native | `apps/mobile/` |
| Pages publiques | HTML statique servi par le backend | `backend/public/` |
| Icônes et visuels du Store | SVG (Inkscape) et script d'export | `icons/` |
| Décisions d'architecture | ADR | `docs/adr/` |
| Intégration Huawei (en pause) | Notes et plan | `huawei/README.md` |

Installation, lancement en local, tests, déploiement et build : voir le [README](../README.md).

## Conventions de travail

- **Langue** : échanges et documentation en français ; code, commentaires et messages de commit en anglais.
- **ADR d'abord** : toute décision de conception importante passe par un ADR dans `docs/adr/`, validé avant l'implémentation.
- **Commits unitaires** : un commit par changement cohérent, messages au format Conventional Commits (`feat(mobile): …`, `fix(backend): …`, `chore: …`). Le mainteneur fait ses commits lui-même : en session locale, proposer les commandes `git add` et `git commit` plutôt que commiter. Dans une session cloud, travailler sur une branche et ouvrir une pull request, jamais de push sur `main`.
- **Expo a changé** : lire la documentation de la version utilisée (https://docs.expo.dev/versions/v57.0.0/) avant d'écrire du code (voir `AGENTS.md`).
- **Formatage** : le projet n'utilise pas Prettier. Ne pas reformater des fichiers entiers ; suivre le style existant (pas de point-virgule, guillemets simples).
- **Explications bienvenues** : le mainteneur est architecte logiciel, plus à l'aise côté backend que côté mobile.
- **Valider avant de changer de cap** : si le mainteneur remet en cause une approche, proposer un plan révisé et attendre son accord avant de modifier des fichiers.

### Ce qu'il ne faut jamais faire

- Commiter des secrets ou des fichiers sensibles : `.env`, keystores, `.aab`/`.apk`, `agconnect-services.json`, `google-services.json`, exports de base de données.
- Écrire dans ce dépôt public des données personnelles des testeurs (prénoms, pas, identifiants).
- Agir sur la production (serveur, base, Play Console) : c'est le mainteneur qui le fait, guidé si besoin.

## Production

| Élément | État |
|---|---|
| API | https://step.architech.lu, derrière un tunnel Cloudflare. Le backend n'écoute que sur `127.0.0.1` (`HOST`) |
| Base | PostgreSQL, migrations 001 à 003 appliquées. Pas encore de sauvegarde automatique |
| Authentification ([ADR 0001](adr/0001-authentication.md)) | En production : connexion Google (OIDC), sessions de l'application |
| Amis ([ADR 0002](adr/0002-friends.md)) | En production : invitations par lien ou code, classement entre amis, surnoms, limites de débit, App Links vérifiés |
| Application | **1.2.0** publiée en test fermé. **1.2.1** envoyée en examen : nouvelle icône, écran de démarrage, titres fixes sous la caméra |
| Fiche Play Store | Descriptions et bannière refaites le 2026-10-04 |

Le déploiement du backend se fait avec `deploy.sh` sur le serveur. Les migrations SQL sont appliquées à la main (voir `backend/migrations/README.md`).

## Reste à faire

### Par le mainteneur (Play Console, serveur, téléphone)

- [ ] Suivre l'examen de la 1.2.1, puis envoyer l'icône de la fiche (`icons/playstore-icon.png`) si ce n'est pas déjà fait.
- [ ] Vérifier sur la fiche publiée que les balises `<b>` de la description s'affichent en gras ; sinon les retirer.
- [ ] Remplacer les captures d'écran du Store : elles montrent de vrais prénoms et de vrais pas.
- [x] Migrer le dernier testeur encore sur un ancien compte : fait le 2026-10-05. Tous les testeurs sont sur leur compte Google et amis entre eux.
- [ ] Supprimer les exports de base faits pendant les migrations (données de santé), une fois la production stable.
- [ ] Huawei : en attente de la validation du Health Service Kit par Huawei (voir `huawei/README.md`, section 14). Une fois la permission de test accordée, ajouter les comptes HUAWEI de test (0/100 aujourd'hui).
- [ ] Huawei : créer la variable d'environnement EAS `AGCONNECT_SERVICES_JSON` (type fichier) pour que les builds de production embarquent la configuration AppGallery Connect (voir `huawei/README.md`, section 14).

### Développement possible dans une session

Chaque point se fait sur sa branche, avec un ADR si la décision le demande.

- [ ] **Signalement et blocage des utilisateurs** (règle Google Play sur le contenu généré par les utilisateurs) : [ADR 0004](adr/0004-user-reporting-and-blocking.md) accepté, à implémenter (conditions d'utilisation, signalement, blocage, procédure de modération). Corriger au passage le contact provisoire d'`agreement.html`.
- [x] **Liste des invitations actives** dans l'écran Amis, avec révocation (date de création, expiration, nombre d'acceptations). Testée sur téléphone le 2026-10-05, livrée avec la prochaine version.
- [ ] **Site public Hugo** ([ADR 0005](adr/0005-public-site-and-domains.md), accepté) : squelette bilingue dans `site/` (anglais par défaut, `/en/` et `/fr/`, sélecteur de langue), pages légales reprises de `backend/public/` (`/en/privacy/`…, versions françaises à traduire), aide Huawei et Santé Connect, page statique `/i/<code>`, `static/.well-known/assetlinks.json` (contenu actuel de `backend/src/routes/appLinks.ts`), `static/.htaccess` (réécriture `/i/`, redirections 301 des anciennes URL, type JSON), GitHub Action de déploiement OVH (modèle et adaptations dans l'ADR). Ne pas toucher au backend : son nettoyage vient après la bascule. Les conditions d'utilisation de l'[ADR 0004](adr/0004-user-reporting-and-blocking.md) s'écrivent directement dans le site.
- [ ] **Données de démonstration** pour faire des captures d'écran propres : un script SQL pour la base de **développement** uniquement, avec des prénoms fictifs, des amitiés et des pas crédibles sur plusieurs semaines.
- [ ] **Ménage des restes du modèle Expo**, à vérifier un par un avant suppression :
  - dépendances apparemment inutilisées : `expo-device`, `expo-status-bar`, `react-native-gesture-handler` ;
  - `AnimatedIcon` dans `components/animated-icon.tsx` (seul `AnimatedSplashOverlay` est utilisé), `expo-logo.png`, `logo-glow.png` ;
  - `themed-text`, `themed-view`, `hint-row`, `external-link`, `web-badge`, `ui/collapsible`, `hooks/use-theme`, `constants/theme.ts`, `scripts/reset-project.js`.
- [ ] **Plus tard** : sauvegardes automatiques de la base ou base managée. Mettre à jour `backend/public/delete-account.html`, qui indique aujourd'hui qu'il n'y a pas de sauvegarde.

## Pièges connus

- **Tests du backend** : ils exigent une base PostgreSQL (`TEST_DATABASE_URL`). En local, `npm run test:local` utilise la base Docker de test. La CI GitHub (`.github/workflows/ci.yml`) les exécute à chaque push.
- **Variante de développement** : `APP_VARIANT=development` donne une application séparée (`lu.architech.stepchallenge.dev`, schéma `stepchallenge-dev`), installable à côté de celle du Store. Elle n'a pas les App Links.
- **Dossier `android/` périmé** : il est généré et ignoré par git. Après une modification native d'`app.json` (icônes, écran de démarrage, permissions, App Links, plugins), le régénérer avant de reconstruire l'application de dev : `APP_VARIANT=development npx expo prebuild --clean --platform android`. Les builds de production (EAS) le régénèrent eux-mêmes.
- **Routes typées** : après l'ajout d'un écran, lancer brièvement `expo start` pour régénérer les types de routes, sinon `tsc` échoue.
- **Thème** : l'application est en mode clair uniquement (`userInterfaceStyle: "light"`, `DefaultTheme`). Les écrans sont conçus pour un fond blanc.
- **Écrans des onglets** : chacun est enveloppé dans un `SafeAreaView` limité au bord haut, avec un titre fixe (`components/TabScreenHeader.tsx`).
- **Clés de signature** : une fonction qui marche en local mais pas avec l'application du Store (ou l'inverse) vient presque toujours d'une empreinte non déclarée. Voir [`signing.md`](signing.md).
- **Comptes inconnus en base** : le robot de test de Google Play crée des comptes pendant l'examen d'une version (nom aléatoire, aucun pas), en plus du compte de démonstration des examinateurs. Ne jamais rendre « tout le monde » ami : `backend/scripts/seed-tester-friendships.sql` prend une liste explicite de comptes.
- **Huawei** : `plugins/withAGConnect.js` applique la configuration AppGallery Connect seulement si `agconnect-services.json` (ou la variable EAS `AGCONNECT_SERVICES_JSON`) est présent, et seulement pour le package de production.
- **Icônes** : la source est `icons/app-icon-foreground.svg` ; tout se régénère avec `python3 icons/export-app-icons.py`, qui nécessite Inkscape.
- **Codes d'invitation** : en base 32 de Crockford. Les lettres I, L et O sont lues comme 1 et 0 : beaucoup de mots de 8 lettres sont donc des codes valides. Pour un code invalide dans un test, utiliser la lettre U, qui est exclue.
- **Limites de débit** : stockage en mémoire, donc propres à chaque instance du backend. À revoir si le backend passe à plusieurs instances.

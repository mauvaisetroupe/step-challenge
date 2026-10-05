# État du projet

Point d'étape pour reprendre le travail, notamment dans une nouvelle session d'assistant (Claude Code en local ou dans le cloud). À mettre à jour à chaque étape importante.

**Dernière mise à jour : 2026-10-05**

## En bref

Step Challenge est une application Android de défi de pas entre amis : gratuite, open source (AGPL, voir [ADR 0003](adr/0003-open-source-license.md)), en test fermé sur Google Play. L'objectif est une vraie application publique. Le support de Huawei Health, que Santé Connect ne reçoit pas, doit la distinguer des autres.

| Partie | Technologie | Dossier |
|---|---|---|
| Backend | Node.js, Fastify 5, PostgreSQL 18 | `backend/` |
| Application | Expo SDK 57, expo-router, React Native | `apps/mobile/` |
| Pages publiques (actuelles) | HTML statique servi par le backend, jusqu'à la bascule de l'ADR 0005 | `backend/public/` |
| Site public (à publier) | Hugo, bilingue, déployé chez OVH par une GitHub Action | `site/` |
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
| API | https://step-api.architech.lu, derrière un tunnel Cloudflare (ADR 0005). Le backend n'écoute que sur `127.0.0.1` (`HOST`). Jusqu'à la bascule vers OVH, `step.architech.lu` mène aussi au backend |
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
- [x] **Préversion du site public** (ADR 0005, étape 2 de la bascule) : publiée le 2026-10-05 sur `https://step-preview.architech.lu` (multisite OVH, dossier `step`), déployée par la GitHub Action en SFTP. Vérifié : toutes les pages en 200 sans redirection (dont `/privacy.html`, `/agreement.html`, `/delete-account.html`), `/i/<code>` réécrit par le `.htaccess` et affiché correctement dans un navigateur, `assetlinks.json` en `application/json`, sitemap et `robots.txt`.
- [ ] **Site public, suite** :
  - l'offre OVH ne permet pas d'utilisateur FTP dédié : l'utilisateur des secrets GitHub voit tous les sites de l'hébergement. Le script refuse d'écrire dans un dossier non marqué ; à envisager en plus : environnement GitHub protégé (validation de chaque déploiement) et actions tierces figées par empreinte de commit ;
  - relire les traductions françaises des pages légales (conditions d'utilisation, confidentialité et suppression de compte mises à jour le 2026-10-05 pour les ADR 0002 et 0004) ;
  - régler la mise en cache Cloudflare du site (point ouvert de l'ADR 0005) ;
  - poursuivre la bascule (ADR 0005, étapes 3 à 7 ; `step-api.architech.lu` est en place depuis le 2026-10-05) : version de l'application avec la nouvelle URL d'API, puis `step.architech.lu` vers OVH (même dossier `step`) et vérification des App Links.
- [ ] **Accès de démonstration** ([ADR 0006](adr/0006-review-demo-access.md)), testé en dev sur téléphone le 2026-10-05 (connexion, code faux, compte supprimé puis recréé, ami bloqué rétabli). Mise en production :
  1. générer le code (`openssl rand -base64 30`), le garder dans le gestionnaire de mots de passe et l'ajouter au `.env` de production (`DEMO_ACCESS_CODE`) ;
  2. appliquer la migration 005 (`backend/migrations/005_demo_credential.sql`), puis déployer le backend : le journal doit indiquer « Demo access enabled » ;
  3. publier la version de l'application qui contient le lien « Accès démonstration » ;
  4. Play Console → Contenu de l'application → Accès à l'application : remplacer le compte Gmail par les instructions de l'ADR 0006 et le code ;
  5. une fois un examen passé, supprimer le compte Gmail de démonstration et son compte Step Challenge ;
  6. vérifier qu'AppGallery Connect permet de fournir un code d'accès de la même façon (point ouvert de l'ADR).
- [x] Huawei : variable d'environnement EAS `AGCONNECT_SERVICES_JSON` (type texte, contenu du fichier) créée ; la configuration AppGallery Connect est vérifiée dans l'`.aab` de la 1.2.2 (voir `huawei/README.md`, section 14).

### Développement possible dans une session

Chaque point se fait sur sa branche, avec un ADR si la décision le demande.

- [x] **Signalement et blocage des utilisateurs** ([ADR 0004](adr/0004-user-reporting-and-blocking.md)) : backend (migration 004, `/api/blocks`, `/api/reports`), application (signaler, bloquer, débloquer, signaler une invitation, mention des conditions à la création du compte, liens légaux dans les Paramètres) et procédure de modération ([`moderation.md`](moderation.md)) faits le 2026-10-05. Reste :
  - la mise en production : migration 004, déploiement du backend, puis nouvelle version de l'application (avec la nouvelle URL d'API, ADR 0005) ;
  - le formulaire Data safety (signalements), à vérifier.
- [x] **Liste des invitations actives** dans l'écran Amis, avec révocation (date de création, expiration, nombre d'acceptations). Testée sur téléphone le 2026-10-05, livrée avec la prochaine version.
- [x] **Site public Hugo** ([ADR 0005](adr/0005-public-site-and-domains.md)) : développé le 2026-10-05 dans `site/` (voir [`site/README.md`](../site/README.md)), pas encore publié. Squelette bilingue (anglais à la racine, français sous `/fr/`, adresses en `.html` : `/privacy.html` reste l'URL de la page, sans redirection ; drapeau vers la même page), pages légales reprises de `backend/public/` et traduites (contact provisoire d'`agreement.html` remplacé par `support@architech.lu`), accueil, aide Santé Connect et Huawei (« pas encore disponible »), FAQ, page `/i/<code>`, `assetlinks.json` (identique à celui du backend), `.htaccess`, GitHub Action `deploy-site.yml` (Hugo 0.167.0, envoi en SFTP par `site/scripts/deploy-sftp.sh`, sauté tant que la configuration manque). Le `.htaccess` de l'ADR bouclait sur `/i/` (erreur 500) : corrigé, et l'ADR précisé. La section « Contenus et comportement » de l'[ADR 0004](adr/0004-user-reporting-and-blocking.md) n'est pas encore dans les conditions d'utilisation : elle sera publiée avec la version de l'application qui contient le signalement et le blocage.

- [x] **Accès de démonstration pour les examinateurs** ([ADR 0006](adr/0006-review-demo-access.md), accepté) : développé le 2026-10-05. Backend (migration 005, `POST /api/auth/demo`, compte et amis fictifs recréés et rafraîchis à chaque connexion, tests), lien « Accès démonstration » sur l'écran de connexion, [`exposure.md`](exposure.md) et [`moderation.md`](moderation.md) (signalements venant du compte de démonstration). Mise en production : voir la liste du mainteneur.
- [x] **Données de démonstration** pour les captures d'écran : `npm run seed:demo` (voir le [README](../README.md)), pour la base de **développement** uniquement, avec le même code que l'accès de démonstration : 6 amis aux prénoms fictifs, pas crédibles sur plusieurs semaines, et en option les pas du compte lui-même.
- [x] **Statistiques sur un an** : depuis le 2026-10-05, la vue « 1a » de l'écran Statistiques lit la base (`GET /api/me/steps`, somme par mois dans l'application), sur Android aussi ; les vues 1j, 7j et 30j restent sur Santé Connect. Vérifié sur le web (totaux mensuels identiques à ceux de la base). **À tester sur téléphone** :
  - la vue 1a montre les mois antérieurs à la première autorisation Santé Connect (ils étaient vides) et des totaux cohérents avec le classement du mois ;
  - le mois en cours inclut les pas du jour (synchronisés à l'ouverture de l'écran) ;
  - les vues 1j, 7j et 30j n'ont pas changé ;
  - sans réseau, la vue 1a affiche une erreur (elle lisait Santé Connect hors ligne) : vérifier que le message est compréhensible ;
  - autorisation Santé Connect refusée : la vue 1a s'affiche quand même depuis la base (la synchronisation du jour n'est plus bloquante pour cette vue).
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
- **Sources de l'écran Statistiques** : 1j, 7j et 30j lisent Santé Connect ; 1a lit la base, car Santé Connect ne donne que 30 jours avant la première autorisation et ne suit pas l'utilisateur sur un nouveau téléphone. C'est la seule vue qui lit la base : Step Challenge ne remplace pas l'historique de la montre (commentaire dans `stats.tsx`).
- **Thème** : l'application est en mode clair uniquement (`userInterfaceStyle: "light"`, `DefaultTheme`). Les écrans sont conçus pour un fond blanc.
- **Écrans des onglets** : chacun est enveloppé dans un `SafeAreaView` limité au bord haut, avec un titre fixe (`components/TabScreenHeader.tsx`).
- **Clés de signature** : une fonction qui marche en local mais pas avec l'application du Store (ou l'inverse) vient presque toujours d'une empreinte non déclarée. Voir [`signing.md`](signing.md).
- **Compte de démonstration Google Play** : Google bloque les connexions des examinateurs (« appareil inconnu ») au compte Gmail de démonstration ; au 2026-10-05, aucun examinateur n'a réussi à se connecter. Remplacé par l'accès de démonstration de l'[ADR 0006](adr/0006-review-demo-access.md) (code d'accès, compte fictif) : développé, à mettre en production. D'ici là, répondre « c'était moi » aux alertes de sécurité du compte Gmail.
- **Comptes fictifs** (ADR 0006) : le compte de démonstration (identifiant de connexion de type `demo`) et ses 6 amis fictifs (identifiants `de300000-0000-4000-8000-…`, sans identifiant de connexion). À exclure de toute statistique d'usage. Ne pas les modifier à la main : chaque connexion de démonstration les remet dans leur état d'origine.
- **Comptes inconnus en base** : le robot de test de Google Play crée des comptes pendant l'examen d'une version (nom aléatoire, aucun pas), en plus du compte de démonstration des examinateurs. Ne jamais rendre « tout le monde » ami : `backend/scripts/seed-tester-friendships.sql` prend une liste explicite de comptes.
- **Huawei** : `plugins/withAGConnect.js` applique la configuration AppGallery Connect seulement si `agconnect-services.json` (ou la variable EAS `AGCONNECT_SERVICES_JSON`) est présent, et seulement pour le package de production.
- **Icônes** : la source est `icons/app-icon-foreground.svg` ; tout se régénère avec `python3 icons/export-app-icons.py`, qui nécessite Inkscape.
- **Codes d'invitation** : en base 32 de Crockford. Les lettres I, L et O sont lues comme 1 et 0 : beaucoup de mots de 8 lettres sont donc des codes valides. Pour un code invalide dans un test, utiliser la lettre U, qui est exclue.
- **Limites de débit** : stockage en mémoire, donc propres à chaque instance du backend. À revoir si le backend passe à plusieurs instances.

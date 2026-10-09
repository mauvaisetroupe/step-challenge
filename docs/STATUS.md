# État du projet

Point d'étape pour reprendre le travail, notamment dans une nouvelle session d'assistant (Claude Code en local ou dans le cloud). À mettre à jour à chaque étape importante.

**Dernière mise à jour : 2026-10-06**

## En bref

Step Challenge est une application Android de défi de pas entre amis : gratuite, open source (AGPL, voir [ADR 0003](adr/0003-open-source-license.md)), en test fermé sur Google Play. L'objectif est une vraie application publique. Le support de Huawei Health, que Santé Connect ne reçoit pas, doit la distinguer des autres.

| Partie | Technologie | Dossier |
|---|---|---|
| Backend | Node.js, Fastify 5, PostgreSQL 18 | `backend/` |
| Application | Expo SDK 57, expo-router, React Native | `apps/mobile/` |
| Site public (`step.architech.lu`) | Hugo, bilingue, déployé chez OVH par une GitHub Action : présentation, aide, pages légales, page d'invitation `/i/<code>`, `assetlinks.json` | `site/` |
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
| API | https://step-api.architech.lu, derrière un tunnel Cloudflare (ADR 0005). Le backend n'écoute que sur `127.0.0.1` (`HOST`). Depuis la bascule du 2026-10-06, `step.architech.lu` est le site public chez OVH : le home lab ne sert plus que l'API |
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
  - bascule faite le 2026-10-06 : `step.architech.lu` pointe vers OVH (même dossier `step` que la préversion), App Links revérifiés sur téléphone, liens d'invitation testés ; backend nettoyé (plus de pages statiques ni de routes `/i/` et `assetlinks.json`). Reste éventuellement : filtrer `step-api.architech.lu` par pays (ADR 0005, points ouverts), supprimer la préversion `step-preview` ;
- [ ] **Accès de démonstration** ([ADR 0006](adr/0006-review-demo-access.md)), testé en dev sur téléphone le 2026-10-05 (connexion, code faux, compte supprimé puis recréé, ami bloqué rétabli). Mise en production :
  1. générer le code (`openssl rand -base64 30`), le garder dans le gestionnaire de mots de passe et l'ajouter au `.env` de production (`DEMO_ACCESS_CODE`) ;
  2. appliquer la migration 005 (`backend/migrations/005_demo_credential.sql`), puis déployer le backend : le journal doit indiquer « Demo access enabled » ;
  3. publier la version de l'application qui contient le lien « Accès démonstration » ;
  4. Play Console → Contenu de l'application → Accès à l'application : remplacer le compte Gmail par les instructions de l'ADR 0006 et le code ;
  5. ~~une fois un examen passé, supprimer le compte Gmail de démonstration et son compte Step Challenge~~ : un examinateur Google s'est connecté par l'accès de démonstration le 2026-10-06 (examen de la 1.4.0), première connexion réussie d'un examinateur ; le compte Gmail et son compte Step Challenge ont été supprimés le 2026-10-06 ;
  6. vérifier qu'AppGallery Connect permet de fournir un code d'accès de la même façon (point ouvert de l'ADR).
- [x] Huawei : variable d'environnement EAS `AGCONNECT_SERVICES_JSON` (type texte, contenu du fichier) créée ; la configuration AppGallery Connect est vérifiée dans l'`.aab` de la 1.2.2 (voir `huawei/README.md`, section 14).

### Développement possible dans une session

Chaque point se fait sur sa branche, avec un ADR si la décision le demande.

- [x] **Signalement et blocage des utilisateurs** ([ADR 0004](adr/0004-user-reporting-and-blocking.md)) : backend (migration 004, `/api/blocks`, `/api/reports`), application (signaler, bloquer, débloquer, signaler une invitation, mention des conditions à la création du compte, liens légaux dans les Paramètres) et procédure de modération ([`moderation.md`](moderation.md)) faits le 2026-10-05. Reste :
  - la mise en production : migration 004, déploiement du backend, puis nouvelle version de l'application (avec la nouvelle URL d'API, ADR 0005) ;
  - le formulaire Data safety (signalements), à vérifier.
- [x] **Liste des invitations actives** dans l'écran Amis, avec révocation (date de création, expiration, nombre d'acceptations). Testée sur téléphone le 2026-10-05, livrée avec la prochaine version.
- [x] **Site public Hugo** ([ADR 0005](adr/0005-public-site-and-domains.md)) : développé le 2026-10-05 dans `site/` (voir [`site/README.md`](../site/README.md)), publié sur `step.architech.lu` le 2026-10-06. Squelette bilingue (anglais à la racine, français sous `/fr/`, adresses en `.html` : `/privacy.html` reste l'URL de la page, sans redirection ; drapeau vers la même page), pages légales reprises de `backend/public/` et traduites (contact provisoire d'`agreement.html` remplacé par `support@architech.lu`), accueil, aide Santé Connect et Huawei (« pas encore disponible »), FAQ, page `/i/<code>`, `assetlinks.json` (identique à celui du backend), `.htaccess`, GitHub Action `deploy-site.yml` (Hugo 0.167.0, envoi en SFTP par `site/scripts/deploy-sftp.sh`, sauté tant que la configuration manque). Le `.htaccess` de l'ADR bouclait sur `/i/` (erreur 500) : corrigé, et l'ADR précisé. La section « Contenus et comportement » de l'[ADR 0004](adr/0004-user-reporting-and-blocking.md) est dans les conditions d'utilisation depuis le 2026-10-05.

- [x] **Accès de démonstration pour les examinateurs** ([ADR 0006](adr/0006-review-demo-access.md), accepté) : développé le 2026-10-05. Backend (migration 005, `POST /api/auth/demo`, compte et amis fictifs recréés et rafraîchis à chaque connexion, tests), lien « Accès démonstration » sur l'écran de connexion, [`exposure.md`](exposure.md) et [`moderation.md`](moderation.md) (signalements venant du compte de démonstration). Mise en production : voir la liste du mainteneur.
- [x] **Données de démonstration** pour les captures d'écran : `npm run seed:demo` (voir le [README](../README.md)), pour la base de **développement** uniquement, avec le même code que l'accès de démonstration : 6 amis aux prénoms fictifs, pas crédibles sur plusieurs semaines, et en option les pas du compte lui-même.
- [x] **Statistiques sur un an** : depuis le 2026-10-05, la vue « 1a » de l'écran Statistiques lit la base (`GET /api/me/steps`, somme par mois dans l'application), sur Android aussi ; les vues 1j, 7j et 30j restent sur Santé Connect. Vérifié sur le web (totaux mensuels identiques à ceux de la base). **À tester sur téléphone** :
  - la vue 1a montre les mois antérieurs à la première autorisation Santé Connect (ils étaient vides) et des totaux cohérents avec le classement du mois ;
  - le mois en cours inclut les pas du jour (synchronisés à l'ouverture de l'écran) ;
  - les vues 1j, 7j et 30j n'ont pas changé ;
  - sans réseau, la vue 1a affiche une erreur (elle lisait Santé Connect hors ligne) : vérifier que le message est compréhensible ;
  - autorisation Santé Connect refusée : la vue 1a s'affiche quand même depuis la base (la synchronisation du jour n'est plus bloquante pour cette vue).
- [x] **Refonte de l'apparence** (2026-10-05) : mode sombre et choix de l'apparence (Paramètres → Apparence : système, clair, sombre), Paramètres en menu avec un écran par section, titres d'onglets sans icône, barres des histogrammes en bleu, vue « 1j » avec anneau de progression et courbe de la journée. Vérifié sur le web, en clair et en sombre, puis **testé sur téléphone le 2026-10-05** (liste ci-dessous) (nouveau build nécessaire : `userInterfaceStyle` passe à `automatic` dans `app.json`, donc `prebuild` pour la variante de développement) :
  - le mode Système suit le réglage du téléphone, y compris la barre d'onglets, la barre d'état et les en-têtes ; Clair et Sombre l'emportent sur lui, et le choix reste après redémarrage ;
  - tous les écrans en sombre, en particulier ceux que le web ne permet pas de vérifier : Amis (et ses fenêtres Renommer, Signaler, le menu d'actions), invitation `/i/<code>`, Accueil ;
  - Paramètres : chaque entrée ouvre son écran, le bouton retour revient au menu ;
  - vue 1j : l'anneau reste gris sous 10 000 pas et devient bleu au-delà ; la courbe heure par heure (Santé Connect) et le repère d'objectif sont justes.
- [x] **Accueil enrichi** (2026-10-05) : l'anneau du jour passe de la vue « 1j » à l'Accueil (la vue 1j ne garde que la courbe heure par heure) ; deux cartes en dessous : « Cette semaine » (rang parmi les amis, pas manquants pour dépasser la personne juste devant, avance quand on est premier, égalité, invitation quand on est seul) et « Série » (jours d'affilée à 10 000 pas ou plus, record sur tout l'historique de la base « depuis ton arrivée sur Step Challenge »). L'Accueil envoie d'abord les pas de Santé Connect au serveur, puis lit le classement de la semaine et l'historique. Calculs dans `apps/mobile/src/services/insights.ts`. Vérifié sur le web avec le compte de démonstration, en clair et en sombre. **Testé sur téléphone le 2026-10-05** :
  - l'anneau suit Santé Connect et le rang tient compte des pas du jour (synchronisés avant la lecture du classement) ;
  - messages de la carte « Cette semaine » : personne devant, premier, égalité, seul (bouton vers Amis) ; un appui ouvre le Classement ;
  - série : elle compte jusqu'à hier tant que l'objectif du jour n'est pas atteint, puis inclut aujourd'hui ; badge « C'est ton record ! » ; un jour absent de la base coupe la série ;
  - tirer vers le bas recharge l'écran ; sans réseau, les cartes affichent un message d'indisponibilité sans bloquer l'anneau.
- [x] **Application en anglais** ([ADR 0007](adr/0007-internationalization.md), 2026-10-06) : tous les textes passent par des clés i18next (`apps/mobile/src/i18n/locales/fr.json` et `en.json`). L'application suit la langue du téléphone, ou le choix fait dans Paramètres → Langue (Système, Français, English) ; anglais par défaut pour une langue non prise en charge. Vérifié sur le web, en français et en anglais (Accueil, Statistiques, Classement, Paramètres, Amis, connexion), changement de langue immédiat. **À tester sur téléphone** (nouveau build nécessaire : module natif expo-localization et langues déclarées pour Android 13, donc `prebuild` pour la variante de développement) :
  - téléphone en anglais, puis en espagnol : l'application est en anglais ; téléphone en français : en français ;
  - Paramètres → Langue : le choix s'applique tout de suite (onglets, titres des écrans, nombres et dates) et reste après redémarrage ;
  - Android 13 et plus : réglages du téléphone → Applis → Step Challenge → Langue propose Français et English, et l'option Système de l'application le suit ;
  - pluriels et rangs : « 1 jour / 4 jours », « 1st / 2nd / 3rd / 5th », « 1 step / 2 steps » ; fenêtres (retirer, bloquer, supprimer le compte) et message d'invitation partagé.
- [ ] **Anglais, suite** : fiche Play Store et captures d'écran en anglais (Play Console).
- [x] **Liens légaux dans la langue de l'application** (2026-10-06) : `src/constants/links.ts` ouvre `/fr/agreement.html` et `/fr/privacy.html` quand l'application est en français, les pages anglaises à la racine sinon (langues absentes du site comprises).
- [x] **Sources des pas dans le Diagnostic** (2026-10-06) : Paramètres → Diagnostic liste les applications qui écrivent des pas dans Santé Connect (30 derniers jours), avec les pas du jour de chacune, les appareils déclarés (« Garmin Forerunner 255 ») et le total retenu par Santé Connect après fusion des doublons. Lu sur le téléphone seulement, rien n'est envoyé au serveur ; inclus dans le texte copié du diagnostic. Service `apps/mobile/src/services/stepSources.ts`, testé avec une simulation de la bibliothèque (le web n'a pas Santé Connect). **À tester sur téléphone** (pas de nouveau build natif nécessaire) :
  - avec une montre Garmin : Garmin Connect et le téléphone apparaissent, le total retenu correspond à la source prioritaire ;
  - nom affiché pour les pas comptés par le téléphone (origine `android` supposée sur Android 14 et plus ; sinon le nom du paquet s'affiche, à ajouter à la table `KNOWN_SOURCES`) ;
  - appareils : dépend de ce que chaque application déclare.
- [x] **Sources de pas** (2026-10-06) : écran Paramètres → Sources de pas (applications qui écrivent dans Santé Connect, pas du jour et appareils, total retenu, bouton vers les réglages de Santé Connect pour la priorité), lien depuis Stats → 1j ; le diagnostic ne les garde que dans son texte copié. Le téléphone est reconnu sous `android` et `com.android.healthconnect.phone.<id>` (Android récents). Testé sur téléphone ; à publier dans la prochaine version. Futur emplacement du choix de la source Huawei.
- [x] **Accueil plus visuel** (2026-10-06) : carte « Cette semaine : 4ᵉ sur 7 » avec une piste (le dernier à gauche, moi, le premier à droite ; noms au-dessus, pas en dessous) ; carte « Série : 31 jours d'affilée » avec une frise de paliers (3, 7, 14, 21, 30, 45, 60, 75, 100, 150… puis tous les 100 jours après un an ; `services/insights.ts`), l'appel à l'action du jour seulement quand la série est en jeu, et le record. Testé sur téléphone ; à publier dans la prochaine version.
- [ ] **Minutes actives et score d'activité** (2026-10-08) : sous la courbe de Stats → 1j, minutes très actives (130 pas par minute ou plus), actives (100 à 129) et inactives (périodes rouges), et un score = actives + 2 × très actives, la règle de l'OMS (150 par semaine, une minute soutenue compte double) comme les points cardio de Google Fit, mais d'après les pas seuls. Calcul local (`services/activity.ts`), courbe lue minute par minute dans Santé Connect. Étape 2 ([ADR 0010](adr/0010-daily-activity-minutes.md), accepté) : minutes des 3 derniers jours envoyées avec les pas (30 jours avec « Synchroniser maintenant »), par le TypeScript et par le travailleur Kotlin, tenus identiques par `modules/step-sync/test-fixtures/activity-days.json` (`npm test` dans `apps/mobile`, `./gradlew :step-sync:testDebugUnitTest`) ; migration `006` ; histogramme du score en 7j, 30j (par jour, objectif 22) et 1a (par semaine, objectif 150). Avant la publication : migration en production, déploiement du backend, du site (politique de confidentialité), vérification du formulaire Data safety.
- [ ] **Chasse à la sédentarité** (2026-10-08) : dans Stats → 1j, un trait rouge sur l'axe du temps (légende « Inactif ») pour chaque période d'au moins 60 minutes sans marche, alignée sur la barre d'inactivité de Garmin (marcher environ 2 minutes la remet à zéro : 200 pas sur une fenêtre glissante de 15 minutes, même en plusieurs fois). Garmin et le téléphone écrivent leurs pas à la minute dans Santé Connect (vérifié le 2026-10-08), entre le premier et le dernier pas de la journée (pas d'accès au sommeil). Courbe lue par tranches de 5 minutes dans Santé Connect. L'OMS recommande de limiter la sédentarité sans donner de seuil (45 minutes, essayé d'abord, colorait en rouge une journée active). Seuils fixes, dans `services/inactivity.ts`. Pas d'ADR : écran seul, sans autorisation ni backend. À faire : vérifier sur de vraies journées (Garmin, téléphone).
- [x] **Synchronisation en arrière-plan native** ([ADR 0009](adr/0009-native-background-sync.md), 2026-10-07) : avec `expo-background-task`, la tâche était bien lancée par Android mais le JavaScript ne s'exécutait pas quand le processus était resté gelé (problème connu [expo/expo#35193](https://github.com/expo/expo/issues/35193)). Remplacée par un module local Expo en Kotlin (`apps/mobile/modules/step-sync`) : travailleur WorkManager toutes les 6 heures qui lit Santé Connect et appelle l'API sans JavaScript, jeton de session transmis par `auth/session.ts` et chiffré (Keystore), historique réuni avec « Synchroniser maintenant ». `expo-background-task` et `expo-task-manager` retirés. Aucune démarche Google : l'autorisation en arrière-plan (1.5.1) est déjà acceptée. Testé en dev (application fermée), puis validé en 1.6.0 depuis le Store, téléphone débranché : exécutions automatiques réussies (2026-10-08).
  - Huawei : le même travailleur lira Huawei Health Kit en arrière-plan quand la source Huawei sera intégrée.
- [ ] **Client web** ([ADR 0008](adr/0008-web-client.md), proposé) : export web d'Expo sur `step-app.architech.lu`, session par cookie `HttpOnly` (`__Host-session`, `SameSite=Strict`), CORS en liste blanche, connexion Google Identity Services ; première version centrée sur le classement.
- [ ] **Historique complet des pas** (ADR à écrire) : l'autorisation Santé Connect « lire les données passées » (`READ_HEALTH_DATA_HISTORY`) permettrait d'envoyer une fois tout l'historique à la base (séries et vue 1 an justes dès l'installation ; aujourd'hui, elles partent de l'arrivée sur Step Challenge). À évaluer : disponibilité selon les versions de Santé Connect, justification dans la déclaration des autorisations de santé de la Play Console, politique de confidentialité. Garmin et Xiaomi écrivent déjà dans Santé Connect ; Garmin n'ouvre son API qu'à des partenaires approuvés.
- [x] **Versions correctives d'Expo** (2026-10-07) : `expo`, `expo-router`, `expo-constants`, `expo-linking` et `@expo/ui` mis à jour (`npx expo install`), testés en dev ; à publier dans la 1.6.0.
- [x] **Autorisations Android inutiles** (2026-10-07 : bloquées par `android.blockedPermissions` dans `app.json`, à vérifier dans l'`.aab` de la 1.6.0) : `SYSTEM_ALERT_WINDOW`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `USE_FINGERPRINT`, `USE_BIOMETRIC` viennent du modèle Expo ou de bibliothèques ; les retirer du manifeste (`tools:node="remove"`, comme dans `plugins/withHuaweiHealthManifest.js`, ou `android.blockedPermissions` d'Expo), puis vérifier dans l'`.aab`. Dans la déclaration « Health apps » de la Play Console, les catégories « Activity recognition » et « Vitals » venaient de la 1.0.22, restée active en test interne : piste de test interne mise en pause le 2026-10-07 (tous les testeurs sont en test fermé). À la prochaine mise à jour, vérifier que ces catégories ont disparu du formulaire.
- [ ] **Ménage des restes du modèle Expo**, à vérifier un par un avant suppression :
  - dépendances apparemment inutilisées : `expo-device`, `react-native-gesture-handler` (`expo-status-bar` sert désormais à la barre d'état claire ou sombre) ;
  - `AnimatedIcon` dans `components/animated-icon.tsx` (seul `AnimatedSplashOverlay` est utilisé), `expo-logo.png`, `logo-glow.png` ;
  - `themed-text`, `themed-view`, `hint-row`, `external-link`, `web-badge`, `ui/collapsible`, `hooks/use-theme`, `constants/theme.ts`, `scripts/reset-project.js`.
- [ ] **Plus tard** : sauvegardes automatiques de la base ou base managée. Mettre à jour la page de suppression de compte du site (`site/content/delete-account.*.md`), qui indique aujourd'hui qu'il n'y a pas de sauvegarde.

- [ ] **Alerte d'inactivité** (idée écartée pour l'instant, 2026-10-08) : vibrer vers 50 minutes d'inactivité. Obstacles : les pas de Garmin arrivent en retard dans Santé Connect ; WorkManager tourne au mieux toutes les 15 minutes et le mode Doze l'espace beaucoup quand le téléphone est posé immobile, justement à un bureau ; les alarmes exactes sont réservées par Google aux réveils et agendas ; un service permanent impose une notification visible et ne voit pas les pas de la montre. Les montres (Garmin) le font déjà au poignet. Si on y revient : version « approximative » sur le travailleur de l'ADR 0009, en option, heures de journée, autorisation de notifications, ADR, et mesure du Doze en dev d'abord.

- [ ] **Hébergement du backend sur un VPS OVH, dans Docker** ([ADR 0011](adr/0011-backend-hosting.md), proposé, 2026-10-09) : VPS-1 dans l'UE, Debian, `ufw`, API, PostgreSQL et `cloudflared` dans une composition Docker sans port publié, `pg_dump` chiffré récupéré chaque nuit par le home lab, supervision de `/api/health`. Le tunnel Cloudflare est gardé dans un premier temps ; son retrait de l'API est une étape 2 à décider. À faire : commande du VPS, `Dockerfile` et composition de production testés en local, bascule.
- [ ] **1.8.1, heures de sommeil et rattrapage** (2026-10-09, ADR 0010 complété) : Paramètres → Activité (sommeil 23 h → 6 h par défaut) ; aucune inactivité comptée pendant ces heures, grisées sur la courbe de Stats → 1j ; transmises au travailleur Kotlin ; jeux d'essai complétés (12 journées). Minutes des 30 jours envoyées une fois après la mise à jour (et après un changement des heures de sommeil). À faire : test en dev, version 1.8.1.

## Pièges connus

- **Tests du backend** : ils exigent une base PostgreSQL (`TEST_DATABASE_URL`). En local, `npm run test:local` utilise la base Docker de test. La CI GitHub (`.github/workflows/ci.yml`) les exécute à chaque push.
- **Synchronisation en arrière-plan en dev** : l'intervalle est de 15 minutes dans l'application de dev (`__DEV__`, `services/backgroundSync.ts`) contre 6 heures en production, pour tester le travailleur natif application fermée. L'application de dev synchronise donc souvent vers le backend local : des échecs « réseau » apparaissent dans l'historique quand il ne tourne pas. Forcer une exécution : `adb shell cmd jobscheduler run -f lu.architech.stepchallenge.dev <numéro>` (numéro dans `adb shell dumpsys jobscheduler`), refusé par WorkManager si le délai minimum n'est pas écoulé.
- **Variante de développement** : `APP_VARIANT=development` donne une application séparée (`lu.architech.stepchallenge.dev`, schéma `stepchallenge-dev`), installable à côté de celle du Store. Elle n'a pas les App Links. Un lien d'invitation créé en dev (`https://step.architech.lu/i/…`) ouvre donc l'application **du Store**, qui interroge la production et répond « invitation invalide » : c'est normal. Pour tester en dev : `adb shell am start -W -a android.intent.action.VIEW -d "stepchallenge-dev://i/<code>" lu.architech.stepchallenge.dev`, ou Amis → J'ai un code.
- **Dossier `android/` périmé** : il est généré et ignoré par git. Après une modification native d'`app.json` (icônes, écran de démarrage, permissions, App Links, plugins), le régénérer avant de reconstruire l'application de dev : `APP_VARIANT=development npx expo prebuild --clean --platform android`. Les builds de production (EAS) le régénèrent eux-mêmes.
- **Routes typées** : après l'ajout d'un écran, lancer brièvement `expo start` pour régénérer les types de routes, sinon `tsc` échoue.
- **Sources de l'écran Statistiques** : 1j, 7j et 30j lisent Santé Connect ; 1a lit la base, car Santé Connect ne donne que 30 jours avant la première autorisation et ne suit pas l'utilisateur sur un nouveau téléphone. C'est la seule vue des Statistiques qui lit la base : Step Challenge ne remplace pas l'historique de la montre (commentaire dans `stats.tsx`). L'Accueil lit aussi la base, pour le classement et les séries (tout l'historique, `from=2000-01-01`).
- **Thème clair et sombre** : aucune couleur en dur dans les écrans. Les couleurs sont des jetons (`src/theme/colors.ts`) lus par `useTheme()` ou `useThemedStyles(createStyles)`, où `createStyles` est une fonction des couleurs. Un texte sans couleur explicite reste noir et devient illisible en sombre : toujours donner une couleur aux styles de texte. Le choix de l'apparence est appliqué avec `Appearance.setColorScheme`, gardé dans AsyncStorage.
- **Traductions** (ADR 0007) : aucun texte en dur dans les écrans, toujours `t('clé')` (`useTranslation()`), et la clé dans **chaque** fichier de `src/i18n/locales/`. `en.json` est la référence du typage : une clé inconnue fait échouer `tsc`. `npm run check:i18n` (lancé par la CI) compare les langues : mêmes clés, formes de pluriel de chaque langue (en français `_one`, `_many`, `_other` ; en anglais `_one`, `_other`), mêmes `{{valeurs}}`. Nombres et dates : `useFormatters()` dans les composants, jamais `'fr-FR'` ni `getFormatters()` (le React Compiler mémoriserait une valeur dans l'ancienne langue). Mots en gras dans une phrase : `<b>…</b>` dans la traduction, rendu par `RichText` (ou `CardText` sur l'Accueil) avec `t(clé, { skipInterpolation: true })`.
- **Web et langue** : l'export web statique est rendu en anglais ; dans un navigateur en français, React signale une différence au chargement (erreur 418) et refait le rendu côté client. Sans effet sur Android.
- **Paramètres** : un menu (`(tabs)/settings/index.tsx`) et un écran par section dans `(tabs)/settings/`, éléments communs dans `components/settings/ui.tsx`.
- **Écrans des onglets** : chacun est enveloppé dans un `SafeAreaView` limité au bord haut, avec un titre fixe (`components/TabScreenHeader.tsx`).
- **Clés de signature** : une fonction qui marche en local mais pas avec l'application du Store (ou l'inverse) vient presque toujours d'une empreinte non déclarée. Voir [`signing.md`](signing.md).
- **Compte de démonstration Google Play** : Google bloquait les connexions des examinateurs au compte Gmail de démonstration (« appareil inconnu »). Remplacé depuis la 1.3.1 par l'accès de démonstration de l'[ADR 0006](adr/0006-review-demo-access.md) : première connexion réussie d'un examinateur le 2026-10-06. Le code est dans la Play Console (Policy → App content → Sign-in details) : le changer impose de le mettre à jour là aussi.
- **Comptes fictifs** (ADR 0006) : le compte de démonstration (identifiant de connexion de type `demo`) et ses 6 amis fictifs (identifiants `de300000-0000-4000-8000-…`, sans identifiant de connexion). À exclure de toute statistique d'usage. Ne pas les modifier à la main : chaque connexion de démonstration les remet dans leur état d'origine.
- **Comptes inconnus en base** : le robot de test de Google Play crée des comptes pendant l'examen d'une version (nom aléatoire, aucun pas), en plus du compte de démonstration des examinateurs. Ne jamais rendre « tout le monde » ami : `backend/scripts/seed-tester-friendships.sql` prend une liste explicite de comptes.
- **Huawei** : `plugins/withAGConnect.js` applique la configuration AppGallery Connect seulement si `agconnect-services.json` (ou la variable EAS `AGCONNECT_SERVICES_JSON`) est présent, et seulement pour le package de production.
- **Icônes** : la source est `icons/app-icon-foreground.svg` ; tout se régénère avec `python3 icons/export-app-icons.py`, qui nécessite Inkscape.
- **Codes d'invitation** : en base 32 de Crockford. Les lettres I, L et O sont lues comme 1 et 0 : beaucoup de mots de 8 lettres sont donc des codes valides. Pour un code invalide dans un test, utiliser la lettre U, qui est exclue.
- **Limites de débit** : stockage en mémoire, donc propres à chaque instance du backend. À revoir si le backend passe à plusieurs instances.

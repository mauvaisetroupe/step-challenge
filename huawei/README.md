# Huawei Health Kit — Intégration Expo / Step Challenge

## Objectif

Ajouter le support **Huawei Health Kit** à l'application Expo Step Challenge, sans casser le support existant :

```text
Step Challenge
├── react-native-health-connect
│   └── Android / Health Connect / Garmin
│
└── @hmscore/react-native-hms-health
    └── Android / Huawei Health Kit
             │
             ▼
         stepSync.ts
             │
             ▼
        PostgreSQL
```

L'objectif fonctionnel reste :

* affichage rapide des pas du jour depuis le provider local ;
* synchronisation silencieuse de l'historique vers PostgreSQL ;
* leaderboard et historique annuel depuis PostgreSQL ;
* support de Health Connect et Huawei sans dupliquer la logique métier.

---

## 1. Package Huawei installé

Depuis `apps/mobile` :

```bash
npm install @hmscore/react-native-hms-health
```

Version installée :

```text
@hmscore/react-native-hms-health@6.15.0-303
```

Le package fournit le binding React Native vers le Huawei Health SDK.

Il compile correctement avec le projet actuel.

---

## 2. Configuration Huawei AppGallery Connect

Application Huawei :

```text
Step Challenge
App ID: 118922449
```

La demande d'accès Health Service Kit a été soumise à Huawei.

Statut au moment de cette intégration :

```text
To be reviewed
Test users: 0/100
```

Huawei indique une revue manuelle pouvant prendre environ 10 jours ouvrés.

### Privacy / Agreement

Privacy policy :

```text
https://step.architech.lu/privacy.html
```

Agreement :

```text
https://step.architech.lu/agreement.html
```

Ces pages sont hébergées par le backend Step Challenge.

---

## 3. `agconnect-services.json`

Le fichier fourni par AppGallery Connect a été placé ici :

```text
apps/mobile/android/app/agconnect-services.json
```

C'est le bon emplacement pour le plugin AGConnect.

**Ne jamais committer publiquement ce fichier sans vérifier son contenu et la politique de sécurité du projet.**

À vérifier avant commit :

```bash
git status
git check-ignore -v android/app/agconnect-services.json
```

Si nécessaire, ajouter le fichier à `.gitignore`.

---

## 4. Particularité Expo

Le package Huawei ne fournit pas de config plugin Expo permettant de générer automatiquement toute la configuration Android nécessaire.

Les fichiers suivants ont donc été modifiés manuellement pour le POC :

```text
apps/mobile/android/build.gradle
apps/mobile/android/app/build.gradle
```

### `android/build.gradle`

Ajout du repository Huawei :

```gradle
maven { url 'https://developer.huawei.com/repo/' }
```

dans `buildscript.repositories` et `allprojects.repositories`.

Ajout du plugin AGConnect :

```gradle
classpath('com.huawei.agconnect:agcp:1.9.1.304')
```

Point important : le projet Expo utilise initialement une dépendance AGP sans version explicite :

```gradle
classpath('com.android.tools.build:gradle')
```

AGConnect ne l'acceptait pas correctement.

La version réellement utilisée par Expo a donc été identifiée puis rendue explicite :

```gradle
classpath('com.android.tools.build:gradle:8.12.0')
```

---

## 5. Comment la version AGP a été vérifiée

Avec le plugin Huawei temporairement désactivé :

```gradle
// apply plugin: 'com.huawei.agconnect'
```

on a exécuté :

```bash
./android/gradlew -p android buildEnvironment
```

Cela a permis de confirmer la stack réellement utilisée :

```text
Gradle       9.3.1
Android AGP  8.12.0
Kotlin       2.1.20
compileSdk   36
targetSdk    36
minSdk       26
NDK          27.1.12297006
```

Le point important était de **ne pas downgrader arbitrairement Expo/AGP** : on a simplement rendu explicite la version déjà utilisée.

---

## 6. Configuration de l'application

Dans :

```text
apps/mobile/android/app/build.gradle
```

ajout :

```gradle
apply plugin: 'com.huawei.agconnect'
```

Le plugin doit être appliqué après le plugin Android/React Native.

Le résultat est que Gradle détecte maintenant correctement :

```text
AGConnect plugin version: 1.9.1.304
Gradle version: 9.3.1
Android Plugin version: 8.12.0
```

---

## 7. Premier problème rencontré

Avec :

```gradle
classpath('com.android.tools.build:gradle')
```

et :

```gradle
apply plugin: 'com.huawei.agconnect'
```

le build échouait avec :

```text
Failed to apply plugin 'com.huawei.agconnect'.

com.android.tools.build:gradle is no set in the build.gradle file
```

AGConnect attendait une version explicite d'Android Gradle Plugin.

La vérification avec `buildEnvironment` a montré que la version réellement résolue était :

```text
com.android.tools.build:gradle -> 8.12.0
```

Nous avons donc utilisé :

```gradle
classpath('com.android.tools.build:gradle:8.12.0')
```

---

## 8. Build final

Commande utilisée depuis :

```text
apps/mobile
```

```bash
./android/gradlew -p android :app:assembleDebug
```

Résultat :

```text
BUILD SUCCESSFUL in 6m 40s
459 actionable tasks: 429 executed, 30 up-to-date
```

Le log confirme notamment :

```text
> Task :hmscore_react-native-hms-health:compileDebugJavaWithJavac
```

Donc le module Huawei est bien compilé dans l'application.

AGConnect confirme également l'utilisation de :

```text
android/app/agconnect-services.json
```

pour les variantes `debug`, `release` et `debugOptimized`.

### Conclusion du POC build

La combinaison suivante fonctionne :

```text
Expo SDK       57.0.20
React Native   0.86.3
Gradle         9.3.1
AGP            8.12.0
Kotlin         2.1.20
compileSdk     36
minSdk         26
HMS Health     6.15.0-303
AGConnect      1.9.1.304
```

---

# 9. Warnings rencontrés

Ils n'empêchent pas le build.

### React Native / dépendances

Plusieurs bibliothèques utilisent encore des API React Native dépréciées :

* `react-native-health-connect`
* `react-native-safe-area-context`
* `react-native-reanimated`
* `react-native-screens`
* `expo-modules-core`
* etc.

Ce sont des warnings des dépendances, pas des problèmes introduits spécifiquement par Huawei.

### AndroidManifest

Android signale notamment l'utilisation de :

```text
package="..."
```

dans certains manifests de bibliothèques.

Android ignore désormais cet attribut pour définir le namespace.

Cela concerne notamment :

```text
@react-native-async-storage
react-native-safe-area-context
react-native-health-connect
```

Pas bloquant.

### SDK XML

Un warning CMake :

```text
This version only understands SDK XML versions up to 3
but an SDK XML file of version 4 was encountered.
```

Il indique probablement une différence de version entre certains outils Android Studio / command-line tools.

Le build continue normalement.

À surveiller lors d'une future mise à jour de l'environnement Android, mais **pas nécessaire pour le POC Huawei**.

### NODE_ENV

Expo signale :

```text
The NODE_ENV environment variable is required but was not specified.
```

Le build continue et utilise `.env.local` / `.env`.

Ce n'est pas bloquant pour ce test.

---

# 10. Limitations actuelles

Le build réussi **ne signifie pas encore que Huawei Health fonctionne fonctionnellement**.

On a uniquement validé :

```text
JavaScript package
       ↓
Android native module
       ↓
Huawei SDK
       ↓
Gradle / AGConnect
```

Il reste à valider :

* disponibilité de Huawei Health sur l'appareil ;
* connexion au compte Huawei ;
* autorisation Health Kit ;
* lecture des pas ;
* lecture de l'historique ;
* comportement sans Huawei Health installé/configuré ;
* gestion des refus d'autorisation ;
* éventuellement la synchronisation en arrière-plan.

Autre limitation importante :

**la demande Health Service Kit est encore en attente de validation Huawei.**

Il faudra donc tenir compte des restrictions éventuelles tant que l'application n'est pas approuvée.

---

# 11. Important : ne pas lancer `expo prebuild --clean`

Pour l'instant, la configuration Huawei est faite directement dans :

```text
android/
```

Un :

```bash
npx expo prebuild --clean
```

peut régénérer le projet Android et supprimer ces modifications.

Donc :

```text
POC actuel
    ↓
modifications Android manuelles
    ↓
validation Huawei
    ↓
config plugin Expo local
    ↓
configuration reproductible
```

La transformation en config plugin doit être faite **après avoir validé le fonctionnement Huawei**, pas avant.

---

# 12. Next steps

## Étape 1 — POC JavaScript Huawei

Ne pas modifier immédiatement toute la logique `stepSync.ts`.

Créer d'abord un test minimal permettant de :

1. initialiser HMS Health ;
2. demander les permissions de lecture des pas ;
3. lire les pas du jour ;
4. afficher le résultat dans l'application ;
5. tester sur un appareil Huawei réel.

Objectif :

```text
Huawei Health
      ↓
HMS Health Kit
      ↓
React Native
      ↓
nombre de pas aujourd'hui
```

---

## Étape 2 — Vérifier les permissions

Tester les cas :

* première utilisation ;
* permission accordée ;
* permission refusée ;
* permission déjà accordée ;
* Huawei Health non disponible ;
* utilisateur non connecté.

L'application ne doit pas casser si Huawei n'est pas disponible.

---

## Étape 3 — Historique

Tester ensuite la lecture :

```text
today
7 days
30 days
```

et vérifier les valeurs avec Huawei Health.

Le but est d'obtenir une fonction Huawei comparable à l'actuelle abstraction Health Connect.

---

## Étape 4 — Abstraction dans `stepSync.ts`

Une fois le POC validé :

```text
stepSync.ts
      │
      ├── Android + Huawei
      │       → HMS Health
      │
      └── Android + autres appareils
              → Health Connect
```

L'idéal est que le reste de l'application ne sache pas quel provider est utilisé.

---

## Étape 5 — Synchronisation PostgreSQL

Réutiliser la logique existante :

```text
provider local
      ↓
daily steps
      ↓
syncLast30Days()
      ↓
PostgreSQL
```

Ne pas dupliquer la logique métier uniquement pour Huawei.

---

## Étape 6 — Config plugin Expo

Quand le POC est validé, créer un config plugin local pour reproduire automatiquement :

* repository Huawei ;
* AGConnect classpath ;
* application du plugin AGConnect ;
* éventuellement les autres modifications Android nécessaires.

Cela permettra ensuite de supprimer les modifications manuelles de `android/`.

---

# 13. État du chantier

```text
[✓] Huawei AppGallery Connect application créée
[✓] Health Service Kit demandé
[✓] Privacy policy disponible
[✓] Agreement disponible
[✓] @hmscore/react-native-hms-health installé
[✓] agconnect-services.json installé
[✓] Huawei Maven repository configuré
[✓] AGConnect configuré
[✓] AGP 8.12.0 identifié
[✓] Version AGP rendue explicite
[✓] Module HMS Health compilé
[✓] assembleDebug réussi

[ ] HMS Health initialisation JS
[ ] Permission Health Kit
[ ] Lecture des pas Huawei
[ ] Lecture historique
[ ] Gestion des erreurs / provider indisponible
[ ] Intégration dans stepSync.ts
[ ] Synchronisation PostgreSQL
[ ] Tests Huawei réels
[ ] Config plugin Expo
[ ] Suppression des modifications Android manuelles
[ ] Validation Huawei/AppGallery Connect
```

## Point de reprise

La prochaine session doit commencer par le **POC JavaScript HMS Health minimal**, et non par une nouvelle modification Gradle.

Le build Android est désormais une base fonctionnelle validée.

---

# 14. Mise à jour — 2026-10-04

Les sections 1 à 13 décrivent le POC tel qu'il a été mené. Depuis, le projet est passé à `expo prebuild` (`android/` est généré et non versionné) : la section 11 n'est plus d'actualité.

## Statut Huawei

* Demande Health Service Kit : **To be reviewed** (refusée le 2026-10-16, voir la section 15). Impossible de tester la lecture des pas tant qu'elle n'est pas validée (`signIn` sur le scope `step.read` échouera).
* Permission d'accès à l'**historique demandée : 1 mois**. Cohérent avec `HISTORY_DAYS = 30` dans `stepSync.ts`.

## Cas d'usage cible

Une testeuse (Christel) a une **montre Huawei appairée à l'application Huawei Health sur un téléphone Samsung**.

* Huawei Health **ne déverse pas** ses données dans Google Health Connect : la seule voie est Health Kit directement.
* Health Kit doit fonctionner sur un téléphone non-Huawei à condition que **HMS Core** soit installé (normalement présent avec l'application Huawei Health) — à confirmer sur son téléphone.

Conséquence pour l'étape 4 : le provider ne se choisit **pas selon la marque du téléphone**, mais par l'utilisateur (Health Connect ou Huawei Health), dans les Paramètres.

## Plan d'intégration (reporté, en attente de la validation Huawei)

1. **Abstraction « provider de pas » dans `stepSync.ts`** : une interface commune (`getDailyStats(start, end): DayStat[]`) avec deux implémentations, Health Connect et Huawei. La comparaison avec le serveur, l'upsert et la tâche de fond restent inchangés. Testable dès maintenant côté Health Connect (non-régression).
2. **Historique Huawei** : `huaweiHealth.ts` ne lit aujourd'hui que le jour courant (`readTodaySummation`). Le package expose `HmsDataController.readDailySummation(dataType, startTime, endTime)` ; le format de `startTime` / `endTime` n'est pas typé (probablement `yyyyMMdd` en nombre — à vérifier au premier test).
3. **Choix du provider** dans les Paramètres, stocké localement, utilisé par `stepSync` et la tâche de fond.
4. **Bord de la fenêtre d'historique** : selon la façon dont Huawei compte « 1 mois », le jour le plus ancien peut être refusé. Ne pas faire échouer toute la synchro : observer si Huawei renvoie une erreur ou un tableau vide, et traiter ce cas.

## Configuration native après prebuild (résolu le 2026-10-04)

La configuration AppGallery Connect est maintenant reproduite à chaque `prebuild` par le config plugin `apps/mobile/plugins/withAGConnect.js` :

* il copie `agconnect-services.json` dans `android/app/` ;
* il ajoute le dépôt Maven Huawei et le classpath du plugin Gradle AGConnect au `buildscript`, avec la version d'AGP rendue explicite (lue dans `react-native/gradle/libs.versions.toml`, voir la section 7) ;
* il applique `com.huawei.agconnect` à l'application. C'est ce plugin Gradle qui ajoute `com.huawei.hms.client.appid` au manifeste : sans lui, HMS Core ne reconnaît pas l'application.

Sans fichier de configuration (clone du dépôt public, CI), ou pour un autre package que celui du fichier (variante de développement `.dev`, non déclarée dans AppGallery Connect), le plugin n'applique rien : l'application se construit, sans Huawei Health.

### Où trouver le fichier

* **En local** : `apps/mobile/agconnect-services.json`, téléchargé depuis AppGallery Connect (Project settings → General information) et ignoré par git. Le modèle `apps/mobile/agconnect-services.example.json` montre sa structure, avec des valeurs factices.
* **Builds EAS** (y compris `--local`) : EAS n'envoie pas les fichiers ignorés par git. Le **contenu** du fichier est fourni par la variable d'environnement EAS `AGCONNECT_SERVICES_JSON` (type texte), que le plugin écrit dans `android/app/` :

  ```bash
  cd apps/mobile
  npx eas-cli env:set production --name AGCONNECT_SERVICES_JSON \
    --type string --visibility sensitive --value "$(cat agconnect-services.json)"
  ```

  * Type **texte** et non fichier : les variables de type fichier ne sont pas fournies aux builds locaux (vérifié avec `eas env:exec`).
  * Visibilité `sensitive` et non `secret` : une variable `secret` n'est lisible que sur les serveurs de build d'EAS.
  * Vérification : `npx eas-cli env:exec production 'test -n "$AGCONNECT_SERVICES_JSON" && echo présente'`.

  À refaire après chaque nouveau téléchargement du fichier (par exemple après l'ajout d'une empreinte).

### Empreintes déclarées dans AppGallery Connect

Les trois empreintes SHA-256 doivent être déclarées : clé de debug (builds locaux), clé d'envoi, et **clé de signature Google Play**, qui signe l'application installée depuis le Store. Valeurs et emplacements : voir [`docs/signing.md`](../docs/signing.md).

### Constat du 2026-10-04

L'application 1.2.x du Store ne contenait pas `com.huawei.hms.client.appid` (fichier perdu lors d'une régénération de `android/`) : HMS Core proposait alors une mise à jour, qui échouait avec l'erreur 102 sur un téléphone non Huawei. La semaine précédente, avec le fichier, l'erreur était 50011 (demande Health Kit encore en examen).

La demande Health Kit est toujours **To be reviewed** : les comptes de test (0/100) ne peuvent être ajoutés qu'une fois la permission de test accordée.

# 15. Refus de la demande Health Kit — 2026-10-16

Huawei a refusé la demande de permission Health Kit, pour deux raisons :

1. **Pas de preuve de publication sur HUAWEI AppGallery.** Huawei exige que l'application y soit publiée dès la demande ([conditions](https://developer.huawei.com/consumer/en/doc/HMSCore-Guides/application-qualification-description-0000001425636570), page inaccessible le jour du refus). Le test fermé sur Google Play ne suffit pas.
2. **Autorisation d'écriture des pas demandée sans justification.** Elle avait été cochée par erreur : l'application ne demande que la lecture (`STEP_READ_SCOPE` dans `apps/mobile/src/services/huaweiHealth.ts`) et n'écrit rien dans Health Kit. À décocher dans le formulaire ; garder la lecture des pas et 1 mois d'historique.

## Suite choisie

* Ticket au support (HMS Core → Health Kit) envoyé le 2026-10-16 : permission de test (comptes de test, 0/100) possible avant toute publication ? Une version en test ouvert ou limitée à quelques pays suffit-elle comme preuve ?
* Sans attendre la réponse, **publication sur AppGallery** (pas d'ADR pour l'instant) : version 1.9.0 soumise le 2026-10-16.

## Publication sur AppGallery

* **Paquet : APK, sans App Signing.** AppGallery n'accepte un AAB qu'avec App Signing : soit Huawei génère sa propre clé (nouvelle empreinte à déclarer dans AGC, dans un client OAuth Google et dans `assetlinks.json`, clé ni visible ni exportable), soit on lui confie une clé privée (celle de Google Play ne s'exporte pas ; il faudrait celle d'importation). L'APK est signé avec la **clé d'importation** d'EAS, dont l'empreinte est déjà déclarée partout (voir [`docs/signing.md`](../docs/signing.md)) : Huawei le distribue tel quel.
* **Build, vérification de l'APK et envoi** : voir [`docs/exploitation.md`](../docs/publication.md#huawei-appgallery).
* **Fiche** : français (par défaut) et anglais, sans balises HTML (AppGallery les affiche telles quelles) ; icône `icons/playstore-icon.png` ; captures `docs/screenshots/french/` et `english/` (compte de démonstration, données fictives).
* **Version** :
  * pays : France seulement (en ajouter se fait dans une nouvelle version, sans nouveau paquet) ;
  * classification par âge : 7+ (interactions entre utilisateurs : oui ; compte et données personnelles : oui ; position : non ; application non destinée aux seuls enfants) ;
  * confidentialité : `privacy.html`, droits des personnes : `delete-account.html` ;
  * données déclarées, usage « App functionality » seulement : Fitness information, Contact list (amis), User identifiers, Account information (nom affiché), Text information (surnoms, commentaire de signalement) ; pas de transfert hors du pays (VPS OVH en France) ;
  * examinateurs : « Sign-in required », utilisateur `demo`, mot de passe = code d'accès de démonstration (ADR 0006), remarque de 300 caractères au plus. Sur un téléphone Huawei sans Santé Connect, l'examinateur voit les pas des amis fictifs, et 0 pour lui.
* **Examen** : contrôle automatique en quelques heures (refus éventuel dans ce délai), puis examen manuel.

### Refus de la 1.9.0 (2026-10-22) et 1.9.1

Rapport du 2026-10-22, règle 3.1 (« l'application doit être utilisable dans ses pays de publication »), testée sur P30 Pro (EMUI 10.1) et P40 Pro (EMUI 12), **sans Santé Connect** :

1. « Service not available » (message d'androidx Health Connect) sur l'accueil, Stats et le classement, qui ne s'affichait pas du tout (la synchronisation précédait sa lecture, dans le même `try`) ;
2. plantage sur Paramètres → Sources de pas → Ouvrir Santé Connect : `openHealthConnectSettings()` de `react-native-health-connect` lance une activité qui n'existe pas (`ActivityNotFoundException`, côté natif, impossible à rattraper en JavaScript).

Corrections de la 1.9.1 :

* `isHealthConnectAvailable()` (`services/stepSync.ts`, d'après `getSdkStatus()`) ; sans Santé Connect, l'accueil et Stats lisent la base comme le client web, le classement s'affiche même si la synchronisation échoue, Sources de pas affiche une explication, et `openHealthConnectSettingsIfAvailable()` remplace tous les appels directs ;
* **podomètre du téléphone**, en attendant Health Kit, dans le build AppGallery seulement (`PHONE_STEP_COUNTER=true`, profil `appgallery`) : capteur `TYPE_STEP_COUNTER` (module `modules/phone-steps`), autorisation « Activité physique » (`ACTIVITY_RECOGNITION`, ajoutée par `plugins/withPhoneStepCounter.js` ; le build Play la retire toujours), relevé à chaque ouverture de l'accueil, de Stats et à l'actualisation du classement, total du jour envoyé au serveur (`services/phoneSteps.ts`, calcul testé dans `phoneStepTally.ts`). Volontairement simple : rien avant la première ouverture, les pas entre le dernier relevé d'un jour et le premier du suivant vont au jour précédent, ceux d'avant un redémarrage sont perdus, pas de synchronisation en arrière-plan ni de détail par minute. **À retirer** quand Health Kit sera en place : le module, les deux fichiers de service, le plugin, la variable du profil `appgallery` et l'exception dans `withHuaweiHealthManifest.js`.
* **Rien qui échoue sur un Huawei** (vérifié sur un émulateur Android 10 sans services Google, avec l'APK de release) : tant que Health Kit n'est pas accordé, `HUAWEI_HEALTH_READY = false` (`services/huaweiHealthReady.ts`) remplace l'écran Paramètres → Huawei Health par « arrive bientôt » (sans le bouton, dont la connexion échouerait) et le diagnostic Huawei par une ligne « Bientôt disponible » (ses appels au SDK ouvraient aussi « HMS Core is not installed » sur l'émulateur) ; le diagnostic indique « Non disponible sur ce téléphone » pour Santé Connect et l'état du podomètre, sans croix rouge ; le travailleur natif ne s'exécute plus sans Santé Connect (sinon un échec toutes les 6 heures dans l'historique) ; le lien « Demo access » passe au-dessus de la barre de navigation (il était presque caché sous Android 10 à trois boutons). **À la réponse de Huawei** : passer `HUAWEI_HEALTH_READY` à `true`.
* **Message aux endroits dégradés** (Accueil, Stats 1j, score d'activité, Sources de pas, Synchronisation en arrière-plan, Activité) : ce qui nécessite Santé Connect, puis la même fin, construite par `noHealthConnectNotice()` (`services/noHealthConnectNotice.ts`) : « Pour l'instant, sur ce téléphone, Step Challenge compte tes pas avec le podomètre du téléphone, à chaque ouverture de l'application » (ou « ne peut pas lire tes pas » sans podomètre) et « La prise en charge de Huawei Health arrive bientôt » (tant que `HUAWEI_HEALTH_READY` est faux).
* Émulateur « comme un Huawei » : AVD `Huawei_like_API29`, image `system-images;android-29;default;arm64-v8a` (sans Google Play, donc sans Santé Connect, qui fait partie du système depuis Android 14). L'APK de release s'y installe (pas d'application Play à remplacer) ; il n'a pas de podomètre.
* Test sur un Pixel : build de développement avec `SIMULATE_NO_HEALTH_CONNECT=true` et `PHONE_STEP_COUNTER=true` (voir `app.config.ts`), après `npx expo prebuild --clean -p android`.

**1.9.1 (versionCode 47) soumise, en examen au 2026-10-25**, avec les notes de version (App information → New features) en français et en anglais.

Remarque pour les examinateurs (300 caractères au plus), saisie dans AppGallery Connect pour la 1.9.1 :

> The app uses Google sign-in. For review, tap "Demo access" at the bottom of the sign-in screen and enter the access code given in the password field. Huawei phones have no Health Connect: steps come from the phone's step counter (allow "Physical activity"). Friends and history are fictitious.

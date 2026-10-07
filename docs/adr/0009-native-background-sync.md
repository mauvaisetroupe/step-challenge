# ADR 0009 — Synchronisation en arrière-plan native

- **Statut** : Accepté
- **Date** : 2026-10-07
- **Décideur** : mauvaisetroupe

## Contexte

Les pas sont envoyés au serveur pour que les amis voient un classement à jour. La synchronisation se fait au premier plan (ouverture de l'Accueil, Classement tiré vers le bas, « Synchroniser maintenant ») et, depuis la 1.5.1, en arrière-plan toutes les 6 heures environ, avec l'autorisation Santé Connect `READ_HEALTH_DATA_IN_BACKGROUND` (acceptée par Google).

La tâche d'arrière-plan s'appuie sur `expo-background-task` : Android lance un travailleur natif (WorkManager), qui doit démarrer ou retrouver le moteur JavaScript (Hermes) pour exécuter `backgroundSync.ts`. Les essais du 2026-10-07 sur un Pixel 7 montrent que cette étape n'est pas fiable :

- quand le processus de l'application est resté gelé en mémoire depuis le matin, le travailleur natif démarre (« Executing task 'step-challenge-sync' ») mais le JavaScript ne s'exécute jamais ; Android arrête la tâche, la relance, sans résultat ;
- dès que l'application est ouverte, un JavaScript neuf exécute la tâche en attente et la synchronisation réussit : le code de synchronisation n'est pas en cause.

C'est un problème connu d'Expo, ouvert ([expo/expo#35193](https://github.com/expo/expo/issues/35193)). Toute solution qui réveille le moteur JavaScript en arrière-plan (Headless JS de React Native, autres bibliothèques) partage cette fragilité.

## Options étudiées

### Option A — Garder `expo-background-task`

- ✅ Rien à faire.
- ❌ L'arrière-plan reste aléatoire ; les amis voient des pas en retard.

### Option B — Une autre bibliothèque JavaScript d'arrière-plan

- ❌ Même mécanisme (JavaScript sans écran), mêmes risques.

### Option C — Un travailleur natif, sans JavaScript

Un module local Expo, en Kotlin, avec un travailleur WorkManager qui lit Santé Connect et appelle l'API lui-même.

- ✅ La manière standard et fiable de travailler en arrière-plan sur Android : aucun moteur JavaScript à réveiller.
- ✅ Réutilisable pour Huawei, dont le SDK est natif.
- ❌ Du code natif à maintenir (le premier code métier natif du projet).
- ❌ Le jeton de session doit être accessible au code natif.

## Décision

**Option C.** Le premier plan reste en TypeScript ; seule la synchronisation d'arrière-plan passe en Kotlin.

## Conception

### Module local `apps/mobile/modules/step-sync`

Module Expo (API Expo Modules), découvert par l'autoliaison, intégré par `expo prebuild` : pas de code dans `android/`, qui est généré.

| Fonction (JavaScript) | Rôle |
|---|---|
| `configure(apiUrl, token)` | Enregistre l'adresse de l'API et le jeton de session pour le travailleur |
| `clear()` | Efface le jeton et annule la synchronisation (déconnexion, suppression du compte, session refusée) |
| `schedule(intervalMinutes)` | Programme le travail périodique (6 heures) ; met à jour une programmation existante |
| `getHistory()` | Exécutions d'arrière-plan récentes, pour Paramètres → Synchronisation |

### Le travailleur

- `CoroutineWorker` WorkManager, travail périodique unique (`step-challenge-native-sync`), contrainte réseau.
- Vérifie la disponibilité de Santé Connect et les autorisations accordées (`READ_STEPS` et `READ_HEALTH_DATA_IN_BACKGROUND`) ; sans elles, l'exécution est enregistrée comme échouée, avec la cause, sans rien demander (aucun écran).
- Lit les totaux quotidiens des 30 derniers jours (`aggregateGroupByPeriod`, un jour par tranche, heure locale), comme `stepSync.ts`.
- Envoie `POST /api/me/steps` (`{ days: [{ date, steps }] }`, 31 jours au plus par requête) avec `Authorization: Bearer <jeton>`. Le serveur garde le maximum par jour : renvoyer les mêmes jours est sans effet.
- Une réponse `401` (session révoquée ou expirée) efface le jeton et arrête la synchronisation jusqu'à la prochaine connexion.
- Chaque exécution est ajoutée à un historique (10 dernières), avec la cause d'un échec.

### Le jeton de session

- Transmis par le JavaScript au module à chaque enregistrement ou chargement de la session (`auth/session.ts`), et effacé avec elle.
- Rangé chiffré : clé AES-GCM dans le Keystore Android (non exportable), texte chiffré dans les préférences privées de l'application. Même niveau de protection que `expo-secure-store`, sans dépendre de son format interne.
- Jamais journalisé.

### Ce qui disparaît

- `expo-background-task` et `expo-task-manager`, et `src/services/backgroundSync.ts` dans sa forme actuelle. Les travaux WorkManager programmés par l'ancienne version sont annulés à la première programmation du nouveau travailleur.

### Ce qui ne change pas

- Les synchronisations au premier plan (TypeScript).
- L'autorisation Santé Connect en arrière-plan, la déclaration Play Console, Data safety et la politique de confidentialité : même données, même fréquence, même application.
- Paramètres → Synchronisation : l'historique réunit les exécutions d'arrière-plan (natives) et « Synchroniser maintenant » (TypeScript).

## Conséquences

### Positives

- Une synchronisation d'arrière-plan qui ne dépend plus du moteur JavaScript.
- Une base pour la source Huawei en arrière-plan.

### Négatives

- Du Kotlin à maintenir, testé à la main (forçage du travail avec `adb shell cmd jobscheduler run -f`).
- Deux implémentations de la lecture de Santé Connect (TypeScript au premier plan, Kotlin en arrière-plan), à garder cohérentes (30 jours, journées en heure locale).

## Points ouverts

- Huawei Health Kit en arrière-plan, dans le même travailleur, une fois la source Huawei intégrée.

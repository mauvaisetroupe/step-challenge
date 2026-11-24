# ADR 0013 — Une seule source de pas, choisie par l'utilisateur

- **Statut** : Proposé
- **Date** : 2026-11-24
- **Décideur** : mauvaisetroupe

## Contexte

Step Challenge lit les pas dans **Santé Connect**, qui rassemble ceux de Garmin, Samsung, Fitbit, Xiaomi, du téléphone, etc. Les montres et bracelets **Huawei** n'y écrivent pas : leurs pas restent dans Huawei Health, lisible seulement par **Huawei Health Kit** (HMS Core). C'est la niche visée (voir [l'intégration Huawei](../explanation/huawei-integration.md)) : par exemple, une montre Huawei appairée à Huawei Health sur un téléphone Samsung.

Huawei a accordé la permission de **test** de Health Kit le 2026-11-24 (100 premiers utilisateurs, un an). Premier essai le même jour sur un Pixel 7 (Android 17, HMS Core et Huawei Health installés) :

- connexion HUAWEI et scope `step.read` : accordés ;
- pas du jour (`readTodaySummation`) et totaux par jour (`readDailySummation`) : lus, à condition de demander `DT_CONTINUOUS_STEPS_DELTA` (avec `DT_CONTINUOUS_STEPS_TOTAL`, erreur 50012) ;
- historique : **30 jours, aujourd'hui compris** (J-29 à aujourd'hui) ; à partir de J-30, erreur 50059 (`SecurityException`). C'est déjà la fenêtre de `stepSync.ts` (`HISTORY_DAYS = 30`) ;
- Huawei Health compte aussi le podomètre du téléphone : le même jour, à un pas près, le total que Santé Connect attribue au téléphone ;
- **gel de HMS Core** : une dizaine de secondes après un appel, Android gèle le processus `com.huawei.hwid.container1`, qui héberge le service Health Kit (« cached apps freezer », présent sur tous les Android récents). Les appels suivants attendent en vain et échouent avec 50011, jusqu'à un arrêt forcé de HMS Core.

Aujourd'hui, l'utilisateur ne voit pas d'où viennent ses pas : les Paramètres ont une entrée « Sources de pas » (le détail de Santé Connect) et une entrée « Huawei Health » (un bouton de connexion), sans lien entre elles.

Contraintes existantes :

- le serveur garde, pour chaque jour, le **plus grand** total reçu (`POST /api/me/steps`, `WHERE daily_steps.steps < EXCLUDED.steps`) ;
- le travailleur Kotlin de l'[ADR 0009](0009-native-background-sync.md) lit Santé Connect et envoie les pas toutes les 6 heures, sans JavaScript ;
- l'API reste compatible avec les versions publiées ([ADR 0012](0012-api-backward-compatibility.md)).

## Options étudiées

### Option A — Choisir la source selon la marque du téléphone

- ✅ Rien à demander à l'utilisateur.
- ❌ Faux pour le cas visé : une montre Huawei sur un téléphone Samsung. Et un téléphone Huawei récent peut avoir Santé Connect.

### Option B — Lire les deux sources et garder le maximum par jour

- ✅ Pas de choix à faire ; jamais de pas comptés deux fois (maximum, pas somme).
- ❌ Deux consentements à demander à tout le monde, et HMS Core à installer pour profiter de l'application.
- ❌ Un total impossible à expliquer (« pourquoi ce chiffre et pas celui de ma montre ? ») : l'écran des sources ne pourrait plus dire d'où il vient.
- ❌ Le gel de HMS Core toucherait tous les utilisateurs de Huawei Health, même ceux qui n'en ont pas besoin.

### Option C — Une seule source à la fois, choisie par l'utilisateur

- ✅ Un chiffre, une origine, que l'écran peut montrer et expliquer.
- ✅ Les utilisateurs de Santé Connect ne voient rien changer : pas de consentement Huawei, pas d'appel à HMS Core.
- ❌ Un réglage de plus, à rendre compréhensible.
- ❌ Changer de source ne fait pas baisser les jours déjà envoyés (règle du maximum, voir plus bas).

## Décision

**Option C.**

### Les sources

| Source | Disponible quand | Ce qu'elle fournit |
|---|---|---|
| **Santé Connect** | Santé Connect est présent (`isHealthConnectAvailable()`) | pas par jour sur 30 jours, détail minute par minute, sources par application, lecture en arrière-plan |
| **Huawei Health** | HMS Core est présent et le build contient la configuration AppGallery Connect | pas par jour sur 30 jours (aujourd'hui compris), à l'ouverture de l'application |

Le podomètre du téléphone du build AppGallery n'est pas une source au choix : il reste le secours automatique sans Santé Connect, en attendant d'être retiré (voir l'intégration Huawei, « Refus de la 1.9.0 et 1.9.1 »). Tant qu'il existe, choisir Huawei Health le remplace.

### Le choix

- **Gardé sur le téléphone** (`AsyncStorage`, comme les heures de sommeil), jamais envoyé au serveur ; une valeur absente vaut la source par défaut.
- **Par défaut** : Santé Connect s'il est disponible (aucun changement pour les utilisateurs actuels) ; sinon Huawei Health si HMS Core est présent ; sinon le podomètre du build AppGallery, ou rien.
- **Choisir Huawei Health** lance la connexion HUAWEI (scope `step.read`). Si elle échoue ou si l'utilisateur refuse, la source reste celle d'avant. Revenir à Santé Connect déconnecte le compte HUAWEI (`HmsHealthAccount.signOut`).
- **Suggestion** : quand Santé Connect n'a aucun pas sur 30 jours et que l'application Huawei Health est installée, l'écran des sources propose Huawei Health. Il faut déclarer `com.huawei.health` dans les `<queries>` du manifeste pour pouvoir le détecter.

### L'écran

Une seule entrée **Paramètres → Pas → Source des pas** remplace « Sources de pas » et « Huawei Health ». Sa ligne affiche la source et les pas du jour (« Santé Connect · 8 412 aujourd'hui »).

Dans l'écran, deux choix exclusifs, chacun avec une phrase qui dit à qui il s'adresse :

- Santé Connect : « Garmin, Samsung, Fitbit, Xiaomi, Pixel… et le téléphone » ;
- Huawei Health : « Montres et bracelets Huawei (Santé Connect ne reçoit pas leurs pas) ».

Sous le choix, le détail de la source retenue :

- Santé Connect : le contenu actuel de « Sources de pas » (total retenu, pas par application, bouton vers les réglages de Santé Connect) ;
- Huawei Health : compte HUAWEI connecté, pas du jour, bouton « Se déconnecter ».

Changer de source demande une confirmation : « Les pas des 30 derniers jours seront relus dans Huawei Health. Un jour déjà envoyé avec plus de pas garde sa valeur. »

### Ce qui ne fonctionne qu'avec Santé Connect

La courbe minute par minute de Statistiques → 1j, les périodes d'inactivité, les minutes actives et le score ([ADR 0010](0010-daily-activity-minutes.md)), l'explication du surplus et les sources par application. Avec Huawei Health, ces emplacements affichent une phrase (« Détail non disponible avec Huawei Health ») plutôt qu'une zone vide ou une erreur. Les jours envoyés par Huawei Health n'ont pas de minutes actives (`NULL`, déjà affiché comme une absence de donnée). Le détail minute par minute de Health Kit (`DataController.read` sur `DT_CONTINUOUS_STEPS_DELTA`) n'est pas testé : à évaluer plus tard, hors de cette décision.

Statistiques rappelle la source sous les graphiques (« Pas lus dans Huawei Health »).

### La synchronisation

- **Abstraction** : `stepSync.ts` lit les 30 jours via la source choisie (une fonction `getLast30Days()` par source, même type `DayStat[]`). L'envoi au serveur ne change pas.
- **Arrière-plan** : le travailleur Kotlin ne lit que Santé Connect. Il reçoit la source choisie, comme le jeton (`configureNativeSync`), et **ne fait rien** quand la source n'est pas Santé Connect. Sinon, il mélangerait les deux sources : sur le Pixel de l'essai, il enverrait les pas du téléphone vus par Santé Connect. Avec Huawei Health, la synchronisation se fait à l'ouverture et à l'actualisation des écrans ; l'écran Synchronisation le dit.
- **Gel de HMS Core** : chaque appel à Health Kit a un délai court. Un échec 50011 n'est pas une erreur de l'utilisateur : la synchronisation est abandonnée sans message bloquant, les pas déjà envoyés restent affichés, et l'écran Source des pas affiche « Huawei Health ne répond pas » avec une piste de déblocage. La parade est à trouver avant la publication (voir « Points ouverts »).

### Le serveur

**Aucun changement d'API.** La règle du maximum par jour reste : un changement de source ne fait jamais baisser un jour déjà envoyé. C'est acceptable parce que les deux sources mesurent les pas de la même personne, et que changer de source reste rare. Une source qui compte moins (le téléphone seul, après une montre) ne prend le dessus que sur les jours suivants.

### Confidentialité

- **Politique de confidentialité** : ajouter Huawei Health comme origine possible des pas (même donnée, même usage) ; pour Huawei, les pas lus ne sont pas transmis à des tiers.
- **Huawei** : la demande de **vérification** (fin de la limite de 100 utilisateurs) se fait après les tests, avec cette version publiée sur AppGallery.
- **Google Play** : le build Play contient aussi le SDK Huawei Health (déjà le cas depuis la 1.8.2). Rien ne change dans le formulaire Data safety : les données et leur usage sont les mêmes.

## Conséquences

- ✅ L'utilisateur sait d'où viennent ses pas, et ceux qui utilisent Santé Connect ne voient rien changer.
- ✅ Les montres Huawei deviennent utilisables, avec 30 jours d'historique dès la connexion.
- ✅ Pas de nouvelle route ni de migration.
- ⚠️ Avec Huawei Health : pas de synchronisation en arrière-plan ni de détail minute par minute.
- ⚠️ Le gel de HMS Core peut faire échouer la lecture : il faut une parade avant de publier.
- ⚠️ Un retour vers une source qui compte moins ne corrige pas les jours déjà envoyés.

## Points ouverts

1. **Gel de HMS Core** : à tester, dans l'ordre : réessayer après quelques secondes ; ouvrir l'application Huawei Health (`com.huawei.health`) avant la lecture ; une version plus récente du SDK Health (6.15.0.300 aujourd'hui) ; sur le téléphone Samsung de la testeuse, pour savoir si le problème vient du Pixel ou d'Android 17. Le signaler à Huawei (ticket HMS Core → Health Kit).
2. **Lecture en arrière-plan de Huawei Health** : en Kotlin, dans le travailleur, avec le SDK Health natif. Seulement si la parade au gel fonctionne hors de l'application.
3. **Mémoriser la source de chaque jour** sur le serveur (support, diagnostic). Non retenu pour l'instant : demanderait une migration et un champ d'API.

## Hors de cette décision

- Additionner ou fusionner plusieurs sources.
- Écrire des pas dans Santé Connect ou dans Huawei Health (pont entre les deux, écarté le 2026-10-04).
- Le détail minute par minute de Health Kit.

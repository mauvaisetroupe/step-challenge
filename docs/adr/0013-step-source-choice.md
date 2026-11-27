# ADR 0013 — Une seule source de pas, choisie par l'utilisateur ; Huawei Health lu par son API cloud

- **Statut** : Accepté
- **Date** : 2026-11-24, amendé le 2026-11-26 (suggestion de Huawei Health sur l'Accueil, annulation de l'autorisation HUAWEI, courbe 1j heure par heure, historique d'un mois) et le 2026-11-27 (relecture des 30 derniers jours, à la baisse)
- **Décideur** : mauvaisetroupe

## Contexte

Step Challenge lit les pas dans **Santé Connect**, qui rassemble ceux de Garmin, Samsung, Fitbit, Xiaomi, du téléphone, etc. Les montres et bracelets **Huawei** n'y écrivent pas : leurs pas restent dans Huawei Health, lisible seulement par **Huawei Health Kit**. C'est la niche visée (voir [l'intégration Huawei](../explanation/huawei-integration.md)) : par exemple, une montre Huawei appairée à Huawei Health sur un téléphone Samsung.

Huawei a accordé la permission de **test** de Health Kit le 2026-11-24 (100 premiers utilisateurs, un an). Essais le même jour sur un Pixel 7 (Android 17, HMS Core et Huawei Health installés), détaillés dans la section 16 de l'intégration Huawei.

### Lecture par le SDK, sur le téléphone

Le SDK (`@hmscore/react-native-hms-health`) passe par HMS Core : l'application appelle le processus `com.huawei.hwid.core`, qui transmet au processus `com.huawei.hwid.container1`, où tourne le service Health Kit.

- connexion HUAWEI (`HmsHealthAccount.signIn`, scope `step.read`) : accordée ; elle passe par `hwid.core` seulement ;
- pas du jour et totaux par jour : lus, avec le type `DT_CONTINUOUS_STEPS_DELTA` (avec `DT_CONTINUOUS_STEPS_TOTAL` : erreur 50012) ;
- historique : 30 jours, aujourd'hui compris ; à J-30, erreur 50059 ;
- **gel de HMS Core** : une dizaine de secondes après un appel, Android gèle `container1` (« cached apps freezer », sur tous les Android récents). Pour l'appel suivant, `hwid.core` réutilise sa connexion vers `container1` sans passer par Android (pas de nouveau `bindService`) : le processus n'est pas dégelé, la requête n'aboutit pas, erreur **50011** au bout de 5 secondes. Prouvé le 2026-11-24 : après 4 minutes d'inactivité, 50011 ; le **même** processus dégelé à la main (`adb shell am unfreeze`), tout fonctionne. Le gel cesse quand Android finit par tuer le processus (une dizaine de minutes plus tard dans l'essai) : l'échec dépend donc du délai entre deux ouvertures et de la mémoire libre, il est imprévisible. Le bug est dans HMS Core, probablement propre aux téléphones non Huawei ;
- parade possible : avant la lecture, ouvrir depuis l'application une connexion vers un composant exporté par HMS Core dans `container1` (le fournisseur `content://com.huawei.android.sns.sdk`, sans rapport avec Health Kit et sans permission) : Android dégèle le processus tant que la connexion est ouverte (vérifié depuis `adb`). Elle dépend de détails internes de HMS Core (quel conteneur héberge Health Kit, quels composants il exporte).

### Lecture par l'API REST, dans le cloud de Huawei

Huawei Health envoie ses données dans le cloud de Huawei, que Health Kit expose aussi par une API REST (`POST https://health-api.cloud.huawei.com/healthkit/v2/sampleSet:polymerize`). Essai le 2026-11-24, avec le jeton d'accès renvoyé par `HmsHealthAccount.signIn` (en-têtes `Authorization: Bearer`, `x-client-id: 118922449`, `x-version`, `x-caller-trace-id`) :

- **HTTP 200** avec la permission de test actuelle : rien d'autre à demander à Huawei ;
- **mêmes totaux par jour que le SDK**, au pas près, aujourd'hui compris (Huawei Health avait déjà synchronisé) ;
- **HMS Core n'intervient pas** dans la lecture : pas de gel. Il reste nécessaire pour la connexion, qui fonctionne ;
- historique : jusqu'à environ J-60 (au-delà, 403 « The query time is out of range »), cause de cette limite inconnue ; au plus 31 jours par requête (au-delà, 400 « polymerize duration too large »).

### Health Sync

Health Sync (Appyhapps, environ 4 $), qui recopie Huawei Health vers d'autres applications, fait ainsi d'après sa [FAQ](https://healthsync.app/f-a-q/) et sa [politique de confidentialité](https://healthsync.app/privacy-policy/) : lecture dans le cloud (« Health Sync receives data from the Health Service Kit in the cloud, so it may take a few hours before the sync starts working »), traitement sur le téléphone sans stockage sur ses serveurs, HMS Core requis sur un téléphone non Huawei, synchronisation en arrière-plan sur le téléphone. Sa FAQ conseille de réinitialiser HMS Core en cas de problème de synchronisation Huawei. Citation sur HMS Core (section Russie de la FAQ) : « on a non-Huawei phone, you need to install HMS Core package, otherwise Health Sync cannot work properly with Huawei services ». La FAQ ne dit pas à quoi HMS Core lui sert (connexion, données ou les deux).

### Aujourd'hui

L'utilisateur ne voit pas d'où viennent ses pas : les Paramètres ont une entrée « Sources de pas » (le détail de Santé Connect) et une entrée « Huawei Health » (un bouton de connexion), sans lien entre elles.

Contraintes existantes :

- le serveur garde, pour chaque jour, le **plus grand** total reçu (`POST /api/me/steps`, `WHERE daily_steps.steps < EXCLUDED.steps`) ;
- le travailleur Kotlin de l'[ADR 0009](0009-native-background-sync.md) lit Santé Connect et envoie les pas toutes les 6 heures, sans JavaScript ;
- l'API reste compatible avec les versions publiées ([ADR 0012](0012-api-backward-compatibility.md)).

Deux questions : comment choisir la source, et comment lire Huawei Health.

## Options étudiées : le choix de la source

### Option A — Choisir la source selon la marque du téléphone

- ✅ Rien à demander à l'utilisateur.
- ❌ Faux pour le cas visé : une montre Huawei sur un téléphone Samsung. Et un téléphone Huawei récent peut avoir Santé Connect.

### Option B — Lire les deux sources et garder le maximum par jour

- ✅ Pas de choix à faire ; jamais de pas comptés deux fois (maximum, pas somme).
- ❌ Deux consentements à demander à tout le monde, et HMS Core à installer pour profiter de l'application.
- ❌ Un total impossible à expliquer (« pourquoi ce chiffre et pas celui de ma montre ? ») : l'écran des sources ne pourrait plus dire d'où il vient.

### Option C — Une seule source à la fois, choisie par l'utilisateur

- ✅ Un chiffre, une origine, que l'écran peut montrer et expliquer.
- ✅ Les utilisateurs de Santé Connect ne voient rien changer : pas de consentement Huawei, pas d'appel à HMS Core.
- ❌ Un réglage de plus, à rendre compréhensible.
- ❌ Changer de source ne fait pas baisser les jours déjà envoyés (règle du maximum, voir plus bas).

## Options étudiées : la lecture de Huawei Health

### Option 1 — Le SDK sur le téléphone, avec la parade au gel

- ✅ Données immédiates, sans attendre la synchronisation de Huawei Health vers le cloud.
- ❌ Parade fragile, liée aux détails internes de HMS Core ; un module natif à écrire.
- ❌ Historique limité à 30 jours.
- ❌ Arrière-plan incertain : le gel y est encore plus probable.

### Option 2 — L'API REST depuis l'application

- ✅ Pas de gel : seule la connexion passe par HMS Core.
- ✅ Un `fetch` en TypeScript, pas de module natif pour la lecture ; même jeton que celui de la connexion, gardé sur le téléphone.
- ✅ Le modèle de Health Sync, en production chez de nombreux utilisateurs.
- ❌ Dépend de la synchronisation de Huawei Health vers le cloud : délai (de quelques minutes à quelques heures selon Health Sync), et elle doit être activée dans Huawei Health.

### Option 3 — L'API REST depuis notre serveur

- ✅ Synchronisation en arrière-plan, même application fermée ou désinstallée.
- ❌ Jetons HUAWEI de rafraîchissement stockés sur notre serveur : à protéger, à déclarer, à révoquer ; OAuth et tâche planifiée à écrire côté backend.
- ❌ Health Sync montre qu'on peut s'en passer : l'arrière-plan se fait aussi sur le téléphone (voir « Évolution prévue »).

## Décision

**Option C** pour le choix de la source, **option 2** pour la lecture de Huawei Health.

### Les sources

| Source | Disponible quand | Ce qu'elle fournit |
|---|---|---|
| **Santé Connect** | Santé Connect est présent (`isHealthConnectAvailable()`) | pas par jour sur 30 jours, détail minute par minute, sources par application, lecture en arrière-plan |
| **Huawei Health** | HMS Core est présent et le build contient la configuration AppGallery Connect | pas par jour sur 30 jours (lus dans le cloud de Huawei), à l'ouverture de l'application |

Le podomètre du téléphone du build AppGallery n'est pas une source au choix : il reste le secours automatique sans Santé Connect, en attendant d'être retiré (voir l'intégration Huawei, « Refus de la 1.9.0 et 1.9.1 »). Tant qu'il existe, choisir Huawei Health le remplace.

### Le choix

- **Gardé sur le téléphone** (`AsyncStorage`, comme les heures de sommeil), jamais envoyé au serveur ; une valeur absente vaut la source par défaut.
- **Par défaut** : Santé Connect s'il est disponible (aucun changement pour les utilisateurs actuels) ; sinon Huawei Health si HMS Core est présent ; sinon le podomètre du build AppGallery, ou rien.
- **Choisir Huawei Health** lance la connexion HUAWEI (scope `step.read`). Si elle échoue ou si l'utilisateur refuse, la source reste celle d'avant.
- **Revenir à Santé Connect** annule l'autorisation donnée à Step Challenge (voir « Annuler l'autorisation HUAWEI »).
- **Suggestion** : voir « Suggérer Huawei Health » (amendement du 2026-11-26).

### Suggérer Huawei Health (amendement du 2026-11-26)

La première version de cet ADR proposait Huawei Health dans l'écran Source des pas, quand Santé Connect n'avait aucun pas sur 30 jours. Personne n'ouvre cet écran sans raison : la testeuse Huawei n'aurait jamais vu la suggestion. Elle passe donc sur l'**Accueil**, comme l'invitation à ajouter des amis.

- **Quand** : l'application Huawei Health (`com.huawei.health`) est installée sur le téléphone, la source est encore Santé Connect, et l'utilisateur n'a pas refusé la suggestion. Quel que soit le nombre de pas dans Santé Connect : avec une montre Huawei, Santé Connect a souvent les pas du téléphone, qui ne sont pas les bons.
- **Qui la voit** : un nouvel utilisateur dès son premier passage sur l'Accueil, et un utilisateur existant à sa prochaine ouverture. Sans Huawei Health sur le téléphone, rien n'est affiché : la question n'aurait pas de sens.
- **La carte** : « Tu as une montre ou un bracelet Huawei ? Leurs pas ne passent pas par Santé Connect : Step Challenge peut les lire dans Huawei Health. » Deux boutons :
  - « Utiliser Huawei Health » ouvre Source des pas, où le changement se confirme comme d'habitude ; la carte reste tant que la source n'a pas changé ;
  - « Non merci » la masque pour de bon (`AsyncStorage`, sur le téléphone).
- **Détection** : `com.huawei.health` est déclaré dans les `<queries>` du manifeste (visibilité d'un paquet précis : aucune déclaration à faire chez Google, contrairement à `QUERY_ALL_PACKAGES`), et le module natif `step-sync` dit si le paquet est installé. Le résultat reste sur le téléphone, il n'est jamais envoyé.

### Annuler l'autorisation HUAWEI (amendement du 2026-11-26)

La bibliothèque n'a pas de `HmsHealthAccount.signOut`. Ce qui retire l'accès de Step Challenge est l'**annulation de l'autorisation** de Health Kit (`HmsConsentsController.cancelAuthorizationAll(false)` : tous les scopes accordés à l'application, sans supprimer de données, l'application n'en écrit aucune). Le [guide de vérification de Huawei](https://developer.huawei.com/consumer/en/doc/HMSCore-Guides/verification-0000001211587947) l'exige d'ailleurs ([annulation de l'autorisation](https://developer.huawei.com/consumer/en/doc/HMSCore-Guides/canceling-authorization-0000001192637063)).

- **Quand** : au retour à Santé Connect, après la confirmation. Le prochain choix de Huawei Health redemande le consentement.
- **Si elle échoue** (HMS Core absent, gelé, réseau) : la source change quand même ; un message dit que l'accès n'a pas pu être retiré et comment le faire dans Huawei Health. Une source qui ne change pas parce que Huawei ne répond pas serait pire.
- **Gel** : cet appel passe par le processus de Health Kit de HMS Core (`container1`), celui qui gèle (contexte), et non par celui de la connexion. Avec la lecture REST, ce processus n'a en principe pas servi depuis longtemps : il démarre pour l'appel. Délai maximal de 15 secondes. Vérifié sur le Pixel le 2026-11-26 : `container1` démarre pour l'appel, `cancelAuthorization` réussit en moins d'une seconde (1,7 s vu de l'application), et le choix suivant de Huawei Health redemande le consentement.

### L'écran

Une seule entrée **Paramètres → Pas → Source des pas** remplace « Sources de pas » et « Huawei Health ». Sa ligne affiche la source et les pas du jour (« Santé Connect · 8 412 aujourd'hui »).

Dans l'écran, deux choix exclusifs, chacun avec une phrase qui dit à qui il s'adresse :

- Santé Connect : « Garmin, Samsung, Fitbit, Xiaomi, Pixel… et le téléphone » ;
- Huawei Health : « Montres et bracelets Huawei (Santé Connect ne reçoit pas leurs pas) ».

Sous le choix, le détail de la source retenue :

- Santé Connect : le contenu actuel de « Sources de pas » (total retenu, pas par application, bouton vers les réglages de Santé Connect) ;
- Huawei Health : pas du jour, heure de la dernière lecture, et une aide : les pas passent par le cloud de Huawei, Huawei Health doit avoir synchronisé (et ses liens cloud être activés dans Moi → Gestion de la confidentialité) ; un écart de quelques minutes avec la montre est normal.

Changer de source demande une confirmation : « Les pas des 30 derniers jours seront relus dans Huawei Health. Un jour déjà envoyé avec plus de pas garde sa valeur. » Il n'y a pas de bouton « Se déconnecter » : revenir à Santé Connect annule l'autorisation HUAWEI.

### Ce qui ne fonctionne qu'avec Santé Connect

La courbe minute par minute de Statistiques → 1j, les périodes d'inactivité, les minutes actives et le score ([ADR 0010](0010-daily-activity-minutes.md)), l'explication du surplus et les sources par application. Avec Huawei Health, ces emplacements affichent une phrase (« Détail non disponible avec Huawei Health ») plutôt qu'une zone vide ou une erreur. Les jours envoyés par Huawei Health n'ont pas de minutes actives (`NULL`, déjà affiché comme une absence de donnée). Le détail minute par minute existe dans l'API REST (même route, regroupement par minute) : à évaluer plus tard, hors de cette décision.

Statistiques rappelle la source sous les graphiques (« Pas lus dans Huawei Health »).

### La lecture de Huawei Health

- **Jeton** : à chaque synchronisation, `HmsHealthAccount.signIn` avec le scope `step.read`, sans écran une fois le consentement donné ; il renvoie un jeton d'accès frais. Le jeton reste en mémoire, jamais stocké ni envoyé à notre serveur.
- **Requête** : `sampleSet:polymerize` sur `com.huawei.continuous.steps.delta`, regroupé par jour dans le fuseau du téléphone, de J-29 à aujourd'hui (une requête, sous la limite de 31 jours) ; réponse convertie en `DayStat[]`, comme pour Santé Connect.
- **Erreurs** : 401, nouvelle connexion puis un seul nouvel essai ; autre erreur ou réseau absent, synchronisation abandonnée sans message bloquant, les pas déjà envoyés restent affichés, l'écran Source des pas indique l'échec.
- **Le SDK** ne sert plus qu'à la connexion (`HmsHealthAccount`). `HmsDataController` et les appels à `container1` disparaissent, et avec eux le gel.

### La synchronisation

- **Abstraction** : `stepSync.ts` lit les 30 jours via la source choisie (une fonction par source, même type `DayStat[]`). L'envoi au serveur ne change pas.
- **Arrière-plan** : le travailleur Kotlin ne lit que Santé Connect. Il reçoit la source choisie, comme le jeton de session (`configureNativeSync`), et **ne fait rien** quand la source n'est pas Santé Connect. Sinon, il mélangerait les deux sources : sur le Pixel de l'essai, il enverrait les pas du téléphone vus par Santé Connect. Avec Huawei Health, la synchronisation se fait à l'ouverture et à l'actualisation des écrans ; l'écran Synchronisation le dit.

### Évolution prévue : l'arrière-plan avec Huawei Health

Comme Health Sync : le travailleur Kotlin obtient un jeton par la connexion HUAWEI silencieuse (SDK Account natif, par `hwid.core`), appelle l'API REST et envoie les pas, sans aucun jeton HUAWEI sur notre serveur. À faire dans une seconde étape, après avoir vérifié que la connexion silencieuse fonctionne sans écran, application fermée. L'option 3 n'est donc pas retenue.

### Plan de secours

Si l'API REST devenait inaccessible (refus de Huawei à la vérification, par exemple) : option 1, le SDK avec la parade au gel, décrite dans le contexte.

### Le serveur

**Aucun changement d'API.** La règle du maximum par jour reste : un changement de source ne fait jamais baisser un jour déjà envoyé. C'est acceptable parce que les deux sources mesurent les pas de la même personne, et que changer de source reste rare. Une source qui compte moins (le téléphone seul, après une montre) ne prend le dessus que sur les jours suivants.

### Relire les 30 derniers jours, à la baisse (amendement du 2026-11-27)

**Constat** (une testeuse, 2026-11-27) : Mi Fitness, seule source de ses pas, écrit certains jours plusieurs fois les mêmes pas dans Santé Connect (environ trois fois le vrai total). Santé Connect départage deux applications, mais additionne les enregistrements d'une même application. Une fois Santé Connect corrigé, la règle du maximum garde les jours gonflés pour toujours, dans les classements des amis aussi.

**Pourquoi la règle du maximum reste la règle** : une synchronisation automatique à la baisse effacerait l'historique dans des cas fréquents :

- un nouveau téléphone, dont Santé Connect est vide ou presque : 30 jours ramenés à 0 ;
- deux appareils sur le même compte (un ancien téléphone resté connecté, dont le travailleur Kotlin synchronise encore) : le dernier envoi gagne ;
- un changement de source sans historique (HUAWEI Health sans le scope d'historique) : 0 sur les jours passés ;
- une lecture partielle : application source qui réécrit ses données, cloud HUAWEI en retard ;
- les versions déjà installées et le travailleur Kotlin, si le changement était côté serveur seulement.

**Décision** : une action volontaire, Plus → Source des pas → **Relire mes 30 derniers jours** :

- l'application lit les 30 jours dans la source choisie et les compare aux jours du serveur (`GET /api/me/steps`) ;
- elle affiche les jours qui changeraient (« 12 nov. : 50 214 → 16 380 »), et ne remplace qu'après confirmation ;
- elle envoie les totaux avec `mode: 'replace'` dans `POST /api/me/steps` (champ facultatif ; absent, `'max'`, la règle habituelle). Le serveur remplace alors un jour par un total différent, **sauf par 0** : un jour vide dans la source garde sa valeur, ce qui protège d'une source vide ou en retard ;
- les minutes d'activité ne sont pas renvoyées : celles déjà enregistrées restent (elles suivent le total, ADR 0010) ;
- les badges déjà gagnés restent (figés à l'obtention, [spécification des badges](../reference/badges.md)) ;
- une ancienne API ignore `mode` (champ inconnu retiré, ADR 0012) : rien ne baisse, l'application le dit par le nombre de jours corrigés.

Aucun risque de triche nouveau : un client peut déjà envoyer n'importe quel total plus grand.

### Confidentialité

- **Chemin des données** : cloud de Huawei → téléphone → notre serveur, comme les pas de Santé Connect passent du téléphone au serveur. Le jeton HUAWEI reste sur le téléphone.
- **Politique de confidentialité** : ajouter Huawei Health comme origine possible des pas (même donnée, même usage), lue dans le cloud de Huawei avec l'accord de l'utilisateur.
- **Huawei** : la demande de **vérification** (fin de la limite de 100 utilisateurs) se fait après les tests, avec cette version publiée sur AppGallery ; y dire que la lecture passe par l'API REST. Exigences de Huawei et état : [Vérification Huawei Health Kit](../reference/huawei-verification.md).
- **Google Play** : le build Play contient déjà le SDK Huawei Health (depuis la 1.8.2). Rien ne change dans le formulaire Data safety : les données et leur usage sont les mêmes.

## Conséquences

- ✅ L'utilisateur sait d'où viennent ses pas, et ceux qui utilisent Santé Connect ne voient rien changer.
- ✅ Les montres Huawei deviennent utilisables, avec 30 jours d'historique dès la connexion.
- ✅ Pas de gel de HMS Core, pas de module natif pour la lecture, pas de jeton sur le serveur.
- ✅ Pas de nouvelle route ni de migration.
- ⚠️ Les pas Huawei arrivent avec le délai de la synchronisation de Huawei Health vers le cloud.
- ⚠️ Avec Huawei Health : pas de synchronisation en arrière-plan dans un premier temps, ni de détail minute par minute.
- ⚠️ Un retour vers une source qui compte moins ne corrige pas les jours déjà envoyés.

## Points ouverts

1. **Délai du cloud** : mesurer l'écart entre la montre, l'application Huawei Health et l'API REST sur une journée normale, et sur le téléphone Samsung de la testeuse.
2. **Connexion silencieuse** : vérifier qu'elle renvoie un jeton frais après plusieurs heures et plusieurs jours, sans écran.
3. **Limite d'historique de l'API REST** (environ 60 jours constatés, pour 1 mois demandé) : à comprendre avant de s'y fier ; l'application s'en tient à 30 jours.
4. **Mémoriser la source de chaque jour** sur le serveur (support, diagnostic). Non retenu pour l'instant : demanderait une migration et un champ d'API.
5. **Historique à la première connexion** (2026-11-25) — **réglé le 2026-11-26** (1.17.0, confirmé chez la testeuse le jour même : 30 jours lus) : sans le scope `https://www.huawei.com/healthkit/historydata.open.month`, Huawei ne sert que les données postérieures à l'autorisation ([Reading Historical Data](https://developer.huawei.com/consumer/en/doc/development/HMSCore-Guides/historydata-open-0000001209921350)). Il était demandé sur HUAWEI Developers (« Reading historical data / 1 month ») mais pas à la connexion : la connexion le demande désormais, case facultative pour l'utilisateur. Constat d'origine : chez la testeuse, l'API n'a renvoyé que le jour même, alors que le Pixel en reçoit 30. Huawei ne donne peut-être que les données postérieures à l'autorisation de l'utilisateur, ou la synchronisation cloud venait d'être activée ; à trancher avec le diagnostic des jours suivants. Si c'est la règle de Huawei, revoir la phrase de confirmation (« les 30 derniers jours seront relus ») et la conséquence « 30 jours d'historique dès la connexion ».
6. **Détail dans la journée** (2026-11-25) : le regroupement par durée (`groupByTime.duration`) donne des pas heure par heure avec une montre Huawei, rien avec le podomètre d'un téléphone non Huawei (section 16 de l'intégration Huawei). **Décidé le 2026-11-26** (1.16.0) : Statistiques → 1j lit les pas heure par heure du jour affiché par l'API REST, et trace la courbe quand au moins une heure a des pas ; sinon, un message dit que l'appareil n'envoie que le total du jour. Ce détail reste sur le téléphone (seul le total du jour va au serveur). L'inactivité et le score demandent la minute, toujours non vérifiée : décision à part.
7. **HMS Core** : gardé pour la connexion, comme Health Sync l'exige. Une connexion OAuth web sans HMS Core est possible, mais l'échange du code demande un secret client, donc notre serveur (sauf si Huawei accepte PKCE, non vérifié) : à reconsidérer seulement si l'installation de HMS Core rebute des utilisateurs. **Repris le 2026-11-26** : le gel de HMS Core touche aussi la connexion et le retrait (contourné dans la 1.16.0), et Huawei documente une variante PKCE ; ce qu'on sait est dans l'intégration Huawei, section 16 (« Connexion par OAuth Web »). Proposé dans l'[ADR 0016](0016-huawei-health-through-the-server.md) : autorisation par notre serveur, sans SDK HMS (l'option 3 ci-dessus).

## Hors de cette décision

- Additionner ou fusionner plusieurs sources.
- Écrire des pas dans Santé Connect ou dans Huawei Health (pont entre les deux, écarté le 2026-10-04).
- Le détail minute par minute de Huawei Health.

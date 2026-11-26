# ADR 0015 — Un lien d'invitation qui traverse l'installation

- **Statut** : Proposé
- **Date** : 2026-11-26
- **Décideur** : mauvaisetroupe
- **Lié à** : [ADR 0002 — Amis](0002-friends.md) (liens d'invitation), [ADR 0014 — Site public sur `sport.architech.lu`](0014-public-site-on-sport-architech.md) (page des invitations)

## Contexte

Un lien d'invitation (`https://sport.architech.lu/step-challenge/i/<code>`) ouvre directement l'application quand elle est installée (App Links). Sinon, il ouvre la page web des invitations, qui demande :

1. d'installer l'application depuis Google Play ;
2. de **rouvrir le lien**, ou de saisir le code dans Classement → Amis → J'ai un code.

L'étape 2 n'est pas intuitive : après l'installation, l'invité ouvre l'application depuis le Play Store, se connecte, et ne voit aucune invitation. Il doit penser à revenir au message pour rouvrir le lien, ou recopier un code. Une partie des invitations se perd là, et l'invitant ne le sait pas.

Le message partagé ne l'explique pas non plus : « Ouvre ce lien (valable 7 jours) ».

### Ce que Google Play permet

Un lien vers la fiche du Play Store peut porter un paramètre `referrer` : `https://play.google.com/store/apps/details?id=lu.architech.stepchallenge&referrer=invite%3DK7F3M9QX`. Après l'installation, l'application le lit par la [Play Install Referrer API](https://developer.android.com/google/play/installreferrer/library), que `expo-application` expose : `getInstallReferrerAsync()` (Android) rend la chaîne brute (`invite=K7F3M9QX`). Google Play la garde 90 jours, et elle ne change pas tant que l'application n'est pas réinstallée.

C'est le « lien différé » des services comme Branch ou Firebase Dynamic Links, sans service tiers.

## Options étudiées

### Option A — Deux liens dans le message

« 1. Installe l'appli : <lien Play Store>. 2. Puis ouvre ce lien : <lien d'invitation> ».

- ✅ Rien à développer.
- ❌ Un message plus long, deux liens, et toujours un retour au message après l'installation.

### Option B — Le code transmis par Google Play à l'installation

La page web met le code dans le `referrer` du lien vers Google Play ; au premier lancement, l'application le lit et ouvre l'invitation.

- ✅ Un seul lien, aucun retour au message : installer, ouvrir, se connecter, accepter.
- ✅ Aucun service tiers, aucun changement d'API.
- ❌ Seulement depuis Google Play : AppGallery n'a pas ce mécanisme.
- ❌ Le code passe par Google Play (voir « Confidentialité »).

### Option C — Un service de liens différés (Branch, AppsFlyer…)

- ❌ Un service tiers qui verrait chaque invitation, et un SDK de suivi dans une application de santé.

## Décision

**Option B**, avec le code toujours affiché sur la page en secours.

### Page des invitations (`architech-sport`)

- Le bouton Google Play et le secours du bouton « Ouvrir dans l'application » (`browser_fallback_url`) mènent à la fiche avec `referrer=invite%3D<code>` (code normalisé, sans tiret).
- Les étapes deviennent : 1. installer Step Challenge ; 2. l'ouvrir et se connecter : l'invitation s'affiche. Le code et « J'ai un code » restent, présentés comme le recours si l'invitation ne s'affiche pas (AppGallery, installation faite sans passer par ce lien).

### Application

- **Au premier lancement**, une seule fois (marqueur dans `AsyncStorage`), l'écran d'entrée lit le `referrer`. S'il contient `invite=<code>` et que le code a la forme d'un code d'invitation, il ouvre `/i/<code>`, qui demande d'abord la connexion puis revient à l'invitation (comportement existant).
- Lecture faite **une fois** : Google Play le recommande, et une invitation déjà traitée ne doit pas réapparaître. Une erreur (Play Store absent, AppGallery, émulateur) vaut « pas d'invitation » et ne bloque jamais le démarrage.
- Un `referrer` sans invitation (installation ordinaire : `utm_source=google-play&utm_medium=organic`) ne change rien.
- Les versions installées avant ne sont pas concernées : le `referrer` ne sert qu'à l'installation.

### Message partagé

Une phrase qui dit ce qui va se passer : « Rejoins-moi sur Step Challenge pour comparer nos pas ! Ouvre ce lien : il installe l'appli si besoin, puis nous rend amis (valable 7 jours). »

### Confidentialité

- Le code d'invitation passe par Google Play, qui le rend à l'application. Aujourd'hui, la page des invitations est faite pour que le code ne fuie vers personne (aucune ressource externe, `no-referrer`). Ce n'est plus vrai pour Google Play, et seulement quand l'invité choisit d'installer l'application.
- Le risque reste faible : le code expire en 7 jours, n'est lié à aucune donnée de santé, et l'accepter demande un compte, une connexion et une confirmation ; l'invitant peut le désactiver.
- Le `referrer` n'est jamais envoyé à notre serveur en dehors du code lui-même, qui suit le chemin habituel d'une invitation.
- À indiquer dans `exposure.md` ; la politique de confidentialité n'a pas à changer (aucune donnée nouvelle collectée).

## Conséquences

- ✅ Un seul lien pour un invité sans l'application : installer, ouvrir, se connecter, accepter.
- ✅ Un message qui explique le parcours.
- ✅ Pas de service tiers, pas de changement d'API.
- ⚠️ Une nouvelle dépendance, `expo-application`, donc une nouvelle version de l'application. La page se publie **après** cette version : elle annonce que l'invitation s'affiche après l'installation, ce que les versions précédentes ne font pas.
- ⚠️ AppGallery et les installations hors de ce lien gardent le code à saisir.

## Points ouverts

1. **Test fermé** : vérifier que le `referrer` est transmis quand l'application est installée depuis la piste de test fermé (le Pixel : désinstaller, ouvrir un lien d'invitation, installer depuis la page, ouvrir).
2. **AppGallery** : Huawei propose un équivalent (référent d'installation d'AppGallery) ; à regarder si des invités passent par AppGallery.

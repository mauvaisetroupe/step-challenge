# ADR 0007 — Internationalisation de l'application

- **Statut** : Accepté
- **Date** : 2026-10-06
- **Décideur** : mauvaisetroupe

## Contexte

L'application est entièrement en français : environ 150 textes écrits en dur dans une trentaine de fichiers, et `'fr-FR'` en dur pour formater les nombres et les dates. Le site public est déjà bilingue (ADR 0005), avec l'anglais à la racine. L'objectif d'une application publique demande au moins l'anglais, et d'autres langues ensuite.

Le backend ne renvoie que des codes d'erreur (`invalid_demo_code`…), jamais de phrases, et n'envoie ni e-mail ni notification : la traduction ne concerne que l'application.

### Critères de décision

- Ajouter une langue ne demande aucune modification des écrans : un fichier de traductions et une ligne dans la liste des langues.
- Pluriels et numéros d'ordre justes dans chaque langue (« 1 jour / 4 jours », « 1ᵉʳ / 3ᵉ », « 1st / 3rd »).
- Une clé absente ou mal écrite est détectée avant la publication, pas par un utilisateur.
- Nombres et dates au format de la langue choisie.
- Aucune donnée nouvelle côté serveur.

## Options étudiées

### Bibliothèque

- **i18n-js** (proposée par la documentation Expo) : simple, mais pluriels limités (règles à écrire soi-même au-delà de one/other), pas de mise en forme dans une phrase traduite.
- **i18next + react-i18next** ✅ : standard de fait, pluriels et numéros d'ordre selon les règles CLDR (via `Intl.PluralRules`), interpolation, typage des clés en TypeScript, rechargement des écrans au changement de langue.
- **Lingui / FormatJS** : messages ICU, extraction automatique ; plus lourd (macro Babel ou compilation des messages) pour une application de cette taille.

### Choix de la langue

- **Suivre le téléphone sans réglage** : simple, mais impossible d'utiliser l'application en anglais sur un téléphone en français (ou l'inverse).
- **Réglage dans l'application, « Système » par défaut** ✅ : même modèle que l'apparence (Paramètres → Apparence) ; le choix est gardé sur le téléphone.
- **Langue enregistrée sur le serveur** : utile seulement si le serveur envoyait des textes (notifications, e-mails), ce qui n'est pas le cas. À reconsidérer le jour où il en enverra.

## Décision

1. **i18next + react-i18next**, langue détectée par **expo-localization**.
2. **Langues** : français et anglais. **Langue de repli : l'anglais**, pour toute langue du téléphone non prise en charge (un téléphone en espagnol affiche l'anglais).
3. **Réglage** : Paramètres → Langue : Système, Français, English. Chaque langue est écrite dans sa propre langue. Le choix est gardé sur le téléphone (AsyncStorage), comme l'apparence. « Système » suit aussi la langue choisie pour l'application dans les réglages d'Android 13 et plus (`supportedLocales` du plugin expo-localization).
4. **Traductions** : un fichier JSON par langue (`apps/mobile/src/i18n/locales/<langue>.json`), clés regroupées par écran (`home.weekRank.toPass`). Le fichier anglais sert de référence pour le typage des clés en TypeScript : une clé inconnue fait échouer le typecheck.
5. **Contrôle des fichiers** : un script (`npm run check:i18n`, lancé par la CI) vérifie que chaque langue a les mêmes clés que l'anglais, les formes de pluriel que demandent ses règles (par exemple `_one`, `_many`, `_other` en français) et les mêmes variables (`{{name}}`).
6. **Pluriels et numéros d'ordre** par i18next (`count`, `ordinal`). Hermes, le moteur JavaScript de l'application, ne fournit pas toujours `Intl.PluralRules` : le polyfill `intl-pluralrules` le complète si besoin.
7. **Mise en forme dans une phrase** (mots en gras) : balises `<b>…</b>` dans la traduction, rendues par un composant de l'application. Les valeurs (prénoms) sont insérées après l'analyse des balises : un prénom qui contient `<b>` reste du texte.
8. **Nombres et dates** : formatés par `Intl` avec la langue choisie, et la région du téléphone quand elle correspond à cette langue (`en-GB`, `fr-BE`…).

### Ce qui ne se traduit pas

- Les noms et surnoms des utilisateurs, et les prénoms des amis fictifs du compte de démonstration (ADR 0006).
- Les journaux techniques (`console.*`) et les codes d'erreur du serveur, qui restent en anglais.
- Les écrans de diagnostic montrent des détails techniques (noms d'API, codes) : seuls les libellés sont traduits.

### Conséquences

- Chaque nouveau texte passe par une clé, dans toutes les langues. Le script de contrôle le rappelle.
- Le message joint à une invitation est dans la langue de celui qui invite ; la page `/i/<code>` du site est bilingue.
- Un nouveau build natif est nécessaire (module expo-localization, déclaration des langues pour Android 13).
- La fiche du Store se traduit à part, dans la Play Console.

## Points ouverts

- Traduction de la fiche Play Store et des captures d'écran en anglais.
- Choix des langues suivantes (allemand et luxembourgeois pour le Luxembourg ?).

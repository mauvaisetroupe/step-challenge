# ADR 0003 — Open source et licence

- **Statut** : Accepté
- **Date** : 2026-10-04
- **Décideur** : mauvaisetroupe

## Contexte

Step Challenge est publié sur GitHub (`mauvaisetroupe/step-challenge`, dépôt public) sous licence MIT. Le projet vise une application gratuite, sans publicité, financée par des pourboires facultatifs, et se différencie par :

- le support de Huawei Health ;
- la **transparence** : code public, données minimales (ADR 0001 : pas d'e-mail ; ADR 0002 : pas d'annuaire, partage uniquement entre amis).

Il faut décider si l'ouverture du code devient un engagement assumé, sous quelle licence, et avec quelles règles. Le moment est favorable : il n'y a aujourd'hui **aucun contributeur externe**, le changement de licence ne nécessite l'accord de personne.

### Audit de l'historique (2026-10-04)

L'historique git (84 commits) a été audité avant cette décision : aucun secret n'y figure (clé API, mot de passe de base de données, keystore de release, `agconnect-services.json`, `.env`). On n'y trouve que des adresses IP privées et des données de test personnelles de l'auteur, sans gravité. **L'historique n'est pas réécrit.**

### Contraintes

- L'application dépend de **SDK propriétaires** : Huawei HMS Health (facteur différenciant) et Google Play services (connexion Google, ADR 0001).
- Distribution via le Google Play Store.
- Le backend est un service réseau : les utilisateurs l'utilisent sans en recevoir le code.

### Critères de décision

- Empêcher qu'un tiers reprenne le projet pour en faire une version fermée (publicité, revente de données) — cohérence avec l'argument de transparence.
- Rester compatible avec le Play Store et avec les SDK propriétaires indispensables.
- Ne pas décourager les contributions.
- Garder un discours exact sur ce qui est libre et ce qui ne l'est pas.

## Options étudiées

### Option A — MIT (situation actuelle)

- ✅ Maximum de liberté, aucune friction pour les contributeurs ou la réutilisation.
- ❌ Permet une reprise fermée : un tiers peut publier une version modifiée avec publicités et collecte de données, sans publier ses modifications.

### Option B — Apache-2.0

- ✅ Comme MIT, avec une clause explicite sur les brevets.
- ❌ Même faiblesse que MIT face à une reprise fermée.

### Option C — GPL-3.0

- ✅ Toute version modifiée **distribuée** (APK) doit publier son code.
- ❌ Ne couvre pas le backend : un tiers peut faire tourner un serveur modifié sans rien publier, car un service réseau n'est pas « distribué ».

### Option D — AGPL-3.0

- ✅ Comme la GPL, et en plus : quiconque fait tourner une version modifiée **en tant que service réseau** doit en publier le code. Couvre le backend.
- ✅ Choix éprouvé pour des services qui revendiquent la transparence (Mastodon, Nextcloud, serveur Signal).
- ❌ Peut décourager certains contributeurs ou réutilisateurs commerciaux — ce qui est ici un effet recherché plutôt qu'un défaut.
- ❌ Lier du code (A)GPL à des SDK propriétaires pose question pour les redistributeurs : il faut une **permission additionnelle** explicite.

## Décision

**Option D : tout le dépôt passe sous AGPL-3.0-or-later**, avec une **permission additionnelle** (section 7 de la licence) autorisant la liaison avec les SDK propriétaires des plateformes mobiles.

### Permission additionnelle

Texte placé dans le fichier `NOTICE`, avec l'avis de copyright ; `LICENSE` contient le texte officiel de l'AGPL sans modification, pour que GitHub et les outils d'analyse de licences la reconnaissent (à faire relire, ce n'est pas un avis juridique) :

> Additional permission under GNU AGPL version 3 section 7: if you modify this Program, or any covered work, by linking or combining it with Google Play services, Huawei Mobile Services (HMS) libraries, or other proprietary platform SDKs required to access health data or authentication on Android, the licensors of this Program grant you additional permission to convey the resulting work.

Elle permet à quiconque de compiler et distribuer l'application avec ces SDK, sans affaiblir l'obligation de publier le code de Step Challenge lui-même.

### Effet du changement de licence

Les versions déjà publiées sous MIT **restent disponibles sous MIT** : on ne peut pas retirer une licence accordée. L'AGPL s'applique à partir du commit qui change la licence. C'est acceptable vu la maturité du projet : l'essentiel du code (authentification, amis, Huawei) reste à écrire.

## Règles associées

### Contributions

- **DCO** (Developer Certificate of Origin) : chaque commit externe porte un `Signed-off-by`. Pas de CLA.
- Conséquence assumée : un futur changement de licence nécessitera l'accord des contributeurs.

### Marque

La licence couvre le code, **pas le nom ni le logo**. Un fichier `TRADEMARKS.md` précise que « Step Challenge » et son icône ne peuvent pas être utilisés par une version dérivée publiée sur un store, afin d'éviter qu'un fork soit confondu avec l'application officielle.

### Secrets et configuration

- Aucun secret dans le dépôt : configuration par variables d'environnement (backend) et environnements EAS (mobile).
- Les identifiants publics par nature (client ID OAuth Google, App ID Huawei) peuvent figurer dans le code.
- `agconnect-services.json` reste hors du dépôt (il contient des clés) ; un modèle `agconnect-services.example.json` est fourni.
- **gitleaks** est exécuté en CI (GitHub Actions) et recommandé en hook pre-commit.

### Transparence

- Les ADR sont publics dans `docs/adr/`.
- Une page « Vos données » liste ce qui est collecté, où (hébergement UE) et pourquoi, avec des liens vers le code concerné.
- Aucun SDK de publicité, d'analytics ou de tracking.
- `SECURITY.md` : procédure de signalement privé des vulnérabilités (GitHub Security Advisories).

### Discours public

- Dire : « **code source ouvert (AGPL), données minimales, hébergé dans l'UE** ».
- Ne pas dire « 100 % libre » : l'application dépend de SDK propriétaires et n'est pas éligible à F-Droid. Une variante sans SDK propriétaires est hors périmètre.

### Auto-hébergement

Le backend reste auto-hébergeable (variables d'environnement documentées dans le README). Une version dérivée de l'application doit utiliser son propre serveur et ses propres identifiants OAuth.

## Conséquences

### Positives

- Une reprise fermée de l'application ou du serveur est juridiquement exclue.
- L'argument de transparence est vérifiable : code, décisions et traitements de données sont publics.
- Les SDK propriétaires indispensables restent utilisables.

### Négatives

- Certains contributeurs ou réutilisateurs évitent l'AGPL.
- La permission additionnelle et `TRADEMARKS.md` sont des textes juridiques rédigés sans juriste.
- Le changement de licence est sans effet sur les versions MIT déjà publiées.

## Mise en œuvre

1. Remplacer `LICENSE` par le texte officiel de l'AGPL-3.0 ; ajouter `NOTICE` (copyright, permission additionnelle, renvoi vers la marque).
2. Aligner les champs `license` des `package.json` sur `AGPL-3.0-or-later` (le backend déclare actuellement `ISC`, l'application rien).
3. Mettre à jour la section « Licence » du README.
4. Ajouter `SECURITY.md`, `CONTRIBUTING.md` (DCO) et `TRADEMARKS.md`.
5. Ajouter `agconnect-services.example.json`.
6. Ajouter une CI GitHub Actions : gitleaks, typecheck backend et mobile.

## Points ouverts

- **Relecture juridique** de la permission additionnelle et de `TRADEMARKS.md`, si le projet prend de l'ampleur.
- **Assets hérités du modèle Expo** (`apps/mobile/assets`) : vérifier leur provenance et remplacer ceux qui ne sont pas les nôtres.

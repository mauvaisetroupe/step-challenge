# ADR 0014 — Tout le site public de Step Challenge passe sur `sport.architech.lu`

- **Statut** : Accepté
- **Date** : 2026-11-25
- **Décideur** : mauvaisetroupe
- **Lié à** : [ADR 0005 — Site public et séparation des domaines](0005-public-site-and-domains.md) (remplacé en partie), ADR 0001 du dépôt [`architech-sport`](https://github.com/mauvaisetroupe/architech-sport) (site commun des applications de sport), [ADR 0002 — Amis](0002-friends.md) (liens d'invitation, App Links), [ADR 0013 — Source des pas](0013-step-source-choice.md) (politique de confidentialité à mettre à jour)

## Contexte

Le site public de Step Challenge (`site/`, Hugo) est publié sous `step.architech.lu` (ADR 0005) : présentation, aide, FAQ, pages légales, page des invitations (`/i/<code>`) et fichier des App Links (`/.well-known/assetlinks.json`).

Depuis le 2026-10-22, le site commun `sport.architech.lu` (dépôt `architech-sport`, son ADR 0001) publie aussi tout ce contenu sous `/step-challenge/`. Cet ADR laissait `step.architech.lu` en place et renvoyait la bascule à un ADR distinct, « une fois l'examen Huawei terminé ». C'est fait : l'application est sur AppGallery (1.9.1) et Health Kit a accordé sa permission de test (2026-11-24).

Depuis, **le contenu existe en deux exemplaires**, à modifier dans les deux dépôts. Il faut maintenant mettre à jour la politique de confidentialité (Huawei Health lu dans le cloud de Huawei, ADR 0013 ; niveau et badges visibles par les amis) : c'est le moment de n'en garder qu'un. Les URL de la politique et de la suppression de compte sur `sport.architech.lu` sont **déjà déclarées dans la Play Console** (2026-11-25).

L'application est en test fermé, avec peu d'utilisateurs : une nouvelle version et une nouvelle vérification des App Links coûtent peu aujourd'hui, beaucoup plus une fois l'application publique.

### Ce qui pointe vers `step.architech.lu`

| Référence | Où | Changer demande |
|---|---|---|
| App Links `https://step.architech.lu/i/…` | manifeste de l'application (`app.json`, `intentFilters`) | une nouvelle version, et une nouvelle vérification d'Android |
| Liens d'invitation | construits par le backend avec `PUBLIC_BASE_URL` (`backend/src/config.ts`, `step.architech.lu` par défaut) | une nouvelle version de l'API |
| `assetlinks.json` | servi par `step.architech.lu` | — |
| Pages légales ouvertes depuis l'application | `constants/links.ts` (`PUBLIC_SITE_URL`), Paramètres → Mentions légales | une nouvelle version ; les versions installées gardent l'ancienne adresse |
| URL de la politique, de la suppression de compte | Play Console (fait), écran de consentement OAuth de Google, AppGallery Connect (fiche, Health Kit) | une modification dans chaque console, faite par le mainteneur |
| Liens dans la doc du dépôt | `docs/`, `README.md` | un commit |

## Options étudiées

### Option A — `step.architech.lu` réduit aux invitations, publié depuis ce dépôt

`site/` ne garde que `i/index.html`, `assetlinks.json` et un `.htaccess` (invitations, redirections des anciennes pages). Le contenu passe sur `sport.architech.lu`.

- ✅ Aucune nouvelle version pour les invitations.
- ❌ Deux noms à garder, et un reste de site dans ce dépôt, avec son déploiement.

### Option B — Le reste de `step.architech.lu` déplacé dans `architech-sport`

- ✅ Plus aucun site dans ce dépôt.
- ❌ Deux noms à garder, deux déploiements dans le dépôt commun.

### Option C — Tout sur `sport.architech.lu`, invitations comprises

Les invitations deviennent `https://sport.architech.lu/step-challenge/i/<code>` ; `step.architech.lu` n'est plus qu'une redirection.

- ✅ Un seul nom, un seul site, un seul déploiement ; plus de site dans ce dépôt.
- ✅ Le bon moment : peu d'utilisateurs, et les liens d'invitation expirent.
- ❌ Une nouvelle version de l'application et une nouvelle vérification des App Links.
- ❌ Les versions installées avant la bascule ne s'ouvrent plus depuis un lien : il passe par la page web (voir plus bas).
- ❌ `assetlinks.json` devient commun au domaine, donc à toutes ses applications.

## Décision

**Option C.**

### Invitations sur `sport.architech.lu`

- **Adresse** : `https://sport.architech.lu/step-challenge/i/<code>`, dans la section de l'application, comme ses autres pages.
- **Backend** : la valeur par défaut de `PUBLIC_BASE_URL` devient `https://sport.architech.lu/step-challenge` ; les liens sont construits en ajoutant `/i/<code>`. Cette adresse dépend de l'application (ses App Links), pas de l'hébergement : elle est fixée par ce dépôt, et l'exploitant ne définit pas la variable, qui ne sert qu'à la surcharger en développement.
- **Application** :
  - App Link déclaré pour l'hôte `sport.architech.lu`, `pathPrefix` `/step-challenge/i/` (`app.json`), à la place de `step.architech.lu`.
  - Expo Router suit le chemin de l'URL : `/step-challenge/i/<code>` ne mène pas à l'écran `/i/[code]`. Un fichier `src/app/+native-intent.tsx` (`redirectSystemPath`) retire le préfixe `/step-challenge` avant la navigation ; à vérifier dans la doc d'Expo SDK 57 avant de l'écrire.
  - Les pages légales s'ouvrent sur `sport.architech.lu` (`constants/links.ts`). La langue précède la section : `https://sport.architech.lu/step-challenge/privacy.html`, `https://sport.architech.lu/fr/step-challenge/privacy.html` (vérifié le 2026-11-25).
- **Site `architech-sport`** :
  - `static/.well-known/assetlinks.json` : même contenu que celui de `step.architech.lu` (package et empreintes Google Play et d'importation, voir [Signature Android](../reference/android-signing.md)). Un seul fichier pour le domaine : une autre application s'y ajoutera comme une entrée de plus. Servi en `application/json`, sans redirection ;
  - `static/step-challenge/i/index.html` : la page actuelle des invitations, avec ses liens adaptés ;
  - `static/.htaccess` : la règle des invitations (`^step-challenge/i/[^/]+/?$`, avec la condition `!-f` de l'ADR 0005) et le type de `assetlinks.json`. Le déploiement doit envoyer les fichiers cachés (`.htaccess`, `.well-known/`).

### `step.architech.lu`

Une **redirection 301 de tout le nom**, par une règle Cloudflare, chaque adresse vers son équivalent :

| Ancienne adresse | Nouvelle adresse |
|---|---|
| `/` | `https://sport.architech.lu/step-challenge/` |
| `/<page>.html`, `/help/…` | `https://sport.architech.lu/step-challenge/<page>.html`, `…/step-challenge/help/…` |
| `/fr/…` | `https://sport.architech.lu/fr/step-challenge/…` |
| `/i/<code>` | `https://sport.architech.lu/step-challenge/i/<code>` |

Le dossier OVH `step` peut ensuite être supprimé. `assetlinks.json` n'est plus servi sur ce nom : les versions installées avant la bascule perdent leur vérification. Un lien d'invitation ouvre alors la page web, dont le bouton « Ouvrir dans l'application » fonctionne toujours ; le code se saisit aussi à la main dans Amis.

### Ordre de la bascule

1. **`architech-sport`** : politique de confidentialité mise à jour (la Play Console pointe déjà dessus), `assetlinks.json`, page et règle des invitations ; publié. Vérifier `assetlinks.json` (type, absence de redirection) et une adresse `/step-challenge/i/…`.
2. **Application** (prochaine version) : App Link sur `sport.architech.lu`, `+native-intent.tsx`, pages légales sur `sport`. Testée sur le Pixel (`adb shell pm get-app-links lu.architech.stepchallenge`, lien d'invitation ouvert depuis un message), puis envoyée.
3. **API** : publier et déployer la version qui change la valeur par défaut, une fois la version de l'application publiée. Avant, les nouveaux liens ne s'ouvriraient dans aucune application installée.
4. **Consoles** (le mainteneur) : écran de consentement OAuth de Google et AppGallery Connect (la Play Console est faite). Chez Huawei, une modification des informations de l'application passe peut-être par un nouvel examen.
5. **`step.architech.lu`** : redirection Cloudflare, puis suppression du dossier OVH `step`.
6. **Ce dépôt** : suppression de `site/` et de `.github/workflows/deploy-site.yml` ; doc mise à jour (`update-the-public-site.md` renvoie à `architech-sport`, `exposure.md`, `ci.md`, `STATUS.md`, `README.md`) ; ADR 0005 marqué « remplacé en partie par l'ADR 0014 ».

## Conséquences

- ✅ Un seul exemplaire du contenu, une seule politique à tenir, un seul nom.
- ✅ Plus de site ni de déploiement de site dans ce dépôt.
- ✅ Les anciennes adresses, déclarées ou partagées, continuent de mener à la bonne page.
- ⚠️ Une modification du contenu de Step Challenge se fait dans un autre dépôt.
- ⚠️ Les versions installées avant la bascule n'ouvrent plus les liens d'invitation directement.
- ⚠️ `assetlinks.json` est commun aux applications du domaine : une erreur dans ce fichier toucherait toutes leurs App Links.

## Points ouverts

1. **Vérificateur d'AppGallery Connect** : il n'atteint ni `step.architech.lu` ni `sport.architech.lu` (avertissement « fails to access the URL », 2026-11-25). Cloudflare bloque probablement son robot (un User-Agent `Java/1.8.0` reçoit un 403 sur les deux noms). Sans lien avec la bascule ; à diagnostiquer dans les événements de sécurité de Cloudflare, et à corriger par une exception ciblée.
2. **AppGallery** : changer l'URL de la politique déclenche-t-il un nouvel examen de l'application ?
3. **Fiches des magasins** : leurs descriptions renvoient peut-être à l'aide (`/help/huawei.html`) ; couvert par la redirection, à mettre à jour au passage.

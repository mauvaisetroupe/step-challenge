# Mettre à jour le site public

Le site public de Step Challenge (présentation, aide, FAQ, pages légales, page des invitations, `assetlinks.json`) n'est plus dans ce dépôt. Il est publié sur `https://sport.architech.lu` par le dépôt [`architech-sport`](https://github.com/mauvaisetroupe/architech-sport), site commun des applications de sport ([ADR 0014](../adr/0014-public-site-on-sport-architech.md)). Son `README.md` explique comment lancer le site en local, ajouter une page et publier.

## Où sont les fichiers de Step Challenge

| Contenu | Dans `architech-sport` | Adresse |
|---|---|---|
| Présentation, FAQ, pages légales | `content/step-challenge/` | `https://sport.architech.lu/step-challenge/…`, `https://sport.architech.lu/fr/step-challenge/…` |
| Aide (Santé Connect, Huawei) | `content/step-challenge/help/` | `…/step-challenge/help/…` |
| Page des invitations | `static/step-challenge/i/index.html`, règle dans `static/.htaccess` | `https://sport.architech.lu/step-challenge/i/<code>` |
| App Links | `static/.well-known/assetlinks.json`, commun au domaine (une entrée par application) | `https://sport.architech.lu/.well-known/assetlinks.json` |
| Logo | `static/images/step-challenge.svg`, dérivé de `icons/app-icon-foreground.svg` de ce dépôt | |

Langue : l'anglais à la racine, le français sous `/fr/`, **avant** la section (`/fr/step-challenge/privacy.html`).

## Ce qui dépend du site dans ce dépôt

- **Application** : les pages légales et d'aide ouvertes depuis l'application (`apps/mobile/src/constants/links.ts` : Plus → Informations légales et Aide, Source des pas, Amis), l'App Link des invitations (`app.json`, `pathPrefix` `/step-challenge/i/`) et `src/app/+native-intent.tsx`, qui retire le préfixe `/step-challenge`.
- **API** : la base des liens d'invitation (`publicBaseUrl` dans `backend/src/config.ts`).
- **`assetlinks.json`** : à mettre à jour dans `architech-sport` si une clé de signature change ([Signature Android](../reference/android-signing.md)).

Une page légale (confidentialité, conditions, suppression du compte) se met à jour **avant** l'envoi d'une version de l'application qui en dépend : les examinateurs des boutiques la lisent.

## L'ancien nom `step.architech.lu`

Redirigé par Cloudflare (zone `architech.lu`, Rules → Redirect Rules), en 301, chaque adresse vers son équivalent sur `sport.architech.lu` : `/fr/…` vers `/fr/step-challenge/…`, tout le reste vers `/step-challenge/…`. Les adresses déclarées dans les consoles et les liens déjà partagés continuent donc de mener à la bonne page. `assetlinks.json` n'y est plus servi : les versions de l'application antérieures à la 1.15.0 n'ouvrent plus directement les liens d'invitation, qui passent par la page web.

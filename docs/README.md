# Documentation

Rangée selon [Diátaxis](https://diataxis.fr/) : apprendre, faire, consulter, comprendre. Les décisions sont dans les
[ADR](adr/), l'avancement dans [STATUS.md](STATUS.md).

**Pour commencer : [l'architecture](explanation/architecture.md)**, puis [développer en
local](tutorials/develop-locally.md).

## Tutoriel : apprendre, de bout en bout

- [Développer en local](tutorials/develop-locally.md) : d'un Mac neuf au backend sur une base de dev et à
  l'application de développement sur un téléphone.

## Guides : faire une tâche

Livrer :

- [Publier une version de l'API](how-to/release-the-api.md) : tag, CI, images, notes de version, déploiement sur le VPS
- [Publier l'application sur Google Play](how-to/publish-on-google-play.md) : version, build EAS local, Play Console, tag
- [Publier l'application sur AppGallery](how-to/publish-on-appgallery.md) : APK, vérifications, AppGallery Connect
- [Mettre à jour le site public](how-to/update-the-public-site.md) : Hugo, pages, déploiement SFTP

Faire tourner :

- [Modérer les signalements](how-to/moderate-reports.md), chaque semaine
- [Préparer les captures d'écran des boutiques](how-to/prepare-store-screenshots.md) avec des données fictives
- [Écrire une migration](../backend/migrations/README.md) (Flyway)

## Référence : consulter

- [Commandes](reference/commands.md) : backend, application, site, publication
- [Configuration](reference/configuration.md) : `.env` du backend, variables EAS, `app.json` et `eas.json`
- [Intégration continue](reference/ci.md) : jobs, tags, images, notes de version
- [Comptes, consoles et secrets](reference/accounts-and-secrets.md) : où est quoi, qui le garde
- [Signature Android](reference/android-signing.md) : les trois clés, leurs empreintes, où elles sont déclarées
- [Badges, points et niveaux](reference/badges.md) : catalogue, règles d'attribution, courbe des niveaux (brouillon)
- [Surface d'exposition](reference/exposure.md) : tout ce qui est accessible sans authentification
- [Exploitation](exploitation.md) : pour qui héberge l'API (images, variables, démarrage, mises à jour, retour en
  arrière). Elle reste à la racine de `docs/` : l'ADR 0011 et le dépôt `vps-infra` y renvoient.

## Explication : comprendre

- [Architecture](explanation/architecture.md) : vue d'ensemble, accès au réseau, séquences des écrans
- [Versions et livraisons](explanation/versions-and-releases.md) : quatre chemins vers l'utilisateur, l'ordre d'une
  mise en production, pourquoi les notes viennent de git et pourquoi taguer l'application
- [Les clés de signature Android](explanation/android-signing.md) : ce que prouve une signature, pourquoi trois clés,
  pourquoi Google, le site et Huawei veulent leurs empreintes
- [L'intégration Huawei](explanation/huawei-integration.md) : journal du chantier Health Kit et AppGallery

# Intégration continue

Deux workflows GitHub Actions : `.github/workflows/ci.yml` (code, images, notes de version) et
`.github/workflows/deploy-site.yml` (site public).

## `ci.yml`

| Événement | `secrets` | `backend` | `mobile` | `images` | `release` |
|---|---|---|---|---|---|
| Pull request | ✓ | ✓ | ✓ | | |
| Push sur `main` | ✓ | ✓ | ✓ | ✓ tag `sha-<commit>` | |
| Tag `api-vX.Y.Z` | ✓ | ✓ | ✓ | ✓ tags `X.Y.Z`, `X.Y` (et `sha-…`) | ✓ |
| Tag `api-vX.Y.Z-rc.N` | ✓ | ✓ | ✓ | ✓ `sha-…` seulement | |
| Tag `mobile-vX.Y.Z` | | | | | |

- **`secrets`** : gitleaks sur tout l'historique. Échoue si un secret est commité : le retirer de l'historique ne
  suffit pas, il faut aussi le changer.
- **`backend`** : `npx tsc --noEmit`, l'image de migration appliquée à un PostgreSQL 18 vide, puis `npm test` avec
  les tests d'intégration.
- **`mobile`** : `npx tsc --noEmit` et `npm run check:i18n` (clés des langues). L'application n'est **pas** construite
  par la CI : les builds se font en local avec EAS.
- **`images`** : `step-challenge-api` et `step-challenge-migrations`, `linux/amd64` et `linux/arm64`, sur
  `ghcr.io/mauvaisetroupe/`. Jamais de `latest`.
- **`release`** : `.github/release-notes.sh` écrit les notes, puis `gh release create` crée la GitHub Release
  « API X.Y.Z ».

Le tag `mobile-v*` ne déclenche rien : il marque le code d'une version de l'application.

## Notes de version de l'API

Écrites depuis git, rien à la main ([ADR 0011](../adr/0011-backend-hosting.md), précisé le 2026-11-02). Seuls les
commits qui touchent `backend/` comptent :

1. **À lire avant de déployer** : les commits marqués `!` (`feat(backend)!: …`) ou avec une ligne
   `BREAKING CHANGE: …`, depuis le tag `api-v*` précédent (préversions exclues).
2. **Migrations** : les `V*.sql` et `B*.sql` ajoutées. Le script **échoue** si une migration de la version précédente
   a été modifiée ou supprimée (Flyway refuserait de migrer).
3. **Changements** : les commits du backend, hors fusions, et le lien de comparaison.

Les essayer avant le tag : `git tag api-v9.9.9 && .github/release-notes.sh api-v9.9.9; git tag -d api-v9.9.9`.

Les notes des versions 1.0.0 à 1.2.1, écrites à la main (ancien `backend/CHANGELOG.md`), restent dans les GitHub
Releases.

## Messages de commit

[Conventional Commits](https://www.conventionalcommits.org), en anglais, avec un scope (`mobile`, `backend`, `site`,
`deploy`, `adr`…). Le `!` est réservé à ce qui demande une action de l'exploitant ou empêche le retour en arrière ; la
version de l'application se commite `chore(mobile): X.Y.Z`.

## `deploy-site.yml`

Construit le site Hugo sur une pull request qui touche `site/`, et l'envoie chez OVH en SFTP sur un push sur `main`
qui touche `site/` (ou à la main, `workflow_dispatch`). Secrets et variables :
[Mettre à jour le site](../how-to/update-the-public-site.md#déploiement).

## Où regarder

- Exécutions : onglet **Actions** du dépôt, ou `gh run list`, `gh run view --log-failed`.
- Images : onglet **Packages** du profil `mauvaisetroupe`.
- Releases : `https://github.com/mauvaisetroupe/step-challenge/releases`.

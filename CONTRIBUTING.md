# Contribuer à Step Challenge

Merci de votre intérêt ! Ce guide résume les règles du projet.

## Avant de commencer

- Pour un bug ou une petite amélioration : ouvrez directement une issue ou une pull request.
- Pour un changement important (architecture, modèle de données, sécurité, nouvelle dépendance) : ouvrez d'abord une issue pour en discuter. Les décisions structurantes sont consignées sous forme d'ADR dans [`docs/adr/`](docs/adr/).
- Pour une vulnérabilité : suivez [SECURITY.md](SECURITY.md), pas d'issue publique.

L'installation et le lancement en local sont décrits dans le [README](README.md).

## Licence et DCO

Step Challenge est distribué sous [AGPL-3.0-or-later](LICENSE) (voir [NOTICE](NOTICE)). En contribuant, vous acceptez que votre contribution soit distribuée sous cette licence.

Chaque commit doit être signé selon le [Developer Certificate of Origin](https://developercertificate.org/) (DCO) : par cette ligne, vous certifiez avoir le droit de soumettre ce code sous la licence du projet.

```bash
git commit -s -m "fix(backend): ..."
```

L'option `-s` ajoute automatiquement :

```text
Signed-off-by: Prénom Nom <email@example.com>
```

Il n'y a pas de CLA : vous restez titulaire des droits sur vos contributions.

## Commits

- Des commits **unitaires** : un commit = un changement cohérent, qui compile seul.
- Messages au format [Conventional Commits](https://www.conventionalcommits.org/) : `feat`, `fix`, `refactor`, `chore`, `docs`, avec un scope (`mobile`, `backend`, `deploy`, `adr`…).

```text
feat(backend): add Google ID token verification
fix(mobile): keep background sync registered after update
```

## Vérifications avant une pull request

```bash
cd backend && npx tsc --noEmit
cd apps/mobile && npx tsc --noEmit
```

La CI exécute ces vérifications ainsi qu'une recherche de secrets (gitleaks).

## Règles du projet

- **Aucun secret dans le dépôt** : clés, mots de passe et fichiers de configuration privés (`.env`, `agconnect-services.json`, keystores) restent hors de git.
- **Données minimales** : ne collectez pas de donnée personnelle qui n'est pas strictement nécessaire. Pas de SDK de publicité, d'analytics ou de tracking.
- **Contrôles d'accès côté serveur** : le backend ne fait jamais confiance à un identifiant d'utilisateur envoyé par le client (voir l'[ADR 0001](docs/adr/0001-authentication.md)).
- Le nom et le logo « Step Challenge » sont régis par [TRADEMARKS.md](TRADEMARKS.md).

# Notes de version du backend

Une section par version des images `step-challenge-api` et `step-challenge-migrations` (tag git `api-vX.Y.Z`, [ADR 0011](../docs/adr/0011-backend-hosting.md)). La CI publie la section de la version dans la GitHub Release, et échoue si elle manque.

Chaque section commence par ce qui change pour l'**exploitant** (variables ajoutées ou retirées, migrations lourdes ou sans retour en arrière, version de PostgreSQL exigée), puis le reste. Écrire « Aucun changement » plutôt que d'omettre une rubrique. La documentation d'exploitation est [`docs/exploitation.md`](../docs/exploitation.md).

Modèle :

```markdown
## X.Y.Z (AAAA-MM-JJ)

### Exploitation

- **Variables** : …
- **Migrations** : …
- **PostgreSQL** : …

### Changements

- …
```

## 1.0.0 (2026-10-26)

Première version publiée sous forme d'images.

### Exploitation

- **Images** : `ghcr.io/mauvaisetroupe/step-challenge-migrations:1.0.0` à lancer jusqu'à sa fin, puis `ghcr.io/mauvaisetroupe/step-challenge-api:1.0.0`. L'API refuse de démarrer tant que la base n'a pas atteint sa version de schéma (6).
- **Variables** : l'API refuse de démarrer si `DATABASE_HOST`, `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD` ou `GOOGLE_CLIENT_ID` manque. Nouvelles : `APP_TIMEZONE` (`Europe/Paris` par défaut ; fixe le jour, la semaine et le mois du classement, au lieu du fuseau du serveur PostgreSQL) et `CLIENT_IP_HEADER` (`cf-connecting-ip` par défaut). `DATABASE_PORT` vaut désormais 5432 par défaut. Image de migration : variables standard de Flyway (`FLYWAY_URL`, `FLYWAY_USER`, `FLYWAY_PASSWORD`).
- **Migrations** : par Flyway. Base vide : schéma complet (`B006`). **Base existante migrée à la main** (sans table `flyway_schema_history`) : lancer une fois l'image de migration avec `FLYWAY_BASELINE_ON_MIGRATE=true` et `FLYWAY_BASELINE_VERSION=6`, après avoir vérifié que les migrations 001 à 006 y sont appliquées. Rien n'est exécuté sur la base.
- **PostgreSQL** : 18.
- **Santé** : `/api/health` interroge la base (503 si elle ne répond pas).

### Changements

- Arrêt propre sur `SIGTERM` : les requêtes en cours se terminent, puis les connexions à la base sont fermées.

# Migrations

- `../schema.sql` décrit le schéma **complet et à jour** : il sert à créer une base neuve.
- Les fichiers `NNN_*.sql` de ce dossier font évoluer une base **existante**, dans l'ordre de leur numéro. Chacun s'exécute dans une transaction.

Toute modification du schéma ajoute une migration **et** met à jour `schema.sql`.

## Appliquer une migration

```bash
psql -d step_challenge -v ON_ERROR_STOP=1 -f backend/migrations/001_auth.sql
```

(ou copier son contenu dans Adminer → « Requête SQL »).

Faire une sauvegarde avant (`pg_dump`, ou Adminer → Exporter avec les données).

## Historique

| Migration | ADR | Contenu |
|---|---|---|
| `001_auth.sql` | 0001 | `user_credentials`, `sessions`, cascade de `daily_steps` |

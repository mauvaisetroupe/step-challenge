# Migrations

Le schéma de la base est créé et mis à jour par **Flyway**, dans l'image de migration construite par le [`Dockerfile`](Dockerfile) de ce dossier ([ADR 0011](../../docs/adr/0011-backend-hosting.md)). Elle s'exécute avant l'API, applique ce qui manque, puis s'arrête ; l'API vérifie à son démarrage que la base a atteint la dernière version de ce dossier.

| Fichier | Rôle |
|---|---|
| `V<NNN>__<description>.sql` | Migration versionnée, appliquée une fois, dans l'ordre des numéros |
| `B<NNN>__schema.sql` | Migration de base : schéma complet à la version `NNN`, appliqué **seulement sur une base vide**, à la place des `V` jusqu'à `NNN` |

`B006__schema.sql` est le schéma complet après `V006`. Sur une base vide, Flyway l'applique, puis les `V` suivantes.

## Écrire une migration

1. Un nouveau fichier `V<numéro suivant>__<description>.sql` (par exemple `V007__weekly_goal.sql`), **sans** `BEGIN;` ni `COMMIT;` : Flyway exécute chaque migration dans une transaction. `V001` à `V006`, écrites pour `psql`, en contiennent ; elles ne s'exécutent plus (ligne de base ou `B006`).
2. **Ne jamais modifier** un fichier déjà appliqué quelque part, `B006` compris : Flyway compare leurs sommes de contrôle et refuse de migrer si l'une a changé.
3. Compatible avec la version précédente de l'API quand c'est possible (colonne ajoutée plutôt que renommée), pour qu'un retour à l'image précédente reste possible.
4. Si elle est lourde (table réécrite, index sur une grande table) ou empêche le retour en arrière, le signaler dans les notes de version (`../CHANGELOG.md`).
5. `npm run db:up` l'applique aux bases de dev et de test.

Une instruction qui ne peut pas s'exécuter dans une transaction (`CREATE INDEX CONCURRENTLY`) demande un réglage de Flyway propre à ce fichier (voir sa documentation).

## Un nouveau schéma complet

Le schéma complet n'est plus tenu à jour dans un fichier. Une fois l'application stable, un nouveau `B<n>__schema.sql` pourra résumer `V001` à `V<n>` : partir d'un `pg_dump --schema-only --no-owner --no-privileges` d'une base migrée (sans la table `flyway_schema_history`), le nettoyer et le commenter. Les anciens `V` et `B` restent : ils figurent dans l'historique des bases déjà migrées.

## Historique

| Migration | ADR | Contenu |
|---|---|---|
| `V001__auth.sql` | 0001 | `user_credentials`, `sessions`, cascade de `daily_steps` |
| `V002__display_name_not_unique.sql` | 0001 | Suppression de l'unicité du nom affiché |
| `V003__friends.sql` | 0002 | `invitations`, `friendships`, `friend_aliases` |
| `V004__reports_and_blocks.sql` | 0004 | `user_blocks`, `user_reports` |
| `V005__demo_credential.sql` | 0006 | Type d'identifiant `demo` (compte de démonstration des examinateurs) |
| `V006__daily_activity.sql` | 0010 | Minutes actives, très actives et inactives dans `daily_steps` |
| `B006__schema.sql` | 0011 | Schéma complet après `V006`, pour une base vide |

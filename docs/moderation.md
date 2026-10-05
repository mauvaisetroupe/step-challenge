# Modération des signalements

Procédure de traitement des signalements d'utilisateurs, décidée par l'[ADR 0004 — Signalement et blocage](adr/0004-user-reporting-and-blocking.md). Le seul contenu que les utilisateurs créent est leur **nom affiché** ; le traitement est manuel.

Les requêtes s'exécutent sur la base de production (Adminer → « Requête SQL »).

## Fréquence

**Au moins une fois par semaine** : vérifier s'il y a des signalements en attente.

```sql
SELECT count(*) AS en_attente
FROM user_reports
WHERE resolved_at IS NULL;
```

La règle Google Play cite comme infraction une application qui « ne traite pas durablement les plaintes » : un signalement ne doit pas rester des semaines sans réponse.

## 1. Lister les signalements en attente

```sql
SELECT
  r.id,
  r.created_at,
  r.reason,
  r.comment,
  r.reported_name                       AS nom_signale,
  reported.name                         AS nom_actuel,
  r.reported_id,
  reporter.name                         AS signale_par,
  r.invitation_id IS NOT NULL           AS via_invitation,
  (SELECT count(*) FROM user_reports r2
   WHERE r2.reported_id = r.reported_id) AS signalements_total
FROM user_reports r
LEFT JOIN users reported ON reported.id = r.reported_id
LEFT JOIN users reporter ON reporter.id = r.reporter_id
WHERE r.resolved_at IS NULL
ORDER BY r.created_at;
```

- `nom_signale` est le nom **au moment du signalement** ; `nom_actuel` peut avoir changé depuis (vide si le compte a été supprimé).
- `signalements_total` aide à repérer un comportement répété.
- Motifs : `offensive_name` (nom offensant), `impersonation` (usurpation d'identité), `harassment` (harcèlement), `other` (autre).

## 2. Décider

| Situation | Action |
|---|---|
| Le nom (actuel ou signalé) enfreint les conditions d'utilisation : injurieux, haineux, sexuel, discriminatoire, usurpation | **Réinitialiser le nom** (3a) |
| Récidive après une réinitialisation, harcèlement grave ou répété | **Supprimer le compte** (3b) |
| Signalement infondé, malveillant, ou nom déjà corrigé | **Classer sans suite** (3c) |

En cas de doute sur une usurpation d'identité, privilégier la réinitialisation du nom : elle est réversible (la personne choisit un nouveau nom), la suppression ne l'est pas.

La personne signalée **n'est pas prévenue** par l'application (aucune adresse e-mail n'est stockée, ADR 0001). Elle constate le changement de nom ou la suppression de son compte, et peut contester par e-mail au support (`support@architech.lu`).

## 3. Agir

Chaque bloc est une transaction : en cas d'erreur, rien n'est modifié. Remplacer l'identifiant de l'utilisateur signalé (`reported_id` de l'étape 1).

### 3a. Réinitialiser le nom

Le nom devient « Utilisateur » ; la personne pourra en choisir un autre dans les Paramètres. Tous les signalements en attente la concernant sont clos.

```sql
BEGIN;

UPDATE users
SET name = 'Utilisateur'
WHERE id = '00000000-0000-0000-0000-000000000000';

UPDATE user_reports
SET resolved_at = now(), resolution = 'name_reset'
WHERE reported_id = '00000000-0000-0000-0000-000000000000'
  AND resolved_at IS NULL;

COMMIT;
```

Les surnoms donnés par ses amis (visibles d'eux seuls) ne sont pas modifiés.

### 3b. Supprimer le compte

Supprime le compte et, en cascade, ses pas, ses sessions, ses identifiants de connexion, ses invitations, amitiés, surnoms et blocages. Les signalements sont conservés (sans lien vers le compte), après avoir été clos.

```sql
BEGIN;

UPDATE user_reports
SET resolved_at = now(), resolution = 'account_deleted'
WHERE reported_id = '00000000-0000-0000-0000-000000000000'
  AND resolved_at IS NULL;

DELETE FROM users
WHERE id = '00000000-0000-0000-0000-000000000000';

COMMIT;
```

Rien n'empêche la personne de recréer un compte avec le même compte Google : surveiller les nouveaux signalements.

### 3c. Classer sans suite

Pour un signalement précis (`id` de l'étape 1) :

```sql
UPDATE user_reports
SET resolved_at = now(), resolution = 'dismissed'
WHERE id = '00000000-0000-0000-0000-000000000000'
  AND resolved_at IS NULL;
```

## 4. Historique d'un utilisateur

```sql
SELECT created_at, reason, comment, reported_name, resolved_at, resolution
FROM user_reports
WHERE reported_id = '00000000-0000-0000-0000-000000000000'
ORDER BY created_at;
```

## 5. Purge (conservation de 12 mois)

Les signalements traités contiennent des données personnelles (nom signalé, commentaire) : ils sont supprimés 12 mois après leur traitement. À lancer une fois par mois, par exemple avec la vérification hebdomadaire.

```sql
DELETE FROM user_reports
WHERE resolved_at < now() - interval '12 months';
```

Les signalements en attente ne sont jamais purgés.

## Points ouverts

- **Notification** à chaque nouveau signalement (ADR 0004, points ouverts) : en attendant, la vérification hebdomadaire.
- **Formulaire Data safety** de Google Play : vérifier si les signalements doivent y être déclarés.

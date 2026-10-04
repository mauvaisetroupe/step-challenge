-- Migration 002 — Le prénom devient un nom affiché libre (ADR 0001)
--
-- L'identité repose désormais sur user_credentials (issuer, subject) :
-- deux utilisateurs peuvent porter le même nom affiché.

BEGIN;

DROP INDEX users_name_unique;

COMMIT;

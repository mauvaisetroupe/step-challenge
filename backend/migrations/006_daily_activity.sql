-- Migration 006 — Minutes actives de chaque jour (ADR 0010)
--
-- Minutes actives, très actives et inactives, calculées par l'application
-- à partir des pas minute par minute. NULL : jamais envoyées (ancienne
-- version de l'application, client web).

BEGIN;

ALTER TABLE daily_steps
    ADD COLUMN active_minutes      smallint,
    ADD COLUMN very_active_minutes smallint,
    ADD COLUMN inactive_minutes    smallint;

COMMIT;

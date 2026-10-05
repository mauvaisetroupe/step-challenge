-- Migration 005 — Accès de démonstration pour les examinateurs (ADR 0006)
--
-- Le compte de démonstration est reconnu par un identifiant de connexion
-- de type 'demo' (issuer 'step-challenge', subject 'demo'), que seule la
-- route POST /api/auth/demo utilise.

BEGIN;

ALTER TABLE user_credentials
    DROP CONSTRAINT user_credentials_type_check,
    ADD CONSTRAINT user_credentials_type_check
        CHECK (type IN ('oidc', 'demo'));

COMMIT;

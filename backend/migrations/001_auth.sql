-- Migration 001 — Authentification (ADR 0001)
--
-- Ajoute les identifiants de connexion et les sessions applicatives.
-- La suppression de l'index unique sur users.name est reportée à la
-- migration de nettoyage : l'ancienne version de l'application, encore
-- en circulation pendant la transition, s'appuie sur cette unicité.

BEGIN;

CREATE TABLE user_credentials (
    id           uuid        PRIMARY KEY,
    user_id      uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    type         text        NOT NULL CHECK (type IN ('oidc')),
    issuer       text        NOT NULL,
    subject      text        NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    last_used_at timestamptz,
    CONSTRAINT user_credentials_issuer_subject_key UNIQUE (issuer, subject)
);

CREATE INDEX user_credentials_user_id_idx ON user_credentials (user_id);

CREATE TABLE sessions (
    id           uuid        PRIMARY KEY,
    user_id      uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash   bytea       NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    last_used_at timestamptz NOT NULL DEFAULT now(),
    expires_at   timestamptz NOT NULL,
    CONSTRAINT sessions_token_hash_key UNIQUE (token_hash)
);

CREATE INDEX sessions_user_id_idx ON sessions (user_id);

-- La suppression d'un compte supprime ses pas.
ALTER TABLE daily_steps
    DROP CONSTRAINT daily_steps_user_fk,
    ADD CONSTRAINT daily_steps_user_fk
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;

COMMIT;

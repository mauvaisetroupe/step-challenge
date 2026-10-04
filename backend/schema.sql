-- Step Challenge — schéma PostgreSQL complet.
-- Pour une base neuve. Une base existante évolue via migrations/ (voir migrations/README.md).
-- Dernière migration incluse : 001_auth.

CREATE TABLE users (
    id         uuid        NOT NULL,
    name       text        NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT users_pkey PRIMARY KEY (id)
);

-- Un prénom ne peut être utilisé qu'une fois, sans tenir compte de la casse
-- ni des espaces (le backend renvoie 409 en cas de doublon).
CREATE UNIQUE INDEX users_name_unique
    ON users (LOWER(TRIM(name)));

CREATE TABLE daily_steps (
    user_id    uuid        NOT NULL,
    date       date        NOT NULL,
    steps      integer     NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    -- Une ligne par utilisateur et par jour : cible de l'upsert de POST /api/steps.
    CONSTRAINT daily_steps_pkey PRIMARY KEY (user_id, date),
    -- La suppression d'un compte supprime ses pas.
    CONSTRAINT daily_steps_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Identifiants de connexion (ADR 0001) : OIDC aujourd'hui, passkeys plus tard.
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

-- Sessions applicatives (ADR 0001) : seul le hash SHA-256 du jeton est stocké.
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

-- Vue de debug : dernières mises à jour de pas, avec le prénom.
CREATE VIEW debug_view AS
SELECT ds.date,
       ds.steps,
       ds.updated_at,
       u.name
FROM daily_steps ds
JOIN users u ON u.id = ds.user_id
ORDER BY ds.updated_at DESC;

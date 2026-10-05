-- Step Challenge — schéma PostgreSQL complet.
-- Pour une base neuve. Une base existante évolue via migrations/ (voir migrations/README.md).
-- Dernière migration incluse : 004_reports_and_blocks.

-- name est un nom affiché libre et non unique : l'identité repose sur
-- user_credentials (ADR 0001).
CREATE TABLE users (
    id         uuid        NOT NULL,
    name       text        NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT users_pkey PRIMARY KEY (id)
);

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

-- Amis (ADR 0002).
-- Seul le hash SHA-256 du code d'invitation est stocké.
CREATE TABLE invitations (
    id          uuid        PRIMARY KEY,
    inviter_id  uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    code_hash   bytea       NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    expires_at  timestamptz NOT NULL,
    revoked_at  timestamptz,
    use_count   integer     NOT NULL DEFAULT 0,
    CONSTRAINT invitations_code_hash_key UNIQUE (code_hash)
);

CREATE INDEX invitations_inviter_id_idx ON invitations (inviter_id);

-- Paire canonique (user_low < user_high) : une seule ligne par amitié,
-- pas de doublon A→B / B→A possible.
CREATE TABLE friendships (
    user_low      uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    user_high     uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at    timestamptz NOT NULL DEFAULT now(),
    invitation_id uuid        REFERENCES invitations (id) ON DELETE SET NULL,
    CONSTRAINT friendships_pkey PRIMARY KEY (user_low, user_high),
    CONSTRAINT friendships_canonical_order CHECK (user_low < user_high)
);

CREATE INDEX friendships_user_high_idx ON friendships (user_high);

-- Surnom que owner_id donne à friend_id (relation orientée).
CREATE TABLE friend_aliases (
    owner_id   uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    friend_id  uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    alias      text        NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT friend_aliases_pkey PRIMARY KEY (owner_id, friend_id),
    CONSTRAINT friend_aliases_not_self CHECK (owner_id <> friend_id),
    CONSTRAINT friend_aliases_length CHECK (length(trim(alias)) BETWEEN 1 AND 50)
);

-- Signalement et blocage des utilisateurs (ADR 0004).
-- blocker_id a bloqué blocked_id. Le blocage empêche toute nouvelle amitié
-- dans les deux sens ; blocked_name est le nom affiché au moment du
-- blocage (on ne voit plus le nom actuel d'une personne bloquée).
CREATE TABLE user_blocks (
    blocker_id   uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    blocked_id   uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    blocked_name text        NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT user_blocks_pkey PRIMARY KEY (blocker_id, blocked_id),
    CONSTRAINT user_blocks_not_self CHECK (blocker_id <> blocked_id)
);

CREATE INDEX user_blocks_blocked_id_idx ON user_blocks (blocked_id);

-- Signalements, traités à la main (docs/moderation.md). Ils survivent à la
-- suppression des comptes concernés (SET NULL), sans rester rattachés à
-- quelqu'un. reported_name est un instantané du nom signalé.
CREATE TABLE user_reports (
    id            uuid        PRIMARY KEY,
    reporter_id   uuid        REFERENCES users (id) ON DELETE SET NULL,
    reported_id   uuid        REFERENCES users (id) ON DELETE SET NULL,
    reported_name text        NOT NULL,
    reason        text        NOT NULL,
    comment       text,
    invitation_id uuid        REFERENCES invitations (id) ON DELETE SET NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),
    resolved_at   timestamptz,
    resolution    text,
    CONSTRAINT user_reports_reason_check
        CHECK (reason IN ('offensive_name', 'impersonation', 'harassment', 'other')),
    CONSTRAINT user_reports_comment_length CHECK (length(comment) <= 500),
    CONSTRAINT user_reports_resolution_check
        CHECK (resolution IN ('name_reset', 'account_deleted', 'dismissed')),
    CONSTRAINT user_reports_resolved_consistency
        CHECK ((resolved_at IS NULL) = (resolution IS NULL))
);

CREATE INDEX user_reports_pending_idx ON user_reports (created_at)
    WHERE resolved_at IS NULL;
CREATE INDEX user_reports_reported_id_idx ON user_reports (reported_id);

-- Vue de debug : dernières mises à jour de pas, avec le prénom.
CREATE VIEW debug_view AS
SELECT ds.date,
       ds.steps,
       ds.updated_at,
       u.name
FROM daily_steps ds
JOIN users u ON u.id = ds.user_id
ORDER BY ds.updated_at DESC;

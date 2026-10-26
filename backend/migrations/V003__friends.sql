-- Migration 003 — Amis (ADR 0002)
--
-- Invitations par lien, amitiés symétriques, alias locaux.

BEGIN;

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

COMMIT;

-- Migration 004 — Signalement et blocage des utilisateurs (ADR 0004)

BEGIN;

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

COMMIT;

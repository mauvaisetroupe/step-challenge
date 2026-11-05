-- Migration 007 — Badges (docs/reference/badges.md)
--
-- Une ligne par badge obtenu. occurrence vaut '' pour un badge unique,
-- la période (YYYY-Www, YYYY-MM) pour un badge de semaine ou de mois,
-- #1, #2… pour un badge répétable : la clé primaire rend l'attribution
-- idempotente (INSERT … ON CONFLICT DO NOTHING).
--
-- Les points sont figés à l'obtention : le catalogue peut être
-- rééquilibré sans changer ce qui est acquis. Le total et le niveau se
-- calculent, ils ne sont pas stockés.

CREATE TABLE user_badges (
    user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    badge_id   text        NOT NULL,
    occurrence text        NOT NULL DEFAULT '',
    points     smallint    NOT NULL,
    -- Jour où la condition a été remplie (dans le passé pour un badge
    -- attribué rétroactivement).
    earned_on  date        NOT NULL,
    -- Insertion de la ligne : l'application annonce les badges insérés
    -- depuis sa dernière consultation.
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT user_badges_pkey PRIMARY KEY (user_id, badge_id, occurrence),
    CONSTRAINT user_badges_points_check CHECK (points BETWEEN 1 AND 4)
);

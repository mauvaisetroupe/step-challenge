-- Migration 008 — Journal des accords (ADR 0017)
--
-- Une ligne par accord donné ou retiré, en ajout seul : l'état courant
-- d'un sujet est sa dernière ligne.
--   - 'terms', 'privacy' : conditions d'utilisation et politique de
--     confidentialité, avec la version acceptée (backend/src/legal.ts) ;
--   - 'huawei_health' : autorisation HUAWEI Health accordée ou retirée,
--     déclarée par l'application, avec les scopes ou la cause du
--     retrait dans detail.
-- Aucune donnée de santé. La suppression du compte efface le journal.

CREATE TABLE user_consents (
    id         uuid        PRIMARY KEY,
    user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    subject    text        NOT NULL,
    action     text        NOT NULL,
    version    text,
    detail     jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT user_consents_subject_check
        CHECK (subject IN ('terms', 'privacy', 'huawei_health')),
    CONSTRAINT user_consents_action_check
        CHECK (action IN ('granted', 'withdrawn')),
    -- Un document accepté porte toujours sa version.
    CONSTRAINT user_consents_document_version
        CHECK (subject = 'huawei_health' OR version IS NOT NULL)
);

CREATE INDEX user_consents_user_idx ON user_consents (user_id, subject, created_at);

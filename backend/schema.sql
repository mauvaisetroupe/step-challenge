-- Step Challenge — schéma PostgreSQL
-- Reflète la base de production (export Adminer du 2026-10-04).

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
    CONSTRAINT daily_steps_user_fk FOREIGN KEY (user_id) REFERENCES users (id)
);

-- Vue de debug : dernières mises à jour de pas, avec le prénom.
CREATE VIEW debug_view AS
SELECT ds.date,
       ds.steps,
       ds.updated_at,
       u.name
FROM daily_steps ds
JOIN users u ON u.id = ds.user_id
ORDER BY ds.updated_at DESC;

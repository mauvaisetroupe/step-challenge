SELECT * FROM users
id	name	created_at
ac240c30-b925-4615-8a95-81424035e730	Lionel	2026-09-06 19:07:26.476385+00
1 row (0.000 s) Edit, Explain, Export

SELECT * FROM daily_steps
user_id	date	steps	updated_at
ac240c30-b925-4615-8a95-81424035e730	2026-09-06	17583	2026-09-06 19:23:59.220872+00


CREATE TABLE step_samples (
    user_id UUID NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    steps INTEGER NOT NULL,
    PRIMARY KEY (user_id, recorded_at),
    CONSTRAINT step_samples_user_fk
        FOREIGN KEY (user_id)
        REFERENCES users(id)
);

CREATE INDEX step_samples_user_recorded_at_idx
    ON step_samples (user_id, recorded_at);


GRANT SELECT, INSERT, UPDATE, DELETE
ON step_samples
TO step_challenge_app;


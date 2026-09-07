SELECT * FROM users
id	name	created_at
ac240c30-b925-4615-8a95-81424035e730	Lionel	2026-09-06 19:07:26.476385+00
1 row (0.000 s) Edit, Explain, Export

SELECT * FROM daily_steps
user_id	date	steps	updated_at
ac240c30-b925-4615-8a95-81424035e730	2026-09-06	17583	2026-09-06 19:23:59.220872+00


CREATE UNIQUE INDEX users_name_unique
ON users (LOWER(TRIM(name)));

SELECT LOWER(TRIM(name)) AS normalized_name, COUNT(*)
FROM users
GROUP BY LOWER(TRIM(name))
HAVING COUNT(*) > 1;
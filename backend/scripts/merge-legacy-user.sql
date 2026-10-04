-- Rattachement d'un ancien compte (onboarding par prénom) à un nouveau
-- compte (connexion Google) — bascule de l'ADR 0001.
--
-- À exécuter sur la base de production, APRÈS que le testeur s'est
-- connecté une première fois avec Google (ce qui crée son nouveau compte).
-- Faire une sauvegarde avant (pg_dump, ou Adminer → Exporter avec données).
--
-- Utilisation (Adminer → « Requête SQL », ou psql -f) :
--
--   1. Exécuter la requête d'identification (étape 1) pour repérer les
--      deux comptes de chaque testeur.
--   2. Renseigner old_user_id et new_user_id dans le bloc de l'étape 2.
--   3. Exécuter le bloc. Il est atomique : en cas d'erreur, rien n'est
--      modifié. Recommencer pour chaque testeur.
--
-- Effet : les pas de l'ancien compte sont copiés vers le nouveau (en
-- gardant le maximum lorsque les deux comptes ont une valeur le même
-- jour), puis l'ancien compte est supprimé. Le nouveau compte garde le
-- nom choisi lors de la connexion Google.


-- Étape 1 — Identification : anciens comptes (sans identifiant de
-- connexion) et nouveaux comptes (connectés avec Google).

SELECT
  u.id,
  u.name,
  u.created_at,
  CASE WHEN uc.user_id IS NULL THEN 'ancien' ELSE 'nouveau' END AS compte,
  count(ds.date) AS jours,
  COALESCE(sum(ds.steps), 0) AS total_pas
FROM users u
LEFT JOIN (SELECT DISTINCT user_id FROM user_credentials) uc
  ON uc.user_id = u.id
LEFT JOIN daily_steps ds ON ds.user_id = u.id
GROUP BY u.id, u.name, u.created_at, uc.user_id
ORDER BY u.name, u.created_at;


-- Étape 2 — Fusion d'un testeur.

DO $$
DECLARE
  -- ▼▼▼ À renseigner ▼▼▼
  old_user_id uuid := '00000000-0000-0000-0000-000000000000';
  new_user_id uuid := '00000000-0000-0000-0000-000000000000';
  -- ▲▲▲

  old_name text;
  new_name text;
  copied integer;
BEGIN
  SELECT name INTO old_name FROM users WHERE id = old_user_id;
  SELECT name INTO new_name FROM users WHERE id = new_user_id;

  IF old_name IS NULL THEN
    RAISE EXCEPTION 'Ancien compte introuvable : %', old_user_id;
  END IF;

  IF new_name IS NULL THEN
    RAISE EXCEPTION 'Nouveau compte introuvable : %', new_user_id;
  END IF;

  IF old_user_id = new_user_id THEN
    RAISE EXCEPTION 'Les deux identifiants sont identiques';
  END IF;

  IF EXISTS (SELECT 1 FROM user_credentials WHERE user_id = old_user_id) THEN
    RAISE EXCEPTION 'Le compte % (%) est déjà connecté avec Google : ce n''est pas un ancien compte',
      old_user_id, old_name;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM user_credentials WHERE user_id = new_user_id) THEN
    RAISE EXCEPTION 'Le compte % (%) n''a pas d''identifiant Google : ce n''est pas un nouveau compte',
      new_user_id, new_name;
  END IF;

  INSERT INTO daily_steps (user_id, date, steps, updated_at)
  SELECT new_user_id, date, steps, updated_at
  FROM daily_steps
  WHERE user_id = old_user_id
  ON CONFLICT (user_id, date) DO UPDATE
  SET steps = GREATEST(daily_steps.steps, EXCLUDED.steps),
      updated_at = GREATEST(daily_steps.updated_at, EXCLUDED.updated_at);

  GET DIAGNOSTICS copied = ROW_COUNT;

  -- Supprime aussi les pas de l'ancien compte (ON DELETE CASCADE).
  DELETE FROM users WHERE id = old_user_id;

  RAISE NOTICE 'Fusion terminée : « % » → « % », % jour(s) de pas rattaché(s).',
    old_name, new_name, copied;
END
$$;

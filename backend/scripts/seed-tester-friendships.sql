-- Rend tous les testeurs amis entre eux — mise en service de l'ADR 0002.
--
-- Avant l'ADR 0002, le classement était global : chaque testeur voyait
-- tous les autres. Pour ne pas vider leur classement au déploiement, une
-- amitié est créée entre chaque paire de comptes connectés avec Google.
--
-- À exécuter sur la base de production, après la migration 003 et avant
-- (ou juste après) le déploiement du backend. Faire une sauvegarde avant.
--
-- Relançable sans risque : seules les amitiés manquantes sont créées. À
-- relancer après chaque migration d'un ancien compte (merge-legacy-user.sql),
-- pour ajouter le testeur migré au groupe.
--
-- Les anciens comptes (sans identifiant Google) sont ignorés : leurs
-- amitiés seraient supprimées en cascade lors de leur fusion.


-- Étape 1 — Aperçu : comptes concernés.

SELECT u.id, u.name, u.created_at
FROM users u
WHERE EXISTS (SELECT 1 FROM user_credentials uc WHERE uc.user_id = u.id)
ORDER BY u.name;


-- Étape 2 — Création des amitiés.

DO $$
DECLARE
  -- ▼▼▼ Comptes à exclure (compte de démonstration pour Google Play…) ▼▼▼
  excluded_ids uuid[] := ARRAY[
    '00000000-0000-0000-0000-000000000000'
  ]::uuid[];
  -- ▲▲▲

  members integer;
  created integer;
BEGIN
  SELECT count(*) INTO members
  FROM users u
  WHERE EXISTS (SELECT 1 FROM user_credentials uc WHERE uc.user_id = u.id)
    AND u.id <> ALL (excluded_ids);

  WITH testers AS (
    SELECT u.id
    FROM users u
    WHERE EXISTS (SELECT 1 FROM user_credentials uc WHERE uc.user_id = u.id)
      AND u.id <> ALL (excluded_ids)
  )
  INSERT INTO friendships (user_low, user_high)
  SELECT a.id, b.id
  FROM testers a
  JOIN testers b ON a.id < b.id
  ON CONFLICT (user_low, user_high) DO NOTHING;

  GET DIAGNOSTICS created = ROW_COUNT;

  RAISE NOTICE '% testeur(s), % amitié(s) créée(s) (% au total pour ce groupe).',
    members, created, members * (members - 1) / 2;
END
$$;

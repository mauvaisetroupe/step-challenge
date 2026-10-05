-- Rend amis entre eux les comptes d'une liste explicite — mise en service
-- de l'ADR 0002.
--
-- Avant l'ADR 0002, le classement était global : chaque testeur voyait
-- tous les autres. Pour ne pas vider leur classement au déploiement, une
-- amitié est créée entre chaque paire de comptes de la liste.
--
-- Liste explicite, et non « tous les comptes connectés avec Google » : des
-- comptes inconnus apparaissent (robot de test de Google Play pendant
-- l'examen d'une version, compte de démonstration pour les examinateurs,
-- puis de vrais utilisateurs). Les rendre amis avec les testeurs leur
-- donnerait accès à leurs pas.
--
-- À exécuter sur la base de production. Faire une sauvegarde avant.
-- Relançable sans risque : seules les amitiés manquantes sont créées.
-- Ne pas y mettre un ancien compte (sans identifiant Google) : ses amitiés
-- seraient supprimées lors de sa fusion (merge-legacy-user.sql) ; fusionner
-- d'abord, puis ajouter le nouveau compte à la liste.


-- Étape 1 — Aperçu : comptes connectés avec Google, pour choisir la liste.

SELECT u.id, u.name, u.created_at
FROM users u
WHERE EXISTS (SELECT 1 FROM user_credentials uc WHERE uc.user_id = u.id)
ORDER BY u.name;


-- Étape 2 — Création des amitiés.

DO $$
DECLARE
  -- ▼▼▼ Comptes à rendre amis entre eux (identifiants de l'étape 1) ▼▼▼
  member_ids uuid[] := ARRAY[
    '00000000-0000-0000-0000-000000000000'
  ]::uuid[];
  -- ▲▲▲

  members integer;
  created integer;
BEGIN
  SELECT count(*) INTO members
  FROM users u
  WHERE u.id = ANY (member_ids)
    AND EXISTS (SELECT 1 FROM user_credentials uc WHERE uc.user_id = u.id);

  IF members <> cardinality(member_ids) THEN
    RAISE EXCEPTION 'Identifiant inconnu ou ancien compte (sans identifiant Google) dans la liste : % trouvé(s) sur %',
      members, cardinality(member_ids);
  END IF;

  WITH testers AS (
    SELECT unnest(member_ids) AS id
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

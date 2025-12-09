-- ============================================
-- SETT OPP EXERCISE GROUPS
-- ============================================
-- Dette scriptet oppretter exercise_groups tabellen og knytter
-- alle eksisterende øvelser til "Rygg" gruppen

-- ============================================
-- 1. OPPRETT EXERCISE_GROUPS TABELLEN
-- ============================================

CREATE TABLE IF NOT EXISTS exercise_groups (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  "order" INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- RLS Policies for exercise_groups
ALTER TABLE exercise_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active exercise groups"
  ON exercise_groups FOR SELECT
  USING (active = true);

CREATE POLICY "Authenticated users can manage exercise groups"
  ON exercise_groups FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 2. LEGG TIL EXERCISE_GROUP_ID I EXERCISES
-- ============================================

-- Legg til exercise_group_id kolonne i exercises tabellen
ALTER TABLE exercises 
ADD COLUMN IF NOT EXISTS exercise_group_id BIGINT REFERENCES exercise_groups(id) ON DELETE SET NULL;

-- ============================================
-- 3. OPPRETT "RYGG" GRUPPEN
-- ============================================

-- Opprett "Rygg" gruppen
INSERT INTO exercise_groups (name, description, "order", active)
VALUES ('Rygg', 'Ryggøvelser', 1, true)
ON CONFLICT DO NOTHING
RETURNING id;

-- Hent ID-en til "Rygg" gruppen
DO $$
DECLARE
  rygg_group_id BIGINT;
BEGIN
  -- Hent eller opprett "Rygg" gruppen
  SELECT id INTO rygg_group_id
  FROM exercise_groups
  WHERE name = 'Rygg'
  LIMIT 1;

  -- Hvis gruppen ikke finnes, opprett den
  IF rygg_group_id IS NULL THEN
    INSERT INTO exercise_groups (name, description, "order", active)
    VALUES ('Rygg', 'Ryggøvelser', 1, true)
    RETURNING id INTO rygg_group_id;
  END IF;

  -- Oppdater alle eksisterende øvelser til å tilhøre "Rygg" gruppen
  UPDATE exercises
  SET exercise_group_id = rygg_group_id
  WHERE exercise_group_id IS NULL;
END $$;

-- ============================================
-- FERDIG!
-- ============================================
-- Alle eksisterende øvelser er nå knyttet til "Rygg" gruppen
-- Du kan nå opprette flere exercise groups og knytte øvelser til dem









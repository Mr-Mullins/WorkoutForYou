-- Migrering: Legg til user_id på exercises for å gjøre øvelser individuelle per bruker

-- Legg til user_id kolonne
ALTER TABLE exercises
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Migrer eksisterende data: Hent user_id fra tilknyttet exercise_group
UPDATE exercises e
SET user_id = eg.user_id
FROM exercise_groups eg
WHERE e.exercise_group_id = eg.id;

-- For øvelser uten gruppe (edge case), sett til standard bruker
UPDATE exercises
SET user_id = '83a7168d-dfff-402a-a6f9-973c6f3f631c'
WHERE user_id IS NULL;

-- Gjør user_id obligatorisk
ALTER TABLE exercises
ALTER COLUMN user_id SET NOT NULL;

-- Fjern gamle RLS-policyer
DROP POLICY IF EXISTS "Anyone can view active exercises" ON exercises;
DROP POLICY IF EXISTS "Authenticated users can manage exercises" ON exercises;

-- Nye RLS-policyer: kun tilgang til egne øvelser
CREATE POLICY "Users can view own exercises"
  ON exercises FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own exercises"
  ON exercises FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own exercises"
  ON exercises FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own exercises"
  ON exercises FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Opprett indeks for raskere spørringer
CREATE INDEX idx_exercises_user_id ON exercises(user_id);

-- Migrering: Legg til user_id på exercise_groups for å gjøre grupper individuelle per bruker

-- Legg til user_id kolonne
ALTER TABLE exercise_groups
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Migrer eksisterende data til spesifisert bruker
UPDATE exercise_groups
SET user_id = '83a7168d-dfff-402a-a6f9-973c6f3f631c'
WHERE user_id IS NULL;

-- Gjør user_id obligatorisk
ALTER TABLE exercise_groups
ALTER COLUMN user_id SET NOT NULL;

-- Fjern gamle RLS-policyer
DROP POLICY IF EXISTS "Anyone can view active exercise groups" ON exercise_groups;
DROP POLICY IF EXISTS "Authenticated users can manage exercise groups" ON exercise_groups;

-- Nye RLS-policyer: kun tilgang til egne grupper
CREATE POLICY "Users can view own exercise groups"
  ON exercise_groups FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own exercise groups"
  ON exercise_groups FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own exercise groups"
  ON exercise_groups FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own exercise groups"
  ON exercise_groups FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Opprett indeks for raskere spørringer
CREATE INDEX idx_exercise_groups_user_id ON exercise_groups(user_id);

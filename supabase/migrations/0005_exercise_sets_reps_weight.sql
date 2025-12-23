-- Legg til nye kolonner i exercises
ALTER TABLE exercises 
ADD COLUMN IF NOT EXISTS sets INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS reps INTEGER,
ADD COLUMN IF NOT EXISTS weight_unit TEXT DEFAULT 'kropp' CHECK (weight_unit IN ('kg', 'kropp'));

-- Opprett workout_sets tabell
CREATE TABLE IF NOT EXISTS workout_sets (
  id BIGSERIAL PRIMARY KEY,
  workout_id BIGINT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL,
  weight DECIMAL(5,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(workout_id, set_number)
);

-- RLS Policies for workout_sets
ALTER TABLE workout_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own workout sets"
  ON workout_sets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workouts 
      WHERE workouts.id = workout_sets.workout_id 
      AND workouts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own workout sets"
  ON workout_sets FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workouts 
      WHERE workouts.id = workout_sets.workout_id 
      AND workouts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own workout sets"
  ON workout_sets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workouts 
      WHERE workouts.id = workout_sets.workout_id 
      AND workouts.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workouts 
      WHERE workouts.id = workout_sets.workout_id 
      AND workouts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own workout sets"
  ON workout_sets FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workouts 
      WHERE workouts.id = workout_sets.workout_id 
      AND workouts.user_id = auth.uid()
    )
  );

-- Opprett indeks for raskere søk
CREATE INDEX IF NOT EXISTS idx_workout_sets_workout_id ON workout_sets(workout_id);







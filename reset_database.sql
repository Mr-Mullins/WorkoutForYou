-- ============================================
-- RESET DATABASE TIL OPPRINNELIG STRUKTUR
-- ============================================
-- Dette scriptet sletter alle tabeller og oppretter dem på nytt
-- med den opprinnelige strukturen (før workout groups)

-- ============================================
-- 1. SLETT ALLE EKSISTERENDE TABELLER
-- ============================================

-- Slett workout_completions hvis den finnes
DROP TABLE IF EXISTS workout_completions CASCADE;

-- Slett workouts tabellen (hvis den er workout-definisjoner, ikke completed workouts)
-- VI BEHOLDER workouts for completed workouts, så vi sletter bare hvis den har workout_group_id
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'workouts' AND column_name = 'workout_group_id'
  ) THEN
    DROP TABLE IF EXISTS workouts CASCADE;
  END IF;
END $$;

-- Slett workout_groups hvis den finnes
DROP TABLE IF EXISTS workout_groups CASCADE;

-- Slett exercises hvis den finnes (vil bli opprettet på nytt)
DROP TABLE IF EXISTS exercises CASCADE;

-- Slett user_profiles hvis den finnes (vil bli opprettet på nytt)
DROP TABLE IF EXISTS user_profiles CASCADE;

-- ============================================
-- 2. OPPRETT EXERCISES TABELLEN
-- ============================================

CREATE TABLE exercises (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  "order" INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- RLS Policies for exercises
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active exercises"
  ON exercises FOR SELECT
  USING (active = true);

CREATE POLICY "Authenticated users can manage exercises"
  ON exercises FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 3. OPPRETT WORKOUTS TABELLEN (for completed workouts)
-- ============================================

CREATE TABLE workouts (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id BIGINT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  completed_at DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(user_id, exercise_id, completed_at)
);

-- RLS Policies for workouts
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own workouts"
  ON workouts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own workouts"
  ON workouts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own workouts"
  ON workouts FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 4. OPPRETT USER_PROFILES TABELLEN
-- ============================================

CREATE TABLE user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- RLS Policies for user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 5. OPPRETT DATABASE TRIGGER FOR USER_PROFILES
-- ============================================

-- Trigger function for å automatisk opprette profil ved registrering
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger som kjøres når ny bruker opprettes
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 6. LEGG TIL EKSEMPELDATA (valgfritt)
-- ============================================

-- Legg til noen eksempel-øvelser hvis tabellen er tom
INSERT INTO exercises (title, description, "order", active)
VALUES 
  ('1. Liggende Bekkenvipp', '10-15 repetisjoner. Stram magen, press ryggen ned.', 1, true),
  ('2. Barnets stilling', 'Hold 30-60 sek. Pass på kneprotesen.', 2, true),
  ('3. Tøy hofteleddsbøyer', '30 sek per side. Ikke svai i ryggen.', 3, true),
  ('4. Fuglehunden', '3 x 10 reps. Løft lavt og kontrollert.', 4, true),
  ('5. Seteløft', '3 x 10 reps. Stopp når kroppen er rett.', 5, true)
ON CONFLICT DO NOTHING;

-- ============================================
-- FERDIG!
-- ============================================
-- Tabellene er nå opprettet med den opprinnelige strukturen:
-- - exercises: Øvelser som kan vises i Dashboard
-- - workouts: Lagrer completed workouts (user_id, exercise_id, completed_at)
-- - user_profiles: Brukerprofiler med fornavn, etternavn og profilbilde









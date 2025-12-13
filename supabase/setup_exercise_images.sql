-- ============================================
-- EXERCISE IMAGES SETUP
-- ============================================
-- Dette scriptet setter opp støtte for bilder på øvelser
-- Kopier hele filen og kjør i Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. OPPRETT EXERCISE_IMAGES TABELL
-- ============================================

CREATE TABLE IF NOT EXISTS exercise_images (
  id BIGSERIAL PRIMARY KEY,
  exercise_id BIGINT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Opprett indekser for raskere søk
CREATE INDEX IF NOT EXISTS idx_exercise_images_exercise_id ON exercise_images(exercise_id);
CREATE INDEX IF NOT EXISTS idx_exercise_images_order ON exercise_images(exercise_id, "order");

-- RLS Policies for exercise_images
ALTER TABLE exercise_images ENABLE ROW LEVEL SECURITY;

-- Alle kan se bilder (offentlig lesing)
CREATE POLICY "Public can view exercise images"
ON exercise_images FOR SELECT
USING (true);

-- Autentiserte brukere kan administrere bilder (for admin og fremtidig AI)
CREATE POLICY "Authenticated users can manage exercise images"
ON exercise_images FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ============================================
-- 2. OPPRETT STORAGE BUCKET FOR EXERCISE IMAGES
-- ============================================

-- Opprett exercise-images bucket hvis den ikke allerede eksisterer
INSERT INTO storage.buckets (id, name, public)
VALUES ('exercise-images', 'exercise-images', true)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for Storage Objects i exercise-images bucket

-- Tillat alle (inkludert ikke-autentiserte) å se bilder siden bucket er public
CREATE POLICY "Public can view exercise images"
ON storage.objects FOR SELECT
USING (bucket_id = 'exercise-images');

-- Tillat autentiserte brukere å laste opp bilder (for admin og fremtidig AI)
CREATE POLICY "Authenticated users can upload exercise images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'exercise-images' 
  AND auth.role() = 'authenticated'
);

-- Tillat autentiserte brukere å oppdatere bilder
CREATE POLICY "Authenticated users can update exercise images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'exercise-images' 
  AND auth.role() = 'authenticated'
)
WITH CHECK (
  bucket_id = 'exercise-images' 
  AND auth.role() = 'authenticated'
);

-- Tillat autentiserte brukere å slette bilder
CREATE POLICY "Authenticated users can delete exercise images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'exercise-images' 
  AND auth.role() = 'authenticated'
);

-- ============================================
-- FERDIG!
-- ============================================
-- Du kan nå:
-- 1. Last opp bilder i Admin panelet når du oppretter/redigerer øvelser
-- 2. Se bilder som thumbnails i Dashboard
-- ============================================


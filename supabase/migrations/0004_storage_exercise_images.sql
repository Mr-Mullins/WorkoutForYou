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



-- Opprett avatars bucket hvis den ikke allerede eksisterer
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for Storage Objects i avatars bucket

-- Tillat alle (inkludert ikke-autentiserte) å se bilder siden bucket er public
CREATE POLICY "Public can view avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Tillat autentiserte brukere å laste opp bilder som starter med deres user_id
CREATE POLICY "Authenticated users can upload own avatars"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
  AND name LIKE auth.uid()::text || '-%'
);

-- Tillat autentiserte brukere å oppdatere sine egne bilder
CREATE POLICY "Authenticated users can update own avatars"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
  AND name LIKE auth.uid()::text || '-%'
)
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
  AND name LIKE auth.uid()::text || '-%'
);

-- Tillat autentiserte brukere å slette sine egne bilder
CREATE POLICY "Authenticated users can delete own avatars"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
  AND name LIKE auth.uid()::text || '-%'
);


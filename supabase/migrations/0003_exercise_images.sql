-- Create exercise_images table to store image metadata for exercises
CREATE TABLE IF NOT EXISTS exercise_images (
  id BIGSERIAL PRIMARY KEY,
  exercise_id BIGINT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_exercise_images_exercise_id ON exercise_images(exercise_id);
CREATE INDEX IF NOT EXISTS idx_exercise_images_order ON exercise_images(exercise_id, "order");

-- RLS Policies for exercise_images
ALTER TABLE exercise_images ENABLE ROW LEVEL SECURITY;

-- Anyone can view exercise images (public read)
CREATE POLICY "Public can view exercise images"
ON exercise_images FOR SELECT
USING (true);

-- Authenticated users can manage exercise images (for admin upload via API and future AI)
CREATE POLICY "Authenticated users can manage exercise images"
ON exercise_images FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);



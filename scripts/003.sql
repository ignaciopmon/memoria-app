-- 1. Crear el bucket público para las imágenes de las tarjetas
INSERT INTO storage.buckets (id, name, public)
VALUES ('card-images', 'card-images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Política: Cualquier persona puede ver las imágenes (es un bucket público)
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'card-images' );

-- 3. Política: Solo los usuarios autenticados pueden subir imágenes
CREATE POLICY "Authenticated users can upload images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'card-images' AND 
  auth.role() = 'authenticated'
);

-- 4. Política: Solo el usuario dueño de la imagen puede borrarla/actualizarla
CREATE POLICY "Users can update their own images"
ON storage.objects FOR UPDATE
USING ( auth.uid() = owner )
WITH CHECK ( bucket_id = 'card-images' );

CREATE POLICY "Users can delete their own images"
ON storage.objects FOR DELETE
USING ( auth.uid() = owner AND bucket_id = 'card-images' );
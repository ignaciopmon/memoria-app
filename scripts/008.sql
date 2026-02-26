-- Añadir campos para guardar el PDF en el cuaderno
ALTER TABLE notebooks ADD COLUMN IF NOT EXISTS file_path TEXT;
ALTER TABLE notebooks ADD COLUMN IF NOT EXISTS file_name TEXT;

-- Añadir una regla para que el "upsert" (actualizar si existe, crear si no) funcione perfecto
ALTER TABLE notebook_assets DROP CONSTRAINT IF EXISTS unique_notebook_type;
ALTER TABLE notebook_assets ADD CONSTRAINT unique_notebook_type UNIQUE (notebook_id, type);
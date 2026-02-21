-- Función para crear configuración y atajos por defecto a los nuevos usuarios
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Insertar configuración por defecto (usará los defaults de la tabla)
  INSERT INTO public.user_settings (user_id)
  VALUES (new.id);
  
  -- Insertar atajos por defecto (usará los defaults de la tabla)
  INSERT INTO public.user_shortcuts (user_id)
  VALUES (new.id);
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Disparador (Trigger) que ejecuta la función al crear usuario
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
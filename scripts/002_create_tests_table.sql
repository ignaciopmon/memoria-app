create table if not exists user_tests (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  topic text,
  source_type text, -- 'topic' or 'pdf'
  difficulty text,
  language text,
  score int,
  total_questions int,
  questions jsonb, -- Guardamos las preguntas completas aquí
  user_answers jsonb, -- Tus respuestas
  ai_report text, -- El informe generado
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Habilitar seguridad (RLS)
alter table user_tests enable row level security;

create policy "Users can manage their own tests"
  on user_tests for all
  using (auth.uid() = user_id);
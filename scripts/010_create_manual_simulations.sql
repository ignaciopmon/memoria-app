-- Manual simulation entries
CREATE TABLE IF NOT EXISTS public.manual_simulation_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  rating TEXT,
  r_level TEXT,
  notes TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  session_date DATE,
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Manual simulation profile
CREATE TABLE IF NOT EXISTS public.manual_simulation_profile (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  weekly_goal INTEGER NOT NULL DEFAULT 4,
  focus_area TEXT,
  ritual TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.manual_simulation_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_simulation_profile ENABLE ROW LEVEL SECURITY;

-- Policies for manual_simulation_entries
CREATE POLICY "Users can view their own manual simulations"
  ON public.manual_simulation_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own manual simulations"
  ON public.manual_simulation_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own manual simulations"
  ON public.manual_simulation_entries FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own manual simulations"
  ON public.manual_simulation_entries FOR DELETE
  USING (auth.uid() = user_id);

-- Policies for manual_simulation_profile
CREATE POLICY "Users can manage their manual simulation profile"
  ON public.manual_simulation_profile
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create decks table
CREATE TABLE IF NOT EXISTS public.decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT, -- Añadido en un paso anterior
  is_folder BOOLEAN NOT NULL DEFAULT false, -- Añadido en un paso anterior
  parent_id UUID REFERENCES public.decks(id) ON DELETE SET NULL, -- Añadido en un paso anterior
  deleted_at TIMESTAMPTZ, -- Añadido en un paso anterior
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create cards table
CREATE TABLE IF NOT EXISTS public.cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID NOT NULL REFERENCES public.decks(id) ON DELETE CASCADE,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  ease_factor REAL NOT NULL DEFAULT 2.5,
  interval INTEGER NOT NULL DEFAULT 0,
  repetitions INTEGER NOT NULL DEFAULT 0,
  next_review_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_rating INTEGER, -- Añadido en un paso anterior
  front_image_url TEXT, -- NUEVA LÍNEA
  back_image_url TEXT,  -- NUEVA LÍNEA
  deleted_at TIMESTAMPTZ, -- Añadido en un paso anterior
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create card_reviews table for tracking study history
CREATE TABLE IF NOT EXISTS public.card_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 4),
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create user_settings and user_shortcuts tables (Añadidos en pasos anteriores)
CREATE TABLE IF NOT EXISTS public.user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    again_interval_minutes INTEGER NOT NULL DEFAULT 1,
    hard_interval_days INTEGER NOT NULL DEFAULT 1,
    good_interval_days INTEGER NOT NULL DEFAULT 3,
    easy_interval_days INTEGER NOT NULL DEFAULT 7,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_shortcuts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    flip_card TEXT NOT NULL DEFAULT ' ',
    to_dashboard TEXT NOT NULL DEFAULT 'd',
    rate_again TEXT NOT NULL DEFAULT '1',
    rate_hard TEXT NOT NULL DEFAULT '2',
    rate_good TEXT NOT NULL DEFAULT '3',
    rate_easy TEXT NOT NULL DEFAULT '4',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_decks_user_id ON public.decks(user_id);
CREATE INDEX IF NOT EXISTS idx_cards_deck_id ON public.cards(deck_id);
CREATE INDEX IF NOT EXISTS idx_cards_next_review_date ON public.cards(next_review_date);
CREATE INDEX IF NOT EXISTS idx_card_reviews_card_id ON public.card_reviews(card_id);

-- Enable Row Level Security
ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_shortcuts ENABLE ROW LEVEL SECURITY;


-- RLS Policies for decks
CREATE POLICY "Users can view their own decks"
  ON public.decks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own decks"
  ON public.decks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own decks"
  ON public.decks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own decks"
  ON public.decks FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for cards (through deck ownership)
CREATE POLICY "Users can view cards in their decks"
  ON public.cards FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.decks
      WHERE decks.id = cards.deck_id
      AND decks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert cards in their decks"
  ON public.cards FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.decks
      WHERE decks.id = cards.deck_id
      AND decks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update cards in their decks"
  ON public.cards FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.decks
      WHERE decks.id = cards.deck_id
      AND decks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete cards in their decks"
  ON public.cards FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.decks
      WHERE decks.id = cards.deck_id
      AND decks.user_id = auth.uid()
    )
  );

-- RLS Policies for card_reviews (through card ownership)
CREATE POLICY "Users can view reviews for their cards"
  ON public.card_reviews FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cards
      JOIN public.decks ON decks.id = cards.deck_id
      WHERE cards.id = card_reviews.card_id
      AND decks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert reviews for their cards"
  ON public.card_reviews FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cards
      JOIN public.decks ON decks.id = cards.deck_id
      WHERE cards.id = card_reviews.card_id
      AND decks.user_id = auth.uid()
    )
  );
  
-- RLS Policies for user_settings and user_shortcuts
CREATE POLICY "Users can manage their own settings"
  ON public.user_settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own shortcuts"
  ON public.user_shortcuts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
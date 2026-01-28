-- Create gmail_accounts table for storing connected Gmail accounts
CREATE TABLE public.gmail_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  is_primary BOOLEAN DEFAULT false,
  provider TEXT DEFAULT 'google_oauth',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, email)
);

-- Enable RLS
ALTER TABLE public.gmail_accounts ENABLE ROW LEVEL SECURITY;

-- Users can only see their own accounts
CREATE POLICY "Users can view own gmail accounts"
  ON public.gmail_accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own gmail accounts"
  ON public.gmail_accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own gmail accounts"
  ON public.gmail_accounts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own gmail accounts"
  ON public.gmail_accounts FOR DELETE
  USING (auth.uid() = user_id);
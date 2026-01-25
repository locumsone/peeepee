-- Create user_signatures table for storing email/SMS signature preferences
CREATE TABLE public.user_signatures (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    first_name TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT 'Clinical Consultant',
    company TEXT NOT NULL DEFAULT 'Locums One',
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.user_signatures ENABLE ROW LEVEL SECURITY;

-- Users can view their own signature
CREATE POLICY "Users can view their own signature"
ON public.user_signatures
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own signature
CREATE POLICY "Users can insert their own signature"
ON public.user_signatures
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own signature
CREATE POLICY "Users can update their own signature"
ON public.user_signatures
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own signature
CREATE POLICY "Users can delete their own signature"
ON public.user_signatures
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_signatures_updated_at
BEFORE UPDATE ON public.user_signatures
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();
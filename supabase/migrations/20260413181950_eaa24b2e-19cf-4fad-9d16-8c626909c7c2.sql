
-- Add views_count to posts
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS views_count integer DEFAULT 0;

-- Create hashtags table
CREATE TABLE IF NOT EXISTS public.hashtags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tag text NOT NULL,
  post_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.hashtags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hashtags viewable by everyone" ON public.hashtags FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create hashtags" ON public.hashtags FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Index for fast tag lookups
CREATE INDEX idx_hashtags_tag ON public.hashtags (tag);
CREATE INDEX idx_hashtags_post_id ON public.hashtags (post_id);

-- Function to increment view count
CREATE OR REPLACE FUNCTION public.increment_view_count(p_post_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.posts SET views_count = COALESCE(views_count, 0) + 1 WHERE id = p_post_id;
$$;


-- Warnings table for admin warnings to users
CREATE TABLE public.warnings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  admin_id UUID NOT NULL,
  reason TEXT NOT NULL,
  post_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.warnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own warnings" ON public.warnings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all warnings" ON public.warnings FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can create warnings" ON public.warnings FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Reactions table for emoji reactions on posts and comments
CREATE TABLE public.reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  post_id UUID,
  comment_id UUID,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id, emoji),
  UNIQUE(user_id, comment_id, emoji)
);
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reactions viewable by everyone" ON public.reactions FOR SELECT USING (true);
CREATE POLICY "Users can add reactions" ON public.reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove own reactions" ON public.reactions FOR DELETE USING (auth.uid() = user_id);

-- Add parent_id to comments for replies
ALTER TABLE public.comments ADD COLUMN parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE;

-- Add is_suspended to profiles
ALTER TABLE public.profiles ADD COLUMN is_suspended BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN suspension_reason TEXT;
ALTER TABLE public.profiles ADD COLUMN suspended_until TIMESTAMP WITH TIME ZONE;

-- Add gender and dob to profiles
ALTER TABLE public.profiles ADD COLUMN gender TEXT;
ALTER TABLE public.profiles ADD COLUMN dob DATE;

-- Function to auto-suspend after 3 warnings
CREATE OR REPLACE FUNCTION public.check_auto_suspension()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  warning_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO warning_count FROM public.warnings WHERE user_id = NEW.user_id;
  IF warning_count >= 3 THEN
    UPDATE public.profiles 
    SET is_suspended = true, 
        suspension_reason = 'Auto-suspended: 3+ warnings received'
    WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_suspension_check
AFTER INSERT ON public.warnings
FOR EACH ROW
EXECUTE FUNCTION public.check_auto_suspension();

-- Enable realtime for warnings
ALTER PUBLICATION supabase_realtime ADD TABLE public.warnings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reactions;

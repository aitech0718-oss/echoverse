
-- Drop existing FKs that point to auth.users
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_author_id_fkey;
ALTER TABLE public.comments DROP CONSTRAINT IF EXISTS comments_author_id_fkey;

-- Re-add FKs to profiles.user_id
ALTER TABLE public.posts 
  ADD CONSTRAINT posts_author_id_profiles_fkey 
  FOREIGN KEY (author_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.comments 
  ADD CONSTRAINT comments_author_id_profiles_fkey 
  FOREIGN KEY (author_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.notifications 
  ADD CONSTRAINT notifications_actor_id_profiles_fkey 
  FOREIGN KEY (actor_id) REFERENCES public.profiles(user_id) ON DELETE SET NULL;

ALTER TABLE public.notifications 
  ADD CONSTRAINT notifications_user_id_profiles_fkey 
  FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.friends 
  ADD CONSTRAINT friends_requester_id_profiles_fkey 
  FOREIGN KEY (requester_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.friends 
  ADD CONSTRAINT friends_addressee_id_profiles_fkey 
  FOREIGN KEY (addressee_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.messages 
  ADD CONSTRAINT messages_sender_id_profiles_fkey 
  FOREIGN KEY (sender_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.messages 
  ADD CONSTRAINT messages_receiver_id_profiles_fkey 
  FOREIGN KEY (receiver_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.reports 
  ADD CONSTRAINT reports_reporter_id_profiles_fkey 
  FOREIGN KEY (reporter_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;

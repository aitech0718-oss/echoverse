import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import PostCard from '@/components/PostCard';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { ImagePlus, X, Send } from 'lucide-react';
import { toast } from 'sonner';
import WarningBanner from '@/components/WarningBanner';

const NewsFeed = () => {
  const { user, profile, warnings } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [friendProfiles, setFriendProfiles] = useState<Record<string, { display_name: string; avatar_url: string | null }>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const isSuspended = profile?.is_suspended;

  const fetchFriendIds = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('friends')
      .select('requester_id, addressee_id')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
    const ids = (data || []).map(f => f.requester_id === user.id ? f.addressee_id : f.requester_id);
    setFriendIds(ids);

    // Fetch profiles for friends
    if (ids.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', ids);
      const map: Record<string, { display_name: string; avatar_url: string | null }> = {};
      (profiles || []).forEach(p => { map[p.user_id] = { display_name: p.display_name, avatar_url: p.avatar_url }; });
      setFriendProfiles(map);
    }

    return ids;
  };

  const fetchPosts = async () => {
    if (!user) return;
    const fIds = await fetchFriendIds() || [];

    // Fetch public posts + friends-only posts from friends + own posts
    const { data } = await supabase
      .from('posts')
      .select('*, profiles:author_id(display_name, avatar_url, username)')
      .order('created_at', { ascending: false })
      .limit(50);

    if (data) {
      // Filter: show public, own, and friends' friends-only posts
      const filtered = data.filter(p => {
        if (p.author_id === user.id) return true;
        if (p.visibility === 'public') return true;
        if (p.visibility === 'friends' && fIds.includes(p.author_id)) return true;
        return false;
      });

      const { data: userLikes } = await supabase.from('likes').select('post_id').eq('user_id', user.id);
      const likedIds = new Set(userLikes?.map(l => l.post_id));
      setPosts(filtered.map(p => ({ ...p, user_liked: likedIds.has(p.id) })));
    } else {
      setPosts([]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchPosts(); }, [user]);

  useEffect(() => {
    const channel = supabase
      .channel('feed-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => fetchPosts())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handlePost = async () => {
    if (!content.trim() && !imageFile) return;
    if (!user || isSuspended) return;
    setPosting(true);

    let image_url = null;
    if (imageFile) {
      const ext = imageFile.name.split('.').pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('media').upload(path, imageFile);
      if (!error) {
        const { data: urlData } = supabase.storage.from('media').getPublicUrl(path);
        image_url = urlData.publicUrl;
      }
    }

    const { error, data: newPost } = await supabase.from('posts').insert({ author_id: user.id, content: content.trim(), image_url }).select().single();
    setPosting(false);
    if (error) { toast.error('Failed to send your echo'); return; }

    // Extract and save hashtags
    if (newPost) {
      const tags = content.match(/#(\w+)/g);
      if (tags && tags.length > 0) {
        const hashtagRows = tags.map(t => ({ tag: t.replace('#', '').toLowerCase(), post_id: newPost.id }));
        await supabase.from('hashtags').insert(hashtagRows);
      }
    }

    setContent('');
    setImageFile(null);
    setImagePreview(null);
    fetchPosts();
  };

  const initials = profile?.display_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'U';

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Suspension Banner */}
        {isSuspended && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Account Suspended</AlertTitle>
            <AlertDescription>{profile?.suspension_reason || 'Your account has been suspended due to policy violations.'}</AlertDescription>
          </Alert>
        )}

        {/* Warning Banner - shows for 1 hour after issued */}
        <WarningBanner />

        {/* Echo Composer */}
        {!isSuspended && (
          <Card className="shadow-md border-primary/10">
            <CardContent className="pt-4">
              <div className="flex gap-3">
                <Avatar className="h-10 w-10 ring-2 ring-primary/20">
                  <AvatarImage src={profile?.avatar_url} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-3">
                  <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="What's echoing in your mind?" className="resize-none min-h-[60px] border-0 bg-muted/50 focus-visible:ring-primary/30" />
                  {imagePreview && (
                    <div className="relative inline-block rounded-xl overflow-hidden border-2 border-dashed border-primary/30 p-1">
                      <div className="absolute top-2 left-2 z-10">
                        <span className="text-xs font-semibold bg-primary/90 text-primary-foreground px-2 py-0.5 rounded-full">Draft Preview</span>
                      </div>
                      <img src={imagePreview} alt="Draft preview" className="rounded-lg max-h-48 object-cover" />
                      <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-6 w-6 z-10" onClick={() => { setImageFile(null); setImagePreview(null); }}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()} className="text-muted-foreground hover:text-primary">
                      <ImagePlus className="h-4 w-4 mr-1" />Attach
                    </Button>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
                    <Button size="sm" onClick={handlePost} disabled={posting || (!content.trim() && !imageFile)} className="echo-gradient text-primary-foreground border-0 hover:opacity-90 gap-1">
                      <Send className="h-3.5 w-3.5" />
                      {posting ? 'Echoing...' : 'Echo'}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
        ) : posts.length === 0 ? (
          <Card className="shadow-md"><CardContent className="py-12 text-center text-muted-foreground">No echoes yet. Be the first to send one into the verse!</CardContent></Card>
        ) : (
          posts.map(post => <PostCard key={post.id} post={post} onUpdate={fetchPosts} friends={friendIds} friendProfiles={friendProfiles} />)
        )}
      </main>
    </div>
  );
};

export default NewsFeed;

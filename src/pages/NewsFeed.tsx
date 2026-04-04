import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import PostCard from '@/components/PostCard';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ImagePlus, X } from 'lucide-react';
import { toast } from 'sonner';

const NewsFeed = () => {
  const { user, profile } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchPosts = async () => {
    const { data } = await supabase
      .from('posts')
      .select('*, profiles:author_id(display_name, avatar_url, username)')
      .order('created_at', { ascending: false })
      .limit(50);

    if (data && user) {
      const { data: userLikes } = await supabase.from('likes').select('post_id').eq('user_id', user.id);
      const likedIds = new Set(userLikes?.map(l => l.post_id));
      setPosts(data.map(p => ({ ...p, user_liked: likedIds.has(p.id) })));
    } else {
      setPosts(data || []);
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
    if (!user) return;
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

    const { error } = await supabase.from('posts').insert({ author_id: user.id, content: content.trim(), image_url });
    setPosting(false);
    if (error) { toast.error('Failed to create post'); return; }
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
        <Card>
          <CardContent className="pt-4">
            <div className="flex gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={profile?.avatar_url} />
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-3">
                <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="What's on your mind?" className="resize-none min-h-[60px]" />
                {imagePreview && (
                  <div className="relative inline-block">
                    <img src={imagePreview} alt="Preview" className="rounded-lg max-h-48 object-cover" />
                    <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => { setImageFile(null); setImagePreview(null); }}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
                    <ImagePlus className="h-4 w-4 mr-1" />Photo
                  </Button>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
                  <Button size="sm" onClick={handlePost} disabled={posting || (!content.trim() && !imageFile)}>
                    {posting ? 'Posting...' : 'Post'}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
        ) : posts.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No posts yet. Be the first to share something!</CardContent></Card>
        ) : (
          posts.map(post => <PostCard key={post.id} post={post} onUpdate={fetchPosts} />)
        )}
      </main>
    </div>
  );
};

export default NewsFeed;

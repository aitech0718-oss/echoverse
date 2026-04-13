import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import PostCard from '@/components/PostCard';
import Navbar from '@/components/Navbar';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Flame, TrendingUp, Clock, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';

type SortMode = 'hot' | 'top' | 'recent';

const Trending = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortMode, setSortMode] = useState<SortMode>('hot');
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [friendProfiles, setFriendProfiles] = useState<Record<string, { display_name: string; avatar_url: string | null }>>({});

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    // Fetch friends
    const { data: friendData } = await supabase
      .from('friends')
      .select('requester_id, addressee_id')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
    const fIds = (friendData || []).map(f => f.requester_id === user.id ? f.addressee_id : f.requester_id);
    setFriendIds(fIds);

    if (fIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('user_id, display_name, avatar_url').in('user_id', fIds);
      const map: Record<string, { display_name: string; avatar_url: string | null }> = {};
      (profiles || []).forEach(p => { map[p.user_id] = { display_name: p.display_name, avatar_url: p.avatar_url }; });
      setFriendProfiles(map);
    }

    // Fetch public posts
    let query = supabase
      .from('posts')
      .select('*, profiles:author_id(display_name, avatar_url, username)')
      .eq('visibility', 'public')
      .limit(50);

    if (sortMode === 'top') {
      query = query.order('likes_count', { ascending: false });
    } else if (sortMode === 'recent') {
      query = query.order('created_at', { ascending: false });
    } else {
      // Hot: order by a combination (likes + comments, recent)
      query = query.order('likes_count', { ascending: false }).order('created_at', { ascending: false });
    }

    const { data } = await query;

    if (data) {
      // For "hot" mode, score by engagement + recency
      let sorted = data;
      if (sortMode === 'hot') {
        sorted = [...data].sort((a, b) => {
          const hoursA = (Date.now() - new Date(a.created_at).getTime()) / 3600000;
          const hoursB = (Date.now() - new Date(b.created_at).getTime()) / 3600000;
          const scoreA = ((a.likes_count || 0) + (a.comments_count || 0) * 2) / Math.pow(hoursA + 2, 1.5);
          const scoreB = ((b.likes_count || 0) + (b.comments_count || 0) * 2) / Math.pow(hoursB + 2, 1.5);
          return scoreB - scoreA;
        });
      }

      const { data: userLikes } = await supabase.from('likes').select('post_id').eq('user_id', user.id);
      const likedIds = new Set(userLikes?.map(l => l.post_id));
      setPosts(sorted.map(p => ({ ...p, user_liked: likedIds.has(p.id) })));
    } else {
      setPosts([]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user, sortMode]);

  const sortOptions: { key: SortMode; label: string; icon: React.ReactNode }[] = [
    { key: 'hot', label: 'Resonating', icon: <Flame className="h-4 w-4" /> },
    { key: 'top', label: 'Amplified', icon: <Star className="h-4 w-4" /> },
    { key: 'recent', label: 'Fresh', icon: <Clock className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Header */}
        <Card className="border-primary/20 overflow-hidden">
          <div className="h-24 echo-gradient flex items-center justify-center relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.15),transparent_60%)]" />
            <div className="flex items-center gap-3 z-10">
              <TrendingUp className="h-8 w-8 text-primary-foreground" />
              <div>
                <h1 className="text-2xl font-bold text-primary-foreground">Trending Echoes</h1>
                <p className="text-primary-foreground/70 text-sm">Discover what's resonating across the verse</p>
              </div>
            </div>
          </div>
          <CardContent className="py-3 flex items-center gap-2 flex-wrap">
            {sortOptions.map(opt => (
              <Button
                key={opt.key}
                size="sm"
                variant={sortMode === opt.key ? 'default' : 'ghost'}
                onClick={() => setSortMode(opt.key)}
                className={sortMode === opt.key ? 'echo-gradient text-primary-foreground border-0' : ''}
              >
                {opt.icon}
                <span className="ml-1">{opt.label}</span>
              </Button>
            ))}
            <Badge variant="secondary" className="ml-auto text-xs">
              {posts.length} echoes
            </Badge>
          </CardContent>
        </Card>

        {/* Posts */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : posts.length === 0 ? (
          <Card className="shadow-md">
            <CardContent className="py-12 text-center text-muted-foreground">
              No trending echoes yet. Start the resonance!
            </CardContent>
          </Card>
        ) : (
          posts.map((post, i) => (
            <div key={post.id} className="relative">
              {i < 3 && (
                <Badge className="absolute -top-2 -left-2 z-10 echo-gradient text-primary-foreground border-0 text-xs px-2">
                  #{i + 1}
                </Badge>
              )}
              <PostCard post={post} onUpdate={fetchData} friends={friendIds} friendProfiles={friendProfiles} />
            </div>
          ))
        )}
      </main>
    </div>
  );
};

export default Trending;

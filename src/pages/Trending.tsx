import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import PostCard from '@/components/PostCard';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Flame, TrendingUp, Clock, Star, Hash, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';

type SortMode = 'hot' | 'top' | 'recent';

const Trending = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortMode, setSortMode] = useState<SortMode>('hot');
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [friendProfiles, setFriendProfiles] = useState<Record<string, { display_name: string; avatar_url: string | null }>>({});
  const [topTags, setTopTags] = useState<{ tag: string; count: number }[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

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

    // Fetch popular tags
    const { data: tagsData } = await supabase
      .from('hashtags')
      .select('tag')
      .order('created_at', { ascending: false })
      .limit(500);

    if (tagsData) {
      const tagCounts: Record<string, number> = {};
      tagsData.forEach(t => { tagCounts[t.tag] = (tagCounts[t.tag] || 0) + 1; });
      const sorted = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([tag, count]) => ({ tag, count }));
      setTopTags(sorted);
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
      query = query.order('likes_count', { ascending: false }).order('created_at', { ascending: false });
    }

    const { data } = await query;

    if (data) {
      let sorted = data;

      // Filter by selected tag
      if (selectedTag) {
        sorted = sorted.filter(p => p.content?.toLowerCase().includes(`#${selectedTag.toLowerCase()}`));
      }

      if (sortMode === 'hot') {
        sorted = [...sorted].sort((a, b) => {
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

  useEffect(() => { fetchData(); }, [user, sortMode, selectedTag]);

  const sortOptions: { key: SortMode; label: string; icon: React.ReactNode }[] = [
    { key: 'hot', label: 'Resonating', icon: <Flame className="h-4 w-4" /> },
    { key: 'top', label: 'Amplified', icon: <Star className="h-4 w-4" /> },
    { key: 'recent', label: 'Fresh', icon: <Clock className="h-4 w-4" /> },
  ];

  const formatCount = (n: number) => {
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Header */}
        <Card className="border-primary/20 overflow-hidden">
          <div className="h-28 echo-gradient flex items-center justify-center relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.15),transparent_60%)]" />
            <div className="flex items-center gap-3 z-10">
              <div className="h-14 w-14 rounded-2xl bg-primary-foreground/20 backdrop-blur-sm flex items-center justify-center">
                <TrendingUp className="h-8 w-8 text-primary-foreground" />
              </div>
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

        {/* Popular Tags */}
        {topTags.length > 0 && (
          <Card className="shadow-sm">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Hash className="h-4 w-4 text-primary" />
                Trending Tags
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="flex flex-wrap gap-2">
                {topTags.map(t => (
                  <button
                    key={t.tag}
                    onClick={() => setSelectedTag(selectedTag === t.tag ? null : t.tag)}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      selectedTag === t.tag
                        ? 'echo-gradient text-primary-foreground shadow-md'
                        : 'bg-muted hover:bg-accent text-foreground'
                    }`}
                  >
                    <Hash className="h-3 w-3" />
                    {t.tag}
                    <span className={`ml-1 ${selectedTag === t.tag ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                      {formatCount(t.count)}
                    </span>
                  </button>
                ))}
              </div>
              {selectedTag && (
                <button onClick={() => setSelectedTag(null)} className="text-xs text-primary hover:underline mt-2">
                  Clear filter
                </button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Posts */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : posts.length === 0 ? (
          <Card className="shadow-md">
            <CardContent className="py-12 text-center text-muted-foreground">
              {selectedTag ? `No echoes with #${selectedTag} yet.` : 'No trending echoes yet. Start the resonance!'}
            </CardContent>
          </Card>
        ) : (
          posts.map((post, i) => (
            <div key={post.id} className="relative">
              {i < 3 && (
                <div className="absolute -top-2 -left-2 z-10">
                  <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold shadow-lg ${
                    i === 0 ? 'bg-yellow-500 text-yellow-950' :
                    i === 1 ? 'bg-gray-300 text-gray-800' :
                    'bg-amber-700 text-amber-50'
                  }`}>
                    #{i + 1}
                    {i === 0 && ' 🏆'}
                  </div>
                </div>
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

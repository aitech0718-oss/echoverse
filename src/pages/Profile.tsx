import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import PostCard from '@/components/PostCard';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, Link as LinkIcon, Calendar, Edit, UserPlus, UserMinus, Ban } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

const Profile = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profileData, setProfileData] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [friendStatus, setFriendStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isOwn = user?.id === id;

  useEffect(() => {
    const fetchData = async () => {
      const { data: p } = await supabase.from('profiles').select('*').eq('user_id', id).single();
      setProfileData(p);

      const { data: postsData } = await supabase
        .from('posts')
        .select('*, profiles:author_id(display_name, avatar_url)')
        .eq('author_id', id!)
        .order('created_at', { ascending: false });

      if (postsData && user) {
        const { data: userLikes } = await supabase.from('likes').select('post_id').eq('user_id', user.id);
        const likedIds = new Set(userLikes?.map(l => l.post_id));
        setPosts(postsData.map(p => ({ ...p, user_liked: likedIds.has(p.id) })));
      } else {
        setPosts(postsData || []);
      }

      if (user && !isOwn) {
        const { data: f } = await supabase
          .from('friends')
          .select('status, requester_id')
          .or(`and(requester_id.eq.${user.id},addressee_id.eq.${id}),and(requester_id.eq.${id},addressee_id.eq.${user.id})`)
          .maybeSingle();
        setFriendStatus(f?.status || null);
      }
      setLoading(false);
    };
    if (id) fetchData();
  }, [id, user]);

  const sendFriendRequest = async () => {
    if (!user || !id) return;
    await supabase.from('friends').insert({ requester_id: user.id, addressee_id: id });
    await supabase.from('notifications').insert({ user_id: id, actor_id: user.id, type: 'friend_request', message: 'wants to resonate with you' });
    setFriendStatus('pending');
    toast.success('Resonance request sent!');
  };

  const removeFriend = async () => {
    if (!user || !id) return;
    await supabase.from('friends').delete().or(`and(requester_id.eq.${user.id},addressee_id.eq.${id}),and(requester_id.eq.${id},addressee_id.eq.${user.id})`);
    setFriendStatus(null);
    toast.success('Disconnected');
  };

  const blockUser = async () => {
    if (!user || !id) return;
    await supabase.from('blocked_users').insert({ blocker_id: user.id, blocked_id: id });
    toast.success('User muted from your verse');
  };

  if (loading) return <div className="min-h-screen bg-background"><Navbar /><div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div></div>;

  const initials = profileData?.display_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'U';

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <Card className="shadow-md overflow-hidden">
          <div className="h-32 echo-gradient opacity-80" />
          <CardContent className="relative pt-0 -mt-12">
            <div className="flex items-end gap-4 mb-4">
              <Avatar className="h-24 w-24 border-4 border-card shadow-lg">
                <AvatarImage src={profileData?.avatar_url} />
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 pb-1">
                <h1 className="text-xl font-bold">{profileData?.display_name}</h1>
                <p className="text-sm text-muted-foreground">@{profileData?.username}</p>
              </div>
              <div className="flex gap-2">
                {isOwn ? (
                  <Button size="sm" variant="outline" onClick={() => navigate('/profile/edit')}><Edit className="h-4 w-4 mr-1" />Edit Verse</Button>
                ) : (
                  <>
                    {friendStatus === 'accepted' && <Button size="sm" variant="outline" onClick={removeFriend}><UserMinus className="h-4 w-4 mr-1" />Disconnect</Button>}
                    {friendStatus === 'pending' && <Button size="sm" variant="outline" disabled>Pending</Button>}
                    {!friendStatus && <Button size="sm" className="echo-gradient text-primary-foreground border-0" onClick={sendFriendRequest}><UserPlus className="h-4 w-4 mr-1" />Resonate</Button>}
                    <Button size="sm" variant="ghost" onClick={blockUser}><Ban className="h-4 w-4" /></Button>
                  </>
                )}
              </div>
            </div>
            {profileData?.bio && <p className="text-sm mb-3">{profileData.bio}</p>}
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              {profileData?.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{profileData.location}</span>}
              {profileData?.website && <a href={profileData.website} target="_blank" className="flex items-center gap-1 text-primary hover:underline"><LinkIcon className="h-3 w-3" />{profileData.website}</a>}
              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Joined {formatDistanceToNow(new Date(profileData?.created_at), { addSuffix: true })}</span>
            </div>
          </CardContent>
        </Card>

        <h2 className="text-lg font-semibold">Echoes</h2>
        {posts.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">No echoes yet</CardContent></Card>
        ) : (
          posts.map(post => <PostCard key={post.id} post={post} onUpdate={() => {}} />)
        )}
      </main>
    </div>
  );
};

export default Profile;

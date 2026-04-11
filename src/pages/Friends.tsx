import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { UserPlus, UserCheck, UserX, Search, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

const Friends = () => {
  const { user } = useAuth();
  const [friends, setFriends] = useState<any[]>([]);
  const [incoming, setIncoming] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [friendUserIds, setFriendUserIds] = useState<Set<string>>(new Set());
  const [pendingUserIds, setPendingUserIds] = useState<Set<string>>(new Set());

  const fetchFriends = async () => {
    if (!user) return;
    const { data: allFriends } = await supabase
      .from('friends')
      .select('*, requester:requester_id(display_name, avatar_url, user_id), addressee:addressee_id(display_name, avatar_url, user_id)')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

    const accepted = (allFriends || []).filter(f => f.status === 'accepted');
    const pending = (allFriends || []).filter(f => f.status === 'pending');

    setFriends(accepted.map(f => f.requester_id === user.id ? { ...f, friend: f.addressee } : { ...f, friend: f.requester }));

    const incomingReqs = pending.filter(f => f.addressee_id === user.id);
    setIncoming(incomingReqs);

    // Build sets of all friend/pending user ids for filtering search results
    const fIds = new Set<string>();
    accepted.forEach(f => {
      fIds.add(f.requester_id === user.id ? f.addressee_id : f.requester_id);
    });
    setFriendUserIds(fIds);

    const pIds = new Set<string>();
    pending.forEach(f => {
      pIds.add(f.requester_id === user.id ? f.addressee_id : f.requester_id);
    });
    setPendingUserIds(pIds);

    setLoading(false);
  };

  useEffect(() => { fetchFriends(); }, [user]);

  const acceptRequest = async (id: string, requesterId: string) => {
    await supabase.from('friends').update({ status: 'accepted' }).eq('id', id);
    await supabase.from('notifications').insert({ user_id: requesterId, actor_id: user!.id, type: 'friend_accepted', message: 'is now resonating with you' });
    toast.success('Resonance established!');
    fetchFriends();
  };

  const declineRequest = async (id: string) => {
    await supabase.from('friends').update({ status: 'declined' }).eq('id', id);
    toast.info('Request declined');
    fetchFriends();
  };

  const removeFriend = async (id: string) => {
    await supabase.from('friends').delete().eq('id', id);
    toast.success('Disconnected');
    fetchFriends();
  };

  const searchUsers = async () => {
    if (!searchQuery.trim() || !user) return;
    const { data } = await supabase.from('profiles').select('*').or(`display_name.ilike.%${searchQuery}%,username.ilike.%${searchQuery}%`).neq('user_id', user.id).limit(20);
    setSearchResults(data || []);
  };

  const sendRequest = async (userId: string) => {
    if (!user) return;
    const { error } = await supabase.from('friends').insert({ requester_id: user.id, addressee_id: userId });
    if (error?.code === '23505') { toast.info('Request already sent'); return; }
    if (error) { toast.error('Failed to send request'); return; }
    await supabase.from('notifications').insert({ user_id: userId, actor_id: user.id, type: 'friend_request', message: 'wants to resonate with you' });
    toast.success('Resonance request sent!');
    setPendingUserIds(prev => new Set(prev).add(userId));
  };

  const getButtonForUser = (userId: string) => {
    if (friendUserIds.has(userId)) {
      return <Button size="sm" variant="outline" disabled><UserCheck className="h-4 w-4 mr-1" />Resonating</Button>;
    }
    if (pendingUserIds.has(userId)) {
      return <Button size="sm" variant="outline" disabled><Clock className="h-4 w-4 mr-1" />Pending</Button>;
    }
    return <Button size="sm" className="echo-gradient text-primary-foreground border-0" onClick={() => sendRequest(userId)}><UserPlus className="h-4 w-4 mr-1" />Resonate</Button>;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-6">
        <Tabs defaultValue="friends">
          <TabsList className="mb-4">
            <TabsTrigger value="friends">Resonators</TabsTrigger>
            <TabsTrigger value="requests">Requests {incoming.length > 0 && `(${incoming.length})`}</TabsTrigger>
            <TabsTrigger value="search">Discover</TabsTrigger>
          </TabsList>

          <TabsContent value="friends">
            {loading ? <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div> :
            friends.length === 0 ? <Card><CardContent className="py-8 text-center text-muted-foreground">No resonators yet. Discover people to connect with!</CardContent></Card> :
            <div className="grid gap-3">{friends.map(f => (
              <Card key={f.id} className="animate-fade-in">
                <CardContent className="flex items-center gap-3 py-3">
                  <Link to={`/profile/${f.friend?.user_id}`}><Avatar><AvatarImage src={f.friend?.avatar_url} /><AvatarFallback className="bg-primary text-primary-foreground">{f.friend?.display_name?.[0]}</AvatarFallback></Avatar></Link>
                  <Link to={`/profile/${f.friend?.user_id}`} className="flex-1 font-medium hover:underline">{f.friend?.display_name}</Link>
                  <Button variant="outline" size="sm" onClick={() => removeFriend(f.id)}><UserX className="h-4 w-4" /></Button>
                </CardContent>
              </Card>
            ))}</div>}
          </TabsContent>

          <TabsContent value="requests">
            {incoming.length === 0 ? <Card><CardContent className="py-8 text-center text-muted-foreground">No pending resonance requests</CardContent></Card> :
            <div className="grid gap-3">{incoming.map(r => (
              <Card key={r.id} className="animate-fade-in">
                <CardContent className="flex items-center gap-3 py-3">
                  <Avatar><AvatarImage src={r.requester?.avatar_url} /><AvatarFallback className="bg-primary text-primary-foreground">{r.requester?.display_name?.[0]}</AvatarFallback></Avatar>
                  <span className="flex-1 font-medium">{r.requester?.display_name}</span>
                  <Button size="sm" onClick={() => acceptRequest(r.id, r.requester_id)}><UserCheck className="h-4 w-4 mr-1" />Accept</Button>
                  <Button size="sm" variant="outline" onClick={() => declineRequest(r.id)}><UserX className="h-4 w-4" /></Button>
                </CardContent>
              </Card>
            ))}</div>}
          </TabsContent>

          <TabsContent value="search">
            <div className="flex gap-2 mb-4">
              <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search the verse..." onKeyDown={e => e.key === 'Enter' && searchUsers()} />
              <Button onClick={searchUsers}><Search className="h-4 w-4" /></Button>
            </div>
            <div className="grid gap-3">{searchResults.map(u => (
              <Card key={u.id} className="animate-fade-in">
                <CardContent className="flex items-center gap-3 py-3">
                  <Link to={`/profile/${u.user_id}`}><Avatar><AvatarImage src={u.avatar_url} /><AvatarFallback className="bg-primary text-primary-foreground">{u.display_name?.[0]}</AvatarFallback></Avatar></Link>
                  <div className="flex-1 min-w-0">
                    <Link to={`/profile/${u.user_id}`} className="font-medium hover:underline block truncate">{u.display_name}</Link>
                    <span className="text-xs text-muted-foreground">@{u.username}</span>
                  </div>
                  {getButtonForUser(u.user_id)}
                </CardContent>
              </Card>
            ))}</div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Friends;

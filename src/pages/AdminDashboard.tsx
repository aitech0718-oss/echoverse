import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Users, Volume2, Flag, MessageCircle, TrendingUp, ShieldAlert, Search, Eye, Trash2, CheckCircle, XCircle, Activity, AlertTriangle, Ban } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

const AdminDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ users: 0, posts: 0, reports: 0, messages: 0, comments: 0, likes: 0 });
  const [users, setUsers] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [recentPosts, setRecentPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userSearch, setUserSearch] = useState('');
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [tab, setTab] = useState('overview');
  const [warnDialog, setWarnDialog] = useState<{ userId: string; userName: string; postId?: string } | null>(null);
  const [warnReason, setWarnReason] = useState('');
  const [suspendDialog, setSuspendDialog] = useState<{ userId: string; userName: string } | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [userWarnings, setUserWarnings] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchData = async () => {
      const [
        { count: uc }, { count: pc }, { count: rc },
        { count: mc }, { count: cc }, { count: lc }
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('posts').select('*', { count: 'exact', head: true }),
        supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('messages').select('*', { count: 'exact', head: true }),
        supabase.from('comments').select('*', { count: 'exact', head: true }),
        supabase.from('likes').select('*', { count: 'exact', head: true }),
      ]);
      setStats({ users: uc || 0, posts: pc || 0, reports: rc || 0, messages: mc || 0, comments: cc || 0, likes: lc || 0 });

      const { data: userData } = await supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(100);
      setUsers(userData || []);

      // Fetch warning counts for users
      const { data: warningData } = await supabase.from('warnings').select('user_id');
      const wCounts: Record<string, number> = {};
      (warningData || []).forEach(w => { wCounts[w.user_id] = (wCounts[w.user_id] || 0) + 1; });
      setUserWarnings(wCounts);

      const { data: reportData } = await supabase
        .from('reports')
        .select('*, reporter:reporter_id(display_name, avatar_url), post:post_id(content, author_id)')
        .order('created_at', { ascending: false }).limit(50);
      setReports(reportData || []);

      const { data: postData } = await supabase
        .from('posts')
        .select('*, profiles:author_id(display_name, avatar_url)')
        .order('created_at', { ascending: false }).limit(20);
      setRecentPosts(postData || []);

      setLoading(false);
    };
    fetchData();
  }, []);

  const handleReportAction = async (reportId: string, status: string) => {
    const notes = adminNotes[reportId] || `${status} by admin`;
    await supabase.from('reports').update({ status, admin_notes: notes }).eq('id', reportId);
    setReports(prev => prev.map(r => r.id === reportId ? { ...r, status, admin_notes: notes } : r));
    toast.success(`Report ${status}`);
  };

  const deletePost = async (postId: string, authorId?: string, reportId?: string, reason?: string) => {
    await supabase.from('posts').delete().eq('id', postId);
    if (reportId) {
      const notes = reason || 'Echo silenced by admin';
      await supabase.from('reports').update({ status: 'resolved', admin_notes: notes }).eq('id', reportId);
      setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: 'resolved' } : r));
    }
    setRecentPosts(prev => prev.filter(p => p.id !== postId));
    // Send warning to post author
    if (authorId && user) {
      const warnMsg = reason || 'Your echo was removed for violating community guidelines';
      await supabase.from('warnings').insert({ user_id: authorId, admin_id: user.id, reason: warnMsg, post_id: postId });
      await supabase.from('notifications').insert({
        user_id: authorId, actor_id: user.id, type: 'warning',
        message: `⚠️ Warning: ${warnMsg}`
      });
      setUserWarnings(prev => ({ ...prev, [authorId]: (prev[authorId] || 0) + 1 }));
    }
    toast.success('Echo silenced & warning sent');
  };

  const sendWarning = async () => {
    if (!warnDialog || !warnReason.trim() || !user) return;
    await supabase.from('warnings').insert({ user_id: warnDialog.userId, admin_id: user.id, reason: warnReason, post_id: warnDialog.postId || null });
    await supabase.from('notifications').insert({
      user_id: warnDialog.userId, actor_id: user.id, type: 'warning',
      message: `⚠️ Warning: ${warnReason}`
    });
    setUserWarnings(prev => ({ ...prev, [warnDialog.userId]: (prev[warnDialog.userId] || 0) + 1 }));
    toast.success(`Warning sent to ${warnDialog.userName}`);
    setWarnDialog(null);
    setWarnReason('');
  };

  const suspendUser = async () => {
    if (!suspendDialog || !suspendReason.trim() || !user) return;
    await supabase.from('profiles').update({ is_suspended: true, suspension_reason: suspendReason } as any).eq('user_id', suspendDialog.userId);
    await supabase.from('notifications').insert({
      user_id: suspendDialog.userId, actor_id: user.id, type: 'suspension',
      message: `🚫 Account suspended: ${suspendReason}`
    });
    setUsers(prev => prev.map(u => u.user_id === suspendDialog.userId ? { ...u, is_suspended: true } : u));
    toast.success(`${suspendDialog.userName} suspended`);
    setSuspendDialog(null);
    setSuspendReason('');
  };

  const unsuspendUser = async (userId: string) => {
    await supabase.from('profiles').update({ is_suspended: false, suspension_reason: null } as any).eq('user_id', userId);
    setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, is_suspended: false } : u));
    toast.success('Suspension lifted');
  };

  const filteredUsers = users.filter(u =>
    !userSearch || u.display_name?.toLowerCase().includes(userSearch.toLowerCase()) || u.username?.toLowerCase().includes(userSearch.toLowerCase())
  );

  const pendingReports = reports.filter(r => r.status === 'pending');
  const resolvedReports = reports.filter(r => r.status !== 'pending');

  if (loading) return <div className="min-h-screen bg-background"><Navbar /><div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div></div>;

  const StatCard = ({ icon: Icon, label, value, color = 'text-primary', bg = 'bg-primary/10' }: any) => (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="flex items-center gap-4 py-5">
        <div className={`h-12 w-12 rounded-xl ${bg} flex items-center justify-center`}>
          <Icon className={`h-6 w-6 ${color}`} />
        </div>
        <div>
          <p className="text-3xl font-bold">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShieldAlert className="h-6 w-6 text-primary" /> Command Center
            </h1>
            <p className="text-sm text-muted-foreground">Admin dashboard for EchoVerse management</p>
          </div>
          {pendingReports.length > 0 && (
            <Badge variant="destructive" className="animate-pulse text-sm px-3 py-1">
              {pendingReports.length} Pending Flag{pendingReports.length > 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard icon={Users} label="Voices" value={stats.users} />
          <StatCard icon={Volume2} label="Echoes" value={stats.posts} color="text-blue-500" bg="bg-blue-500/10" />
          <StatCard icon={MessageCircle} label="Whispers" value={stats.messages} color="text-green-500" bg="bg-green-500/10" />
          <StatCard icon={Activity} label="Comments" value={stats.comments} color="text-purple-500" bg="bg-purple-500/10" />
          <StatCard icon={TrendingUp} label="Resonances" value={stats.likes} color="text-pink-500" bg="bg-pink-500/10" />
          <StatCard icon={Flag} label="Pending Flags" value={stats.reports} color="text-destructive" bg="bg-destructive/10" />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-4 w-full max-w-lg">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="reports" className="relative">
              Flags {pendingReports.length > 0 && <span className="ml-1 bg-destructive text-destructive-foreground rounded-full text-[10px] px-1.5">{pendingReports.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="users">Voices</TabsTrigger>
            <TabsTrigger value="content">Content</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Recent Voices</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {users.slice(0, 5).map(u => (
                    <div key={u.id} className="flex items-center gap-3 py-1.5">
                      <Avatar className="h-8 w-8"><AvatarImage src={u.avatar_url} /><AvatarFallback className="bg-primary text-primary-foreground text-xs">{u.display_name?.[0]}</AvatarFallback></Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <p className="font-medium text-sm truncate">{u.display_name}</p>
                          {u.is_suspended && <Badge variant="destructive" className="text-[10px] px-1">Suspended</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">@{u.username}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Flag className="h-4 w-4 text-destructive" /> Recent Flags</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {reports.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">No flags — the verse is peaceful ✨</p> :
                    reports.slice(0, 5).map(r => (
                      <div key={r.id} className="flex items-center gap-3 py-1.5">
                        <Badge variant={r.status === 'pending' ? 'destructive' : 'secondary'} className="text-xs">{r.status}</Badge>
                        <p className="text-sm flex-1 truncate">{r.reason}</p>
                        <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
                      </div>
                    ))
                  }
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="reports" className="space-y-4 mt-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase">Pending Flags ({pendingReports.length})</h3>
            {pendingReports.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">🎉 No pending flags!</CardContent></Card>
            ) : pendingReports.map(r => (
              <Card key={r.id} className="animate-fade-in border-destructive/20">
                <CardContent className="py-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7"><AvatarImage src={r.reporter?.avatar_url} /><AvatarFallback className="text-xs bg-muted">{r.reporter?.display_name?.[0]}</AvatarFallback></Avatar>
                      <p className="text-sm"><span className="font-medium">{r.reporter?.display_name}</span> <span className="text-muted-foreground">flagged</span></p>
                    </div>
                    <Badge variant="destructive">{r.status}</Badge>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Reason</p>
                    <p className="text-sm">{r.reason}</p>
                  </div>
                  {r.post && (
                    <div className="bg-muted/30 rounded-lg p-3 border-l-2 border-primary/30">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Flagged Echo</p>
                      <p className="text-sm">{r.post.content?.substring(0, 300)}</p>
                    </div>
                  )}
                  <div>
                    <Textarea placeholder="Admin remark (will be sent to user as warning)..." value={adminNotes[r.id] || ''} onChange={e => setAdminNotes(prev => ({ ...prev, [r.id]: e.target.value }))} rows={2} className="text-sm mb-2" />
                    <div className="flex gap-2 flex-wrap">
                      {r.post_id && (
                        <Button size="sm" variant="destructive" onClick={() => deletePost(r.post_id, r.post?.author_id, r.id, adminNotes[r.id])}>
                          <Trash2 className="h-3 w-3 mr-1" />Silence Echo + Warn
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => handleReportAction(r.id, 'reviewed')}><Eye className="h-3 w-3 mr-1" />Mark Reviewed</Button>
                      <Button size="sm" variant="ghost" onClick={() => handleReportAction(r.id, 'dismissed')}><XCircle className="h-3 w-3 mr-1" />Dismiss</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {resolvedReports.length > 0 && (
              <>
                <h3 className="font-semibold text-sm text-muted-foreground uppercase mt-6">Resolved ({resolvedReports.length})</h3>
                {resolvedReports.slice(0, 10).map(r => (
                  <Card key={r.id} className="opacity-70">
                    <CardContent className="flex items-center gap-3 py-3">
                      <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                      <p className="text-sm flex-1 truncate">{r.reason}</p>
                      <Badge variant="secondary">{r.status}</Badge>
                      <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
          </TabsContent>

          <TabsContent value="users" className="space-y-4 mt-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search voices..." value={userSearch} onChange={e => setUserSearch(e.target.value)} className="pl-9" />
              </div>
            </div>
            <div className="grid gap-2">
              {filteredUsers.map(u => (
                <Card key={u.id} className="animate-fade-in hover:shadow-sm transition-shadow">
                  <CardContent className="flex items-center gap-3 py-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={u.avatar_url} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">{u.display_name?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{u.display_name}</p>
                        {u.is_online && <span className="h-2 w-2 bg-green-500 rounded-full" />}
                        {u.is_suspended && <Badge variant="destructive" className="text-[10px] px-1">Suspended</Badge>}
                        {(userWarnings[u.user_id] || 0) > 0 && (
                          <Badge variant="outline" className="text-[10px] text-yellow-600 border-yellow-500/30">
                            ⚠️ {userWarnings[u.user_id]} warning{userWarnings[u.user_id] > 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">@{u.username}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Send Warning"
                        onClick={() => setWarnDialog({ userId: u.user_id, userName: u.display_name })}>
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      </Button>
                      {u.is_suspended ? (
                        <Button variant="outline" size="sm" onClick={() => unsuspendUser(u.user_id)}>Unsuspend</Button>
                      ) : (
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Suspend"
                          onClick={() => setSuspendDialog({ userId: u.user_id, userName: u.display_name })}>
                          <Ban className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="content" className="space-y-3 mt-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase">Recent Echoes</h3>
            {recentPosts.map(p => (
              <Card key={p.id} className="animate-fade-in">
                <CardContent className="py-3">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-8 w-8"><AvatarImage src={p.profiles?.avatar_url} /><AvatarFallback className="bg-primary text-primary-foreground text-xs">{p.profiles?.display_name?.[0]}</AvatarFallback></Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{p.profiles?.display_name}</p>
                        <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}</span>
                        <Badge variant="outline" className="text-[10px]">{p.visibility}</Badge>
                      </div>
                      <p className="text-sm mt-1">{p.content?.substring(0, 200)}</p>
                      {p.image_url && <img src={p.image_url} alt="" className="rounded-lg mt-2 max-h-32 object-cover" />}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span>❤️ {p.likes_count || 0}</span>
                        <span>💬 {p.comments_count || 0}</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => deletePost(p.id, p.author_id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </main>

      {/* Warning Dialog */}
      <Dialog open={!!warnDialog} onOpenChange={() => setWarnDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-yellow-500" /> Warn {warnDialog?.userName}</DialogTitle>
          </DialogHeader>
          <Textarea placeholder="Warning reason..." value={warnReason} onChange={e => setWarnReason(e.target.value)} rows={3} />
          <p className="text-xs text-muted-foreground">Current warnings: {userWarnings[warnDialog?.userId || ''] || 0}/3. At 3 warnings, the account is auto-suspended.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWarnDialog(null)}>Cancel</Button>
            <Button className="bg-yellow-500 hover:bg-yellow-600 text-white" onClick={sendWarning} disabled={!warnReason.trim()}>Send Warning</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend Dialog */}
      <Dialog open={!!suspendDialog} onOpenChange={() => setSuspendDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Ban className="h-5 w-5 text-destructive" /> Suspend {suspendDialog?.userName}</DialogTitle>
          </DialogHeader>
          <Textarea placeholder="Suspension reason..." value={suspendReason} onChange={e => setSuspendReason(e.target.value)} rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={suspendUser} disabled={!suspendReason.trim()}>Suspend Account</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;

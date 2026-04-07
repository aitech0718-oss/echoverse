import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, Volume2, Flag } from 'lucide-react';
import { toast } from 'sonner';

const AdminDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ users: 0, posts: 0, reports: 0 });
  const [users, setUsers] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const [{ count: uc }, { count: pc }, { count: rc }] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('posts').select('*', { count: 'exact', head: true }),
        supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);
      setStats({ users: uc || 0, posts: pc || 0, reports: rc || 0 });

      const { data: userData } = await supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(50);
      setUsers(userData || []);

      const { data: reportData } = await supabase
        .from('reports')
        .select('*, reporter:reporter_id(display_name), post:post_id(content, author_id)')
        .order('created_at', { ascending: false }).limit(50);
      setReports(reportData || []);
      setLoading(false);
    };
    fetchData();
  }, []);

  const handleReportAction = async (reportId: string, status: string) => {
    await supabase.from('reports').update({ status, admin_notes: `${status} by admin` }).eq('id', reportId);
    setReports(prev => prev.map(r => r.id === reportId ? { ...r, status } : r));
    toast.success(`Report ${status}`);
  };

  const deletePost = async (postId: string, reportId: string) => {
    await supabase.from('posts').delete().eq('id', postId);
    await supabase.from('reports').update({ status: 'resolved', admin_notes: 'Echo silenced by admin' }).eq('id', reportId);
    setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: 'resolved' } : r));
    toast.success('Echo silenced');
  };

  if (loading) return <div className="min-h-screen bg-background"><Navbar /><div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div></div>;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <h1 className="text-2xl font-bold">Command Center</h1>
        
        <div className="grid grid-cols-3 gap-4">
          <Card className="shadow-sm"><CardContent className="flex items-center gap-3 py-4"><Users className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{stats.users}</p><p className="text-sm text-muted-foreground">Voices</p></div></CardContent></Card>
          <Card className="shadow-sm"><CardContent className="flex items-center gap-3 py-4"><Volume2 className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{stats.posts}</p><p className="text-sm text-muted-foreground">Echoes</p></div></CardContent></Card>
          <Card className="shadow-sm"><CardContent className="flex items-center gap-3 py-4"><Flag className="h-8 w-8 text-destructive" /><div><p className="text-2xl font-bold">{stats.reports}</p><p className="text-sm text-muted-foreground">Flags</p></div></CardContent></Card>
        </div>

        <Tabs defaultValue="reports">
          <TabsList>
            <TabsTrigger value="reports">Flagged Echoes</TabsTrigger>
            <TabsTrigger value="users">Voices</TabsTrigger>
          </TabsList>

          <TabsContent value="reports" className="space-y-3 mt-4">
            {reports.length === 0 ? <Card><CardContent className="py-8 text-center text-muted-foreground">No flags</CardContent></Card> :
            reports.map(r => (
              <Card key={r.id} className="animate-fade-in">
                <CardContent className="py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm"><span className="font-medium">{r.reporter?.display_name}</span> flagged: <span className="text-muted-foreground">{r.reason}</span></p>
                    <Badge variant={r.status === 'pending' ? 'destructive' : 'secondary'}>{r.status}</Badge>
                  </div>
                  {r.post && <p className="text-sm bg-muted p-2 rounded-lg">{r.post.content?.substring(0, 200)}</p>}
                  {r.status === 'pending' && (
                    <div className="flex gap-2">
                      {r.post_id && <Button size="sm" variant="destructive" onClick={() => deletePost(r.post_id, r.id)}>Silence Echo</Button>}
                      <Button size="sm" variant="outline" onClick={() => handleReportAction(r.id, 'dismissed')}>Dismiss</Button>
                      <Button size="sm" variant="outline" onClick={() => handleReportAction(r.id, 'reviewed')}>Mark Reviewed</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="users" className="space-y-3 mt-4">
            {users.map(u => (
              <Card key={u.id} className="animate-fade-in">
                <CardContent className="flex items-center gap-3 py-3">
                  <Avatar className="h-9 w-9"><AvatarImage src={u.avatar_url} /><AvatarFallback className="bg-primary text-primary-foreground text-xs">{u.display_name?.[0]}</AvatarFallback></Avatar>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{u.display_name}</p>
                    <p className="text-xs text-muted-foreground">@{u.username}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminDashboard;

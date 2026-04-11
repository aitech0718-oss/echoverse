import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Check, CheckCheck, AlertTriangle, Ban } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const Notifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*, actor:actor_id(display_name, avatar_url)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setNotifications(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchNotifications(); }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('notifications-page')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => fetchNotifications())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const getIcon = (type: string) => {
    if (type === 'warning') return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    if (type === 'suspension') return <Ban className="h-4 w-4 text-destructive" />;
    return null;
  };

  const getBorderClass = (type: string, isRead: boolean) => {
    if (type === 'warning') return 'border-yellow-500/40 bg-yellow-500/5';
    if (type === 'suspension') return 'border-destructive/40 bg-destructive/5';
    if (!isRead) return 'border-primary/30 bg-primary/5 shadow-sm';
    return '';
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Reverberations</h1>
          <Button variant="ghost" size="sm" onClick={markAllRead}><CheckCheck className="h-4 w-4 mr-1" />Mark all heard</Button>
        </div>
        {loading ? <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div> :
        notifications.length === 0 ? <Card><CardContent className="py-8 text-center text-muted-foreground">No reverberations yet</CardContent></Card> :
        notifications.map(n => (
          <Card key={n.id} className={`animate-fade-in transition-all ${getBorderClass(n.type, n.is_read)}`}>
            <CardContent className="flex items-center gap-3 py-3">
              {getIcon(n.type) || (
                <Avatar className="h-9 w-9">
                  <AvatarImage src={n.actor?.avatar_url} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">{n.actor?.display_name?.[0] || '?'}</AvatarFallback>
                </Avatar>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm"><span className="font-medium">{n.actor?.display_name || 'System'}</span> {n.message}</p>
                <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
              </div>
              {!n.is_read && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => markRead(n.id)}><Check className="h-4 w-4" /></Button>}
            </CardContent>
          </Card>
        ))}
      </main>
    </div>
  );
};

export default Notifications;

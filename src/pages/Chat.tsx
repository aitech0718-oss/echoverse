import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const Chat = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    const fetchConversations = async () => {
      const { data: friends } = await supabase
        .from('friends')
        .select('*, requester:requester_id(display_name, avatar_url, user_id), addressee:addressee_id(display_name, avatar_url, user_id)')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
      
      const convos = (friends || []).map(f => 
        f.requester_id === user.id ? f.addressee : f.requester
      );
      setConversations(convos);
    };
    fetchConversations();
  }, [user]);

  useEffect(() => {
    if (!selectedUser || !user) return;
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${selectedUser.user_id}),and(sender_id.eq.${selectedUser.user_id},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });
      setMessages(data || []);
      
      await supabase.from('messages').update({ is_read: true })
        .eq('sender_id', selectedUser.user_id).eq('receiver_id', user.id).eq('is_read', false);
    };
    fetchMessages();

    const channel = supabase
      .channel(`chat-${selectedUser.user_id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new as any;
        if ((msg.sender_id === user.id && msg.receiver_id === selectedUser.user_id) ||
            (msg.sender_id === selectedUser.user_id && msg.receiver_id === user.id)) {
          setMessages(prev => [...prev, msg]);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedUser, user]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || !selectedUser) return;
    await supabase.from('messages').insert({ sender_id: user.id, receiver_id: selectedUser.user_id, content: newMessage.trim() });
    setNewMessage('');
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="grid md:grid-cols-[280px_1fr] gap-4 h-[calc(100vh-120px)]">
          <Card className="overflow-y-auto">
            <CardContent className="p-2">
              <h3 className="font-semibold text-sm px-2 py-2 text-muted-foreground uppercase tracking-wider">Whispers</h3>
              {conversations.length === 0 ? <p className="text-sm text-muted-foreground p-2">Connect with resonators to start whispering</p> :
              conversations.map(c => (
                <button key={c.user_id} onClick={() => setSelectedUser(c)}
                  className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors hover:bg-accent ${selectedUser?.user_id === c.user_id ? 'bg-accent' : ''}`}>
                  <Avatar className="h-9 w-9"><AvatarImage src={c.avatar_url} /><AvatarFallback className="bg-primary text-primary-foreground text-xs">{c.display_name?.[0]}</AvatarFallback></Avatar>
                  <span className="text-sm font-medium truncate">{c.display_name}</span>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="flex flex-col">
            {selectedUser ? (
              <>
                <div className="flex items-center gap-3 p-4 border-b">
                  <Avatar className="h-8 w-8"><AvatarImage src={selectedUser.avatar_url} /><AvatarFallback className="bg-primary text-primary-foreground text-xs">{selectedUser.display_name?.[0]}</AvatarFallback></Avatar>
                  <span className="font-semibold text-sm">{selectedUser.display_name}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.map(m => (
                    <div key={m.id} className={`flex ${m.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm ${m.sender_id === user?.id ? 'echo-gradient text-primary-foreground' : 'bg-muted'}`}>
                        <p>{m.content}</p>
                        <p className={`text-[10px] mt-1 ${m.sender_id === user?.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                          {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
                <div className="p-4 border-t flex gap-2">
                  <Input value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Whisper something..." 
                    onKeyDown={e => e.key === 'Enter' && sendMessage()} />
                  <Button size="icon" onClick={sendMessage} disabled={!newMessage.trim()} className="echo-gradient text-primary-foreground border-0"><Send className="h-4 w-4" /></Button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">Select a resonator to start whispering</div>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Chat;

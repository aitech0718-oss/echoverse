import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, ImagePlus, Phone, Video, X, Download, ArrowLeft } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

const Chat = () => {
  const { user, profile } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [callActive, setCallActive] = useState<'audio' | 'video' | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    const fetchConversations = async () => {
      const { data: friends } = await supabase
        .from('friends')
        .select('*, requester:requester_id(display_name, avatar_url, user_id, is_online), addressee:addressee_id(display_name, avatar_url, user_id, is_online)')
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

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { toast.error('File too large (max 10MB)'); return; }
      setMediaFile(file);
      setMediaPreview(URL.createObjectURL(file));
    }
  };

  const sendMessage = async () => {
    if ((!newMessage.trim() && !mediaFile) || !user || !selectedUser) return;
    setSending(true);

    let content = newMessage.trim();

    if (mediaFile) {
      const ext = mediaFile.name.split('.').pop();
      const path = `chat/${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('media').upload(path, mediaFile);
      if (error) { toast.error('Failed to upload media'); setSending(false); return; }
      const { data: urlData } = supabase.storage.from('media').getPublicUrl(path);
      content = content ? `${content}\n[media]${urlData.publicUrl}[/media]` : `[media]${urlData.publicUrl}[/media]`;
    }

    await supabase.from('messages').insert({ sender_id: user.id, receiver_id: selectedUser.user_id, content });
    setNewMessage('');
    setMediaFile(null);
    setMediaPreview(null);
    setSending(false);
  };

  const startCall = (type: 'audio' | 'video') => {
    setCallActive(type);
    toast.info(`${type === 'audio' ? '📞 Audio' : '📹 Video'} call started with ${selectedUser?.display_name}`, { duration: 3000 });
  };

  const endCall = () => { setCallActive(null); toast.info('Call ended'); };

  const parseMessage = (content: string) => {
    const mediaRegex = /\[media\](.*?)\[\/media\]/g;
    const parts: { type: 'text' | 'media'; value: string }[] = [];
    let lastIndex = 0;
    let match;
    while ((match = mediaRegex.exec(content)) !== null) {
      if (match.index > lastIndex) parts.push({ type: 'text', value: content.slice(lastIndex, match.index).trim() });
      parts.push({ type: 'media', value: match[1] });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < content.length) {
      const remaining = content.slice(lastIndex).trim();
      if (remaining) parts.push({ type: 'text', value: remaining });
    }
    if (parts.length === 0) parts.push({ type: 'text', value: content });
    return parts;
  };

  const isImage = (url: string) => /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(url);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-4">
        <div className="grid md:grid-cols-[300px_1fr] gap-4 h-[calc(100vh-100px)]">
          {/* Conversations sidebar */}
          <Card className={`overflow-y-auto ${selectedUser ? 'hidden md:block' : ''}`}>
            <CardContent className="p-3">
              <h3 className="font-semibold text-sm px-2 py-2 text-muted-foreground uppercase tracking-wider">Whispers</h3>
              {conversations.length === 0 ? (
                <p className="text-sm text-muted-foreground p-3">Connect with resonators to start whispering</p>
              ) : conversations.map(c => (
                <button key={c.user_id} onClick={() => setSelectedUser(c)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all hover:bg-accent ${selectedUser?.user_id === c.user_id ? 'bg-accent shadow-sm' : ''}`}>
                  <div className="relative">
                    <Avatar className="h-10 w-10"><AvatarImage src={c.avatar_url} /><AvatarFallback className="bg-primary text-primary-foreground text-xs">{c.display_name?.[0]}</AvatarFallback></Avatar>
                    {c.is_online && <span className="absolute bottom-0 right-0 h-3 w-3 bg-green-500 rounded-full border-2 border-card" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium truncate block">{c.display_name}</span>
                    <span className="text-xs text-muted-foreground">{c.is_online ? 'Online' : 'Offline'}</span>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Chat area */}
          <Card className={`flex flex-col ${!selectedUser ? 'hidden md:flex' : ''}`}>
            {selectedUser ? (
              <>
                {/* Chat header with call buttons */}
                <div className="flex items-center gap-3 p-4 border-b">
                  <Button variant="ghost" size="icon" className="md:hidden h-8 w-8" onClick={() => setSelectedUser(null)}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div className="relative">
                    <Avatar className="h-9 w-9"><AvatarImage src={selectedUser.avatar_url} /><AvatarFallback className="bg-primary text-primary-foreground text-xs">{selectedUser.display_name?.[0]}</AvatarFallback></Avatar>
                    {selectedUser.is_online && <span className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-green-500 rounded-full border-2 border-card" />}
                  </div>
                  <div className="flex-1">
                    <span className="font-semibold text-sm">{selectedUser.display_name}</span>
                    <p className="text-xs text-muted-foreground">{selectedUser.is_online ? 'Online now' : 'Offline'}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => startCall('audio')} title="Audio Call">
                      <Phone className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => startCall('video')} title="Video Call">
                      <Video className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Call overlay */}
                {callActive && (
                  <div className="bg-gradient-to-br from-primary/20 to-pink-500/20 p-6 flex items-center justify-between border-b animate-fade-in">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center animate-pulse ${callActive === 'video' ? 'bg-blue-500/20' : 'bg-green-500/20'}`}>
                        {callActive === 'audio' ? <Phone className="h-5 w-5 text-green-500" /> : <Video className="h-5 w-5 text-blue-500" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{callActive === 'audio' ? 'Audio' : 'Video'} call with {selectedUser.display_name}</p>
                        <p className="text-xs text-muted-foreground">In progress...</p>
                      </div>
                    </div>
                    <Button variant="destructive" size="sm" onClick={endCall}>End Call</Button>
                  </div>
                )}

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.length === 0 && (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                      Start a whisper with {selectedUser.display_name}
                    </div>
                  )}
                  {messages.map(m => {
                    const parts = parseMessage(m.content);
                    const isMine = m.sender_id === user?.id;
                    return (
                      <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${isMine ? 'echo-gradient text-primary-foreground' : 'bg-muted'}`}>
                          {parts.map((part, i) => (
                            part.type === 'media' ? (
                              <div key={i} className="my-1">
                                {isImage(part.value) ? (
                                  <img src={part.value} alt="Shared media" className="rounded-lg max-h-52 object-cover cursor-pointer" onClick={() => window.open(part.value, '_blank')} />
                                ) : (
                                  <div className="flex items-center gap-2 bg-background/20 rounded-lg p-2">
                                    <span className="text-xs truncate flex-1">Attachment</span>
                                  </div>
                                )}
                                <a href={part.value} download target="_blank" rel="noopener noreferrer"
                                  className={`inline-flex items-center gap-1 text-xs mt-1 ${isMine ? 'text-primary-foreground/80 hover:text-primary-foreground' : 'text-primary hover:underline'}`}>
                                  <Download className="h-3 w-3" />Download
                                </a>
                              </div>
                            ) : (
                              <p key={i}>{part.value}</p>
                            )
                          ))}
                          <p className={`text-[10px] mt-1 ${isMine ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                            {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                            {isMine && <span className="ml-1">{m.is_read ? '✓✓' : '✓'}</span>}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Media preview */}
                {mediaPreview && (
                  <div className="px-4 py-2 border-t">
                    <div className="relative inline-block rounded-lg overflow-hidden border-2 border-dashed border-primary/30 p-1">
                      <span className="absolute top-1 left-1 text-[10px] font-semibold bg-primary/90 text-primary-foreground px-1.5 py-0.5 rounded-full z-10">Draft</span>
                      <img src={mediaPreview} alt="Preview" className="rounded max-h-24 object-cover" />
                      <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-5 w-5 z-10" onClick={() => { setMediaFile(null); setMediaPreview(null); }}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Input bar */}
                <div className="p-3 border-t flex gap-2 items-center">
                  <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => fileRef.current?.click()}>
                    <ImagePlus className="h-4 w-4" />
                  </Button>
                  <input ref={fileRef} type="file" accept="image/*,video/*,.pdf,.doc,.docx" className="hidden" onChange={handleMediaSelect} />
                  <Input value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Whisper something..."
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()} className="flex-1" />
                  <Button size="icon" onClick={sendMessage} disabled={sending || (!newMessage.trim() && !mediaFile)} className="echo-gradient text-primary-foreground border-0 h-9 w-9 shrink-0">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2">
                <div className="h-16 w-16 rounded-full echo-gradient flex items-center justify-center opacity-30">
                  <Send className="h-8 w-8 text-primary-foreground" />
                </div>
                <p className="text-sm">Select a resonator to start whispering</p>
              </div>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Chat;

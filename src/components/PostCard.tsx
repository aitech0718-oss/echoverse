import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MessageCircle, Share2, Flag, MoreHorizontal, Trash2, Volume2, Download, Send, Copy, SmilePlus, Reply, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

// Track which posts have been viewed this session to avoid inflating counts
const viewedPostIds = new Set<string>();

const EMOJI_LIST = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

const REPORT_REASONS = [
  'Spam or misleading',
  'Harassment or bullying',
  'Hate speech',
  'Violence or threats',
  'Nudity or sexual content',
  'False information',
];

interface PostCardProps {
  post: any;
  onUpdate?: () => void;
  friends?: string[];
  friendProfiles?: Record<string, { display_name: string; avatar_url: string | null }>;
}

const PostCard = ({ post, onUpdate, friends = [], friendProfiles = {} }: PostCardProps) => {
  const { user } = useAuth();
  const [liked, setLiked] = useState(post.user_liked || false);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [viewsCount, setViewsCount] = useState(post.views_count || 0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<any>(null);
  const [loadingComments, setLoadingComments] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [reactions, setReactions] = useState<any[]>(post.reactions || []);
  const [commentReactions, setCommentReactions] = useState<Record<string, any[]>>({});

  // Track view on mount - only once per post per session
  useEffect(() => {
    if (viewedPostIds.has(post.id)) return;
    viewedPostIds.add(post.id);
    const trackView = async () => {
      try {
        await supabase.rpc('increment_view_count', { p_post_id: post.id });
        setViewsCount((c: number) => c + 1);
      } catch {}
    };
    trackView();
  }, [post.id]);

  const initials = post.profiles?.display_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'U';

  const handleLike = async () => {
    if (!user) return;
    if (liked) {
      await supabase.from('likes').delete().eq('post_id', post.id).eq('user_id', user.id);
      setLiked(false);
      setLikesCount((c: number) => c - 1);
    } else {
      await supabase.from('likes').insert({ post_id: post.id, user_id: user.id });
      setLiked(true);
      setLikesCount((c: number) => c + 1);
      if (post.author_id !== user.id) {
        await supabase.from('notifications').insert({
          user_id: post.author_id, actor_id: user.id, type: 'like',
          reference_id: post.id, message: 'resonated with your echo'
        });
      }
    }
  };

  const handleReaction = async (emoji: string) => {
    if (!user) return;
    const existing = reactions.find(r => r.user_id === user.id && r.emoji === emoji);
    if (existing) {
      await supabase.from('reactions').delete().eq('id', existing.id);
      setReactions(prev => prev.filter(r => r.id !== existing.id));
    } else {
      const { data } = await supabase.from('reactions').insert({ user_id: user.id, post_id: post.id, emoji }).select().single();
      if (data) setReactions(prev => [...prev, data]);
    }
  };

  const handleCommentReaction = async (commentId: string, emoji: string) => {
    if (!user) return;
    const existing = (commentReactions[commentId] || []).find(r => r.user_id === user.id && r.emoji === emoji);
    if (existing) {
      await supabase.from('reactions').delete().eq('id', existing.id);
      setCommentReactions(prev => ({ ...prev, [commentId]: (prev[commentId] || []).filter(r => r.id !== existing.id) }));
    } else {
      const { data } = await supabase.from('reactions').insert({ user_id: user.id, comment_id: commentId, emoji }).select().single();
      if (data) setCommentReactions(prev => ({ ...prev, [commentId]: [...(prev[commentId] || []), data] }));
    }
  };

  const loadComments = async () => {
    setLoadingComments(true);
    const { data } = await supabase
      .from('comments')
      .select('*, profiles:author_id(display_name, avatar_url)')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true });
    setComments(data || []);
    if (data && data.length > 0) {
      const commentIds = data.map(c => c.id);
      const { data: cReactions } = await supabase.from('reactions').select('*').in('comment_id', commentIds);
      const grouped: Record<string, any[]> = {};
      (cReactions || []).forEach(r => {
        if (!grouped[r.comment_id]) grouped[r.comment_id] = [];
        grouped[r.comment_id].push(r);
      });
      setCommentReactions(grouped);
    }
    setLoadingComments(false);
  };

  const loadReactions = async () => {
    const { data } = await supabase.from('reactions').select('*').eq('post_id', post.id);
    setReactions(data || []);
  };

  const toggleComments = () => {
    if (!showComments) { loadComments(); loadReactions(); }
    setShowComments(!showComments);
  };

  const submitComment = async () => {
    if (!newComment.trim() || !user) return;
    const insertData: any = { post_id: post.id, author_id: user.id, content: newComment.trim() };
    if (replyTo) insertData.parent_id = replyTo.id;
    await supabase.from('comments').insert(insertData);
    setNewComment('');
    setReplyTo(null);
    loadComments();
    if (post.author_id !== user.id) {
      await supabase.from('notifications').insert({
        user_id: post.author_id, actor_id: user.id, type: 'comment',
        reference_id: post.id, message: 'replied to your echo'
      });
    }
    if (replyTo && replyTo.author_id !== user.id) {
      await supabase.from('notifications').insert({
        user_id: replyTo.author_id, actor_id: user.id, type: 'reply',
        reference_id: post.id, message: 'replied to your comment'
      });
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/profile/${post.author_id}`);
      toast.success('Echo link copied!');
    } catch {
      toast.error('Failed to copy link');
    }
    setShowShareMenu(false);
  };

  const handleSendToFriend = async (friendId: string) => {
    if (!user) return;
    const link = `${window.location.origin}/profile/${post.author_id}`;
    await supabase.from('messages').insert({
      sender_id: user.id, receiver_id: friendId,
      content: `Check out this echo: ${link}\n\n"${post.content?.substring(0, 100)}..."`
    });
    toast.success('Echo shared via whisper!');
    setShowShareMenu(false);
  };

  const handleDelete = async () => {
    await supabase.from('posts').delete().eq('id', post.id);
    toast.success('Echo silenced');
    onUpdate?.();
  };

  const handleReport = async () => {
    if (!user) return;
    const reason = reportReason === 'Other' ? customReason : reportReason;
    if (!reason.trim()) { toast.error('Please provide a reason'); return; }
    await supabase.from('reports').insert({ reporter_id: user.id, post_id: post.id, reason, reported_user_id: post.author_id });
    toast.success('Echo reported — thanks for keeping the verse safe');
    setShowReport(false);
    setReportReason('');
    setCustomReason('');
  };

  const handleDownload = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `echoverse_media_${Date.now()}.${blob.type.split('/')[1] || 'jpg'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      toast.success('Media downloaded');
    } catch {
      toast.error('Download failed');
    }
  };

  // Format view count nicely
  const formatCount = (n: number) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  };

  // Group reactions by emoji
  const reactionCounts: Record<string, { count: number; userReacted: boolean }> = {};
  reactions.forEach(r => {
    if (!reactionCounts[r.emoji]) reactionCounts[r.emoji] = { count: 0, userReacted: false };
    reactionCounts[r.emoji].count++;
    if (r.user_id === user?.id) reactionCounts[r.emoji].userReacted = true;
  });

  // Organize comments into threads
  const topLevelComments = comments.filter(c => !c.parent_id);
  const replies = comments.filter(c => c.parent_id);
  const getReplies = (parentId: string) => replies.filter(r => r.parent_id === parentId);

  // Extract hashtags from content for display
  const renderContent = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(#\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('#')) {
        return <span key={i} className="text-primary font-medium hover:underline cursor-pointer">{part}</span>;
      }
      return part;
    });
  };

  const CommentItem = ({ c, isReply = false }: { c: any; isReply?: boolean }) => {
    const cReactionCounts: Record<string, { count: number; userReacted: boolean }> = {};
    (commentReactions[c.id] || []).forEach(r => {
      if (!cReactionCounts[r.emoji]) cReactionCounts[r.emoji] = { count: 0, userReacted: false };
      cReactionCounts[r.emoji].count++;
      if (r.user_id === user?.id) cReactionCounts[r.emoji].userReacted = true;
    });

    return (
      <div className={`flex gap-2 text-sm ${isReply ? 'ml-8' : ''}`}>
        <Link to={`/profile/${c.author_id}`}>
          <Avatar className="h-6 w-6 mt-0.5">
            <AvatarImage src={c.profiles?.avatar_url} />
            <AvatarFallback className="text-xs bg-muted">{c.profiles?.display_name?.[0]}</AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex-1">
          <div className="bg-muted/60 rounded-xl p-2.5">
            <span className="font-medium text-xs">{c.profiles?.display_name}</span>
            {c.parent_id && <span className="text-[10px] text-muted-foreground ml-1">↩ reply</span>}
            <p className="text-xs mt-0.5">{c.content}</p>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</p>
            <button onClick={() => { setReplyTo(c); setNewComment(`@${c.profiles?.display_name} `); }} className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
              <Reply className="h-2.5 w-2.5" /> Reply
            </button>
            <Popover>
              <PopoverTrigger asChild>
                <button className="text-[10px] text-muted-foreground hover:text-primary"><SmilePlus className="h-3 w-3" /></button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-1 flex gap-1" side="top">
                {EMOJI_LIST.map(e => (
                  <button key={e} onClick={() => handleCommentReaction(c.id, e)} className="hover:scale-125 transition-transform text-sm p-0.5">{e}</button>
                ))}
              </PopoverContent>
            </Popover>
          </div>
          {Object.keys(cReactionCounts).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {Object.entries(cReactionCounts).map(([emoji, data]) => (
                <button key={emoji} onClick={() => handleCommentReaction(c.id, emoji)}
                  className={`text-xs px-1.5 py-0.5 rounded-full border transition-colors ${data.userReacted ? 'bg-primary/10 border-primary/30' : 'bg-muted border-border hover:bg-accent'}`}>
                  {emoji} {data.count}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <Card className="animate-fade-in shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center gap-3 pb-2">
          <Link to={`/profile/${post.author_id}`}>
            <Avatar className="h-10 w-10 ring-2 ring-primary/10">
              <AvatarImage src={post.profiles?.avatar_url} />
              <AvatarFallback className="bg-primary text-primary-foreground text-sm">{initials}</AvatarFallback>
            </Avatar>
          </Link>
          <div className="flex-1 min-w-0">
            <Link to={`/profile/${post.author_id}`} className="font-semibold text-sm hover:underline">
              {post.profiles?.display_name}
            </Link>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Volume2 className="h-3 w-3" />
              echoed {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
              <span className="mx-1">·</span>
              <Eye className="h-3 w-3" />
              <span>{formatCount(viewsCount)}</span>
            </p>
          </div>
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {post.author_id === user.id && <DropdownMenuItem onClick={handleDelete}><Trash2 className="mr-2 h-4 w-4" />Silence Echo</DropdownMenuItem>}
                {post.author_id !== user.id && <DropdownMenuItem onClick={() => setShowReport(true)}><Flag className="mr-2 h-4 w-4" />Report</DropdownMenuItem>}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </CardHeader>
        <CardContent className="pb-3">
          {post.content && <p className="text-sm whitespace-pre-wrap mb-3">{renderContent(post.content)}</p>}
          {post.image_url && (
            <div className="relative group">
              <img src={post.image_url} alt="Echo media" className="rounded-xl w-full max-h-96 object-cover" />
              <Button variant="secondary" size="icon" className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                onClick={() => handleDownload(post.image_url)} title="Download">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          )}
          {Object.keys(reactionCounts).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {Object.entries(reactionCounts).map(([emoji, data]) => (
                <button key={emoji} onClick={() => handleReaction(emoji)}
                  className={`text-xs px-2 py-1 rounded-full border transition-colors ${data.userReacted ? 'bg-primary/10 border-primary/30' : 'bg-muted border-border hover:bg-accent'}`}>
                  {emoji} {data.count}
                </button>
              ))}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-3 pt-0">
          <div className="flex items-center gap-1 w-full border-t pt-2">
            <Button variant="ghost" size="sm" onClick={handleLike} className={liked ? 'text-pink-500' : 'text-muted-foreground hover:text-pink-500'}>
              <Heart className={`h-4 w-4 mr-1 ${liked ? 'fill-current' : ''}`} />{likesCount > 0 && likesCount}
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary">
                  <SmilePlus className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-1 flex gap-1" side="top">
                {EMOJI_LIST.map(e => (
                  <button key={e} onClick={() => handleReaction(e)} className="hover:scale-125 transition-transform text-lg p-1">{e}</button>
                ))}
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="sm" onClick={toggleComments} className="text-muted-foreground hover:text-primary">
              <MessageCircle className="h-4 w-4 mr-1" />{post.comments_count > 0 && post.comments_count}
            </Button>
            <Popover open={showShareMenu} onOpenChange={setShowShareMenu}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-green-500">
                  <Share2 className="h-4 w-4 mr-1" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" side="top">
                <p className="text-xs font-medium text-muted-foreground mb-2">Share this echo</p>
                <button onClick={handleCopyLink} className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-accent text-sm">
                  <Copy className="h-4 w-4" /> Copy Link
                </button>
                {friends.length > 0 && (
                  <>
                    <div className="border-t my-1" />
                    <p className="text-[10px] text-muted-foreground px-2 py-1">Send to Resonator</p>
                    <div className="max-h-40 overflow-y-auto space-y-0.5">
                      {friends.map(fId => {
                        const fp = friendProfiles[fId];
                        return (
                          <button key={fId} onClick={() => handleSendToFriend(fId)}
                            className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-accent text-sm">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={fp?.avatar_url || ''} />
                              <AvatarFallback className="text-[10px] bg-muted">{fp?.display_name?.[0] || '?'}</AvatarFallback>
                            </Avatar>
                            <span className="truncate">{fp?.display_name || 'Unknown'}</span>
                            <Send className="h-3 w-3 ml-auto shrink-0 text-muted-foreground" />
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </PopoverContent>
            </Popover>
            {/* View count display */}
            <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
              <Eye className="h-3.5 w-3.5" />
              <span>{formatCount(viewsCount)}</span>
            </div>
          </div>
          {showComments && (
            <div className="w-full space-y-3 animate-fade-in">
              {loadingComments ? <p className="text-sm text-muted-foreground">Loading replies...</p> : (
                <>
                  {topLevelComments.map(c => (
                    <div key={c.id} className="space-y-2">
                      <CommentItem c={c} />
                      {getReplies(c.id).map(r => (
                        <CommentItem key={r.id} c={r} isReply />
                      ))}
                    </div>
                  ))}
                  {replyTo && (
                    <div className="flex items-center gap-1 text-xs text-primary bg-primary/5 px-2 py-1 rounded">
                      <Reply className="h-3 w-3" />
                      Replying to {replyTo.profiles?.display_name}
                      <button onClick={() => { setReplyTo(null); setNewComment(''); }} className="ml-auto text-muted-foreground hover:text-destructive">✕</button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Textarea value={newComment} onChange={e => setNewComment(e.target.value)} placeholder={replyTo ? `Reply to ${replyTo.profiles?.display_name}...` : "Reply to this echo..."}
                      className="min-h-[36px] text-sm resize-none" rows={1} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment(); } }} />
                    <Button size="icon" onClick={submitComment} disabled={!newComment.trim()} className="echo-gradient text-primary-foreground border-0 h-9 w-9 shrink-0">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </CardFooter>
      </Card>

      {/* Report Dialog */}
      <Dialog open={showReport} onOpenChange={setShowReport}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Flag className="h-5 w-5 text-destructive" /> Report this Echo</DialogTitle>
          </DialogHeader>
          <RadioGroup value={reportReason} onValueChange={setReportReason} className="space-y-2">
            {REPORT_REASONS.map(r => (
              <div key={r} className="flex items-center space-x-2">
                <RadioGroupItem value={r} id={r} />
                <Label htmlFor={r} className="text-sm">{r}</Label>
              </div>
            ))}
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="Other" id="other" />
              <Label htmlFor="other" className="text-sm">Other</Label>
            </div>
          </RadioGroup>
          {reportReason === 'Other' && (
            <Textarea placeholder="Describe the issue..." value={customReason} onChange={e => setCustomReason(e.target.value)} rows={2} />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReport(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReport} disabled={!reportReason || (reportReason === 'Other' && !customReason.trim())}>Submit Report</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PostCard;

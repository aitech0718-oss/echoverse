import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MessageCircle, Share2, Flag, MoreHorizontal, Trash2, Volume2, Download, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface PostCardProps {
  post: any;
  onUpdate?: () => void;
}

const PostCard = ({ post, onUpdate }: PostCardProps) => {
  const { user } = useAuth();
  const [liked, setLiked] = useState(post.user_liked || false);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [shareCount, setShareCount] = useState(post.shares_count || 0);

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

  const loadComments = async () => {
    setLoadingComments(true);
    const { data } = await supabase
      .from('comments')
      .select('*, profiles:author_id(display_name, avatar_url)')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true });
    setComments(data || []);
    setLoadingComments(false);
  };

  const toggleComments = () => {
    if (!showComments) loadComments();
    setShowComments(!showComments);
  };

  const submitComment = async () => {
    if (!newComment.trim() || !user) return;
    await supabase.from('comments').insert({ post_id: post.id, author_id: user.id, content: newComment.trim() });
    setNewComment('');
    loadComments();
    if (post.author_id !== user.id) {
      await supabase.from('notifications').insert({
        user_id: post.author_id, actor_id: user.id, type: 'comment',
        reference_id: post.id, message: 'replied to your echo'
      });
    }
  };

  const handleShare = async () => {
    if (!user) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/profile/${post.author_id}`);
      toast.success('Echo link copied!');
      setShareCount((c: number) => c + 1);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const handleDelete = async () => {
    await supabase.from('posts').delete().eq('id', post.id);
    toast.success('Echo silenced');
    onUpdate?.();
  };

  const handleReport = async () => {
    if (!user) return;
    await supabase.from('reports').insert({ reporter_id: user.id, post_id: post.id, reason: 'Inappropriate content' });
    toast.success('Echo reported — thanks for keeping the verse safe');
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

  return (
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
          </p>
        </div>
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {post.author_id === user.id && <DropdownMenuItem onClick={handleDelete}><Trash2 className="mr-2 h-4 w-4" />Silence Echo</DropdownMenuItem>}
              {post.author_id !== user.id && <DropdownMenuItem onClick={handleReport}><Flag className="mr-2 h-4 w-4" />Report</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </CardHeader>
      <CardContent className="pb-3">
        {post.content && <p className="text-sm whitespace-pre-wrap mb-3">{post.content}</p>}
        {post.image_url && (
          <div className="relative group">
            <img src={post.image_url} alt="Echo media" className="rounded-xl w-full max-h-96 object-cover" />
            <Button variant="secondary" size="icon" className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
              onClick={() => handleDownload(post.image_url)} title="Download">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-3 pt-0">
        <div className="flex items-center gap-1 w-full border-t pt-2">
          <Button variant="ghost" size="sm" onClick={handleLike} className={liked ? 'text-pink-500' : 'text-muted-foreground hover:text-pink-500'}>
            <Heart className={`h-4 w-4 mr-1 ${liked ? 'fill-current' : ''}`} />{likesCount > 0 && likesCount}
          </Button>
          <Button variant="ghost" size="sm" onClick={toggleComments} className="text-muted-foreground hover:text-primary">
            <MessageCircle className="h-4 w-4 mr-1" />{post.comments_count > 0 && post.comments_count}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleShare} className="text-muted-foreground hover:text-green-500">
            <Share2 className="h-4 w-4 mr-1" />{shareCount > 0 && shareCount}
          </Button>
        </div>
        {showComments && (
          <div className="w-full space-y-3 animate-fade-in">
            {loadingComments ? <p className="text-sm text-muted-foreground">Loading replies...</p> : (
              <>
                {comments.map(c => (
                  <div key={c.id} className="flex gap-2 text-sm">
                    <Link to={`/profile/${c.author_id}`}>
                      <Avatar className="h-6 w-6 mt-0.5">
                        <AvatarImage src={c.profiles?.avatar_url} />
                        <AvatarFallback className="text-xs bg-muted">{c.profiles?.display_name?.[0]}</AvatarFallback>
                      </Avatar>
                    </Link>
                    <div className="flex-1 bg-muted/60 rounded-xl p-2.5">
                      <span className="font-medium text-xs">{c.profiles?.display_name}</span>
                      <p className="text-xs mt-0.5">{c.content}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</p>
                    </div>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Textarea value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Reply to this echo..."
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
  );
};

export default PostCard;

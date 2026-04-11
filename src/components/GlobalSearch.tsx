import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const GlobalSearch = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const doSearch = async (q: string) => {
    if (!q.trim() || !user) { setUsers([]); setPosts([]); return; }
    setSearching(true);
    const [{ data: uData }, { data: pData }] = await Promise.all([
      supabase.from('profiles').select('user_id, display_name, avatar_url, username').or(`display_name.ilike.%${q}%,username.ilike.%${q}%`).limit(5),
      supabase.from('posts').select('id, content, author_id, profiles:author_id(display_name)').ilike('content', `%${q}%`).eq('visibility', 'public').limit(5),
    ]);
    setUsers(uData || []);
    setPosts(pData || []);
    setSearching(false);
  };

  const handleChange = (val: string) => {
    setQuery(val);
    setOpen(!!val);
    const timer = setTimeout(() => doSearch(val), 300);
    return () => clearTimeout(timer);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={e => handleChange(e.target.value)}
          onFocus={() => query && setOpen(true)}
          placeholder="Search..."
          className="pl-8 pr-8 h-8 w-40 md:w-56 text-sm bg-muted/50"
        />
        {query && (
          <button onClick={() => { setQuery(''); setOpen(false); }} className="absolute right-2 top-1/2 -translate-y-1/2">
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </div>
      {open && (users.length > 0 || posts.length > 0 || searching) && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-card border rounded-xl shadow-lg z-50 max-h-80 overflow-y-auto">
          {searching && <p className="text-xs text-muted-foreground p-3">Searching...</p>}
          {users.length > 0 && (
            <div className="p-2">
              <p className="text-[10px] font-medium text-muted-foreground uppercase px-2 mb-1">Voices</p>
              {users.map(u => (
                <button key={u.user_id} className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-accent text-left"
                  onClick={() => { navigate(`/profile/${u.user_id}`); setOpen(false); setQuery(''); }}>
                  <Avatar className="h-7 w-7"><AvatarImage src={u.avatar_url} /><AvatarFallback className="text-xs bg-primary text-primary-foreground">{u.display_name?.[0]}</AvatarFallback></Avatar>
                  <div>
                    <p className="text-sm font-medium">{u.display_name}</p>
                    <p className="text-[10px] text-muted-foreground">@{u.username}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {posts.length > 0 && (
            <div className="p-2 border-t">
              <p className="text-[10px] font-medium text-muted-foreground uppercase px-2 mb-1">Echoes</p>
              {posts.map(p => (
                <button key={p.id} className="w-full text-left p-2 rounded-lg hover:bg-accent"
                  onClick={() => { navigate(`/profile/${p.author_id}`); setOpen(false); setQuery(''); }}>
                  <p className="text-xs font-medium">{(p.profiles as any)?.display_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{p.content?.substring(0, 80)}</p>
                </button>
              ))}
            </div>
          )}
          {!searching && users.length === 0 && posts.length === 0 && (
            <p className="text-xs text-muted-foreground p-3 text-center">No results found</p>
          )}
        </div>
      )}
    </div>
  );
};

export default GlobalSearch;

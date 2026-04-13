import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Home, MessageCircle, Users, Settings, LogOut, Shield, User, Menu, X, Radio, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import NotificationBell from './NotificationBell';
import GlobalSearch from './GlobalSearch';
import { useState } from 'react';

const Navbar = () => {
  const { user, profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user) return null;

  const initials = profile?.display_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'U';

  return (
    <header className="sticky top-0 z-50 glass border-b">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/feed" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg echo-gradient flex items-center justify-center">
            <Radio className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-primary to-pink-500 bg-clip-text text-transparent hidden sm:inline">EchoVerse</span>
        </Link>

        <div className="hidden md:block">
          <GlobalSearch />
        </div>

        <nav className="hidden md:flex items-center gap-1">
          <Button variant="ghost" size="sm" asChild><Link to="/feed"><Home className="h-5 w-5" /></Link></Button>
          <Button variant="ghost" size="sm" asChild><Link to="/trending"><TrendingUp className="h-5 w-5" /></Link></Button>
          <Button variant="ghost" size="sm" asChild><Link to="/friends"><Users className="h-5 w-5" /></Link></Button>
          <Button variant="ghost" size="sm" asChild><Link to="/chat"><MessageCircle className="h-5 w-5" /></Link></Button>
          <NotificationBell />
        </nav>

        <div className="flex items-center gap-2">
          <div className="md:hidden">
            <Button variant="ghost" size="sm" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={profile?.avatar_url} />
                  <AvatarFallback className="text-xs bg-primary text-primary-foreground">{initials}</AvatarFallback>
                </Avatar>
                <span className="hidden md:inline text-sm font-medium">{profile?.display_name}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => navigate(`/profile/${user.id}`)}><User className="mr-2 h-4 w-4" />My Verse</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/privacy')}><Settings className="mr-2 h-4 w-4" />Echo Settings</DropdownMenuItem>
              {role === 'admin' && <DropdownMenuItem onClick={() => navigate('/admin')}><Shield className="mr-2 h-4 w-4" />Command Center</DropdownMenuItem>}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut}><LogOut className="mr-2 h-4 w-4" />Sign Out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {mobileOpen && (
        <nav className="md:hidden border-t px-4 py-2 space-y-2 glass animate-fade-in">
          <div className="mb-2"><GlobalSearch /></div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" asChild onClick={() => setMobileOpen(false)}><Link to="/feed"><Home className="h-4 w-4 mr-1" />Timeline</Link></Button>
            <Button variant="ghost" size="sm" asChild onClick={() => setMobileOpen(false)}><Link to="/friends"><Users className="h-4 w-4 mr-1" />Resonators</Link></Button>
            <Button variant="ghost" size="sm" asChild onClick={() => setMobileOpen(false)}><Link to="/chat"><MessageCircle className="h-4 w-4 mr-1" />Whisper</Link></Button>
            <NotificationBell />
          </div>
        </nav>
      )}
    </header>
  );
};

export default Navbar;

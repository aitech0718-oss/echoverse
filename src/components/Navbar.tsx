import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Bell, Home, MessageCircle, Users, Settings, LogOut, Shield, User, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import NotificationBell from './NotificationBell';
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
        <Link to="/feed" className="text-xl font-bold text-primary">SocialHub</Link>

        <nav className="hidden md:flex items-center gap-1">
          <Button variant="ghost" size="sm" asChild><Link to="/feed"><Home className="h-5 w-5" /></Link></Button>
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
              <DropdownMenuItem onClick={() => navigate(`/profile/${user.id}`)}><User className="mr-2 h-4 w-4" />Profile</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/privacy')}><Settings className="mr-2 h-4 w-4" />Privacy Settings</DropdownMenuItem>
              {role === 'admin' && <DropdownMenuItem onClick={() => navigate('/admin')}><Shield className="mr-2 h-4 w-4" />Admin Dashboard</DropdownMenuItem>}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut}><LogOut className="mr-2 h-4 w-4" />Sign Out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {mobileOpen && (
        <nav className="md:hidden border-t px-4 py-2 flex gap-2 glass animate-fade-in">
          <Button variant="ghost" size="sm" asChild onClick={() => setMobileOpen(false)}><Link to="/feed"><Home className="h-4 w-4 mr-1" />Feed</Link></Button>
          <Button variant="ghost" size="sm" asChild onClick={() => setMobileOpen(false)}><Link to="/friends"><Users className="h-4 w-4 mr-1" />Friends</Link></Button>
          <Button variant="ghost" size="sm" asChild onClick={() => setMobileOpen(false)}><Link to="/chat"><MessageCircle className="h-4 w-4 mr-1" />Chat</Link></Button>
          <NotificationBell />
        </nav>
      )}
    </header>
  );
};

export default Navbar;

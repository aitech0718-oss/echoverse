import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { Camera } from 'lucide-react';

const EditProfile = () => {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [location, setLocation] = useState(profile?.location || '');
  const [website, setWebsite] = useState(profile?.website || '');
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setAvatarFile(file); setAvatarPreview(URL.createObjectURL(file)); }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    let avatar_url = profile?.avatar_url;
    if (avatarFile) {
      const ext = avatarFile.name.split('.').pop();
      const path = `${user.id}/avatar.${ext}`;
      await supabase.storage.from('media').upload(path, avatarFile, { upsert: true });
      const { data } = supabase.storage.from('media').getPublicUrl(path);
      avatar_url = data.publicUrl;
    }

    const { error } = await supabase.from('profiles').update({
      display_name: displayName, bio, location, website, avatar_url
    }).eq('user_id', user.id);

    setSaving(false);
    if (error) { toast.error('Failed to update your verse'); return; }
    toast.success('Verse updated!');
    await refreshProfile();
    navigate(`/profile/${user.id}`);
  };

  const initials = displayName?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'U';

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-lg mx-auto px-4 py-6">
        <Card className="shadow-md">
          <CardHeader><CardTitle>Edit Your Verse</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center">
              <label className="relative cursor-pointer group">
                <Avatar className="h-24 w-24 ring-2 ring-primary/20">
                  <AvatarImage src={avatarPreview || profile?.avatar_url} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-2xl">{initials}</AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="h-6 w-6 text-primary-foreground" />
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </label>
            </div>
            <div><label className="text-sm font-medium">Display Name</label><Input value={displayName} onChange={e => setDisplayName(e.target.value)} /></div>
            <div><label className="text-sm font-medium">Bio</label><Textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} /></div>
            <div><label className="text-sm font-medium">Location</label><Input value={location} onChange={e => setLocation(e.target.value)} /></div>
            <div><label className="text-sm font-medium">Website</label><Input value={website} onChange={e => setWebsite(e.target.value)} /></div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving} className="flex-1 echo-gradient text-primary-foreground border-0">{saving ? 'Saving...' : 'Save Verse'}</Button>
              <Button variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default EditProfile;

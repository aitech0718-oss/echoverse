import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const PrivacySettings = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from('privacy_settings').select('*').eq('user_id', user.id).single().then(({ data }) => setSettings(data));
  }, [user]);

  const update = async (field: string, value: string) => {
    if (!user) return;
    setSettings((prev: any) => ({ ...prev, [field]: value }));
    const updateData: Record<string, string> = {};
    updateData[field] = value;
    await supabase.from('privacy_settings').update(updateData as any).eq('user_id', user.id);
    toast.success('Echo settings updated');
  };

  if (!settings) return <div className="min-h-screen bg-background"><Navbar /><div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div></div>;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
        <h1 className="text-xl font-bold">Echo Settings</h1>
        <Card>
          <CardHeader><CardTitle className="text-base">Verse Visibility</CardTitle></CardHeader>
          <CardContent>
            <Select value={settings.profile_visibility} onValueChange={v => update('profile_visibility', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public — Anyone can discover your verse</SelectItem>
                <SelectItem value="friends">Resonators Only</SelectItem>
                <SelectItem value="private">Private — Only you</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Default Echo Reach</CardTitle></CardHeader>
          <CardContent>
            <Select value={settings.post_default_visibility} onValueChange={v => update('post_default_visibility', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public</SelectItem>
                <SelectItem value="friends">Resonators Only</SelectItem>
                <SelectItem value="private">Private</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Who Can Whisper You</CardTitle></CardHeader>
          <CardContent>
            <Select value={settings.message_privacy} onValueChange={v => update('message_privacy', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="everyone">Everyone</SelectItem>
                <SelectItem value="friends">Resonators Only</SelectItem>
                <SelectItem value="nobody">Nobody</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default PrivacySettings;

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Globe, Users, Lock, Eye, Volume2, MessageCircle, Shield, AlertTriangle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

const PrivacySettings = () => {
  const { user, warnings } = useAuth();
  const [settings, setSettings] = useState<any>(null);
  const [showAllWarnings, setShowAllWarnings] = useState(false);

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

  const visibilityBadge = (val: string) => {
    if (val === 'public') return <Badge variant="outline" className="text-green-500 border-green-500/30 bg-green-500/10 text-xs">Public</Badge>;
    if (val === 'friends') return <Badge variant="outline" className="text-blue-500 border-blue-500/30 bg-blue-500/10 text-xs">Resonators</Badge>;
    if (val === 'private') return <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/10 text-xs">Private</Badge>;
    if (val === 'everyone') return <Badge variant="outline" className="text-green-500 border-green-500/30 bg-green-500/10 text-xs">Everyone</Badge>;
    if (val === 'nobody') return <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/10 text-xs">Nobody</Badge>;
    return null;
  };

  if (!settings) return <div className="min-h-screen bg-background"><Navbar /><div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div></div>;

  const displayedWarnings = showAllWarnings ? warnings : warnings.slice(0, 3);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Echo Settings</h1>
        </div>
        <p className="text-sm text-muted-foreground">Control who can see and interact with your verse</p>

        {/* Warnings History Section */}
        {warnings.length > 0 && (
          <Card className="border-yellow-500/30 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  <CardTitle className="text-base">Admin Warnings</CardTitle>
                </div>
                <Badge variant="outline" className={`text-xs ${warnings.length >= 3 ? 'border-destructive/50 text-destructive bg-destructive/10' : 'border-yellow-500/50 text-yellow-600 bg-yellow-500/10'}`}>
                  {warnings.length}/3
                </Badge>
              </div>
              <CardDescription className="text-xs">
                {warnings.length >= 3
                  ? 'Your account has been auto-suspended due to 3+ warnings'
                  : `${3 - warnings.length} warning${3 - warnings.length !== 1 ? 's' : ''} remaining before auto-suspension`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {displayedWarnings.map((w: any, i: number) => (
                <div key={w.id} className="flex gap-3 p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/10">
                  <div className="flex flex-col items-center">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      i === 0 && warnings.indexOf(w) === 0 ? 'bg-yellow-500 text-yellow-950' : 'bg-muted text-muted-foreground'
                    }`}>
                      {warnings.indexOf(w) + 1}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{w.reason}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(w.created_at), 'MMM d, yyyy')} · {formatDistanceToNow(new Date(w.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {warnings.length > 3 && (
                <button
                  onClick={() => setShowAllWarnings(!showAllWarnings)}
                  className="w-full flex items-center justify-center gap-1 text-xs text-primary hover:underline py-1"
                >
                  {showAllWarnings ? <><ChevronUp className="h-3 w-3" /> Show less</> : <><ChevronDown className="h-3 w-3" /> Show all {warnings.length} warnings</>}
                </button>
              )}
            </CardContent>
          </Card>
        )}

        <Separator />

        {/* Privacy Controls */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">Verse Visibility</CardTitle>
              </div>
              {visibilityBadge(settings.profile_visibility)}
            </div>
            <CardDescription className="text-xs">Who can discover and view your profile</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={settings.profile_visibility} onValueChange={v => update('profile_visibility', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="public"><div className="flex items-center gap-2"><Globe className="h-3 w-3 text-green-500" /> Public — Anyone can discover your verse</div></SelectItem>
                <SelectItem value="friends"><div className="flex items-center gap-2"><Users className="h-3 w-3 text-blue-500" /> Resonators Only</div></SelectItem>
                <SelectItem value="private"><div className="flex items-center gap-2"><Lock className="h-3 w-3 text-destructive" /> Private — Only you</div></SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">Default Echo Reach</CardTitle>
              </div>
              {visibilityBadge(settings.post_default_visibility)}
            </div>
            <CardDescription className="text-xs">Default visibility for new echoes you create</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={settings.post_default_visibility} onValueChange={v => update('post_default_visibility', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="public"><div className="flex items-center gap-2"><Globe className="h-3 w-3 text-green-500" /> Public</div></SelectItem>
                <SelectItem value="friends"><div className="flex items-center gap-2"><Users className="h-3 w-3 text-blue-500" /> Resonators Only</div></SelectItem>
                <SelectItem value="private"><div className="flex items-center gap-2"><Lock className="h-3 w-3 text-destructive" /> Private</div></SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">Who Can Whisper You</CardTitle>
              </div>
              {visibilityBadge(settings.message_privacy)}
            </div>
            <CardDescription className="text-xs">Control who can send you direct whispers</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={settings.message_privacy} onValueChange={v => update('message_privacy', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="everyone"><div className="flex items-center gap-2"><Globe className="h-3 w-3 text-green-500" /> Everyone</div></SelectItem>
                <SelectItem value="friends"><div className="flex items-center gap-2"><Users className="h-3 w-3 text-blue-500" /> Resonators Only</div></SelectItem>
                <SelectItem value="nobody"><div className="flex items-center gap-2"><Lock className="h-3 w-3 text-destructive" /> Nobody</div></SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card className="bg-muted/30">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Your verse, your rules</p>
                <p className="text-xs text-muted-foreground mt-1">Changes take effect immediately. Your privacy is our priority. Blocked users cannot see or interact with your content regardless of these settings.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default PrivacySettings;

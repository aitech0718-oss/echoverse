import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: any;
  role: string;
  loading: boolean;
  warnings: any[];
  signUp: (email: string, password: string, displayName: string, username: string, gender: string, dob: string) => Promise<any>;
  signIn: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshWarnings: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [role, setRole] = useState<string>('user');
  const [loading, setLoading] = useState(true);
  const [warnings, setWarnings] = useState<any[]>([]);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('user_id', userId).single();
    setProfile(data);
    const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', userId).single();
    if (roleData) setRole(roleData.role);
    // Fetch warnings
    const { data: w } = await supabase.from('warnings').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    setWarnings(w || []);
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  const refreshWarnings = async () => {
    if (user) {
      const { data: w } = await supabase.from('warnings').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      setWarnings(w || []);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => fetchProfile(session.user.id), 100);
      } else {
        setProfile(null);
        setRole('user');
        setWarnings([]);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, displayName: string, username: string, gender: string, dob: string) => {
    return supabase.auth.signUp({
      email, password,
      options: { data: { display_name: displayName, username, gender, dob } }
    });
  };

  const signIn = async (email: string, password: string) => {
    return supabase.auth.signInWithPassword({ email, password });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole('user');
    setWarnings([]);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, role, loading, warnings, signUp, signIn, signOut, refreshProfile, refreshWarnings }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

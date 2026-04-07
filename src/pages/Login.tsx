import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Radio } from 'lucide-react';

const Login = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Welcome back to EchoVerse!');
    navigate('/feed');
  };

  const fillDemo = () => {
    setEmail('demo@echoverse.app');
    setPassword('Demo@123');
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-primary/10 via-background to-pink-500/5">
      <Card className="w-full max-w-md animate-fade-in shadow-xl">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto h-14 w-14 rounded-2xl echo-gradient flex items-center justify-center shadow-lg">
            <Radio className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-pink-500 bg-clip-text text-transparent">EchoVerse</CardTitle>
          <p className="text-muted-foreground">Sign in to your verse</p>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <Input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
            <Input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
            <button type="button" onClick={fillDemo} className="text-xs text-primary hover:underline">
              Use demo account →
            </button>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full echo-gradient text-primary-foreground border-0 hover:opacity-90" disabled={loading}>{loading ? 'Entering the verse...' : 'Enter the Verse'}</Button>
            <p className="text-sm text-muted-foreground">New to EchoVerse? <Link to="/register" className="text-primary hover:underline">Create your verse</Link></p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default Login;

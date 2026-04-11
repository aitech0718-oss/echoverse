import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Radio, Eye, EyeOff, Check, X } from 'lucide-react';

const Register = () => {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [gender, setGender] = useState('');
  const [dob, setDob] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const hasMinLength = password.length >= 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
  const isPasswordValid = hasMinLength && hasUpperCase && hasSymbol;

  const getAge = (dobStr: string) => {
    const today = new Date();
    const birth = new Date(dobStr);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordValid) { toast.error('Password does not meet requirements'); return; }
    if (!passwordsMatch) { toast.error('Passwords do not match'); return; }
    if (!name.trim() || !username.trim()) { toast.error('Name and username are required'); return; }
    if (!gender) { toast.error('Please select your gender'); return; }
    if (!dob) { toast.error('Please enter your date of birth'); return; }
    if (getAge(dob) < 16) { toast.error('You must be at least 16 years old to join EchoVerse'); return; }

    setLoading(true);
    const { error } = await signUp(email, password, name, username, gender, dob);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Welcome to EchoVerse! Your voice matters.');
    navigate('/feed');
  };

  const Rule = ({ met, label }: { met: boolean; label: string }) => (
    <div className={`flex items-center gap-1.5 text-xs ${met ? 'text-green-500' : 'text-muted-foreground'}`}>
      {met ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      {label}
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-gradient-to-br from-primary/10 via-background to-pink-500/5">
      <Card className="w-full max-w-md animate-fade-in shadow-xl">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto h-14 w-14 rounded-2xl echo-gradient flex items-center justify-center shadow-lg">
            <Radio className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-pink-500 bg-clip-text text-transparent">EchoVerse</CardTitle>
          <p className="text-muted-foreground">Create your verse</p>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Display Name *</label>
                <Input placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} required />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Username *</label>
                <Input placeholder="johndoe" value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} required />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Email *</label>
              <Input type="email" placeholder="john@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Gender *</label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="non-binary">Non-binary</SelectItem>
                    <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Date of Birth *</label>
                <Input type="date" value={dob} onChange={e => setDob(e.target.value)} required max={new Date().toISOString().split('T')[0]} />
              </div>
            </div>
            {dob && getAge(dob) < 16 && (
              <p className="text-xs text-destructive flex items-center gap-1"><X className="h-3 w-3" /> You must be at least 16 years old</p>
            )}
            <div>
              <label className="text-xs font-medium text-muted-foreground">Password *</label>
              <div className="relative">
                <Input type={showPassword ? 'text' : 'password'} placeholder="Min 8 chars, 1 upper, 1 symbol" value={password} onChange={e => setPassword(e.target.value)} required />
                <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full w-10" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {password.length > 0 && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                  <Rule met={hasMinLength} label="8+ characters" />
                  <Rule met={hasUpperCase} label="1 uppercase" />
                  <Rule met={hasSymbol} label="1 symbol" />
                </div>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Confirm Password *</label>
              <div className="relative">
                <Input type={showConfirm ? 'text' : 'password'} placeholder="Re-enter password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
                <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full w-10" onClick={() => setShowConfirm(!showConfirm)}>
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {confirmPassword.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs mt-1.5">
                  {passwordsMatch ? <Check className="h-3 w-3 text-green-500" /> : <X className="h-3 w-3 text-destructive" />}
                  <span className={passwordsMatch ? 'text-green-500' : 'text-destructive'}>{passwordsMatch ? 'Passwords match' : 'Passwords do not match'}</span>
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full echo-gradient text-primary-foreground border-0 hover:opacity-90" disabled={loading || !isPasswordValid || !passwordsMatch || (!!dob && getAge(dob) < 16)}>
              {loading ? 'Creating your verse...' : 'Join EchoVerse'}
            </Button>
            <p className="text-sm text-muted-foreground">Already echoing? <Link to="/login" className="text-primary hover:underline">Sign in</Link></p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default Register;

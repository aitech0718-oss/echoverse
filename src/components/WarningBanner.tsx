import { useAuth } from '@/hooks/useAuth';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';

const WarningBanner = () => {
  const { warnings } = useAuth();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Show warnings from last 1 hour only
  const recentWarnings = warnings.filter(w => {
    const created = new Date(w.created_at);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return created > oneHourAgo && !dismissed.has(w.id);
  });

  if (recentWarnings.length === 0) return null;

  return (
    <div className="space-y-2">
      {recentWarnings.map((w: any) => (
        <Alert key={w.id} className="border-yellow-500/50 bg-yellow-500/5 relative animate-fade-in">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          <AlertTitle className="text-yellow-600 text-sm font-semibold">
            ⚠️ Admin Warning ({warnings.length}/3)
          </AlertTitle>
          <AlertDescription className="text-sm mt-1">
            <p>{w.reason}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Issued {formatDistanceToNow(new Date(w.created_at), { addSuffix: true })}
            </p>
          </AlertDescription>
          <button
            onClick={() => setDismissed(prev => new Set(prev).add(w.id))}
            className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </Alert>
      ))}
    </div>
  );
};

export default WarningBanner;

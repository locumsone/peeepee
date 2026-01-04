import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface CallLog {
  id: string;
  phone_number: string;
  candidate_name: string | null;
  duration_seconds: number | null;
  call_type: string | null;
  created_at: string;
}

interface SoftphoneRecentProps {
  onCallBack: (phoneNumber: string) => void;
}

const formatDuration = (seconds: number | null): string => {
  if (!seconds) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const getCallIcon = (type: string | null) => {
  switch (type) {
    case 'outbound':
      return <PhoneOutgoing className="h-4 w-4 text-primary" />;
    case 'inbound':
      return <PhoneIncoming className="h-4 w-4 text-success" />;
    case 'missed':
      return <PhoneMissed className="h-4 w-4 text-destructive" />;
    default:
      return <Phone className="h-4 w-4 text-muted-foreground" />;
  }
};

export const SoftphoneRecent = ({ onCallBack }: SoftphoneRecentProps) => {
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCalls = async () => {
      const { data, error } = await supabase
        .from('ai_call_logs')
        .select('id, phone_number, candidate_name, duration_seconds, call_type, created_at')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error fetching call logs:', error);
      } else {
        setCalls(data || []);
      }
      setLoading(false);
    };

    fetchCalls();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (calls.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Phone className="h-12 w-12 mb-2 opacity-50" />
        <p>No recent calls</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {calls.map((call) => (
        <button
          key={call.id}
          onClick={() => onCallBack(call.phone_number)}
          className="w-full flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors text-left"
        >
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center">
            {getCallIcon(call.call_type)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {call.candidate_name || call.phone_number}
            </p>
            {call.candidate_name && (
              <p className="text-xs text-muted-foreground truncate">
                {call.phone_number}
              </p>
            )}
          </div>
          <div className="flex-shrink-0 text-right">
            <p className="text-sm text-foreground">
              {formatDuration(call.duration_seconds)}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(call.created_at), { addSuffix: true })}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
};

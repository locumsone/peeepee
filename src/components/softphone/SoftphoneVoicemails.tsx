import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Play, Pause, Check, Voicemail } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface VoicemailRecord {
  id: string;
  caller_number: string;
  caller_name: string | null;
  duration_seconds: number;
  audio_url: string;
  listened: boolean;
  created_at: string;
}

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const SoftphoneVoicemails = () => {
  const [voicemails, setVoicemails] = useState<VoicemailRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const fetchVoicemails = async () => {
      // Since voicemails table may not exist, we'll handle gracefully
      try {
        const { data, error } = await supabase
          .from('ai_call_logs')
          .select('*')
          .eq('voicemail_left', true)
          .order('created_at', { ascending: false })
          .limit(20);

        if (!error && data) {
          // Transform to voicemail format
          const vmData: VoicemailRecord[] = data.map((item: any) => ({
            id: item.id,
            caller_number: item.phone_number,
            caller_name: item.candidate_name,
            duration_seconds: item.duration_seconds || 0,
            audio_url: item.recording_url || '',
            listened: false,
            created_at: item.created_at,
          }));
          setVoicemails(vmData);
        }
      } catch (e) {
        console.error('Error fetching voicemails:', e);
      }
      setLoading(false);
    };

    fetchVoicemails();
  }, []);

  const handlePlay = (vm: VoicemailRecord) => {
    if (playingId === vm.id) {
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      audioRef.current = new Audio(vm.audio_url);
      audioRef.current.play();
      audioRef.current.onended = () => setPlayingId(null);
      setPlayingId(vm.id);
    }
  };

  const handleMarkListened = async (id: string) => {
    setVoicemails(prev => prev.filter(vm => vm.id !== id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (voicemails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Voicemail className="h-12 w-12 mb-2 opacity-50" />
        <p>No voicemails</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {voicemails.map((vm) => (
        <div key={vm.id} className="p-3 space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                {vm.caller_name || vm.caller_number}
              </p>
              {vm.caller_name && (
                <p className="text-xs text-muted-foreground">{vm.caller_number}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">
                {formatDuration(vm.duration_seconds)}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(vm.created_at), { addSuffix: true })}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handlePlay(vm)}
              disabled={!vm.audio_url}
              className="flex-1"
            >
              {playingId === vm.id ? (
                <>
                  <Pause className="h-4 w-4 mr-1" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-1" />
                  Play
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleMarkListened(vm.id)}
              className="text-muted-foreground hover:text-foreground"
            >
              <Check className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};

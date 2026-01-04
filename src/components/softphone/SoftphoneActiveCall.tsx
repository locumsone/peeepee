import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  Mic, MicOff, Pause, Play, Grid3X3, ArrowRightLeft, 
  PhoneOff, ChevronDown, User, MapPin, Star 
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface SoftphoneActiveCallProps {
  phoneNumber: string;
  callDuration: number;
  isMuted: boolean;
  isOnHold: boolean;
  onToggleMute: () => void;
  onToggleHold: () => void;
  onSendDigits: (digits: string) => void;
  onHangUp: () => void;
  callerContext?: any;
}

interface CandidateInfo {
  id: string;
  first_name: string;
  last_name: string;
  specialty: string;
  city: string;
  state: string;
  enrichment_tier: string;
  quality_score: number;
}

interface CallScript {
  opening: string;
  pitch: string;
  objections: string;
  closing: string;
}

const CALL_OUTCOMES = [
  { value: 'interested', label: 'Interested' },
  { value: 'callback', label: 'Callback Requested' },
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'no_answer', label: 'No Answer' },
  { value: 'voicemail', label: 'Voicemail' },
  { value: 'wrong_number', label: 'Wrong Number' },
];

const KEYPAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const SoftphoneActiveCall = ({
  phoneNumber,
  callDuration,
  isMuted,
  isOnHold,
  onToggleMute,
  onToggleHold,
  onSendDigits,
  onHangUp,
  callerContext,
}: SoftphoneActiveCallProps) => {
  const [showKeypad, setShowKeypad] = useState(false);
  const [notes, setNotes] = useState('');
  const [outcome, setOutcome] = useState('');
  const [callbackTime, setCallbackTime] = useState('');
  const [candidate, setCandidate] = useState<CandidateInfo | null>(null);
  const [script, setScript] = useState<CallScript | null>(null);
  const [scriptOpen, setScriptOpen] = useState(false);

  // Fetch candidate info if we have a known number
  useEffect(() => {
    const fetchCandidate = async () => {
      const digits = phoneNumber.replace(/\D/g, '');
      const { data } = await supabase
        .from('candidates')
        .select('id, first_name, last_name, specialty, city, state, enrichment_tier, quality_score')
        .or(`phone.ilike.%${digits},personal_mobile.ilike.%${digits}`)
        .limit(1)
        .single();
      
      if (data) {
        setCandidate(data);
      }
    };

    fetchCandidate();
  }, [phoneNumber]);

  // Fetch call script
  useEffect(() => {
    const fetchScript = async () => {
      const { data } = await supabase
        .from('agent_prompts')
        .select('prompt_text')
        .eq('agent_name', 'dialosaurus-rex')
        .eq('active', true)
        .single();
      
      if (data?.prompt_text) {
        try {
          // Parse script sections from prompt text
          const text = data.prompt_text;
          setScript({
            opening: text.match(/Opening:(.*?)(?=Pitch:|$)/s)?.[1]?.trim() || 'No opening script available',
            pitch: text.match(/Pitch:(.*?)(?=Objections:|$)/s)?.[1]?.trim() || 'No pitch script available',
            objections: text.match(/Objections:(.*?)(?=Closing:|$)/s)?.[1]?.trim() || 'No objection handling available',
            closing: text.match(/Closing:(.*?)$/s)?.[1]?.trim() || 'No closing script available',
          });
        } catch {
          // Default script if parsing fails
        }
      }
    };

    fetchScript();
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Call Info Header */}
      <div className="p-4 text-center border-b border-border">
        {callerContext && (
          <Badge className="mb-2 bg-primary/20 text-primary border-primary/30">
            Transferred from ARIA
          </Badge>
        )}
        <h3 className="text-xl font-semibold text-foreground">
          {candidate ? `${candidate.first_name} ${candidate.last_name}` : phoneNumber}
        </h3>
        <p className="text-3xl font-mono text-success mt-2">{formatDuration(callDuration)}</p>
        
        {/* Candidate Info Card */}
        {candidate && (
          <div className="mt-4 p-3 rounded-lg bg-muted/30 text-left">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{candidate.specialty || 'Unknown Specialty'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm mt-1">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>{candidate.city}, {candidate.state}</span>
            </div>
            <div className="flex items-center gap-3 mt-2">
              {candidate.quality_score && (
                <Badge variant="outline" className="text-xs">
                  <Star className="h-3 w-3 mr-1 text-warning" />
                  Score: {candidate.quality_score}
                </Badge>
              )}
              {candidate.enrichment_tier && (
                <Badge variant="outline" className="text-xs">
                  Tier: {candidate.enrichment_tier}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* ARIA Context */}
        {callerContext && (
          <div className="mt-3 p-3 rounded-lg bg-primary/10 text-left text-sm">
            <p className="text-muted-foreground">ARIA Notes:</p>
            <p className="text-foreground mt-1">{callerContext.call_summary}</p>
          </div>
        )}
      </div>

      {/* Call Controls */}
      <div className="p-4 border-b border-border">
        <div className="flex justify-center gap-4">
          <button
            onClick={onToggleMute}
            className={cn(
              "flex flex-col items-center gap-1 p-3 rounded-full transition-colors",
              isMuted ? "bg-destructive/20 text-destructive" : "bg-muted/50 text-foreground hover:bg-muted"
            )}
          >
            {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            <span className="text-[10px]">{isMuted ? 'Unmute' : 'Mute'}</span>
          </button>

          <button
            onClick={onToggleHold}
            className={cn(
              "flex flex-col items-center gap-1 p-3 rounded-full transition-colors",
              isOnHold ? "bg-warning/20 text-warning" : "bg-muted/50 text-foreground hover:bg-muted"
            )}
          >
            {isOnHold ? <Play className="h-6 w-6" /> : <Pause className="h-6 w-6" />}
            <span className="text-[10px]">{isOnHold ? 'Resume' : 'Hold'}</span>
          </button>

          <button
            onClick={() => setShowKeypad(!showKeypad)}
            className={cn(
              "flex flex-col items-center gap-1 p-3 rounded-full transition-colors",
              showKeypad ? "bg-primary/20 text-primary" : "bg-muted/50 text-foreground hover:bg-muted"
            )}
          >
            <Grid3X3 className="h-6 w-6" />
            <span className="text-[10px]">Keypad</span>
          </button>

          <button
            className="flex flex-col items-center gap-1 p-3 rounded-full bg-muted/30 text-muted-foreground cursor-not-allowed"
            disabled
          >
            <ArrowRightLeft className="h-6 w-6" />
            <span className="text-[10px]">Transfer</span>
          </button>
        </div>

        {/* In-call Keypad */}
        {showKeypad && (
          <div className="grid grid-cols-3 gap-2 mt-4">
            {KEYPAD.map((digit) => (
              <button
                key={digit}
                onClick={() => onSendDigits(digit)}
                className="h-12 rounded-lg bg-muted/30 hover:bg-muted/60 text-xl font-semibold text-foreground transition-colors"
              >
                {digit}
              </button>
            ))}
          </div>
        )}

        {/* End Call Button */}
        <Button
          onClick={onHangUp}
          className="w-full mt-4 h-14 text-lg font-semibold bg-destructive hover:bg-destructive/90"
        >
          <PhoneOff className="h-5 w-5 mr-2" />
          End Call
        </Button>
      </div>

      {/* Notes Section */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label className="text-xs text-muted-foreground">Call Notes</label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Enter call notes..."
            className="mt-1 bg-muted/30 border-border min-h-[80px]"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Outcome</label>
          <Select value={outcome} onValueChange={setOutcome}>
            <SelectTrigger className="mt-1 bg-muted/30 border-border">
              <SelectValue placeholder="Select outcome" />
            </SelectTrigger>
            <SelectContent>
              {CALL_OUTCOMES.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {outcome === 'callback' && (
          <div>
            <label className="text-xs text-muted-foreground">Callback Time</label>
            <input
              type="datetime-local"
              value={callbackTime}
              onChange={(e) => setCallbackTime(e.target.value)}
              className="mt-1 w-full p-2 rounded-md bg-muted/30 border border-border text-foreground text-sm"
            />
          </div>
        )}

        {/* Call Script */}
        {script && (
          <Collapsible open={scriptOpen} onOpenChange={setScriptOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
              <span className="text-sm font-medium">Call Script</span>
              <ChevronDown className={cn("h-4 w-4 transition-transform", scriptOpen && "rotate-180")} />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-3">
              {(['opening', 'pitch', 'objections', 'closing'] as const).map((section) => (
                <div key={section} className="p-3 rounded-lg bg-muted/20">
                  <h4 className="text-xs font-semibold text-primary uppercase mb-1">
                    {section}
                  </h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {script[section]}
                  </p>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  );
};

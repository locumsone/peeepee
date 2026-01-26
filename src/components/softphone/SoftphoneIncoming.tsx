import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, PhoneOff, User, Bot, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPhoneNumber } from '@/lib/formatPhone';

interface SoftphoneIncomingProps {
  phoneNumber: string;
  callerContext?: {
    candidate_name?: string;
    candidate_id?: string;
    call_summary?: string;
    job_title?: string;
    specialty?: string;
    state?: string;
    source?: 'aria_transfer' | 'database_match';
  };
  onAccept: () => void;
  onReject: () => void;
}

export const SoftphoneIncoming = ({
  phoneNumber,
  callerContext,
  onAccept,
  onReject,
}: SoftphoneIncomingProps) => {
  const isAriaTransfer = callerContext?.source === 'aria_transfer';
  const isDatabaseMatch = callerContext?.source === 'database_match';

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[60] flex items-center justify-center">
      <div className="w-[360px] bg-card rounded-2xl shadow-2xl p-6 space-y-4 animate-pulse-subtle border border-border">
        {/* Header */}
        <div className="text-center">
          {isAriaTransfer && (
            <Badge className="mb-3 bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
              <Bot className="h-3 w-3 mr-1" />
              Transferred from ARIA
            </Badge>
          )}
          {isDatabaseMatch && (
            <Badge className="mb-3 bg-primary/20 text-primary border-primary/30">
              <Database className="h-3 w-3 mr-1" />
              Matched in Database
            </Badge>
          )}
          <div className="w-20 h-20 rounded-full bg-success/20 mx-auto mb-4 flex items-center justify-center animate-pulse">
            <Phone className="h-10 w-10 text-success" />
          </div>
          <h3 className="text-xl font-semibold text-foreground">
            Incoming Call
          </h3>
          <p className="text-lg text-foreground mt-1 font-medium">
            {callerContext?.candidate_name || formatPhoneNumber(phoneNumber)}
          </p>
          {callerContext?.candidate_name && (
            <p className="text-sm text-muted-foreground font-mono">{formatPhoneNumber(phoneNumber)}</p>
          )}
        </div>

        {/* Context Info */}
        {callerContext && (
          <div className={cn(
            "p-4 rounded-lg space-y-2",
            isAriaTransfer ? "bg-cyan-500/10 border border-cyan-500/20" : "bg-primary/10 border border-primary/20"
          )}>
            <p className={cn(
              "text-xs font-medium uppercase",
              isAriaTransfer ? "text-cyan-400" : "text-primary"
            )}>
              {isAriaTransfer ? "ARIA Transfer Notes" : "Candidate Info"}
            </p>
            
            {/* Show specialty/state for database matches */}
            {isDatabaseMatch && (callerContext.specialty || callerContext.state) && (
              <p className="text-sm text-foreground">
                {callerContext.specialty}
                {callerContext.specialty && callerContext.state && " • "}
                {callerContext.state}
              </p>
            )}
            
            {/* Show job title for ARIA transfers */}
            {callerContext.job_title && (
              <p className="text-sm text-foreground">
                <span className="text-muted-foreground">Job discussed: </span>
                {callerContext.job_title}
              </p>
            )}
            {callerContext.call_summary && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {callerContext.call_summary}
              </p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4 pt-2">
          <Button
            onClick={onReject}
            className="flex-1 h-14 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            <PhoneOff className="h-5 w-5 mr-2" />
            Decline
          </Button>
          <Button
            onClick={onAccept}
            className="flex-1 h-14 bg-success hover:bg-success/90 text-success-foreground"
          >
            <Phone className="h-5 w-5 mr-2" />
            Accept
          </Button>
        </div>
      </div>

      <style>{`
        @keyframes pulse-subtle {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }
        .animate-pulse-subtle {
          animation: pulse-subtle 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

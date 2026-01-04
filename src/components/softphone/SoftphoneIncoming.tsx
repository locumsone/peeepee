import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, PhoneOff, User, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SoftphoneIncomingProps {
  phoneNumber: string;
  callerContext?: {
    candidate_name?: string;
    call_summary?: string;
    job_title?: string;
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
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[60] flex items-center justify-center">
      <div className="w-[360px] bg-card rounded-2xl shadow-2xl p-6 space-y-4 animate-pulse-subtle border border-border">
        {/* Header */}
        <div className="text-center">
          {callerContext && (
            <Badge className="mb-3 bg-primary/20 text-primary border-primary/30">
              Transferred from ARIA
            </Badge>
          )}
          <div className="w-20 h-20 rounded-full bg-success/20 mx-auto mb-4 flex items-center justify-center animate-pulse">
            <Phone className="h-10 w-10 text-success" />
          </div>
          <h3 className="text-xl font-semibold text-foreground">
            Incoming Call
          </h3>
          <p className="text-lg text-muted-foreground mt-1">
            {callerContext?.candidate_name || phoneNumber}
          </p>
          {callerContext?.candidate_name && (
            <p className="text-sm text-muted-foreground">{phoneNumber}</p>
          )}
        </div>

        {/* ARIA Context */}
        {callerContext && (
          <div className="p-4 rounded-lg bg-primary/10 space-y-2">
            <p className="text-xs font-medium text-primary uppercase">ARIA Transfer Notes</p>
            {callerContext.job_title && (
              <p className="text-sm text-foreground">
                <span className="text-muted-foreground">Job discussed: </span>
                {callerContext.job_title}
              </p>
            )}
            {callerContext.call_summary && (
              <p className="text-sm text-muted-foreground">
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

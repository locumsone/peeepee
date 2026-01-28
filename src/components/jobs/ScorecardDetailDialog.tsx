import { useState } from "react";
import { 
  X, Star, Check, Phone, MessageSquare, UserPlus, 
  MapPin, Briefcase, AlertTriangle, Sparkles, RotateCcw, Maximize2 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

interface CandidateForScorecard {
  id: string;
  candidate_id: string | null;
  candidate_name: string | null;
  candidate_specialty: string | null;
  candidate_state: string | null;
  candidate_email?: string | null;
  candidate_phone?: string | null;
  status: string | null;
  tier: number | null;
  match_score?: number | null;
  match_reasons?: string[] | null;
  match_concerns?: string[] | null;
  licenses?: string[] | null;
  board_certified?: boolean | null;
}

interface ScorecardAttribute {
  id: string;
  label: string;
  type: "boolean" | "rating";
  description?: string;
}

interface ScorecardDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: CandidateForScorecard | null;
  attributes: ScorecardAttribute[];
  scores: Record<string, number | boolean>;
  autoScores: Record<string, number | boolean>;
  overallScore: number;
  requiredState?: string;
  onScoreChange: (attrId: string, value: number | boolean) => void;
  onReset: () => void;
  onRemove: () => void;
  onCall?: () => void;
  onSMS?: () => void;
  onAddToCampaign?: () => void;
}

export const ScorecardDetailDialog = ({
  open,
  onOpenChange,
  candidate,
  attributes,
  scores,
  autoScores,
  overallScore,
  requiredState,
  onScoreChange,
  onReset,
  onRemove,
  onCall,
  onSMS,
  onAddToCampaign,
}: ScorecardDetailDialogProps) => {
  const [notes, setNotes] = useState("");

  if (!candidate) return null;

  const hasLicense = requiredState && candidate.licenses?.some(
    l => l.toLowerCase().includes(requiredState.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Candidate Evaluation</span>
            <Badge
              variant={overallScore >= 70 ? "default" : overallScore >= 40 ? "secondary" : "outline"}
              className={cn(
                "text-lg px-3 py-1",
                overallScore >= 70 && "bg-success text-success-foreground",
                overallScore >= 40 && overallScore < 70 && "bg-warning text-warning-foreground"
              )}
            >
              {overallScore}%
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Candidate Header */}
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h3 className="text-xl font-semibold text-foreground">
                {candidate.candidate_name || "Unknown Candidate"}
              </h3>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                {candidate.candidate_specialty && (
                  <span className="flex items-center gap-1">
                    <Briefcase className="h-3.5 w-3.5" />
                    {candidate.candidate_specialty}
                  </span>
                )}
                {candidate.candidate_state && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {candidate.candidate_state}
                    {hasLicense && (
                      <Badge variant="secondary" className="text-[10px] ml-1 bg-success/20 text-success">
                        Licensed
                      </Badge>
                    )}
                  </span>
                )}
              </div>
              {candidate.match_score && (
                <Badge variant="outline" className="mt-2">
                  <Sparkles className="h-3 w-3 mr-1" />
                  AI Match: {candidate.match_score}%
                </Badge>
              )}
            </div>
            
            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              {onCall && (
                <Button variant="outline" size="sm" onClick={onCall}>
                  <Phone className="h-4 w-4" />
                </Button>
              )}
              {onSMS && (
                <Button variant="outline" size="sm" onClick={onSMS}>
                  <MessageSquare className="h-4 w-4" />
                </Button>
              )}
              {onAddToCampaign && (
                <Button variant="default" size="sm" onClick={onAddToCampaign}>
                  <UserPlus className="h-4 w-4 mr-1" />
                  Add to Campaign
                </Button>
              )}
            </div>
          </div>

          {/* Match Reasons/Concerns */}
          {(candidate.match_reasons?.length || candidate.match_concerns?.length) && (
            <div className="grid grid-cols-2 gap-4">
              {candidate.match_reasons && candidate.match_reasons.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-success flex items-center gap-1">
                    <Check className="h-4 w-4" />
                    Match Reasons
                  </h4>
                  <ul className="space-y-1">
                    {candidate.match_reasons.map((reason, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-success mt-1">•</span>
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {candidate.match_concerns && candidate.match_concerns.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-warning flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" />
                    Concerns
                  </h4>
                  <ul className="space-y-1">
                    {candidate.match_concerns.map((concern, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-warning mt-1">•</span>
                        {concern}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <Separator />

          {/* Scorecard */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-foreground">Evaluation Criteria</h4>
              <Button variant="ghost" size="sm" onClick={onReset}>
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset
              </Button>
            </div>

            <div className="grid gap-4">
              {attributes.map((attr) => {
                const autoValue = autoScores[attr.id];
                const manualValue = scores[attr.id];
                const value = manualValue ?? autoValue;
                const isAuto = manualValue === undefined && autoValue !== undefined;

                return (
                  <div 
                    key={attr.id} 
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{attr.label}</span>
                        {isAuto && (
                          <Badge variant="outline" className="text-[10px]">Auto</Badge>
                        )}
                      </div>
                      {attr.description && (
                        <p className="text-xs text-muted-foreground">{attr.description}</p>
                      )}
                    </div>

                    {attr.type === "boolean" ? (
                      <div className="flex items-center gap-2">
                        <Button
                          variant={value === true ? "default" : "outline"}
                          size="sm"
                          className={cn(
                            "h-8 w-8 p-0",
                            value === true && "bg-success hover:bg-success/90"
                          )}
                          onClick={() => onScoreChange(attr.id, true)}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          variant={value === false ? "default" : "outline"}
                          size="sm"
                          className={cn(
                            "h-8 w-8 p-0",
                            value === false && "bg-destructive hover:bg-destructive/90"
                          )}
                          onClick={() => onScoreChange(attr.id, false)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() => onScoreChange(attr.id, star)}
                            className="p-1 hover:scale-110 transition-transform"
                          >
                            <Star
                              className={cn(
                                "h-5 w-5",
                                typeof value === "number" && star <= value
                                  ? "text-warning fill-warning"
                                  : "text-muted-foreground"
                              )}
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Notes */}
          <div className="space-y-2">
            <h4 className="font-medium text-foreground">Evaluation Notes</h4>
            <Textarea
              placeholder="Add notes about this candidate's fit for the role..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4">
            <Button 
              variant="destructive" 
              size="sm"
              onClick={() => {
                onRemove();
                onOpenChange(false);
              }}
            >
              <X className="h-4 w-4 mr-1" />
              Remove Match
            </Button>
            <Button onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ScorecardDetailDialog;

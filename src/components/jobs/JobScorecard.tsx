import { useState } from "react";
import { Star, Check, X, HelpCircle, Maximize2, RotateCcw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useScorecardRatings } from "@/hooks/useScorecardRatings";
import { ScorecardDetailDialog } from "./ScorecardDetailDialog";
import { RemoveMatchDialog } from "./RemoveMatchDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface CandidateLead {
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

interface JobScorecardProps {
  jobId: string;
  leads: CandidateLead[];
  requiredState?: string;
  requiredSpecialty?: string;
  onRemoveCandidate?: (candidateId: string) => void;
}

// Define evaluation criteria
const SCORECARD_ATTRIBUTES: ScorecardAttribute[] = [
  { 
    id: "state_license", 
    label: "State License", 
    type: "boolean",
    description: "Candidate has active license in required state"
  },
  { 
    id: "specialty_match", 
    label: "Specialty Match", 
    type: "boolean",
    description: "Candidate specialty matches job requirements"
  },
  { 
    id: "experience", 
    label: "Experience Level", 
    type: "rating",
    description: "Years of relevant experience (1-5 stars)"
  },
  { 
    id: "availability", 
    label: "Availability", 
    type: "rating",
    description: "How soon can candidate start"
  },
  { 
    id: "rate_fit", 
    label: "Rate Fit", 
    type: "rating",
    description: "Expected rate vs. job pay rate"
  },
];

export const JobScorecard = ({ 
  jobId, 
  leads, 
  requiredState,
  requiredSpecialty,
  onRemoveCandidate,
}: JobScorecardProps) => {
  // Persisted scorecard ratings
  const { ratings, isLoading: ratingsLoading, setRating, resetRatings, resetAllRatings } = useScorecardRatings(jobId);
  
  // Dialog state
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateLead | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [candidateToRemove, setCandidateToRemove] = useState<CandidateLead | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const getScoreValue = (candidateId: string, attrId: string) => {
    return ratings[candidateId]?.[attrId];
  };

  const autoEvaluateCandidate = (lead: CandidateLead): Record<string, number | boolean> => {
    const auto: Record<string, number | boolean> = {};
    
    // Auto-evaluate state license
    if (requiredState && lead.candidate_state) {
      auto.state_license = lead.candidate_state.toLowerCase() === requiredState.toLowerCase();
    }
    
    // Auto-evaluate specialty match
    if (requiredSpecialty && lead.candidate_specialty) {
      auto.specialty_match = lead.candidate_specialty.toLowerCase().includes(requiredSpecialty.toLowerCase());
    }
    
    return auto;
  };

  const calculateOverallScore = (candidateId: string, lead: CandidateLead): number => {
    const autoScores = autoEvaluateCandidate(lead);
    const manualScores = ratings[candidateId] || {};
    const combined = { ...autoScores, ...manualScores };
    
    let total = 0;
    let maxPossible = 0;
    
    SCORECARD_ATTRIBUTES.forEach(attr => {
      if (attr.type === "boolean") {
        maxPossible += 20;
        if (combined[attr.id] === true) total += 20;
      } else {
        maxPossible += 25;
        const rating = combined[attr.id] as number;
        if (typeof rating === "number") total += rating * 5;
      }
    });
    
    return maxPossible > 0 ? Math.round((total / maxPossible) * 100) : 0;
  };

  const handleRemoveConfirm = async () => {
    if (!candidateToRemove) return;
    
    setIsRemoving(true);
    try {
      const candidateId = candidateToRemove.candidate_id || candidateToRemove.id;
      
      const { error } = await supabase
        .from("candidate_job_matches")
        .delete()
        .eq("job_id", jobId)
        .eq("candidate_id", candidateId);

      if (error) throw error;

      toast({ title: "Candidate removed from matches" });
      onRemoveCandidate?.(candidateId);
    } catch (err) {
      console.error("Error removing match:", err);
      toast({
        title: "Error",
        description: "Failed to remove candidate",
        variant: "destructive",
      });
    } finally {
      setIsRemoving(false);
      setRemoveDialogOpen(false);
      setCandidateToRemove(null);
    }
  };

  const openDetailDialog = (lead: CandidateLead) => {
    setSelectedCandidate(lead);
    setDetailDialogOpen(true);
  };

  if (leads.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Star className="h-12 w-12 mx-auto mb-4 opacity-30" />
        <h3 className="text-lg font-medium text-foreground mb-2">No Candidates to Evaluate</h3>
        <p>Add candidates to this job to use the scorecard</p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-foreground">Candidate Scorecard</h3>
            <p className="text-sm text-muted-foreground">
              Evaluate candidates against job requirements
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={resetAllRatings}
              disabled={ratingsLoading}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset All
            </Button>
            <Badge variant="outline">
              {leads.length} candidate{leads.length !== 1 ? "s" : ""}
            </Badge>
          </div>
        </div>

        {/* Scorecard Table - Native scroll instead of ScrollArea for table compatibility */}
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="max-h-[500px] overflow-auto">
            <table className="w-full min-w-[800px]">
              <thead className="bg-muted/50 sticky top-0 z-10">
                <tr>
                  <th className="text-left p-3 text-sm font-medium text-foreground min-w-[200px]">
                    Candidate
                  </th>
                  {SCORECARD_ATTRIBUTES.map(attr => (
                    <th key={attr.id} className="p-3 text-center text-sm font-medium text-foreground min-w-[100px]">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button 
                            type="button" 
                            className="inline-flex items-center justify-center gap-1 cursor-help"
                          >
                            {attr.label}
                            <HelpCircle className="h-3 w-3 text-muted-foreground" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{attr.description}</TooltipContent>
                      </Tooltip>
                    </th>
                  ))}
                  <th className="p-3 text-center text-sm font-medium text-foreground min-w-[80px]">
                    Score
                  </th>
                  <th className="p-3 text-center text-sm font-medium text-foreground w-[100px]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {leads.map(lead => {
                  const candidateId = lead.candidate_id || lead.id;
                  const autoScores = autoEvaluateCandidate(lead);
                  const overallScore = calculateOverallScore(candidateId, lead);
                  
                  return (
                    <tr 
                      key={lead.id} 
                      className="hover:bg-muted/30 transition-colors group cursor-pointer"
                      onClick={() => openDetailDialog(lead)}
                    >
                      <td className="p-3">
                        <div>
                          <div className="font-medium text-foreground">
                            {lead.candidate_name || "Unknown"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {lead.candidate_specialty} • {lead.candidate_state}
                          </div>
                        </div>
                      </td>
                      
                      {SCORECARD_ATTRIBUTES.map(attr => {
                        const autoValue = autoScores[attr.id];
                        const manualValue = getScoreValue(candidateId, attr.id);
                        const value = manualValue ?? autoValue;
                        const isAuto = manualValue === undefined && autoValue !== undefined;
                        
                        return (
                          <td key={attr.id} className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                            {attr.type === "boolean" ? (
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className={cn(
                                    "h-8 w-8 p-0",
                                    value === true && "bg-success/20 text-success"
                                  )}
                                  onClick={() => setRating(candidateId, attr.id, true)}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className={cn(
                                    "h-8 w-8 p-0",
                                    value === false && "bg-destructive/20 text-destructive"
                                  )}
                                  onClick={() => setRating(candidateId, attr.id, false)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                                {isAuto && (
                                  <Badge variant="outline" className="text-[10px] ml-1">
                                    Auto
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-0.5">
                                {[1, 2, 3, 4, 5].map(star => (
                                  <button
                                    key={star}
                                    type="button"
                                    onClick={() => setRating(candidateId, attr.id, star)}
                                    className="p-0.5 hover:scale-110 transition-transform"
                                  >
                                    <Star
                                      className={cn(
                                        "h-4 w-4",
                                        typeof value === "number" && star <= value
                                          ? "text-warning fill-warning"
                                          : "text-muted-foreground"
                                      )}
                                    />
                                  </button>
                                ))}
                              </div>
                            )}
                          </td>
                        );
                      })}
                      
                      <td className="p-3 text-center">
                        <Badge
                          variant={overallScore >= 70 ? "default" : overallScore >= 40 ? "secondary" : "outline"}
                          className={cn(
                            overallScore >= 70 && "bg-success text-success-foreground",
                            overallScore >= 40 && overallScore < 70 && "bg-warning text-warning-foreground"
                          )}
                        >
                          {overallScore}%
                        </Badge>
                      </td>

                      <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => openDetailDialog(lead)}
                              >
                                <Maximize2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Expand Details</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                onClick={() => {
                                  setCandidateToRemove(lead);
                                  setRemoveDialogOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Remove Match</TooltipContent>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Detail Dialog */}
      {selectedCandidate && (
        <ScorecardDetailDialog
          open={detailDialogOpen}
          onOpenChange={setDetailDialogOpen}
          candidate={selectedCandidate}
          attributes={SCORECARD_ATTRIBUTES}
          scores={ratings[selectedCandidate.candidate_id || selectedCandidate.id] || {}}
          autoScores={autoEvaluateCandidate(selectedCandidate)}
          overallScore={calculateOverallScore(selectedCandidate.candidate_id || selectedCandidate.id, selectedCandidate)}
          requiredState={requiredState}
          onScoreChange={(attrId, value) => 
            setRating(selectedCandidate.candidate_id || selectedCandidate.id, attrId, value)
          }
          onReset={() => resetRatings(selectedCandidate.candidate_id || selectedCandidate.id)}
          onRemove={() => {
            setCandidateToRemove(selectedCandidate);
            setRemoveDialogOpen(true);
          }}
        />
      )}

      {/* Remove Confirmation Dialog */}
      <RemoveMatchDialog
        open={removeDialogOpen}
        onOpenChange={setRemoveDialogOpen}
        candidateName={candidateToRemove?.candidate_name || "Unknown"}
        onConfirm={handleRemoveConfirm}
        isLoading={isRemoving}
      />
    </TooltipProvider>
  );
};

export default JobScorecard;

import { useState } from "react";
import { Star, Check, X, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CandidateLead {
  id: string;
  candidate_id: string | null;
  candidate_name: string | null;
  candidate_specialty: string | null;
  candidate_state: string | null;
  status: string | null;
  tier: number | null;
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
  requiredSpecialty 
}: JobScorecardProps) => {
  // Local state for scorecard ratings (would persist to DB in production)
  const [scores, setScores] = useState<Record<string, Record<string, number | boolean>>>({});

  const getScoreValue = (leadId: string, attrId: string) => {
    return scores[leadId]?.[attrId];
  };

  const setScoreValue = (leadId: string, attrId: string, value: number | boolean) => {
    setScores(prev => ({
      ...prev,
      [leadId]: {
        ...prev[leadId],
        [attrId]: value,
      },
    }));
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

  const calculateOverallScore = (leadId: string, lead: CandidateLead): number => {
    const autoScores = autoEvaluateCandidate(lead);
    const manualScores = scores[leadId] || {};
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
          <Badge variant="outline">
            {leads.length} candidate{leads.length !== 1 ? "s" : ""}
          </Badge>
        </div>

        {/* Scorecard Table */}
        <div className="rounded-xl border border-border overflow-hidden">
          <ScrollArea className="max-h-[500px]">
            <table className="w-full">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-left p-3 text-sm font-medium text-foreground min-w-[200px]">
                    Candidate
                  </th>
                  {SCORECARD_ATTRIBUTES.map(attr => (
                    <th key={attr.id} className="p-3 text-center text-sm font-medium text-foreground min-w-[100px]">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex items-center justify-center gap-1 cursor-help">
                            {attr.label}
                            <HelpCircle className="h-3 w-3 text-muted-foreground" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{attr.description}</TooltipContent>
                      </Tooltip>
                    </th>
                  ))}
                  <th className="p-3 text-center text-sm font-medium text-foreground">
                    Score
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {leads.map(lead => {
                  const autoScores = autoEvaluateCandidate(lead);
                  const overallScore = calculateOverallScore(lead.id, lead);
                  
                  return (
                    <tr key={lead.id} className="hover:bg-muted/30 transition-colors">
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
                        const manualValue = getScoreValue(lead.id, attr.id);
                        const value = manualValue ?? autoValue;
                        const isAuto = manualValue === undefined && autoValue !== undefined;
                        
                        return (
                          <td key={attr.id} className="p-3 text-center">
                            {attr.type === "boolean" ? (
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className={cn(
                                    "h-8 w-8 p-0",
                                    value === true && "bg-success/20 text-success"
                                  )}
                                  onClick={() => setScoreValue(lead.id, attr.id, true)}
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
                                  onClick={() => setScoreValue(lead.id, attr.id, false)}
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
                                    onClick={() => setScoreValue(lead.id, attr.id, star)}
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollArea>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default JobScorecard;

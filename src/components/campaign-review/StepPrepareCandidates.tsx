import { useState } from "react";
import { Users, ArrowRight, CheckCircle2, AlertTriangle, Loader2, Sparkles, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { SelectedCandidate, TierStats } from "./types";

interface StepPrepareCandidatesProps {
  candidates: SelectedCandidate[];
  tierStats: TierStats;
  jobId: string | null;
  onCandidatesUpdate: (candidates: SelectedCandidate[]) => void;
}

interface EnrichmentProgress {
  current: number;
  total: number;
  status: "idle" | "enriching" | "complete";
}

export function StepPrepareCandidates({
  candidates,
  tierStats,
  jobId,
  onCandidatesUpdate,
}: StepPrepareCandidatesProps) {
  const navigate = useNavigate();
  const [enrichmentProgress, setEnrichmentProgress] = useState<EnrichmentProgress>({
    current: 0,
    total: 0,
    status: "idle",
  });

  const needsEnrichment = tierStats.needsEnrichment;
  const estimatedCost = (needsEnrichment * 0.20).toFixed(2);

  const handleEnrichAll = async () => {
    const candidatesToEnrich = candidates.filter(c => {
      const hasEmail = c.email || c.personal_email;
      const hasPhone = c.phone || c.personal_mobile;
      return !hasEmail && !hasPhone;
    });

    if (candidatesToEnrich.length === 0) {
      toast({ title: "All candidates already have contact info" });
      return;
    }

    setEnrichmentProgress({
      current: 0,
      total: candidatesToEnrich.length,
      status: "enriching",
    });

    let successCount = 0;
    const updatedCandidates = [...candidates];

    for (let i = 0; i < candidatesToEnrich.length; i++) {
      const candidate = candidatesToEnrich[i];
      
      try {
        const { data, error } = await supabase.functions.invoke("enrich-contact", {
          body: {
            candidate_id: candidate.id,
            first_name: candidate.first_name,
            last_name: candidate.last_name,
            city: candidate.city,
            state: candidate.state,
            job_id: jobId,
          },
        });

        if (!error && data?.success) {
          successCount++;
          const idx = updatedCandidates.findIndex(c => c.id === candidate.id);
          if (idx !== -1) {
            updatedCandidates[idx] = {
              ...updatedCandidates[idx],
              personal_email: data.email || updatedCandidates[idx].personal_email,
              personal_mobile: data.phone || updatedCandidates[idx].personal_mobile,
              enrichment_source: data.source,
              enrichment_tier: "Platinum",
            };
          }
        }
      } catch (err) {
        console.error(`Failed to enrich ${candidate.first_name} ${candidate.last_name}:`, err);
      }

      setEnrichmentProgress(prev => ({
        ...prev,
        current: i + 1,
      }));
    }

    setEnrichmentProgress(prev => ({ ...prev, status: "complete" }));
    onCandidatesUpdate(updatedCandidates);

    toast({
      title: "Enrichment Complete",
      description: `Found contact info for ${successCount} of ${candidatesToEnrich.length} candidates`,
    });

    // Reset after a moment
    setTimeout(() => {
      setEnrichmentProgress({ current: 0, total: 0, status: "idle" });
    }, 2000);
  };

  const allReady = needsEnrichment === 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Candidate Breakdown */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h4 className="font-semibold text-foreground">Candidate Breakdown</h4>
          </div>

          <div className="bg-muted/30 rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-2xl font-bold text-foreground">{candidates.length}</span>
              <span className="text-sm text-muted-foreground">Total Selected</span>
            </div>

            <div className="space-y-2 border-t border-border pt-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">A-Tier (Top Match)</span>
                <Badge variant="default" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                  {tierStats.tier1}
                </Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">B-Tier (Good Match)</span>
                <Badge variant="secondary">{tierStats.tier2}</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">C-Tier (Potential)</span>
                <Badge variant="outline">{tierStats.tier3}</Badge>
              </div>
            </div>

            <div className="border-t border-border pt-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  Ready to Contact
                </span>
                <span className="font-medium text-emerald-400">{tierStats.readyCount}</span>
              </div>
              {needsEnrichment > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    Missing Contact Info
                  </span>
                  <span className="font-medium text-amber-400">{needsEnrichment}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Enrichment Panel */}
        <div className="space-y-4">
          {allReady ? (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/20 rounded-full">
                  <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-emerald-400">All Candidates Ready</h4>
                  <p className="text-sm text-muted-foreground">
                    All {candidates.length} candidates have contact information
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h4 className="font-semibold text-foreground">Contact Enrichment</h4>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 space-y-4">
                <div className="flex items-start gap-3">
                  <ArrowRight className="h-5 w-5 text-amber-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">
                      {needsEnrichment} candidates need contact info
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      We'll search PDL first ($0.05), then Whitepages ($0.30) if needed
                    </p>
                  </div>
                </div>

                {enrichmentProgress.status === "enriching" ? (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Enriching contacts...</span>
                      <span className="text-foreground font-medium">
                        {enrichmentProgress.current}/{enrichmentProgress.total}
                      </span>
                    </div>
                    <Progress 
                      value={(enrichmentProgress.current / enrichmentProgress.total) * 100} 
                      className="h-2"
                    />
                  </div>
                ) : enrichmentProgress.status === "complete" ? (
                  <div className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm font-medium">Enrichment complete!</span>
                  </div>
                ) : (
                  <Button
                    onClick={handleEnrichAll}
                    className="w-full bg-gradient-to-r from-primary to-sky-500"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Enrich All {needsEnrichment} Candidates · ~${estimatedCost}
                  </Button>
                )}

                <p className="text-xs text-muted-foreground">
                  Average cost: ~$0.20 per candidate (PDL hit rate ~60%)
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Edit Button */}
      <div className="flex justify-end pt-2 border-t border-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/campaigns/new/candidates")}
          className="text-muted-foreground hover:text-foreground"
        >
          <Edit2 className="h-4 w-4 mr-2" />
          Edit Candidates
        </Button>
      </div>
    </div>
  );
}

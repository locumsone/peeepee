import { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Search, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  AlertTriangle,
  DollarSign,
  Phone,
  Mail
} from "lucide-react";
import type { SelectedCandidate } from "./types";

interface EnrichmentPanelProps {
  candidates: SelectedCandidate[];
  jobId: string;
  onCandidatesUpdate: (candidates: SelectedCandidate[]) => void;
}

interface EnrichmentStatus {
  candidateId: string;
  status: "pending" | "enriching" | "success" | "failed" | "no_match";
  email?: string | null;
  phone?: string | null;
  source?: string;
}

const PDL_COST = 0.05;
const WHITEPAGES_COST = 0.30;
const AVG_COST_PER_CANDIDATE = 0.20; // Weighted average assuming 60% PDL hit rate

export function EnrichmentPanel({ candidates, jobId, onCandidatesUpdate }: EnrichmentPanelProps) {
  const [enrichmentStatuses, setEnrichmentStatuses] = useState<Record<string, EnrichmentStatus>>({});
  const [isEnrichingAll, setIsEnrichingAll] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState({ current: 0, total: 0 });

  // Filter candidates that need enrichment (missing BOTH email AND phone)
  const candidatesNeedingEnrichment = useMemo(() => {
    return candidates.filter(c => {
      const hasEmail = c.email || c.personal_email;
      const hasPhone = c.phone || c.personal_mobile;
      return !hasEmail && !hasPhone;
    });
  }, [candidates]);

  const estimatedCost = useMemo(() => {
    return (candidatesNeedingEnrichment.length * AVG_COST_PER_CANDIDATE).toFixed(2);
  }, [candidatesNeedingEnrichment.length]);

  const enrichCandidate = async (candidate: SelectedCandidate): Promise<EnrichmentStatus> => {
    setEnrichmentStatuses(prev => ({
      ...prev,
      [candidate.id]: { candidateId: candidate.id, status: "enriching" }
    }));

    try {
      const { data, error } = await supabase.functions.invoke("enrich-contact", {
        body: {
          candidate_id: candidate.id,
          first_name: candidate.first_name,
          last_name: candidate.last_name,
          city: candidate.city,
          state: candidate.state,
          specialty: candidate.specialty,
          job_id: jobId,
        },
      });

      if (error) throw error;

      const result: EnrichmentStatus = {
        candidateId: candidate.id,
        status: data.success ? "success" : "no_match",
        email: data.personal_email,
        phone: data.personal_mobile,
        source: data.source,
      };

      setEnrichmentStatuses(prev => ({
        ...prev,
        [candidate.id]: result
      }));

      // Update the candidate in the parent state
      if (data.success && (data.personal_email || data.personal_mobile)) {
        const updatedCandidates = candidates.map(c => 
          c.id === candidate.id 
            ? { 
                ...c, 
                personal_email: data.personal_email || c.personal_email,
                personal_mobile: data.personal_mobile || c.personal_mobile 
              }
            : c
        );
        onCandidatesUpdate(updatedCandidates);
      }

      return result;
    } catch (error) {
      console.error("Enrichment failed for candidate:", candidate.id, error);
      const result: EnrichmentStatus = {
        candidateId: candidate.id,
        status: "failed",
      };
      setEnrichmentStatuses(prev => ({
        ...prev,
        [candidate.id]: result
      }));
      return result;
    }
  };

  const enrichAllCandidates = async () => {
    if (candidatesNeedingEnrichment.length === 0) return;

    // Confirmation for bulk enrichment
    if (candidatesNeedingEnrichment.length > 10) {
      const confirmed = window.confirm(
        `This will enrich ${candidatesNeedingEnrichment.length} candidates at an estimated cost of ~$${estimatedCost}. Continue?`
      );
      if (!confirmed) return;
    }

    setIsEnrichingAll(true);
    setEnrichProgress({ current: 0, total: candidatesNeedingEnrichment.length });

    let successCount = 0;
    let failCount = 0;

    // Process in batches of 5 to avoid rate limiting
    const batchSize = 5;
    for (let i = 0; i < candidatesNeedingEnrichment.length; i += batchSize) {
      const batch = candidatesNeedingEnrichment.slice(i, i + batchSize);
      
      const results = await Promise.all(batch.map(c => enrichCandidate(c)));
      
      results.forEach(result => {
        if (result.status === "success") successCount++;
        else if (result.status === "failed" || result.status === "no_match") failCount++;
      });

      setEnrichProgress({ 
        current: Math.min(i + batchSize, candidatesNeedingEnrichment.length), 
        total: candidatesNeedingEnrichment.length 
      });

      // Small delay between batches
      if (i + batchSize < candidatesNeedingEnrichment.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    setIsEnrichingAll(false);

    toast({
      title: "Enrichment Complete",
      description: `Found contact info for ${successCount} candidates. ${failCount} had no matches.`,
      variant: successCount > 0 ? "default" : "destructive",
    });
  };

  const getStatusIcon = (status: EnrichmentStatus["status"]) => {
    switch (status) {
      case "enriching":
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case "success":
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-destructive" />;
      case "no_match":
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      default:
        return null;
    }
  };

  if (candidatesNeedingEnrichment.length === 0) {
    return (
      <Card className="border-success/30 bg-success/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            Contact Info Ready
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            All {candidates.length} candidates have contact information.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Contact Enrichment
          </CardTitle>
          <Badge variant="outline" className="text-warning border-warning">
            {candidatesNeedingEnrichment.length} need enrichment
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Cost Estimate */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Estimated cost:</span>
          </div>
          <span className="font-semibold text-sm">~${estimatedCost}</span>
        </div>

        {/* Progress during bulk enrichment */}
        {isEnrichingAll && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Enriching candidates...</span>
              <span className="font-medium">{enrichProgress.current} / {enrichProgress.total}</span>
            </div>
            <Progress 
              value={(enrichProgress.current / enrichProgress.total) * 100} 
              className="h-2" 
            />
          </div>
        )}

        {/* Candidate List */}
        <ScrollArea className="h-[200px]">
          <div className="space-y-2">
            {candidatesNeedingEnrichment.map((candidate) => {
              const status = enrichmentStatuses[candidate.id];
              
              return (
                <div 
                  key={candidate.id}
                  className="flex items-center justify-between p-2 rounded-lg border bg-background hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {status && getStatusIcon(status.status)}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        Dr. {candidate.first_name} {candidate.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {candidate.city}, {candidate.state}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {status?.status === "success" && (
                      <div className="flex items-center gap-1">
                        {status.email && <Mail className="h-3.5 w-3.5 text-success" />}
                        {status.phone && <Phone className="h-3.5 w-3.5 text-success" />}
                      </div>
                    )}
                    
                    {(!status || status.status === "pending") && !isEnrichingAll && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => enrichCandidate(candidate)}
                        className="h-7 text-xs"
                      >
                        <Search className="h-3 w-3 mr-1" />
                        Enrich
                      </Button>
                    )}

                    {status?.status === "no_match" && (
                      <Badge variant="secondary" className="text-xs">No match</Badge>
                    )}

                    {status?.status === "failed" && (
                      <Badge variant="destructive" className="text-xs">Failed</Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Bulk Enrich Button */}
        <Button
          onClick={enrichAllCandidates}
          disabled={isEnrichingAll || candidatesNeedingEnrichment.length === 0}
          className="w-full"
          variant="default"
        >
          {isEnrichingAll ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Enriching...
            </>
          ) : (
            <>
              <Search className="h-4 w-4 mr-2" />
              Enrich All {candidatesNeedingEnrichment.length} Candidates (~${estimatedCost})
            </>
          )}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          Uses PeopleDataLabs first, then Whitepages Pro for best match rates
        </p>
      </CardContent>
    </Card>
  );
}

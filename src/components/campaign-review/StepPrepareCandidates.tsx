import { useState } from "react";
import { Users, ArrowRight, CheckCircle2, AlertTriangle, Loader2, Sparkles, Edit2, Download, XCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

interface EnrichmentResult {
  candidateId: string;
  candidateName: string;
  status: 'success' | 'not_found' | 'failed';
  email?: string | null;
  phone?: string | null;
  source?: string;
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
  const [enrichmentResults, setEnrichmentResults] = useState<EnrichmentResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [totalCostSpent, setTotalCostSpent] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

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

    const results: EnrichmentResult[] = [];
    let totalCost = 0;
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

        console.log("Enrichment response for", candidate.first_name, candidate.last_name, ":", data);
        
        if (!error && data?.success) {
          successCount++;
          const idx = updatedCandidates.findIndex(c => c.id === candidate.id);
          if (idx !== -1) {
            updatedCandidates[idx] = {
              ...updatedCandidates[idx],
              personal_email: data.personal_email || updatedCandidates[idx].personal_email,
              personal_mobile: data.personal_mobile || updatedCandidates[idx].personal_mobile,
              enrichment_source: data.source,
              enrichment_tier: "Platinum",
            };
          }
          results.push({
            candidateId: candidate.id,
            candidateName: `Dr. ${candidate.first_name} ${candidate.last_name}`,
            status: 'success',
            email: data.personal_email,
            phone: data.personal_mobile,
            source: data.source
          });
          totalCost += data.cost || 0.20;
        } else {
          results.push({
            candidateId: candidate.id,
            candidateName: `Dr. ${candidate.first_name} ${candidate.last_name}`,
            status: data?.success === false ? 'not_found' : 'failed',
          });
          totalCost += 0.05; // PDL minimum cost even if not found
        }
      } catch (err) {
        console.error(`Failed to enrich ${candidate.first_name} ${candidate.last_name}:`, err);
        results.push({
          candidateId: candidate.id,
          candidateName: `Dr. ${candidate.first_name} ${candidate.last_name}`,
          status: 'failed',
        });
        totalCost += 0.05;
      }

      setEnrichmentProgress(prev => ({
        ...prev,
        current: i + 1,
      }));
    }

    setEnrichmentProgress(prev => ({ ...prev, status: "complete" }));
    setEnrichmentResults(results);
    setTotalCostSpent(totalCost);
    setShowResults(true);
    onCandidatesUpdate(updatedCandidates);

    toast({
      title: "Enrichment Complete",
      description: `Found contact info for ${successCount} of ${candidatesToEnrich.length} candidates`,
    });
  };

  const handleExportResults = () => {
    const csv = [
      ['Status', 'Name', 'Email', 'Phone', 'Source'],
      ...enrichmentResults.map(r => [
        r.status === 'success' ? 'Found' : 'Not Found',
        r.candidateName,
        r.email || '',
        r.phone || '',
        r.source || ''
      ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `enrichment-results-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleContinue = () => {
    setShowResults(false);
    setEnrichmentProgress({ current: 0, total: 0, status: "idle" });
  };

  const filteredResults = enrichmentResults.filter(r => 
    r.candidateName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const successCount = enrichmentResults.filter(r => r.status === 'success').length;
  const failedCount = enrichmentResults.filter(r => r.status !== 'success').length;

  const allReady = needsEnrichment === 0 && !showResults;

  return (
    <div className="space-y-4">
      {/* Enrichment Results Table */}
      {showResults && enrichmentResults.length > 0 ? (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="bg-muted/50 px-4 py-3 border-b border-border">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-foreground">Enrichment Results</h4>
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                  ✅ {successCount} found
                </Badge>
                <Badge variant="outline" className="text-muted-foreground">
                  ❌ {failedCount} not found
                </Badge>
              </div>
              <span className="text-sm text-muted-foreground">Total: ${totalCostSpent.toFixed(2)}</span>
            </div>
          </div>

          {/* Search */}
          <div className="px-4 py-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-8"
              />
            </div>
          </div>
          
          <ScrollArea className="h-[250px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Status</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredResults.map((result) => (
                  <TableRow key={result.candidateId}>
                    <TableCell>
                      {result.status === 'success' ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">{result.candidateName}</TableCell>
                    <TableCell className="text-muted-foreground">{result.email || '--'}</TableCell>
                    <TableCell className="text-muted-foreground">{result.phone || '--'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
          
          <div className="px-4 py-3 border-t border-border flex justify-between items-center">
            <Button variant="outline" size="sm" onClick={handleExportResults}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button size="sm" onClick={handleContinue}>
              Continue with {successCount} Candidates →
            </Button>
          </div>
        </div>
      ) : (
        /* Standard Candidate Breakdown + Enrichment Panel */
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
                        <span className="text-muted-foreground flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Enriching contacts...
                        </span>
                        <span className="text-foreground font-medium">
                          {enrichmentProgress.current}/{enrichmentProgress.total}
                        </span>
                      </div>
                      <Progress 
                        value={(enrichmentProgress.current / enrichmentProgress.total) * 100} 
                        className="h-2"
                      />
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
      )}

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

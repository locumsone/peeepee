import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import StepIndicator from "@/components/layout/StepIndicator";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, ArrowRight, CheckCircle2, AlertCircle, Phone, Mail, Check } from "lucide-react";

interface Candidate {
  id: string;
  name: string;
  unified_score: string;
  match_strength: number;
  enrichment_tier: string;
  personal_mobile?: string;
  personal_email?: string;
  phone?: string;
  email?: string;
  tier: number;
}

const steps = [
  { number: 1, label: "Job Details" },
  { number: 2, label: "Find Candidates" },
  { number: 3, label: "Assign Tiers" },
  { number: 4, label: "Review Contacts" },
  { number: 5, label: "Launch" },
];

const getScoreColor = (score: string) => {
  if (score.startsWith("A")) return "bg-green-500/20 text-green-400 border-green-500/30";
  if (score.startsWith("B")) return "bg-blue-500/20 text-blue-400 border-blue-500/30";
  return "bg-gray-500/20 text-gray-400 border-gray-500/30";
};

const getTierLabel = (tier: number) => {
  switch (tier) {
    case 1: return "Priority";
    case 2: return "Strong";
    case 3: return "Consider";
    default: return "Skip";
  }
};

const getTierColor = (tier: number) => {
  switch (tier) {
    case 1: return "bg-green-500/20 text-green-400";
    case 2: return "bg-blue-500/20 text-blue-400";
    case 3: return "bg-yellow-500/20 text-yellow-400";
    default: return "bg-muted text-muted-foreground";
  }
};

export default function EnrichmentReview() {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedForEnrichment, setSelectedForEnrichment] = useState<Set<string>>(new Set());
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichmentProgress, setEnrichmentProgress] = useState(0);
  const [enrichedCount, setEnrichedCount] = useState(0);
  const [totalToEnrich, setTotalToEnrich] = useState(0);
  const [completedEnrichments, setCompletedEnrichments] = useState<Set<string>>(new Set());

  useEffect(() => {
    const stored = sessionStorage.getItem("selectedForCampaign");
    if (stored) {
      const parsed = JSON.parse(stored) as Candidate[];
      // Filter to only Tiers 1-3
      const filtered = parsed.filter((c) => c.tier <= 3);
      setCandidates(filtered);
    }
  }, []);

  const isReadyToContact = (candidate: Candidate) => {
    return (
      candidate.enrichment_tier === "Platinum" ||
      candidate.personal_mobile ||
      candidate.personal_email
    );
  };

  const readyCandidates = candidates.filter(isReadyToContact);
  const needsEnrichmentCandidates = candidates.filter((c) => !isReadyToContact(c));

  const handleSelectForEnrichment = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedForEnrichment);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedForEnrichment(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedForEnrichment(new Set(needsEnrichmentCandidates.map((c) => c.id)));
    } else {
      setSelectedForEnrichment(new Set());
    }
  };

  const estimatedCost = selectedForEnrichment.size * 0.30;

  const runEnrichment = async (candidateIds: string[]) => {
    setIsEnriching(true);
    setTotalToEnrich(candidateIds.length);
    setEnrichedCount(0);
    setEnrichmentProgress(0);
    setCompletedEnrichments(new Set());

    for (let i = 0; i < candidateIds.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      setEnrichedCount(i + 1);
      setEnrichmentProgress(((i + 1) / candidateIds.length) * 100);
      setCompletedEnrichments((prev) => new Set([...prev, candidateIds[i]]));
    }

    // Simulate moving enriched candidates to ready section
    setCandidates((prev) =>
      prev.map((c) =>
        candidateIds.includes(c.id)
          ? { ...c, enrichment_tier: "Platinum", personal_mobile: "+1 (555) 123-4567" }
          : c
      )
    );

    setSelectedForEnrichment(new Set());
    setTimeout(() => setIsEnriching(false), 500);
  };

  const handleEnrichSelected = () => {
    runEnrichment(Array.from(selectedForEnrichment));
  };

  const handleEnrichAll = () => {
    runEnrichment(needsEnrichmentCandidates.map((c) => c.id));
  };

  const handleNext = () => {
    sessionStorage.setItem("enrichedCandidates", JSON.stringify(candidates));
    navigate("/campaign/launch");
  };

  return (
    <Layout>
      <div className="container mx-auto py-6 px-4 max-w-6xl">
        <StepIndicator currentStep={4} steps={steps} />

        <div className="mt-8 space-y-8">
          {/* Section 1: Ready to Contact */}
          <div className="rounded-lg border-2 border-green-500/30 overflow-hidden">
            <div className="bg-green-500/10 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-400" />
                <h2 className="text-lg font-semibold text-green-400">Ready to Contact</h2>
              </div>
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                {readyCandidates.length} candidates ready
              </Badge>
            </div>
            <div className="p-4">
              {readyCandidates.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/50">
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Tier</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {readyCandidates.map((candidate) => (
                      <TableRow key={candidate.id} className="border-border/30">
                        <TableCell>
                          <Check className="h-4 w-4 text-green-400" />
                        </TableCell>
                        <TableCell className="font-medium">{candidate.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getScoreColor(candidate.unified_score)}>
                            {candidate.unified_score}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">
                              {candidate.personal_mobile || (
                                <span className="text-muted-foreground">
                                  {candidate.phone || "—"}{" "}
                                  {candidate.phone && <span className="text-xs">(work)</span>}
                                </span>
                              )}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">
                              {candidate.personal_email || (
                                <span className="text-muted-foreground">
                                  {candidate.email || "—"}{" "}
                                  {candidate.email && <span className="text-xs">(work)</span>}
                                </span>
                              )}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getTierColor(candidate.tier)}>
                            {getTierLabel(candidate.tier)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No candidates ready to contact yet. Enrich candidates below to add contact info.
                </p>
              )}
            </div>
          </div>

          {/* Section 2: Needs Enrichment */}
          <div className="rounded-lg border-2 border-yellow-500/30 overflow-hidden">
            <div className="bg-yellow-500/10 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-400" />
                <h2 className="text-lg font-semibold text-yellow-400">Needs Enrichment</h2>
              </div>
              <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                {needsEnrichmentCandidates.length} candidates
              </Badge>
            </div>
            <div className="p-4">
              {needsEnrichmentCandidates.length > 0 ? (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/50">
                        <TableHead className="w-12">
                          <Checkbox
                            checked={
                              needsEnrichmentCandidates.length > 0 &&
                              selectedForEnrichment.size === needsEnrichmentCandidates.length
                            }
                            onCheckedChange={handleSelectAll}
                          />
                        </TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Work Phone</TableHead>
                        <TableHead>Work Email</TableHead>
                        <TableHead className="text-right">Est. Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {needsEnrichmentCandidates.map((candidate) => (
                        <TableRow key={candidate.id} className="border-border/30">
                          <TableCell>
                            <Checkbox
                              checked={selectedForEnrichment.has(candidate.id)}
                              onCheckedChange={(checked) =>
                                handleSelectForEnrichment(candidate.id, checked as boolean)
                              }
                            />
                          </TableCell>
                          <TableCell className="font-medium">{candidate.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={getScoreColor(candidate.unified_score)}>
                              {candidate.unified_score}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {candidate.phone || "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {candidate.email || "—"}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            $0.30
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Selected: <span className="font-medium text-foreground">{selectedForEnrichment.size}</span>
                      {" | "}
                      Estimated Cost:{" "}
                      <span className="font-medium text-foreground">${estimatedCost.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        onClick={handleEnrichAll}
                        disabled={needsEnrichmentCandidates.length === 0}
                      >
                        Enrich All Needed
                      </Button>
                      <Button
                        variant="gradient"
                        onClick={handleEnrichSelected}
                        disabled={selectedForEnrichment.size === 0}
                      >
                        Enrich Selected
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  All candidates have contact information!
                </p>
              )}
            </div>
          </div>

          {needsEnrichmentCandidates.length > 0 && (
            <div className="text-center">
              <button
                onClick={handleNext}
                className="text-sm text-muted-foreground hover:text-foreground underline"
              >
                Skip & Continue without enriching
              </button>
            </div>
          )}

          {/* Footer Navigation */}
          <div className="flex items-center justify-between pt-6 border-t border-border/50">
            <Button variant="outline" onClick={() => navigate("/campaign/tiers")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Tiers
            </Button>
            <Button variant="gradient" onClick={handleNext}>
              Next: Launch Campaign
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>

        {/* Enrichment Modal */}
        <Dialog open={isEnriching} onOpenChange={() => {}}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Enriching Contacts</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">
                    {enrichedCount} of {totalToEnrich}
                  </span>
                </div>
                <Progress value={enrichmentProgress} className="h-2" />
              </div>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {Array.from(completedEnrichments).map((id) => {
                  const candidate = candidates.find((c) => c.id === id);
                  return (
                    <div
                      key={id}
                      className="flex items-center gap-2 text-sm text-green-400"
                    >
                      <Check className="h-4 w-4" />
                      <span>{candidate?.name || "Unknown"} enriched</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

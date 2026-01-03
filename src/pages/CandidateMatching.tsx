import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Users, Loader2, ArrowRight, ArrowLeft, ChevronDown, ChevronUp,
  AlertCircle, CheckCircle2, Star, Phone, X
} from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ParsedJob } from "@/components/jobs/ParsedJobCard";
import { cn } from "@/lib/utils";

interface Candidate {
  id: string;
  first_name: string;
  last_name: string;
  specialty: string;
  unified_score: string;
  licenses_count: number;
  icebreaker: string;
  talking_points: string[];
  has_personal_contact: boolean;
  needs_enrichment: boolean;
}

// Mock data for demonstration
const mockCandidates: Candidate[] = [
  { 
    id: "1", 
    first_name: "Sarah", 
    last_name: "Johnson", 
    specialty: "Interventional Radiology", 
    unified_score: "A+", 
    licenses_count: 37,
    icebreaker: "Sarah recently spoke at the RSNA conference about innovative IR techniques and has published 12 papers on vascular interventions.", 
    talking_points: [
      "Presented at RSNA 2025 on micro-catheter innovations",
      "Fellowship-trained at Johns Hopkins",
      "Prefers Midwest assignments due to family proximity"
    ],
    has_personal_contact: true, 
    needs_enrichment: false 
  },
  { 
    id: "2", 
    first_name: "Michael", 
    last_name: "Chen", 
    specialty: "Interventional Radiology", 
    unified_score: "A", 
    licenses_count: 24,
    icebreaker: "Michael has 15 years of experience in IR and leads a research team at Stanford focusing on minimally invasive procedures.", 
    talking_points: [
      "Stanford faculty member with research focus",
      "Experience with complex embolization cases",
      "Available for long-term assignments"
    ],
    has_personal_contact: true, 
    needs_enrichment: false 
  },
  { 
    id: "3", 
    first_name: "Emily", 
    last_name: "Rodriguez", 
    specialty: "Interventional Radiology", 
    unified_score: "B+", 
    licenses_count: 12,
    icebreaker: "Emily completed her fellowship at Mayo Clinic and specializes in hepatobiliary interventions.", 
    talking_points: [
      "Mayo Clinic fellowship graduate",
      "Specializes in liver/biliary procedures",
      "Seeking work-life balance opportunities"
    ],
    has_personal_contact: false, 
    needs_enrichment: true 
  },
  { 
    id: "4", 
    first_name: "David", 
    last_name: "Thompson", 
    specialty: "Interventional Radiology", 
    unified_score: "B", 
    licenses_count: 8,
    icebreaker: "David has extensive locum tenens experience with flexible scheduling preferences and excellent patient reviews.", 
    talking_points: [
      "5+ years locum tenens experience",
      "Flexible on scheduling",
      "Strong patient satisfaction scores"
    ],
    has_personal_contact: true, 
    needs_enrichment: false 
  },
  { 
    id: "5", 
    first_name: "Lisa", 
    last_name: "Park", 
    specialty: "Interventional Radiology", 
    unified_score: "C", 
    licenses_count: 4,
    icebreaker: "Lisa is actively seeking new locum opportunities and is willing to obtain additional state licenses.", 
    talking_points: [
      "Early career with strong training",
      "Willing to obtain new licenses",
      "Interested in mentorship opportunities"
    ],
    has_personal_contact: false, 
    needs_enrichment: true 
  },
];

const getScoreColor = (score: string) => {
  if (score === "A+") return "bg-success text-success-foreground";
  if (score === "A") return "bg-success/80 text-success-foreground";
  if (score === "B+") return "bg-accent text-accent-foreground";
  if (score === "B") return "bg-accent/80 text-accent-foreground";
  return "bg-muted text-muted-foreground";
};

const CandidateMatching = () => {
  const navigate = useNavigate();
  const [job, setJob] = useState<ParsedJob | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Load job from session storage
    const storedJob = sessionStorage.getItem("currentJob");
    if (storedJob) {
      setJob(JSON.parse(storedJob));
    }

    // Simulate API call for candidate matching
    const fetchCandidates = async () => {
      setIsLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setCandidates(mockCandidates);
      setIsLoading(false);
    };

    fetchCandidates();
  }, []);

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const selectAllATier = () => {
    const aTier = candidates.filter(c => c.unified_score.startsWith("A")).map(c => c.id);
    setSelectedIds(new Set(aTier));
  };

  const selectAllWithContact = () => {
    const withContact = candidates.filter(c => c.has_personal_contact).map(c => c.id);
    setSelectedIds(new Set(withContact));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleContinue = () => {
    const selected = candidates.filter(c => selectedIds.has(c.id));
    sessionStorage.setItem("selectedCandidates", JSON.stringify(selected));
    navigate("/campaign-builder");
  };

  // Stats
  const aTierCount = candidates.filter(c => c.unified_score.startsWith("A")).length;
  const bTierCount = candidates.filter(c => c.unified_score.startsWith("B")).length;
  const needsEnrichmentCount = candidates.filter(c => c.needs_enrichment).length;

  if (isLoading) {
    return (
      <Layout currentStep={2}>
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-6">
          <div className="relative">
            <div className="h-20 w-20 rounded-full gradient-primary animate-pulse-glow flex items-center justify-center">
              <Users className="h-10 w-10 text-primary-foreground" />
            </div>
          </div>
          <div className="text-center space-y-2">
            <h2 className="font-display text-2xl font-bold text-foreground">
              AI is Matching Candidates...
            </h2>
            <p className="text-muted-foreground">
              Analyzing skills, availability, and preferences
            </p>
          </div>
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout currentStep={2}>
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Job Summary Bar */}
        <div className="rounded-xl bg-secondary/50 border border-border px-6 py-4">
          <p className="text-lg font-semibold text-foreground">
            IR at {job?.facility || "Chippewa Valley"} | {job?.location || "Eau Claire, WI"} | <span className="text-success">{job?.payRate || "$529/hr"}</span>
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Matched" value={candidates.length} color="primary" />
          <StatCard label="A-Tier" value={aTierCount} color="success" />
          <StatCard label="B-Tier" value={bTierCount} color="accent" />
          <StatCard label="Needs Enrichment" value={needsEnrichmentCount} color="warning" />
        </div>

        {/* Bulk Actions */}
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" size="sm" onClick={selectAllATier}>
            <Star className="h-4 w-4 mr-1" />
            Select All A-Tier
          </Button>
          <Button variant="outline" size="sm" onClick={selectAllWithContact}>
            <Phone className="h-4 w-4 mr-1" />
            Select All with Contact
          </Button>
          <Button variant="outline" size="sm" onClick={clearSelection}>
            <X className="h-4 w-4 mr-1" />
            Clear Selection
          </Button>
          <span className="flex items-center text-sm text-muted-foreground ml-auto">
            {selectedIds.size} selected
          </span>
        </div>

        {/* Candidates Table */}
        <div className="rounded-2xl bg-card shadow-card overflow-hidden border border-border">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="px-4 py-3 text-left w-12">
                    <Checkbox
                      checked={selectedIds.size === candidates.length && candidates.length > 0}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedIds(new Set(candidates.map(c => c.id)));
                        } else {
                          setSelectedIds(new Set());
                        }
                      }}
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Score</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Specialty</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Licenses</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contact Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground w-20"></th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((candidate, index) => (
                  <>
                    <tr 
                      key={candidate.id}
                      className={cn(
                        "border-b border-border/50 transition-colors hover:bg-secondary/30",
                        selectedIds.has(candidate.id) && "bg-primary/5"
                      )}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <td className="px-4 py-4">
                        <Checkbox
                          checked={selectedIds.has(candidate.id)}
                          onCheckedChange={() => toggleSelect(candidate.id)}
                        />
                      </td>
                      <td className="px-4 py-4">
                        <span className="font-medium text-foreground">
                          {candidate.first_name} {candidate.last_name}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <Badge className={cn("font-bold", getScoreColor(candidate.unified_score))}>
                          {candidate.unified_score}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">
                        {candidate.specialty}
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant="secondary" className="text-xs">
                          {candidate.licenses_count} states
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        {candidate.has_personal_contact ? (
                          <div className="flex items-center gap-1.5 text-success">
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="text-xs font-medium">Available</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-warning">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-xs font-medium">Needs Enrichment</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => toggleExpand(candidate.id)}
                          className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors font-medium"
                        >
                          {expandedIds.has(candidate.id) ? (
                            <ChevronUp className="h-5 w-5" />
                          ) : (
                            <ChevronDown className="h-5 w-5" />
                          )}
                        </button>
                      </td>
                    </tr>
                    {expandedIds.has(candidate.id) && (
                      <tr key={`${candidate.id}-expanded`} className="bg-secondary/20">
                        <td colSpan={7} className="px-6 py-4">
                          <div className="space-y-3 animate-fade-in">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Icebreaker</p>
                              <p className="text-sm text-foreground">{candidate.icebreaker}</p>
                            </div>
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Talking Points</p>
                              <ul className="list-disc list-inside text-sm text-foreground space-y-1">
                                {candidate.talking_points.map((point, i) => (
                                  <li key={i}>{point}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <Button variant="outline" onClick={() => navigate("/job-entry")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button
            variant="gradient"
            size="lg"
            onClick={handleContinue}
            disabled={selectedIds.size === 0}
          >
            Continue to Campaign
            <ArrowRight className="h-5 w-5 ml-2" />
          </Button>
        </div>
      </div>
    </Layout>
  );
};

interface StatCardProps {
  label: string;
  value: number;
  color: "primary" | "success" | "accent" | "warning";
}

const StatCard = ({ label, value, color }: StatCardProps) => {
  const colorClasses = {
    primary: "bg-primary/10 text-primary border-primary/20",
    success: "bg-success/10 text-success border-success/20",
    accent: "bg-accent/10 text-accent border-accent/20",
    warning: "bg-warning/10 text-warning border-warning/20",
  };

  return (
    <div className={cn("rounded-xl border p-4", colorClasses[color])}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-80">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
    </div>
  );
};

export default CandidateMatching;

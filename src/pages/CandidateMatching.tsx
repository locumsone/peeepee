import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Users, Loader2, ArrowRight, ChevronDown, ChevronUp,
  Phone, Mail, AlertCircle, CheckCircle2, Star
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
  licenses: string[];
  icebreaker: string;
  has_personal_contact: boolean;
  needs_enrichment: boolean;
  email?: string;
  phone?: string;
}

// Mock data for demonstration
const mockCandidates: Candidate[] = [
  { id: "1", first_name: "Sarah", last_name: "Johnson", specialty: "Cardiology", unified_score: "A+", licenses: ["TX", "CA", "NY"], icebreaker: "Sarah recently spoke at the American Heart Association conference about innovative cardiac care techniques.", has_personal_contact: true, needs_enrichment: false, email: "sarah.j@email.com", phone: "+1 (555) 123-4567" },
  { id: "2", first_name: "Michael", last_name: "Chen", specialty: "Cardiology", unified_score: "A", licenses: ["TX", "FL"], icebreaker: "Michael has 15 years of experience in interventional cardiology and leads a research team at Stanford.", has_personal_contact: true, needs_enrichment: false, email: "m.chen@email.com" },
  { id: "3", first_name: "Emily", last_name: "Rodriguez", specialty: "Cardiology", unified_score: "A", licenses: ["TX"], icebreaker: "Emily completed her fellowship at Mayo Clinic and specializes in heart failure management.", has_personal_contact: false, needs_enrichment: true },
  { id: "4", first_name: "David", last_name: "Thompson", specialty: "Internal Medicine", unified_score: "B+", licenses: ["TX", "AZ"], icebreaker: "David has extensive locum tenens experience with flexible scheduling preferences.", has_personal_contact: true, needs_enrichment: false, phone: "+1 (555) 987-6543" },
  { id: "5", first_name: "Lisa", last_name: "Park", specialty: "Cardiology", unified_score: "B+", licenses: ["TX", "CA", "WA", "OR"], icebreaker: "Lisa is actively seeking new locum opportunities and has excellent patient satisfaction scores.", has_personal_contact: true, needs_enrichment: false, email: "lisa.park@email.com", phone: "+1 (555) 456-7890" },
  { id: "6", first_name: "James", last_name: "Wilson", specialty: "Cardiology", unified_score: "B", licenses: ["TX"], icebreaker: "James recently relocated and is looking for long-term assignments in the Austin area.", has_personal_contact: false, needs_enrichment: true },
  { id: "7", first_name: "Amanda", last_name: "Foster", specialty: "Cardiology", unified_score: "C", licenses: ["CA", "NV"], icebreaker: "Amanda has expressed interest in obtaining Texas licensure.", has_personal_contact: true, needs_enrichment: false },
];

const getScoreColor = (score: string) => {
  if (score.startsWith("A")) return "bg-success text-success-foreground";
  if (score.startsWith("B")) return "bg-accent text-accent-foreground";
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
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
              Matched Candidates
            </h1>
            <p className="text-muted-foreground">
              {job?.specialty} • {job?.location}
            </p>
          </div>
          <Button
            variant="gradient"
            size="lg"
            onClick={handleContinue}
            disabled={selectedIds.size === 0}
          >
            Continue to Campaign
            <ArrowRight className="h-5 w-5" />
          </Button>
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
          <span className="flex items-center text-sm text-muted-foreground ml-auto">
            {selectedIds.size} selected
          </span>
        </div>

        {/* Candidates Table */}
        <div className="rounded-2xl bg-card shadow-card overflow-hidden">
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
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Icebreaker</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((candidate, index) => (
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
                      <div className="flex gap-1 flex-wrap">
                        {candidate.licenses.slice(0, 3).map((license) => (
                          <Badge key={license} variant="secondary" className="text-xs">
                            {license}
                          </Badge>
                        ))}
                        {candidate.licenses.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{candidate.licenses.length - 3}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {candidate.has_personal_contact ? (
                        <div className="flex items-center gap-1 text-success">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="text-xs font-medium">Available</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-warning">
                          <AlertCircle className="h-4 w-4" />
                          <span className="text-xs font-medium">Needs Enrichment</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => toggleExpand(candidate.id)}
                        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {expandedIds.has(candidate.id) ? (
                          <>Hide <ChevronUp className="h-4 w-4" /></>
                        ) : (
                          <>Show <ChevronDown className="h-4 w-4" /></>
                        )}
                      </button>
                      {expandedIds.has(candidate.id) && (
                        <p className="mt-2 text-sm text-muted-foreground max-w-xs animate-fade-in">
                          {candidate.icebreaker}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import StepIndicator from "@/components/layout/StepIndicator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, Sparkles, RefreshCw, Edit2, Check, X,
  Users, Target, Search, CheckCircle2, AlertTriangle, Lightbulb, Cat
} from "lucide-react";
import { cn } from "@/lib/utils";

const steps = [
  { number: 1, label: "Job" },
  { number: 2, label: "Candidates" },
  { number: 3, label: "Personalize" },
  { number: 4, label: "Sequence" },
  { number: 5, label: "Review" },
];

// 10 Playbook Hook Patterns - from team's playbook document
const PLAYBOOK_HOOKS = [
  {
    id: "fellowship_training",
    name: "Fellowship/Training Match",
    priority: 1,
    useWhen: "Candidate has fellowship training or board certification",
    pattern: "Your {specialty} fellowship at {program} means you've developed expertise in {clinical_areas} - exactly what {facility_name} needs.",
    example: "Your GI fellowship at Mass General has given you comprehensive training in procedural endoscopy and consultative care."
  },
  {
    id: "elite_compensation",
    name: "Elite Compensation",
    priority: 2,
    useWhen: "Candidate is in academic setting or lower-paying market",
    pattern: "At ${pay_rate}/hr (${annual_potential}/year potential), this opportunity offers significantly above-median compensation while maintaining {benefit}.",
    example: "At $500/hr ($1.04M annual potential), this significantly exceeds median locums rates."
  },
  {
    id: "hybrid_model",
    name: "Hybrid Model Differentiator",
    priority: 3,
    useWhen: "Candidate seems torn between private practice and academics",
    pattern: "{facility_name} offers a unique hybrid: {practice_type} with {resource_type} - you get {benefit_a} without {drawback_b}.",
    example: "Community-based practice with academic hospital resources - clinical autonomy without isolation."
  },
  {
    id: "mission_impact",
    name: "Mission/Impact",
    priority: 4,
    useWhen: "Candidate shows burnout signs or mentions meaningful work",
    pattern: "{facility_name} serves {population}, meaning your {specialty} expertise would {specific_impact} for patients who {situation}.",
    example: "Your expertise would provide specialized care for underserved patients who face barriers accessing specialists."
  },
  {
    id: "academic_without_burden",
    name: "Academic Without Burden",
    priority: 5,
    useWhen: "Candidate values teaching but frustrated with academic medicine",
    pattern: "Affiliation with {academic_institution} means {academic_benefits} without {academic_frustrations}.",
    example: "Teaching opportunities and research collaboration without endless committee meetings or grant writing pressure."
  },
  {
    id: "open_to_work",
    name: "Open to Work Urgency",
    priority: 6,
    useWhen: "Candidate has Open to Work badge or recently left position",
    pattern: "I noticed you're actively exploring opportunities - wanted to reach out immediately about {position} (${pay_rate}/hr) that matches your {background}.",
    example: "Wanted to reach out immediately about this $500/hr IR position that matches your fellowship training."
  },
  {
    id: "procedural_scope",
    name: "Procedural Volume/Scope",
    priority: 7,
    useWhen: "Candidate wants good procedural volume or clinical variety",
    pattern: "{facility_name} offers {procedural_details} with {case_mix} that keeps work clinically engaging.",
    example: "High procedural volume with diverse case mix - thrombectomy, angioplasty, biopsies, drains."
  },
  {
    id: "work_life_balance",
    name: "Work-Life Balance",
    priority: 8,
    useWhen: "Candidate mentions lifestyle, burnout, or work-life balance",
    pattern: "{schedule_type} means {schedule_details} with {team_support}.",
    example: "M-F schedule with minimal call - predictable hours without 24/7 availability expectations."
  },
  {
    id: "geographic_location",
    name: "Geographic/Location",
    priority: 9,
    useWhen: "Candidate has ties to area or expresses regional interest",
    pattern: "{location} offers {location_benefits} with {specific_advantage}.",
    example: "Houston offers no state income tax, lower cost of living, and excellent quality of life."
  },
  {
    id: "license_advantage",
    name: "License/IMLC Advantage",
    priority: 10,
    useWhen: "Candidate has job state license or IMLC eligibility",
    pattern: "Your {license_count} state licenses {imlc_status} mean {credentialing_advantage} - you could {start_timing}.",
    example: "Your 24 state licenses including Texas mean expedited credentialing - you could start within 30 days."
  }
];

interface Job {
  id: string;
  job_name?: string;
  facility_name?: string;
  specialty?: string;
  city?: string;
  state?: string;
  bill_rate?: number;
  pay_rate?: number;
}

interface Candidate {
  id: string;
  first_name?: string;
  last_name?: string;
  specialty?: string;
  email?: string;
  personal_email?: string;
  phone?: string;
  personal_mobile?: string;
  licenses?: string[];
  // Personalization fields
  personalization_hook?: string;
  hook_type?: string;
  icebreaker?: string;
  talking_points?: string[];
  deep_researched?: boolean;
  research_confidence?: string;
}

export default function PersonalizationStudio() {
  const navigate = useNavigate();
  
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  
  const [isResearching, setIsResearching] = useState(false);
  const [researchProgress, setResearchProgress] = useState(0);
  const [researchedCount, setResearchedCount] = useState(0);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingHook, setEditingHook] = useState("");
  
  const [previewCandidate, setPreviewCandidate] = useState<Candidate | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  
  // Load data
  useEffect(() => {
    const storedJobId = sessionStorage.getItem("campaign_job_id");
    const storedCandidates = sessionStorage.getItem("campaign_candidates") || sessionStorage.getItem("selectedCandidates");
    const storedJob = sessionStorage.getItem("campaign_job");
    
    if (!storedJobId || !storedCandidates) {
      toast.error("Missing campaign data");
      navigate("/campaigns/new");
      return;
    }
    
    setJobId(storedJobId);
    
    try {
      const parsed = JSON.parse(storedCandidates);
      setCandidates(parsed);
      setResearchedCount(parsed.filter((c: Candidate) => c.personalization_hook || c.icebreaker).length);
    } catch (e) {
      console.error("Error parsing candidates:", e);
    }
    
    if (storedJob) {
      try {
        setJob(JSON.parse(storedJob));
      } catch (e) {
        console.error("Error parsing job:", e);
      }
    }
    
    // Fetch fresh job data
    const fetchJob = async () => {
      const { data } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", storedJobId)
        .single();
      
      if (data) {
        setJob(data);
        sessionStorage.setItem("campaign_job", JSON.stringify(data));
      }
    };
    fetchJob();
  }, [navigate]);
  
  // Run Sherlock deep research
  const handleRunSherlock = async () => {
    if (!jobId || candidates.length === 0) {
      toast.error("No candidates to research");
      return;
    }
    
    setIsResearching(true);
    setResearchProgress(0);
    
    const candidateIds = candidates
      .filter(c => !c.personalization_hook && !c.icebreaker)
      .slice(0, 20) // Limit to 20 per batch
      .map(c => c.id);
    
    if (candidateIds.length === 0) {
      toast.info("All candidates already have personalization");
      setIsResearching(false);
      return;
    }
    
    try {
      const progressInterval = setInterval(() => {
        setResearchProgress(prev => Math.min(prev + 5, 90));
      }, 500);
      
      const { data, error } = await supabase.functions.invoke('personalization-research', {
        body: {
          candidate_ids: candidateIds,
          job_id: jobId,
          deep_research: true,
          batch_size: 10,
        },
      });
      
      clearInterval(progressInterval);
      setResearchProgress(100);
      
      if (error) throw error;
      
      if (data?.results) {
        // Update local state with research results
        interface ResearchResult {
          candidate_id: string;
          hook?: string;
          hook_type?: string;
          icebreaker?: string;
          talking_points?: string[];
          confidence?: string;
        }
        
        const resultsMap = new Map<string, ResearchResult>(
          (data.results as ResearchResult[]).map((r) => [r.candidate_id, r])
        );
        
        const updatedCandidates = candidates.map(c => {
          const result = resultsMap.get(c.id);
          if (result) {
            return {
              ...c,
              personalization_hook: result.hook || result.icebreaker,
              hook_type: result.hook_type,
              icebreaker: result.icebreaker,
              talking_points: result.talking_points || [],
              deep_researched: true,
              research_confidence: result.confidence,
            };
          }
          return c;
        });
        
        setCandidates(updatedCandidates);
        setResearchedCount(updatedCandidates.filter(c => c.personalization_hook || c.icebreaker).length);
        sessionStorage.setItem("campaign_candidates", JSON.stringify(updatedCandidates));
        
        toast.success(`Personalized ${data.results.length} candidates!`);
      }
    } catch (error) {
      console.error("Research error:", error);
      toast.error("Failed to run deep research");
    } finally {
      setIsResearching(false);
    }
  };
  
  // Edit hook inline
  const handleSaveHook = (candidateId: string) => {
    const updated = candidates.map(c => 
      c.id === candidateId ? { ...c, personalization_hook: editingHook } : c
    );
    setCandidates(updated);
    sessionStorage.setItem("campaign_candidates", JSON.stringify(updated));
    setEditingId(null);
    setEditingHook("");
    toast.success("Hook updated");
  };
  
  // Select hook pattern for candidate
  const handleSelectHookPattern = (candidateId: string, hookId: string) => {
    const hook = PLAYBOOK_HOOKS.find(h => h.id === hookId);
    if (!hook) return;
    
    const candidate = candidates.find(c => c.id === candidateId);
    if (!candidate) return;
    
    // Generate personalized hook from pattern
    const payRate = job?.pay_rate || (job?.bill_rate ? Math.round(job.bill_rate * 0.8) : 500);
    const annualPotential = payRate * 9 * 5 * 52;
    
    let generatedHook = hook.pattern
      .replace("{specialty}", candidate.specialty || job?.specialty || "locums")
      .replace("{program}", "your fellowship program")
      .replace("{clinical_areas}", "procedural and consultative care")
      .replace("{facility_name}", job?.facility_name || "our partner facility")
      .replace("{pay_rate}", payRate.toString())
      .replace("{annual_potential}", `$${(annualPotential / 1000).toFixed(0)}K`)
      .replace("{location}", `${job?.city}, ${job?.state}`)
      .replace("{license_count}", (candidate.licenses?.length || 0).toString())
      .replace("{benefit}", "clinical autonomy");
    
    const updated = candidates.map(c => 
      c.id === candidateId ? { 
        ...c, 
        personalization_hook: generatedHook,
        hook_type: hookId,
      } : c
    );
    setCandidates(updated);
    sessionStorage.setItem("campaign_candidates", JSON.stringify(updated));
    toast.success(`Applied "${hook.name}" pattern`);
  };
  
  const handleNext = () => {
    sessionStorage.setItem("campaign_candidates", JSON.stringify(candidates));
    navigate("/campaigns/new/sequence");
  };
  
  const payRate = job?.pay_rate || (job?.bill_rate ? Math.round(job.bill_rate * 0.8) : null);
  const personalizedPercent = candidates.length > 0 
    ? Math.round((researchedCount / candidates.length) * 100) 
    : 0;
  
  return (
    <Layout showSteps={false}>
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <StepIndicator currentStep={3} steps={steps} />
          
          {/* Header */}
          <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-lg px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-amber-500/20">
                  <Cat className="h-6 w-6 text-amber-500" />
                </div>
                <div>
                  <h1 className="text-xl font-bold flex items-center gap-2">
                    Sherlock Meowmes
                    <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30">
                      Deep Research
                    </Badge>
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Generate hyper-personalized outreach hooks using the 10 playbook patterns
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{candidates.length}</span>
                </div>
                {payRate && (
                  <Badge variant="secondary" className="text-green-600">
                    ${payRate}/hr pay
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          {/* Progress Bar */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Personalization Progress</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {researchedCount} / {candidates.length} candidates
                </span>
              </div>
              <Progress value={personalizedPercent} className="h-2" />
              <p className="text-xs text-muted-foreground mt-2">
                {personalizedPercent < 50 
                  ? "💡 Run Sherlock AI to generate personalized hooks for better response rates"
                  : personalizedPercent < 100
                  ? "⚡ Good progress! Continue to personalize remaining candidates"
                  : "✅ All candidates personalized!"}
              </p>
            </CardContent>
          </Card>
          
          {/* Action Bar */}
          <div className="flex items-center justify-between">
            <Button
              variant="default"
              size="lg"
              onClick={handleRunSherlock}
              disabled={isResearching || researchedCount === candidates.length}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
            >
              {isResearching ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Researching... {researchProgress}%
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Run Sherlock AI ({candidates.length - researchedCount} remaining)
                </>
              )}
            </Button>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => navigate("/candidates/matching")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button onClick={handleNext} disabled={researchedCount === 0}>
                Continue to Sequences
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
          
          {/* Playbook Hook Patterns Reference */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                10 Playbook Hook Patterns
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {PLAYBOOK_HOOKS.map((hook, idx) => (
                  <div 
                    key={hook.id}
                    className="p-2 rounded border text-xs hover:bg-secondary/50 cursor-help"
                    title={hook.useWhen}
                  >
                    <span className="text-muted-foreground mr-1">#{idx + 1}</span>
                    <span className="font-medium">{hook.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          
          {/* Candidate Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Candidate Personalization</CardTitle>
              <CardDescription>
                Review and edit personalized hooks for each candidate
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background border-b">
                    <tr>
                      <th className="text-left p-3 font-medium">Candidate</th>
                      <th className="text-left p-3 font-medium">Hook Pattern</th>
                      <th className="text-left p-3 font-medium">Personalized Hook</th>
                      <th className="text-center p-3 font-medium w-24">Status</th>
                      <th className="text-right p-3 font-medium w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map((candidate) => (
                      <tr key={candidate.id} className="border-b hover:bg-secondary/30">
                        <td className="p-3">
                          <div>
                            <p className="font-medium">Dr. {candidate.last_name}</p>
                            <p className="text-xs text-muted-foreground">{candidate.specialty}</p>
                          </div>
                        </td>
                        <td className="p-3">
                          <Select
                            value={candidate.hook_type || ""}
                            onValueChange={(v) => handleSelectHookPattern(candidate.id, v)}
                          >
                            <SelectTrigger className="h-8 text-xs w-40">
                              <SelectValue placeholder="Select pattern" />
                            </SelectTrigger>
                            <SelectContent>
                              {PLAYBOOK_HOOKS.map((hook) => (
                                <SelectItem key={hook.id} value={hook.id} className="text-xs">
                                  {hook.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-3 max-w-md">
                          {editingId === candidate.id ? (
                            <div className="flex items-center gap-2">
                              <Textarea
                                value={editingHook}
                                onChange={(e) => setEditingHook(e.target.value)}
                                className="min-h-[60px] text-xs"
                              />
                              <div className="flex flex-col gap-1">
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="h-6 w-6"
                                  onClick={() => handleSaveHook(candidate.id)}
                                >
                                  <Check className="h-3 w-3 text-green-500" />
                                </Button>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="h-6 w-6"
                                  onClick={() => setEditingId(null)}
                                >
                                  <X className="h-3 w-3 text-red-500" />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {candidate.personalization_hook || candidate.icebreaker || (
                                <span className="italic text-warning">No hook generated</span>
                              )}
                            </p>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {candidate.personalization_hook || candidate.icebreaker ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-amber-500 mx-auto" />
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => {
                              setEditingId(candidate.id);
                              setEditingHook(candidate.personalization_hook || candidate.icebreaker || "");
                            }}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}

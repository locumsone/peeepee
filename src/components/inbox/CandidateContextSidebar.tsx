import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import {
  User,
  MapPin,
  Phone,
  Mail,
  Award,
  Briefcase,
  Shield,
  ExternalLink,
  Loader2,
  ChevronRight,
  Copy,
  Sparkles,
  FileText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { ConversationItem } from "@/pages/Communications";

interface CandidateContextSidebarProps {
  conversation: ConversationItem | null;
  className?: string;
}

export const CandidateContextSidebar = ({ conversation, className }: CandidateContextSidebarProps) => {
  // Fetch candidate details
  const { data: candidate, isLoading: candidateLoading } = useQuery({
    queryKey: ["candidate-context", conversation?.candidateId],
    queryFn: async () => {
      if (!conversation?.candidateId) return null;
      
      const { data, error } = await supabase
        .from("candidates")
        .select(`
          id,
          first_name,
          last_name,
          email,
          phone,
          personal_email,
          personal_mobile,
          specialty,
          city,
          state,
          licenses,
          npi,
          company_name,
          enrichment_tier,
          quality_score,
          status
        `)
        .eq("id", conversation.candidateId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!conversation?.candidateId,
  });

  // Fetch research data
  const { data: research } = useQuery({
    queryKey: ["candidate-research-context", conversation?.candidateId],
    queryFn: async () => {
      if (!conversation?.candidateId) return null;

      const { data, error } = await supabase
        .from("candidate_research")
        .select(`
          npi_verified,
          verified_specialty,
          verified_licenses,
          has_imlc,
          credentials_summary,
          professional_highlights,
          research_confidence
        `)
        .eq("candidate_id", conversation.candidateId)
        .maybeSingle();

      if (error) return null;
      return data;
    },
    enabled: !!conversation?.candidateId,
  });

  // Fetch campaign info if available
  const { data: campaign } = useQuery({
    queryKey: ["campaign-context", conversation?.campaignId],
    queryFn: async () => {
      if (!conversation?.campaignId) return null;

      const { data, error } = await supabase
        .from("campaigns")
        .select("id, name, status, job_id")
        .eq("id", conversation.campaignId)
        .maybeSingle();

      if (error) return null;
      return data;
    },
    enabled: !!conversation?.campaignId,
  });

  // Fetch job info if campaign has job_id
  const { data: job } = useQuery({
    queryKey: ["job-context", campaign?.job_id],
    queryFn: async () => {
      if (!campaign?.job_id) return null;

      const { data, error } = await supabase
        .from("jobs")
        .select("id, job_name, specialty, state, city, facility_name, pay_rate")
        .eq("id", campaign.job_id)
        .maybeSingle();

      if (error) return null;
      return data;
    },
    enabled: !!campaign?.job_id,
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  if (!conversation) {
    return null;
  }

  if (!conversation.candidateId) {
    return (
      <div className={cn("flex flex-col h-full bg-card border-l border-border", className)}>
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Candidate Context</h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-sm text-muted-foreground text-center">
            No linked candidate profile
          </p>
        </div>
      </div>
    );
  }

  if (candidateLoading) {
    return (
      <div className={cn("flex flex-col h-full bg-card border-l border-border", className)}>
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Candidate Context</h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const licenses = candidate?.licenses || research?.verified_licenses || [];
  const hasImlc = research?.has_imlc;

  return (
    <div className={cn("flex flex-col h-full bg-card border-l border-border", className)}>
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Candidate Context</h3>
          <Link to={`/candidates/${candidate?.id}`}>
            <Button variant="ghost" size="sm" className="h-7 text-xs">
              <ExternalLink className="h-3 w-3 mr-1" />
              Full Profile
            </Button>
          </Link>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          {/* Profile Section */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-foreground truncate">
                  Dr. {candidate?.first_name} {candidate?.last_name}
                </h4>
                <p className="text-sm text-muted-foreground truncate">
                  {candidate?.specialty || "Specialty unknown"}
                </p>
                {candidate?.enrichment_tier && (
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "mt-1 text-[10px]",
                      candidate.enrichment_tier === "Platinum" && "bg-violet-500/20 text-violet-400 border-violet-500/30",
                      candidate.enrichment_tier === "Gold" && "bg-amber-500/20 text-amber-400 border-amber-500/30",
                      candidate.enrichment_tier === "Silver" && "bg-slate-400/20 text-slate-300 border-slate-400/30"
                    )}
                  >
                    {candidate.enrichment_tier}
                  </Badge>
                )}
              </div>
            </div>

            {/* Location */}
            {(candidate?.city || candidate?.state) && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                <span>{[candidate.city, candidate.state].filter(Boolean).join(", ")}</span>
              </div>
            )}

            {/* Current employer */}
            {candidate?.company_name && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Briefcase className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{candidate.company_name}</span>
              </div>
            )}
          </div>

          <Separator />

          {/* Contact Info */}
          <div className="space-y-2">
            <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Contact</h5>
            
            {(candidate?.personal_mobile || candidate?.phone) && (
              <button
                onClick={() => copyToClipboard(candidate?.personal_mobile || candidate?.phone || "", "Phone")}
                className="w-full flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors group"
              >
                <Phone className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                <span className="font-mono text-xs truncate">
                  {candidate?.personal_mobile || candidate?.phone}
                </span>
                <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
              </button>
            )}

            {(candidate?.personal_email || candidate?.email) && (
              <button
                onClick={() => copyToClipboard(candidate?.personal_email || candidate?.email || "", "Email")}
                className="w-full flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors group"
              >
                <Mail className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                <span className="text-xs truncate">
                  {candidate?.personal_email || candidate?.email}
                </span>
                <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
              </button>
            )}
          </div>

          <Separator />

          {/* Credentials */}
          <div className="space-y-2">
            <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Credentials</h5>
            
            {/* NPI Status */}
            <div className="flex items-center gap-2">
              <Shield className="h-3.5 w-3.5 text-muted-foreground" />
              {research?.npi_verified ? (
                <Badge variant="outline" className="text-[10px] bg-success/20 text-success border-success/30">
                  NPI Verified
                </Badge>
              ) : candidate?.npi ? (
                <span className="text-xs text-muted-foreground font-mono">{candidate.npi}</span>
              ) : (
                <span className="text-xs text-muted-foreground">No NPI</span>
              )}
              {hasImlc && (
                <Badge variant="outline" className="text-[10px] bg-primary/20 text-primary border-primary/30">
                  IMLC
                </Badge>
              )}
            </div>

            {/* Licenses */}
            {licenses.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Award className="h-3 w-3" />
                  <span>{licenses.length} State Licenses</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {licenses.slice(0, 8).map((license: string, i: number) => (
                    <Badge key={i} variant="outline" className="text-[9px] px-1.5 py-0">
                      {license}
                    </Badge>
                  ))}
                  {licenses.length > 8 && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                      +{licenses.length - 8}
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Research confidence */}
            {research?.research_confidence && (
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-[10px]",
                    research.research_confidence === "high" && "bg-success/20 text-success",
                    research.research_confidence === "medium" && "bg-warning/20 text-warning",
                    research.research_confidence === "low" && "bg-muted text-muted-foreground"
                  )}
                >
                  {research.research_confidence} confidence
                </Badge>
              </div>
            )}
          </div>

          {/* Campaign Context */}
          {campaign && (
            <>
              <Separator />
              <div className="space-y-2">
                <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Campaign</h5>
                
                <Link 
                  to={`/campaigns/${campaign.id}`}
                  className="block p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground truncate">
                      {campaign.name || "Unnamed Campaign"}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                  {job && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {job.job_name} • {job.city}, {job.state}
                    </p>
                  )}
                </Link>

                {job?.pay_rate && (
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-foreground font-medium">${job.pay_rate}/hr</span>
                    <span className="text-muted-foreground text-xs">pay rate</span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Professional Highlights */}
          {research?.professional_highlights && research.professional_highlights.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Highlights</h5>
                <ul className="space-y-1">
                  {research.professional_highlights.slice(0, 3).map((highlight: string, i: number) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{highlight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

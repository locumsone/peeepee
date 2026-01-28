import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Star, Award, CheckCircle2, Search, Target, Shield, Phone, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { ResearchInsights } from "./ResearchInsights";

// Use a flexible interface that works with any candidate-like object
export interface CandidateExpandedViewProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  candidate: any;
  jobState?: string;
  researchingIds: Set<string>;
  deepResearchingIds: Set<string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onResearch: (candidate: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onDeepResearch: (candidate: any, forceRefresh: boolean) => void;
}

export function CandidateExpandedView({
  candidate,
  jobState,
  researchingIds,
  deepResearchingIds,
  onResearch,
  onDeepResearch,
}: CandidateExpandedViewProps) {
  return (
    <div className="space-y-4 animate-fade-in">
      {/* RESEARCH SUMMARY CARD - Playbook Style */}
      {(candidate.researched || candidate.deep_researched) && (
        <div className="rounded-xl bg-gradient-to-br from-slate-900/80 to-slate-800/60 border border-slate-600/50 overflow-hidden">
          {/* ATS-Style Header */}
          <div className="bg-gradient-to-r from-emerald-600/20 via-blue-600/10 to-purple-600/20 px-5 py-4 border-b border-slate-600/30">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                {/* Avatar with initials */}
                <div className="h-14 w-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                  {candidate.first_name?.[0]}{candidate.last_name?.[0]}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Dr. {candidate.first_name} {candidate.last_name}
                    {candidate.credentials_summary && (
                      <span className="ml-2 text-sm font-normal text-slate-400">{candidate.credentials_summary}</span>
                    )}
                  </h3>
                  <p className="text-sm text-blue-300">
                    {candidate.verified_specialty || candidate.specialty}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-400">
                      📍 {candidate.city ? `${candidate.city}, ` : ''}{candidate.state}
                    </span>
                    {candidate.npi && (
                      <span className="text-xs text-emerald-400">• NPI: {candidate.npi}</span>
                    )}
                  </div>
                </div>
              </div>
              {/* Score Badge */}
              <div className="text-right">
                <div className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold",
                  candidate.match_strength >= 95 ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/50" :
                  candidate.match_strength >= 85 ? "bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/50" :
                  candidate.match_strength >= 70 ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/50" :
                  "bg-slate-500/20 text-slate-400"
                )}>
                  {candidate.match_strength >= 95 && <Star className="h-3.5 w-3.5" />}
                  {candidate.match_strength}% Match
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  {candidate.deep_researched ? '🔮 Deep Research' : candidate.from_cache ? '📦 Cached' : '🔬 NPI Verified'}
                </p>
              </div>
            </div>
          </div>
          
          <div className="p-5 space-y-5">
            {/* Quick Tags Row - ATS Style */}
            <div className="flex flex-wrap gap-2">
              {candidate.is_local && (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                  📍 Local Candidate
                </Badge>
              )}
              {candidate.has_job_state_license && (
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                  ✓ {jobState} Licensed
                </Badge>
              )}
              {candidate.has_imlc && (
                <Badge className="bg-indigo-500/20 text-indigo-400 border-indigo-500/30 text-xs">
                  🏛️ IMLC Eligible
                </Badge>
              )}
              {(candidate.verified_licenses?.length || candidate.licenses_count || 0) >= 10 && (
                <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">
                  🌟 {candidate.verified_licenses?.length || candidate.licenses_count} State Licenses
                </Badge>
              )}
              {candidate.verified_specialty && (
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                  {candidate.verified_specialty}
                </Badge>
              )}
              {candidate.deep_researched && (
                <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">
                  🔮 AI Enriched
                </Badge>
              )}
            </div>
            
            {/* Professional Summary */}
            {candidate.professional_highlights && candidate.professional_highlights.length > 0 && (
              <div className="rounded-lg bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border border-blue-500/20 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-3 flex items-center gap-2">
                  <Award className="h-4 w-4" /> Professional Summary
                </p>
                <ul className="space-y-2">
                  {candidate.professional_highlights.map((highlight, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <span className="text-blue-400 mt-0.5 font-bold">•</span>
                      <span className="text-slate-200 leading-relaxed">{highlight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Match Reasons (if no professional highlights) */}
            {(!candidate.professional_highlights || candidate.professional_highlights.length === 0) && 
             candidate.match_reasons && candidate.match_reasons.length > 0 && (
              <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> Why This Candidate Is a Great Fit
                </p>
                <ul className="space-y-2">
                  {candidate.match_reasons.map((reason, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <span className="text-emerald-500 mt-0.5 font-bold">✓</span>
                      <span className="text-slate-200">{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Deep Research Summary */}
            {candidate.research_summary && 
             candidate.research_summary.length > 50 && 
             !candidate.research_summary.toLowerCase().includes('previously researched') && (
              <ResearchInsights 
                researchSummary={candidate.research_summary}
                confidence={candidate.research_confidence}
              />
            )}
            
            {/* Personalized Icebreaker */}
            {candidate.icebreaker && candidate.icebreaker.length > 40 && !candidate.icebreaker.match(/^(Hi|Hello|Dear)\s+Dr\.?\s+\w+,?\s*$/i) && (
              <div className="rounded-lg bg-slate-700/30 border border-slate-600/30 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-2">
                  💬 Suggested Opening Line
                </p>
                <p className="text-sm text-slate-300 leading-relaxed italic">"{candidate.icebreaker}"</p>
              </div>
            )}
            
            {/* LICENSES */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-2">
                <Shield className="h-3.5 w-3.5" /> Active State Licenses ({candidate.verified_licenses?.length || candidate.licenses_count || 0})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(candidate.verified_licenses || candidate.licenses)?.slice(0, 20).map((license, i) => (
                  <Badge 
                    key={i} 
                    variant="outline" 
                    className={cn(
                      "text-xs font-medium",
                      license.toUpperCase() === jobState?.toUpperCase() 
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 ring-1 ring-emerald-500/30" 
                        : "bg-slate-700/50 text-slate-300 border-slate-600/50"
                    )}
                  >
                    {license}
                  </Badge>
                ))}
                {((candidate.verified_licenses || candidate.licenses)?.length || 0) > 20 && (
                  <Badge variant="outline" className="text-xs bg-slate-700/30 text-slate-400">
                    +{(candidate.verified_licenses || candidate.licenses)!.length - 20} more
                  </Badge>
                )}
              </div>
            </div>
            
            {/* Concerns */}
            {candidate.match_concerns && candidate.match_concerns.length > 0 && (
              <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-400 mb-2">⚠️ Notes / Considerations</p>
                <ul className="space-y-1">
                  {candidate.match_concerns.map((concern, i) => (
                    <li key={i} className="text-sm text-amber-300/80 flex items-start gap-2">
                      <span className="text-amber-500 mt-0.5">•</span>
                      {concern}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Not Researched - show CTA */}
      {!candidate.researched && !candidate.deep_researched && (
        <div className="rounded-lg bg-slate-800/30 border border-slate-700/30 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-slate-700/50 flex items-center justify-center">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-300">Research Available</p>
              <p className="text-xs text-slate-500">
                Run research to generate personalized outreach
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-slate-600 hover:bg-slate-700"
            disabled={researchingIds.has(candidate.id)}
            onClick={(e) => { e.stopPropagation(); onResearch(candidate); }}
          >
            {researchingIds.has(candidate.id) ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Target className="h-4 w-4" />
            )}
            <span className="ml-2">Research</span>
          </Button>
        </div>
      )}
      
      {/* Deep Research Button */}
      {candidate.researched && (
        <div className={cn(
          "rounded-lg p-3 flex items-center justify-between",
          candidate.deep_researched 
            ? "bg-purple-500/10 border border-purple-500/20" 
            : "bg-purple-500/5 border border-purple-500/10"
        )}>
          <div className="flex items-center gap-2">
            <span className="text-lg">🔮</span>
            <div>
              <p className="text-xs font-medium text-purple-300">
                {candidate.deep_researched ? 'Deep Research Complete' : 'Unlock Deep Personalization'}
              </p>
              <p className="text-[10px] text-slate-500">
                {candidate.deep_researched ? 'Click to refresh with latest web data' : 'AI-crafted hooks from live web research'}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className={cn(
              "text-xs h-7",
              candidate.deep_researched 
                ? "text-purple-300 hover:text-purple-200 hover:bg-purple-500/10" 
                : "text-purple-400 hover:text-purple-300 hover:bg-purple-500/10"
            )}
            disabled={deepResearchingIds.has(candidate.id)}
            onClick={(e) => { 
              e.stopPropagation(); 
              onDeepResearch(candidate, !!candidate.deep_researched);
            }}
          >
            {deepResearchingIds.has(candidate.id) ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : null}
            {candidate.deep_researched ? '🔄 Refresh' : 'Deep Research'}
          </Button>
        </div>
      )}
      
      {/* Contact Info */}
      {(candidate.work_email || candidate.work_phone || candidate.personal_email || candidate.personal_mobile) && (
        <div className="flex flex-wrap gap-4 pt-2 border-t border-border">
          {candidate.personal_mobile && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-success" />
              <span className="text-foreground font-medium">{candidate.personal_mobile}</span>
              <Badge className="bg-success/20 text-success text-[10px]">✅ Personal (Enriched)</Badge>
            </div>
          )}
          {candidate.personal_email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-success" />
              <span className="text-foreground">{candidate.personal_email}</span>
              <Badge className="bg-success/20 text-success text-[10px]">✅ Personal (Enriched)</Badge>
            </div>
          )}
          {candidate.work_phone && !candidate.personal_mobile && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-amber-500" />
              <span className="text-foreground">{candidate.work_phone}</span>
              <Badge className="bg-amber-500/20 text-amber-600 text-[10px]">🏢 Company</Badge>
            </div>
          )}
          {candidate.work_email && !candidate.personal_email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-amber-500" />
              <span className="text-foreground">{candidate.work_email}</span>
              <Badge className="bg-amber-500/20 text-amber-600 text-[10px]">🏢 Company</Badge>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

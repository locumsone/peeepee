import { Badge } from "@/components/ui/badge";
import { Building2, GraduationCap, Award, Star, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface ResearchInsightsProps {
  researchSummary: string;
  confidence?: 'high' | 'medium' | 'low';
  className?: string;
}

interface ParsedResearch {
  employer?: string;
  training?: string;
  credentials?: string;
  notable?: string;
}

// Parse the structured research format from Perplexity
function parseResearchSummary(summary: string): ParsedResearch {
  const result: ParsedResearch = {};
  
  if (!summary) return result;
  
  // Match numbered format: 1. **EMPLOYER**: ... 2. **TRAINING**: ...
  const patterns = [
    { key: 'employer' as const, regex: /\*\*EMPLOYER\*\*:?\s*([^*]+?)(?=\d+\.\s*\*\*|$)/i },
    { key: 'training' as const, regex: /\*\*TRAINING\*\*:?\s*([^*]+?)(?=\d+\.\s*\*\*|$)/i },
    { key: 'credentials' as const, regex: /\*\*CREDENTIALS\*\*:?\s*([^*]+?)(?=\d+\.\s*\*\*|$)/i },
    { key: 'notable' as const, regex: /\*\*NOTABLE\*\*:?\s*([^*]+?)(?=\d+\.\s*\*\*|$)/i },
  ];
  
  for (const { key, regex } of patterns) {
    const match = summary.match(regex);
    if (match && match[1]) {
      // Clean up the extracted text
      let value = match[1].trim();
      // Remove trailing numbers like [1][2][3]
      value = value.replace(/\[\d+\]/g, '').trim();
      // Remove leading numbers like "1. " or "2. "
      value = value.replace(/^\d+\.\s*/, '');
      if (value.length > 10) {
        result[key] = value;
      }
    }
  }
  
  // If no structured format found, try to extract key info
  if (Object.keys(result).length === 0 && summary.length > 50) {
    // Look for hospital/employer mentions
    const hospitalMatch = summary.match(/(practices?\s+(?:with|at)|works?\s+at|affiliated\s+with)\s+([^.]+)/i);
    if (hospitalMatch) result.employer = hospitalMatch[0];
    
    // Look for training mentions
    const trainingMatch = summary.match(/(fellowship|residency|trained)\s+(?:at|from)\s+([^.]+)/i);
    if (trainingMatch) result.training = trainingMatch[0];
    
    // Look for board certification
    const certMatch = summary.match(/board\s+certified?\s+(?:in\s+)?([^.]+)/i);
    if (certMatch) result.credentials = certMatch[0];
  }
  
  return result;
}

const sectionIcons = {
  employer: Building2,
  training: GraduationCap,
  credentials: Award,
  notable: Star,
};

const sectionLabels = {
  employer: 'Current Practice',
  training: 'Training & Fellowship',
  credentials: 'Board Certifications',
  notable: 'Notable Achievements',
};

const sectionColors = {
  employer: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  training: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  credentials: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  notable: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
};

export function ResearchInsights({ researchSummary, confidence, className }: ResearchInsightsProps) {
  const parsed = parseResearchSummary(researchSummary);
  const hasStructuredData = Object.keys(parsed).length > 0;
  
  if (!hasStructuredData && (!researchSummary || researchSummary.length < 50)) {
    return null;
  }
  
  return (
    <div className={cn("rounded-xl border border-primary/20 bg-primary/5 overflow-hidden", className)}>
      {/* Header */}
      <div className="px-4 py-3 bg-primary/10 border-b border-primary/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🔮</span>
          <span className="text-sm font-semibold text-foreground">Online Research Insights</span>
        </div>
        {confidence && (
          <Badge 
            variant="outline" 
            className={cn(
              "text-[10px] font-medium",
              confidence === 'high' ? "text-success border-success/30 bg-success/10" :
              confidence === 'medium' ? "text-warning border-warning/30 bg-warning/10" :
              "text-muted-foreground border-border"
            )}
          >
            {confidence} confidence
          </Badge>
        )}
      </div>
      
      {/* Content */}
      <div className="p-4 space-y-3">
        {hasStructuredData ? (
          // Structured display
          <div className="grid gap-3">
            {(Object.entries(parsed) as [keyof ParsedResearch, string][]).map(([key, value]) => {
              if (!value) return null;
              const Icon = sectionIcons[key];
              const label = sectionLabels[key];
              const colorClasses = sectionColors[key];
              
              return (
                <div 
                  key={key}
                  className={cn(
                    "rounded-lg border p-3",
                    colorClasses
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn("h-8 w-8 rounded-md flex items-center justify-center shrink-0", colorClasses.replace('text-', 'bg-').replace('400', '500/20'))}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                        {label}
                      </p>
                      <p className="text-sm text-foreground leading-relaxed">
                        {value}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // Fallback: raw text display
          <p className="text-sm text-muted-foreground leading-relaxed">
            {researchSummary}
          </p>
        )}
      </div>
    </div>
  );
}

// Export the parser for use in edge functions
export { parseResearchSummary };
export type { ParsedResearch };

import { useState } from "react";
import { X, ChevronDown, ChevronUp, Users, Phone, MapPin, Shield, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface Candidate {
  id: string;
  first_name: string;
  last_name: string;
  specialty?: string;
  state?: string;
  unified_score: string;
  match_strength: number;
  licenses_count?: number;
  has_personal_contact?: boolean;
  personal_mobile?: string;
  personal_email?: string;
}

interface ShortlistBannerProps {
  candidates: Candidate[];
  addedIds: Set<string>;
  onRemove: (id: string) => void;
  onClear: () => void;
  jobState: string;
}

const ShortlistBanner = ({
  candidates,
  addedIds,
  onRemove,
  onClear,
  jobState,
}: ShortlistBannerProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Get only the added candidates
  const addedCandidates = candidates.filter(c => addedIds.has(c.id));
  
  if (addedCandidates.length === 0) {
    return null;
  }

  // Calculate stats
  const contactReadyCount = addedCandidates.filter(
    c => c.has_personal_contact || c.personal_mobile || c.personal_email
  ).length;
  const localCount = addedCandidates.filter(c => c.state === jobState).length;
  const tenPlusLicensesCount = addedCandidates.filter(c => (c.licenses_count || 0) >= 10).length;

  // Score badge styling
  const getScoreColor = (score: string) => {
    if (score?.startsWith('A')) return 'text-success';
    if (score?.startsWith('B')) return 'text-blue-400';
    return 'text-muted-foreground';
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div className="rounded-xl bg-gradient-to-r from-primary/10 via-success/5 to-primary/10 border-2 border-primary/30 overflow-hidden">
        {/* Header - Always visible */}
        <div className="px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-primary/20 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                  Campaign Shortlist
                  <Badge className="bg-primary text-primary-foreground text-xs">
                    {addedCandidates.length} added
                  </Badge>
                </p>
                <p className="text-xs text-muted-foreground">
                  {contactReadyCount} Contact Ready • {localCount} Local • {tenPlusLicensesCount} with 10+ Licenses
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => { e.stopPropagation(); onClear(); }}
              className="text-xs text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Clear All
            </Button>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1">
                {isExpanded ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    Collapse
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    View All
                  </>
                )}
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>

        {/* Collapsed View - Horizontal scroll of chips */}
        {!isExpanded && (
          <div className="px-5 pb-3">
            <ScrollArea className="w-full whitespace-nowrap">
              <div className="flex gap-2">
                {addedCandidates.slice(0, 12).map((candidate) => (
                  <div
                    key={candidate.id}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-card border border-border hover:border-primary/50 transition-colors group"
                  >
                    <span className="text-sm font-medium text-foreground">
                      {candidate.first_name} {candidate.last_name?.charAt(0)}.
                    </span>
                    <span className={cn("text-xs font-bold", getScoreColor(candidate.unified_score))}>
                      {candidate.match_strength}%
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); onRemove(candidate.id); }}
                      className="h-4 w-4 rounded-full bg-muted/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {addedCandidates.length > 12 && (
                  <div className="inline-flex items-center px-3 py-1.5 rounded-full bg-muted/50 text-muted-foreground text-sm">
                    +{addedCandidates.length - 12} more
                  </div>
                )}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
        )}

        {/* Expanded View - Full list */}
        <CollapsibleContent>
          <div className="border-t border-primary/20 bg-card/50">
            <ScrollArea className="max-h-[300px]">
              <div className="p-4 space-y-2">
                {addedCandidates.map((candidate) => {
                  const isLocal = candidate.state === jobState;
                  const hasContact = candidate.has_personal_contact || candidate.personal_mobile || candidate.personal_email;
                  const hasManyLicenses = (candidate.licenses_count || 0) >= 10;

                  return (
                    <div
                      key={candidate.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-card border border-border hover:border-primary/40 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-foreground">
                            {candidate.first_name} {candidate.last_name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {candidate.specialty} • {candidate.state}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-xs font-bold",
                              candidate.unified_score?.startsWith('A') 
                                ? "bg-success/10 text-success border-success/30"
                                : candidate.unified_score?.startsWith('B')
                                  ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                                  : "bg-muted text-muted-foreground"
                            )}
                          >
                            {candidate.unified_score} • {candidate.match_strength}%
                          </Badge>
                          {isLocal && (
                            <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/30">
                              <MapPin className="h-3 w-3 mr-0.5" />
                              Local
                            </Badge>
                          )}
                          {hasContact && (
                            <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
                              <Phone className="h-3 w-3 mr-0.5" />
                              Contact
                            </Badge>
                          )}
                          {hasManyLicenses && (
                            <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-400 border-purple-500/30">
                              <Shield className="h-3 w-3 mr-0.5" />
                              {candidate.licenses_count}+ Lic
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemove(candidate.id)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

export default ShortlistBanner;

import { useMemo, useState } from "react";
import { Users, MapPin, Globe, ArrowRight, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Candidate {
  id: string;
  first_name: string;
  last_name: string;
  specialty: string;
  state: string;
  city?: string;
  match_strength: number;
  unified_score: string;
  has_personal_contact?: boolean;
  personal_mobile?: string;
  personal_email?: string;
  licenses?: string[];
  licenses_count?: number;
  enrichment_tier?: string;
}

interface ShortlistPanelProps {
  candidates: Candidate[];
  addedIds: Set<string>;
  jobState: string;
  onRemove: (id: string) => void;
  onClear: () => void;
  onContinue: () => void;
  disabled?: boolean;
}

const ShortlistPanel = ({
  candidates,
  addedIds,
  jobState,
  onRemove,
  onClear,
  onContinue,
  disabled
}: ShortlistPanelProps) => {
  const [localOpen, setLocalOpen] = useState(true);
  const [otherOpen, setOtherOpen] = useState(true);

  const addedCandidates = useMemo(() => 
    candidates.filter(c => addedIds.has(c.id)),
  [candidates, addedIds]);

  const localCandidates = useMemo(() => 
    addedCandidates.filter(c => c.state === jobState),
  [addedCandidates, jobState]);

  const otherCandidates = useMemo(() => 
    addedCandidates.filter(c => c.state !== jobState),
  [addedCandidates, jobState]);

  const stats = useMemo(() => ({
    total: addedCandidates.length,
    contactReady: addedCandidates.filter(c => 
      c.has_personal_contact || c.personal_mobile || c.personal_email ||
      ['platinum', 'gold'].includes(c.enrichment_tier?.toLowerCase() || '')
    ).length,
    localCount: localCandidates.length,
    avgMatch: addedCandidates.length > 0 
      ? Math.round(addedCandidates.reduce((s, c) => s + c.match_strength, 0) / addedCandidates.length) 
      : 0,
    inLicensed: addedCandidates.filter(c => 
      c.licenses?.some(l => l.toUpperCase().includes(jobState.toUpperCase()))
    ).length,
    needsEnrich: addedCandidates.filter(c => !c.has_personal_contact && !c.personal_mobile).length,
  }), [addedCandidates, localCandidates, jobState]);

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Your Shortlist
          <Badge className="bg-primary text-primary-foreground">{stats.total}</Badge>
        </h2>
        {stats.total > 0 && (
          <Button variant="ghost" size="sm" onClick={onClear} className="text-muted-foreground hover:text-destructive">
            Clear All
          </Button>
        )}
      </div>

      {/* Quick Stats */}
      {stats.total > 0 && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-success/10 p-2">
            <p className="text-lg font-bold text-success">{stats.contactReady}</p>
            <p className="text-[10px] text-muted-foreground">Ready</p>
          </div>
          <div className="rounded-lg bg-primary/10 p-2">
            <p className="text-lg font-bold text-primary">{stats.localCount}</p>
            <p className="text-[10px] text-muted-foreground">Local</p>
          </div>
          <div className="rounded-lg bg-purple-500/10 p-2">
            <p className="text-lg font-bold text-purple-400">{stats.inLicensed}</p>
            <p className="text-[10px] text-muted-foreground">{jobState} Lic</p>
          </div>
        </div>
      )}

      {/* Scrollable Sections */}
      <ScrollArea className="flex-1 -mx-4 px-4">
        <div className="space-y-3">
          {/* Local Section */}
          {localCandidates.length > 0 && (
            <Collapsible open={localOpen} onOpenChange={setLocalOpen}>
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-success/10 border border-success/20 hover:bg-success/15 transition-colors">
                  <div className="flex items-center gap-2 text-success font-medium text-sm">
                    <MapPin className="h-4 w-4" />
                    Local ({localCandidates.length})
                  </div>
                  {localOpen ? <ChevronUp className="h-4 w-4 text-success" /> : <ChevronDown className="h-4 w-4 text-success" />}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-1.5">
                {localCandidates.slice(0, 4).map(candidate => (
                  <ShortlistItem 
                    key={candidate.id} 
                    candidate={candidate} 
                    onRemove={() => onRemove(candidate.id)}
                    highlight="green"
                  />
                ))}
                {localCandidates.length > 4 && (
                  <p className="text-xs text-success/70 text-center py-1">
                    +{localCandidates.length - 4} more local
                  </p>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Other States Section */}
          {otherCandidates.length > 0 && (
            <Collapsible open={otherOpen} onOpenChange={setOtherOpen}>
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50 border border-border hover:bg-muted transition-colors">
                  <div className="flex items-center gap-2 text-foreground font-medium text-sm">
                    <Globe className="h-4 w-4" />
                    Other States ({otherCandidates.length})
                  </div>
                  {otherOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-1.5">
                {otherCandidates.slice(0, 4).map(candidate => (
                  <ShortlistItem 
                    key={candidate.id} 
                    candidate={candidate} 
                    onRemove={() => onRemove(candidate.id)}
                  />
                ))}
                {otherCandidates.length > 4 && (
                  <p className="text-xs text-muted-foreground text-center py-1">
                    +{otherCandidates.length - 4} more
                  </p>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Empty State */}
          {stats.total === 0 && (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No candidates selected</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Click "Add" on candidates to build your shortlist</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Detailed Stats */}
      {stats.total > 0 && (
        <div className="rounded-lg bg-muted/50 p-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Shortlist Stats</p>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Avg Match Score</span>
              <span className="font-medium text-foreground">{stats.avgMatch}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{jobState} Licensed</span>
              <span className="font-medium text-foreground">{stats.inLicensed}/{stats.total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Contact Ready</span>
              <span className={cn(
                "font-medium",
                stats.contactReady === stats.total ? "text-success" : "text-warning"
              )}>
                {stats.contactReady}/{stats.total}
              </span>
            </div>
            {stats.needsEnrich > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Needs Enrichment</span>
                <span className="font-medium text-warning">{stats.needsEnrich}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Continue Button */}
      <Button
        className="w-full"
        size="lg"
        onClick={onContinue}
        disabled={disabled || stats.total === 0}
      >
        Continue with {stats.total} Candidates
        <ArrowRight className="h-5 w-5 ml-2" />
      </Button>
    </div>
  );
};

// Individual shortlist item
interface ShortlistItemProps {
  candidate: Candidate;
  onRemove: () => void;
  highlight?: 'green';
}

const ShortlistItem = ({ candidate, onRemove, highlight }: ShortlistItemProps) => {
  return (
    <div className={cn(
      "flex items-center justify-between px-3 py-2 rounded-lg border transition-all group",
      highlight === 'green' 
        ? "bg-success/5 border-success/20 hover:bg-success/10"
        : "bg-card border-border hover:bg-muted/50"
    )}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {candidate.first_name} {candidate.last_name}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {candidate.city}, {candidate.state}
        </p>
      </div>
      <div className="flex items-center gap-2 ml-2">
        <Badge variant="outline" className="text-xs">
          {candidate.match_strength}%
        </Badge>
        <button 
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded transition-all"
        >
          <X className="h-3.5 w-3.5 text-destructive" />
        </button>
      </div>
    </div>
  );
};

export default ShortlistPanel;


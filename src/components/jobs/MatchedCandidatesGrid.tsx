import { useState } from "react";
import { Users, Search, ArrowUpDown, Trash2, CheckSquare, Square, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MatchedCandidateCard, MatchedCandidate } from "./MatchedCandidateCard";
import { RemoveMatchDialog } from "./RemoveMatchDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface MatchedCandidatesGridProps {
  candidates: MatchedCandidate[];
  requiredState?: string;
  jobId: string;
  onAddToCampaign?: (candidateId: string) => void;
  onCandidatesRemoved?: (removedIds: string[]) => void;
  isLoading?: boolean;
}

type SortOption = "match_score" | "name" | "state" | "date";
type FilterOption = "all" | "licensed" | "unlicensed" | "has_concerns";

export const MatchedCandidatesGrid = ({
  candidates,
  requiredState,
  jobId,
  onAddToCampaign,
  onCandidatesRemoved,
  isLoading = false,
}: MatchedCandidatesGridProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("match_score");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [filterBy, setFilterBy] = useState<FilterOption>("all");
  
  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Remove dialog state
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [candidateToRemove, setCandidateToRemove] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  // Filter candidates
  const filteredCandidates = candidates.filter((c) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const fullName = `${c.first_name || ""} ${c.last_name || ""}`.toLowerCase();
      const matchesSearch = (
        fullName.includes(query) ||
        c.specialty?.toLowerCase().includes(query) ||
        c.state?.toLowerCase().includes(query) ||
        c.email?.toLowerCase().includes(query)
      );
      if (!matchesSearch) return false;
    }
    
    // Type filter
    if (filterBy === "licensed" && requiredState) {
      const hasLicense = c.licenses?.some(l => l.toLowerCase().includes(requiredState.toLowerCase()));
      if (!hasLicense) return false;
    }
    if (filterBy === "unlicensed" && requiredState) {
      const hasLicense = c.licenses?.some(l => l.toLowerCase().includes(requiredState.toLowerCase()));
      if (hasLicense) return false;
    }
    if (filterBy === "has_concerns") {
      if (!c.match_concerns || c.match_concerns.length === 0) return false;
    }
    
    return true;
  });

  // Sort candidates
  const sortedCandidates = [...filteredCandidates].sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case "match_score":
        comparison = (a.match_score || 0) - (b.match_score || 0);
        break;
      case "name":
        const nameA = `${a.first_name || ""} ${a.last_name || ""}`;
        const nameB = `${b.first_name || ""} ${b.last_name || ""}`;
        comparison = nameA.localeCompare(nameB);
        break;
      case "state":
        comparison = (a.state || "").localeCompare(b.state || "");
        break;
      case "date":
        comparison = new Date(a.matched_at || 0).getTime() - new Date(b.matched_at || 0).getTime();
        break;
    }
    
    return sortOrder === "desc" ? -comparison : comparison;
  });

  const handleSelect = (candidateId: string, selected: boolean) => {
    setSelectedIds(prev => {
      const updated = new Set(prev);
      if (selected) {
        updated.add(candidateId);
      } else {
        updated.delete(candidateId);
      }
      return updated;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === sortedCandidates.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedCandidates.map(c => c.id)));
    }
  };

  const handleSelectLocal = () => {
    if (!requiredState) return;
    const localIds = sortedCandidates
      .filter(c => c.licenses?.some(l => l.toLowerCase().includes(requiredState.toLowerCase())))
      .map(c => c.id);
    setSelectedIds(new Set(localIds));
  };

  const handleRemoveSingle = (candidateId: string) => {
    setCandidateToRemove(candidateId);
    setRemoveDialogOpen(true);
  };

  const handleRemoveSelected = () => {
    if (selectedIds.size === 0) return;
    setCandidateToRemove(null); // null indicates bulk remove
    setRemoveDialogOpen(true);
  };

  const handleRemoveConfirm = async () => {
    setIsRemoving(true);
    
    try {
      const idsToRemove = candidateToRemove ? [candidateToRemove] : Array.from(selectedIds);
      
      const { error } = await supabase
        .from("candidate_job_matches")
        .delete()
        .eq("job_id", jobId)
        .in("candidate_id", idsToRemove);

      if (error) throw error;

      toast({ 
        title: `Removed ${idsToRemove.length} candidate${idsToRemove.length !== 1 ? "s" : ""} from matches` 
      });
      
      onCandidatesRemoved?.(idsToRemove);
      setSelectedIds(new Set());
    } catch (err) {
      console.error("Error removing matches:", err);
      toast({
        title: "Error",
        description: "Failed to remove candidates",
        variant: "destructive",
      });
    } finally {
      setIsRemoving(false);
      setRemoveDialogOpen(false);
      setCandidateToRemove(null);
    }
  };

  const selectedCandidate = candidateToRemove 
    ? candidates.find(c => c.id === candidateToRemove)
    : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <div className="text-center py-16 rounded-xl border border-dashed border-border bg-card">
        <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
        <h3 className="text-lg font-medium text-foreground mb-2">No matched candidates</h3>
        <p className="text-muted-foreground">
          Run candidate matching to find candidates for this job
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search candidates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        
        {/* Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-1" />
              {filterBy === "all" ? "All" : 
               filterBy === "licensed" ? "Licensed" :
               filterBy === "unlicensed" ? "Unlicensed" : "Has Concerns"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setFilterBy("all")}>
              All Candidates
            </DropdownMenuItem>
            {requiredState && (
              <>
                <DropdownMenuItem onClick={() => setFilterBy("licensed")}>
                  {requiredState} Licensed
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterBy("unlicensed")}>
                  No {requiredState} License
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem onClick={() => setFilterBy("has_concerns")}>
              Has Concerns
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Sort */}
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="match_score">Match Score</SelectItem>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="state">State</SelectItem>
            <SelectItem value="date">Date Matched</SelectItem>
          </SelectContent>
        </Select>
        
        <Button
          variant="outline"
          size="icon"
          onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
        >
          <ArrowUpDown className={`h-4 w-4 transition-transform ${sortOrder === "asc" ? "rotate-180" : ""}`} />
        </Button>

        <Badge variant="secondary">
          {filteredCandidates.length} of {candidates.length}
        </Badge>
      </div>

      {/* Selection Toolbar */}
      <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSelectAll}
          className="gap-2"
        >
          {selectedIds.size === sortedCandidates.length && sortedCandidates.length > 0 ? (
            <CheckSquare className="h-4 w-4" />
          ) : (
            <Square className="h-4 w-4" />
          )}
          {selectedIds.size === sortedCandidates.length && sortedCandidates.length > 0 ? "Deselect All" : "Select All"}
        </Button>
        
        {requiredState && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSelectLocal}
          >
            Select {requiredState} Licensed
          </Button>
        )}

        {selectedIds.size > 0 && (
          <>
            <div className="h-4 w-px bg-border mx-2" />
            <Badge variant="secondary">
              {selectedIds.size} selected
            </Badge>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleRemoveSelected}
              className="ml-auto"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Remove Selected
            </Button>
          </>
        )}
      </div>

      {/* Grid */}
      <div className="max-h-[600px] overflow-auto pr-1">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedCandidates.map((candidate) => (
            <MatchedCandidateCard
              key={candidate.id}
              candidate={candidate}
              requiredState={requiredState}
              onAddToCampaign={onAddToCampaign}
              onRemove={handleRemoveSingle}
              isSelected={selectedIds.has(candidate.id)}
              onSelect={handleSelect}
            />
          ))}
        </div>
      </div>

      {/* Remove Confirmation Dialog */}
      <RemoveMatchDialog
        open={removeDialogOpen}
        onOpenChange={setRemoveDialogOpen}
        candidateName={selectedCandidate 
          ? `${selectedCandidate.first_name || ""} ${selectedCandidate.last_name || ""}`.trim() || "Unknown"
          : ""
        }
        count={candidateToRemove ? undefined : selectedIds.size}
        onConfirm={handleRemoveConfirm}
        isLoading={isRemoving}
      />
    </div>
  );
};

export default MatchedCandidatesGrid;

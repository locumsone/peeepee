import { useState } from "react";
import { Users, Search, ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MatchedCandidateCard, MatchedCandidate } from "./MatchedCandidateCard";

interface MatchedCandidatesGridProps {
  candidates: MatchedCandidate[];
  requiredState?: string;
  onAddToCampaign?: (candidateId: string) => void;
  isLoading?: boolean;
}

type SortOption = "match_score" | "name" | "state" | "date";

export const MatchedCandidatesGrid = ({
  candidates,
  requiredState,
  onAddToCampaign,
  isLoading = false,
}: MatchedCandidatesGridProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("match_score");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Filter candidates
  const filteredCandidates = candidates.filter((c) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const fullName = `${c.first_name || ""} ${c.last_name || ""}`.toLowerCase();
    return (
      fullName.includes(query) ||
      c.specialty?.toLowerCase().includes(query) ||
      c.state?.toLowerCase().includes(query) ||
      c.email?.toLowerCase().includes(query)
    );
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
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search candidates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
          <SelectTrigger className="w-[160px]">
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

      {/* Grid */}
      <ScrollArea className="h-[600px]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-4">
          {sortedCandidates.map((candidate) => (
            <MatchedCandidateCard
              key={candidate.id}
              candidate={candidate}
              requiredState={requiredState}
              onAddToCampaign={onAddToCampaign}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default MatchedCandidatesGrid;

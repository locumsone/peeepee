import { useState, useEffect, useMemo } from "react";
import { 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight,
  Check,
  X,
  Download,
  Users,
  ChevronDown
} from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import CandidateDetailPanel from "@/components/candidates/CandidateDetailPanel";

interface Candidate {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  specialty: string | null;
  city: string | null;
  state: string | null;
  licenses: string[] | null;
  enrichment_tier: string | null;
}

interface Campaign {
  id: string;
  name: string | null;
}

const ITEMS_PER_PAGE = 50;
const TIERS = ["Platinum", "Gold", "Silver", "Bronze"];

const CandidateSearch = () => {
  const { toast } = useToast();
  
  // Data state
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  
  // Filter options
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [states, setStates] = useState<string[]>([]);
  
  // Search & filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [selectedTiers, setSelectedTiers] = useState<string[]>([]);
  const [hasPhone, setHasPhone] = useState(false);
  const [hasEmail, setHasEmail] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  
  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // UI state
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");

  // Load filter options on mount
  useEffect(() => {
    loadFilterOptions();
    loadCampaigns();
  }, []);

  // Load candidates when filters change
  useEffect(() => {
    loadCandidates();
  }, [searchQuery, selectedSpecialties, selectedStates, selectedTiers, hasPhone, hasEmail, currentPage]);

  const loadFilterOptions = async () => {
    const [specialtiesRes, statesRes] = await Promise.all([
      supabase.from("candidates").select("specialty").not("specialty", "is", null),
      supabase.from("candidates").select("state").not("state", "is", null),
    ]);

    const uniqueSpecialties = [...new Set(specialtiesRes.data?.map(c => c.specialty).filter(Boolean) as string[])].sort();
    const uniqueStates = [...new Set(statesRes.data?.map(c => c.state).filter(Boolean) as string[])].sort();
    
    setSpecialties(uniqueSpecialties);
    setStates(uniqueStates);
  };

  const loadCampaigns = async () => {
    const { data } = await supabase
      .from("campaigns")
      .select("id, name")
      .order("created_at", { ascending: false });
    setCampaigns(data || []);
  };

  const loadCandidates = async () => {
    setLoading(true);
    
    let query = supabase
      .from("candidates")
      .select("id, first_name, last_name, email, phone, specialty, city, state, licenses, enrichment_tier", { count: "exact" });

    // Search filter
    if (searchQuery.trim()) {
      const search = `%${searchQuery.trim()}%`;
      query = query.or(`first_name.ilike.${search},last_name.ilike.${search},email.ilike.${search},phone.ilike.${search}`);
    }

    // Specialty filter
    if (selectedSpecialties.length > 0) {
      query = query.in("specialty", selectedSpecialties);
    }

    // State filter
    if (selectedStates.length > 0) {
      query = query.in("state", selectedStates);
    }

    // Tier filter
    if (selectedTiers.length > 0) {
      query = query.in("enrichment_tier", selectedTiers);
    }

    // Has phone filter
    if (hasPhone) {
      query = query.not("phone", "is", null);
    }

    // Has email filter
    if (hasEmail) {
      query = query.not("email", "is", null);
    }

    // Pagination
    const from = (currentPage - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;
    
    query = query.range(from, to).order("created_at", { ascending: false });

    const { data, count, error } = await query;

    if (error) {
      console.error("Error loading candidates:", error);
      toast({ title: "Error loading candidates", variant: "destructive" });
    } else {
      setCandidates(data || []);
      setTotalCount(count || 0);
    }
    
    setLoading(false);
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const startItem = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endItem = Math.min(currentPage * ITEMS_PER_PAGE, totalCount);

  const toggleSelectAll = () => {
    if (selectedIds.size === candidates.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(candidates.map(c => c.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleAddToCampaign = async () => {
    if (!selectedCampaignId || selectedIds.size === 0) return;

    const leads = Array.from(selectedIds).map(candidateId => ({
      campaign_id: selectedCampaignId,
      candidate_id: candidateId,
      status: "pending",
    }));

    const { error } = await supabase.from("campaign_leads_v2").insert(leads);

    if (error) {
      toast({ title: "Error adding to campaign", variant: "destructive" });
    } else {
      toast({ title: `Added ${selectedIds.size} candidates to campaign` });
      setSelectedIds(new Set());
      setCampaignModalOpen(false);
    }
  };

  const handleExportCSV = () => {
    const selectedCandidates = candidates.filter(c => selectedIds.has(c.id));
    const headers = ["Name", "Email", "Phone", "Specialty", "City", "State", "Tier"];
    const rows = selectedCandidates.map(c => [
      `${c.first_name || ""} ${c.last_name || ""}`.trim(),
      c.email || "",
      c.phone || "",
      c.specialty || "",
      c.city || "",
      c.state || "",
      c.enrichment_tier || "",
    ]);

    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "candidates.csv";
    a.click();
    URL.revokeObjectURL(url);
    
    toast({ title: `Exported ${selectedIds.size} candidates` });
  };

  const getTierBadge = (tier: string | null) => {
    if (!tier) return null;
    const colors: Record<string, string> = {
      Platinum: "bg-purple-500/20 text-purple-400 border-purple-500/30",
      Gold: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      Silver: "bg-gray-400/20 text-gray-300 border-gray-400/30",
      Bronze: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    };
    return (
      <Badge variant="outline" className={colors[tier] || ""}>
        {tier}
      </Badge>
    );
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedSpecialties([]);
    setSelectedStates([]);
    setSelectedTiers([]);
    setHasPhone(false);
    setHasEmail(false);
    setCurrentPage(1);
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedSpecialties.length) count++;
    if (selectedStates.length) count++;
    if (selectedTiers.length) count++;
    if (hasPhone) count++;
    if (hasEmail) count++;
    return count;
  }, [selectedSpecialties, selectedStates, selectedTiers, hasPhone, hasEmail]);

  return (
    <Layout>
      <div className="flex h-[calc(100vh-64px)]">
        {/* Filter Sidebar */}
        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
          <div className={`border-r border-border bg-card transition-all ${filtersOpen ? "w-64" : "w-0"} overflow-hidden`}>
            <ScrollArea className="h-full">
              <div className="p-4 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground">Filters</h3>
                  {activeFilterCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      Clear all
                    </Button>
                  )}
                </div>

                {/* Specialty Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Specialty</label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        {selectedSpecialties.length > 0 
                          ? `${selectedSpecialties.length} selected` 
                          : "Select specialties"}
                        <ChevronDown className="h-4 w-4 ml-2" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56 max-h-64 overflow-auto">
                      {specialties.map(specialty => (
                        <DropdownMenuCheckboxItem
                          key={specialty}
                          checked={selectedSpecialties.includes(specialty)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedSpecialties([...selectedSpecialties, specialty]);
                            } else {
                              setSelectedSpecialties(selectedSpecialties.filter(s => s !== specialty));
                            }
                            setCurrentPage(1);
                          }}
                        >
                          {specialty}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* State Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">State</label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        {selectedStates.length > 0 
                          ? `${selectedStates.length} selected` 
                          : "Select states"}
                        <ChevronDown className="h-4 w-4 ml-2" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56 max-h-64 overflow-auto">
                      {states.map(state => (
                        <DropdownMenuCheckboxItem
                          key={state}
                          checked={selectedStates.includes(state)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedStates([...selectedStates, state]);
                            } else {
                              setSelectedStates(selectedStates.filter(s => s !== state));
                            }
                            setCurrentPage(1);
                          }}
                        >
                          {state}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Tier Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Enrichment Tier</label>
                  <div className="space-y-2">
                    {TIERS.map(tier => (
                      <div key={tier} className="flex items-center space-x-2">
                        <Checkbox
                          id={`tier-${tier}`}
                          checked={selectedTiers.includes(tier)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedTiers([...selectedTiers, tier]);
                            } else {
                              setSelectedTiers(selectedTiers.filter(t => t !== tier));
                            }
                            setCurrentPage(1);
                          }}
                        />
                        <label htmlFor={`tier-${tier}`} className="text-sm text-foreground cursor-pointer">
                          {tier}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Contact Filters */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Contact Info</label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="has-phone"
                        checked={hasPhone}
                        onCheckedChange={(checked) => {
                          setHasPhone(!!checked);
                          setCurrentPage(1);
                        }}
                      />
                      <label htmlFor="has-phone" className="text-sm text-foreground cursor-pointer">
                        Has Phone
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="has-email"
                        checked={hasEmail}
                        onCheckedChange={(checked) => {
                          setHasEmail(!!checked);
                          setCurrentPage(1);
                        }}
                      />
                      <label htmlFor="has-email" className="text-sm text-foreground cursor-pointer">
                        Has Email
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>
          
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-card border border-border rounded-l-none"
              style={{ left: filtersOpen ? "256px" : "0" }}
            >
              <Filter className="h-4 w-4" />
            </Button>
          </CollapsibleTrigger>
        </Collapsible>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-border">
            <div className="flex items-center justify-between gap-4">
              <h1 className="text-2xl font-bold text-foreground">Candidates</h1>
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or phone..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {/* Bulk Action Bar */}
          {selectedIds.size > 0 && (
            <div className="px-6 py-3 bg-primary/10 border-b border-border flex items-center gap-4">
              <span className="text-sm font-medium text-foreground">
                {selectedIds.size} selected
              </span>
              <Button size="sm" onClick={() => setCampaignModalOpen(true)}>
                <Users className="h-4 w-4 mr-1" />
                Add to Campaign
              </Button>
              <Button size="sm" variant="outline" onClick={handleExportCSV}>
                <Download className="h-4 w-4 mr-1" />
                Export CSV
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                Clear selection
              </Button>
            </div>
          )}

          {/* Results Table */}
          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={candidates.length > 0 && selectedIds.size === candidates.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Specialty</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Licenses</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead className="text-center">Phone</TableHead>
                  <TableHead className="text-center">Email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Loading candidates...
                    </TableCell>
                  </TableRow>
                ) : candidates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No candidates found
                    </TableCell>
                  </TableRow>
                ) : (
                  candidates.map((candidate) => (
                    <TableRow
                      key={candidate.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedCandidateId(candidate.id)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(candidate.id)}
                          onCheckedChange={() => toggleSelect(candidate.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {`${candidate.first_name || ""} ${candidate.last_name || ""}`.trim() || "—"}
                      </TableCell>
                      <TableCell>{candidate.specialty || "—"}</TableCell>
                      <TableCell>
                        {candidate.city && candidate.state
                          ? `${candidate.city}, ${candidate.state}`
                          : candidate.state || "—"}
                      </TableCell>
                      <TableCell>
                        {candidate.licenses?.length || 0}
                      </TableCell>
                      <TableCell>{getTierBadge(candidate.enrichment_tier)}</TableCell>
                      <TableCell className="text-center">
                        {candidate.phone ? (
                          <Check className="h-4 w-4 text-green-400 mx-auto" />
                        ) : (
                          <X className="h-4 w-4 text-muted-foreground mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {candidate.email ? (
                          <Check className="h-4 w-4 text-green-400 mx-auto" />
                        ) : (
                          <X className="h-4 w-4 text-muted-foreground mx-auto" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="p-4 border-t border-border flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Showing {totalCount > 0 ? startItem : 0}-{endItem} of {totalCount}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground px-2">
                Page {currentPage} of {totalPages || 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Candidate Detail Panel */}
        <CandidateDetailPanel
          candidateId={selectedCandidateId}
          onClose={() => setSelectedCandidateId(null)}
        />

        {/* Add to Campaign Modal */}
        <Dialog open={campaignModalOpen} onOpenChange={setCampaignModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add to Campaign</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <label className="text-sm font-medium text-foreground">Select Campaign</label>
              <select
                className="w-full mt-2 p-2 rounded-md border border-border bg-background text-foreground"
                value={selectedCampaignId}
                onChange={(e) => setSelectedCampaignId(e.target.value)}
              >
                <option value="">Choose a campaign...</option>
                {campaigns.map(campaign => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name || "Untitled Campaign"}
                  </option>
                ))}
              </select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCampaignModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddToCampaign} disabled={!selectedCampaignId}>
                Add {selectedIds.size} Candidates
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default CandidateSearch;

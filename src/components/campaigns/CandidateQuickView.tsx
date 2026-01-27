import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  Phone,
  MessageSquare,
  Mail,
  User,
  MapPin,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPhoneNumber } from "@/lib/formatPhone";
import { useSoftphoneActions } from "@/hooks/useSoftphoneActions";
import { toast } from "sonner";

interface CandidateQuickViewProps {
  campaignId: string | null;
  campaignName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type LeadStatus = "all" | "contacted" | "opened" | "replied" | "interested";

export const CandidateQuickView = ({
  campaignId,
  campaignName,
  open,
  onOpenChange,
}: CandidateQuickViewProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus>("all");
  const { initiateCall } = useSoftphoneActions();

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["campaign-leads", campaignId],
    queryFn: async () => {
      if (!campaignId) return [];
      const { data, error } = await supabase
        .from("campaign_leads_v2")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!campaignId && open,
  });

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      !searchQuery ||
      lead.candidate_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.candidate_phone?.includes(searchQuery);

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "contacted" && (lead.emails_sent || 0) > 0) ||
      (statusFilter === "opened" && (lead.emails_opened || 0) > 0) ||
      (statusFilter === "replied" && (lead.emails_replied || 0) > 0) ||
      (statusFilter === "interested" && lead.interest_level === "high");

    return matchesSearch && matchesStatus;
  });

  const handleCall = (lead: typeof leads[0]) => {
    if (lead.candidate_phone) {
      initiateCall({
        phoneNumber: lead.candidate_phone,
        candidateName: lead.candidate_name || undefined,
        candidateId: lead.candidate_id || undefined,
      });
      toast.success(`Calling ${lead.candidate_name || formatPhoneNumber(lead.candidate_phone)}...`);
    }
  };

  const handleSMS = (lead: typeof leads[0]) => {
    if (lead.candidate_phone) {
      // Navigate to communications with this phone pre-filled
      window.location.href = `/communications?phone=${encodeURIComponent(lead.candidate_phone)}`;
    }
  };

  const statusFilters: { key: LeadStatus; label: string }[] = [
    { key: "all", label: "All" },
    { key: "contacted", label: "Contacted" },
    { key: "opened", label: "Opened" },
    { key: "replied", label: "Replied" },
    { key: "interested", label: "Interested" },
  ];

  const getStatusBadge = (lead: typeof leads[0]) => {
    if (lead.interest_level === "high") {
      return <Badge className="bg-success/20 text-success border-0 text-[10px]">Interested</Badge>;
    }
    if ((lead.emails_replied || 0) > 0 || (lead.sms_replied || 0) > 0) {
      return <Badge className="bg-primary/20 text-primary border-0 text-[10px]">Replied</Badge>;
    }
    if ((lead.emails_opened || 0) > 0) {
      return <Badge className="bg-accent/20 text-accent border-0 text-[10px]">Opened</Badge>;
    }
    if ((lead.emails_sent || 0) > 0 || (lead.sms_sent || 0) > 0) {
      return <Badge variant="outline" className="text-[10px]">Contacted</Badge>;
    }
    return <Badge variant="secondary" className="text-[10px]">Pending</Badge>;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[480px] p-0">
        <SheetHeader className="p-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {campaignName ? `${campaignName} - Leads` : "Campaign Leads"}
          </SheetTitle>
        </SheetHeader>

        {/* Filters */}
        <div className="p-4 border-b border-border space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-9"
            />
          </div>

          {/* Status Filter Chips */}
          <div className="flex gap-1 flex-wrap">
            {statusFilters.map((filter) => (
              <button
                key={filter.key}
                onClick={() => setStatusFilter(filter.key)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-medium transition-all",
                  statusFilter === filter.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Leads List */}
        <ScrollArea className="h-[calc(100vh-200px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <User className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">No leads found</p>
              {searchQuery && (
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Try adjusting your search
                </p>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="p-4 hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-foreground truncate">
                          {lead.candidate_name || "Unknown"}
                        </h4>
                        {getStatusBadge(lead)}
                      </div>
                      
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {lead.candidate_phone && (
                          <span className="font-mono">
                            {formatPhoneNumber(lead.candidate_phone)}
                          </span>
                        )}
                        {lead.candidate_specialty && (
                          <span>{lead.candidate_specialty}</span>
                        )}
                        {lead.candidate_state && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {lead.candidate_state}
                          </span>
                        )}
                      </div>

                      {/* Engagement Stats */}
                      <div className="flex items-center gap-3 mt-2 text-xs">
                        {(lead.emails_sent || 0) > 0 && (
                          <span className="text-muted-foreground">
                            <Mail className="h-3 w-3 inline mr-1" />
                            {lead.emails_sent} sent, {lead.emails_opened || 0} opened
                          </span>
                        )}
                        {(lead.calls_attempted || 0) > 0 && (
                          <span className="text-muted-foreground">
                            <Phone className="h-3 w-3 inline mr-1" />
                            {lead.calls_connected || 0}/{lead.calls_attempted} calls
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleCall(lead)}
                        disabled={!lead.candidate_phone}
                      >
                        <Phone className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleSMS(lead)}
                        disabled={!lead.candidate_phone}
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                      {lead.candidate_id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => window.open(`/candidates/${lead.candidate_id}`, "_blank")}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="border-t border-border p-4 bg-secondary/30">
          <p className="text-xs text-muted-foreground text-center">
            {filteredLeads.length} of {leads.length} leads
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
};

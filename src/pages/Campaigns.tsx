import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Loader2 } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  CampaignCard,
  CampaignStats,
  CampaignFilters,
  CampaignKanbanBoard,
  CampaignPipeline,
  CandidateQuickView,
  calculateHealth,
} from "@/components/campaigns";
import type { CampaignWithJob, FilterTab, ViewMode, HealthStatus } from "@/components/campaigns";

const Campaigns = () => {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<CampaignWithJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [healthFilter, setHealthFilter] = useState<HealthStatus | null>(null);
  const [channelFilter, setChannelFilter] = useState<string | null>(null);
  
  // Quick view state
  const [quickViewCampaignId, setQuickViewCampaignId] = useState<string | null>(null);
  const [quickViewCampaignName, setQuickViewCampaignName] = useState<string | null>(null);

  useEffect(() => {
    fetchCampaigns();
    
    // Real-time subscription
    const channel = supabase
      .channel("campaigns-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "campaigns" },
        () => fetchCampaigns()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchCampaigns = async () => {
    try {
      const { data, error } = await supabase
        .from("campaigns")
        .select(`
          *,
          jobs (
            job_name,
            specialty,
            facility_name,
            city,
            state,
            pay_rate
          )
        `)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setCampaigns((data as CampaignWithJob[]) || []);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      toast.error("Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats
  const stats = useMemo(() => {
    const activeCount = campaigns.filter((c) => c.status === "active").length;
    const pausedCount = campaigns.filter((c) => c.status === "paused").length;
    const completedCount = campaigns.filter((c) => c.status === "completed").length;
    const draftCount = campaigns.filter((c) => !c.status || c.status === "draft").length;
    const totalLeads = campaigns.reduce((sum, c) => sum + (c.leads_count || 0), 0);

    // Calculate average rates
    const campaignsWithSent = campaigns.filter((c) => (c.emails_sent || 0) > 0);
    const avgOpenRate =
      campaignsWithSent.length > 0
        ? campaignsWithSent.reduce((sum, c) => {
            const rate = ((c.emails_opened || 0) / (c.emails_sent || 1)) * 100;
            return sum + rate;
          }, 0) / campaignsWithSent.length
        : 0;

    const avgReplyRate =
      campaignsWithSent.length > 0
        ? campaignsWithSent.reduce((sum, c) => {
            const rate = ((c.emails_replied || 0) / (c.emails_sent || 1)) * 100;
            return sum + rate;
          }, 0) / campaignsWithSent.length
        : 0;

    // Hot leads would come from campaign_leads_v2, for now estimate from replied
    const hotLeadsCount = campaigns.reduce(
      (sum, c) => sum + (c.emails_replied || 0) + (c.sms_replied || 0),
      0
    );

    return {
      activeCount,
      pausedCount,
      completedCount,
      draftCount,
      totalLeads,
      avgOpenRate,
      avgReplyRate,
      hotLeadsCount,
    };
  }, [campaigns]);

  // Filter campaigns
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((campaign) => {
      // Search filter
      const matchesSearch =
        !searchQuery ||
        campaign.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        campaign.jobs?.job_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        campaign.jobs?.specialty?.toLowerCase().includes(searchQuery.toLowerCase());

      // Status filter
      const matchesStatus =
        activeFilter === "all" ||
        (activeFilter === "draft" && (!campaign.status || campaign.status === "draft")) ||
        campaign.status === activeFilter;

      // Health filter
      let matchesHealth = true;
      if (healthFilter) {
        const health = calculateHealth(
          campaign.emails_sent || 0,
          campaign.emails_opened || 0,
          campaign.emails_bounced || 0
        );
        matchesHealth = health === healthFilter;
      }

      // Channel filter
      let matchesChannel = true;
      if (channelFilter) {
        const channel = campaign.channel?.toLowerCase() || "";
        if (channelFilter === "email") {
          matchesChannel = channel.includes("email") && !channel.includes("sms");
        } else if (channelFilter === "sms") {
          matchesChannel = channel.includes("sms") && !channel.includes("email");
        } else if (channelFilter === "multi") {
          matchesChannel = channel.includes("all") || 
            (channel.includes("email") && channel.includes("sms"));
        }
      }

      return matchesSearch && matchesStatus && matchesHealth && matchesChannel;
    });
  }, [campaigns, searchQuery, activeFilter, healthFilter, channelFilter]);

  const handlePauseResume = async (campaignId: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "paused" : "active";
    try {
      const { error } = await supabase
        .from("campaigns")
        .update({ status: newStatus })
        .eq("id", campaignId);
      if (error) throw error;
      toast.success(`Campaign ${newStatus === "active" ? "resumed" : "paused"}`);
      fetchCampaigns();
    } catch (error) {
      console.error("Error updating campaign:", error);
      toast.error("Failed to update campaign");
    }
  };

  const handleDelete = async (campaignId: string) => {
    if (!confirm("Are you sure you want to delete this campaign?")) return;
    try {
      const { error } = await supabase.from("campaigns").delete().eq("id", campaignId);
      if (error) throw error;
      toast.success("Campaign deleted");
      fetchCampaigns();
    } catch (error) {
      console.error("Error deleting campaign:", error);
      toast.error("Failed to delete campaign");
    }
  };

  const handleDuplicate = async (campaignId: string) => {
    const campaign = campaigns.find((c) => c.id === campaignId);
    if (!campaign) return;

    try {
      const { error } = await supabase.from("campaigns").insert({
        name: `${campaign.name || "Campaign"} (Copy)`,
        job_id: campaign.job_id,
        channel: campaign.channel,
        status: "draft",
      });
      if (error) throw error;
      toast.success("Campaign duplicated");
      fetchCampaigns();
    } catch (error) {
      console.error("Error duplicating campaign:", error);
      toast.error("Failed to duplicate campaign");
    }
  };

  const handleViewLeads = (campaignId: string) => {
    const campaign = campaigns.find((c) => c.id === campaignId);
    setQuickViewCampaignId(campaignId);
    setQuickViewCampaignName(campaign?.name || null);
  };

  const handleContinueDraft = (campaignId: string) => {
    // Navigate to review page with the draft campaign ID
    navigate(`/campaigns/new/review?draft=${campaignId}`);
  };

  const handleStatusChange = async (campaignId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("campaigns")
        .update({ status: newStatus })
        .eq("id", campaignId);
      if (error) throw error;
      toast.success(`Campaign moved to ${newStatus}`);
      fetchCampaigns();
    } catch (error) {
      console.error("Error updating campaign status:", error);
      toast.error("Failed to update campaign");
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="font-display text-3xl font-bold text-foreground">
            Campaigns
          </h1>
          <Button variant="default" onClick={() => navigate("/campaigns/new")}>
            <Plus className="h-4 w-4 mr-2" />
            New Campaign
          </Button>
        </div>

        {/* Stats Dashboard */}
        <CampaignStats {...stats} />

        {/* Filters */}
        <CampaignFilters
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          healthFilter={healthFilter}
          onHealthFilterChange={setHealthFilter}
          channelFilter={channelFilter}
          onChannelFilterChange={setChannelFilter}
        />

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="rounded-xl bg-card shadow-card p-12 text-center">
            <p className="text-muted-foreground mb-4">No campaigns found</p>
            <Button variant="outline" onClick={() => navigate("/campaigns/new")}>
              Create Your First Campaign
            </Button>
          </div>
        ) : (
          <>
            {/* List View */}
            {viewMode === "list" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredCampaigns.map((campaign) => (
                  <CampaignCard
                    key={campaign.id}
                    campaign={campaign}
                    onPauseResume={handlePauseResume}
                    onDelete={handleDelete}
                    onDuplicate={handleDuplicate}
                    onViewLeads={handleViewLeads}
                    onContinueDraft={handleContinueDraft}
                  />
                ))}
              </div>
            )}

            {/* Kanban View */}
            {viewMode === "kanban" && (
              <CampaignKanbanBoard
                campaigns={filteredCampaigns}
                onStatusChange={handleStatusChange}
              />
            )}

            {/* Pipeline View */}
            {viewMode === "pipeline" && (
              <CampaignPipeline
                campaigns={filteredCampaigns}
                onStageClick={(stage) => console.log("Filter by stage:", stage)}
              />
            )}
          </>
        )}
      </div>

      {/* Candidate Quick View */}
      <CandidateQuickView
        campaignId={quickViewCampaignId}
        campaignName={quickViewCampaignName}
        open={!!quickViewCampaignId}
        onOpenChange={(open) => {
          if (!open) {
            setQuickViewCampaignId(null);
            setQuickViewCampaignName(null);
          }
        }}
      />
    </Layout>
  );
};

export default Campaigns;

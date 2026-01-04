import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Plus, Search, MoreVertical, Play, Pause, Copy, Trash2,
  Mail, MessageSquare, Phone, Eye, Activity, Users, CheckCircle2, Clock
} from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface Campaign {
  id: string;
  name: string | null;
  job_id: string | null;
  channel: string | null;
  status: string | null;
  leads_count: number | null;
  created_at: string | null;
  external_id: string | null;
  jobs?: {
    job_name: string | null;
  } | null;
}

type FilterTab = "all" | "active" | "paused" | "completed" | "draft";

const Campaigns = () => {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const { data, error } = await supabase
        .from("campaigns")
        .select(`
          *,
          jobs (
            job_name
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
    } finally {
      setLoading(false);
    }
  };

  // Stats calculations
  const stats = {
    active: campaigns.filter(c => c.status === "active").length,
    paused: campaigns.filter(c => c.status === "paused").length,
    completed: campaigns.filter(c => c.status === "completed").length,
    totalLeads: campaigns.reduce((sum, c) => sum + (c.leads_count || 0), 0),
  };

  // Filter campaigns
  const filteredCampaigns = campaigns.filter(campaign => {
    const matchesSearch = 
      (campaign.name?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
      (campaign.jobs?.job_name?.toLowerCase().includes(searchQuery.toLowerCase()) || false);
    
    const matchesFilter = 
      activeFilter === "all" || 
      campaign.status === activeFilter;
    
    return matchesSearch && matchesFilter;
  });

  const handlePauseResume = async (campaignId: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "paused" : "active";
    try {
      await supabase
        .from("campaigns")
        .update({ status: newStatus })
        .eq("id", campaignId);
      fetchCampaigns();
    } catch (error) {
      console.error("Error updating campaign:", error);
    }
  };

  const handleDelete = async (campaignId: string) => {
    if (!confirm("Are you sure you want to delete this campaign?")) return;
    try {
      await supabase.from("campaigns").delete().eq("id", campaignId);
      fetchCampaigns();
    } catch (error) {
      console.error("Error deleting campaign:", error);
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-success/10 text-success border-success/20 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-success mr-1.5" />
            Active
          </Badge>
        );
      case "paused":
        return (
          <Badge className="bg-warning/10 text-warning border-warning/20">
            Paused
          </Badge>
        );
      case "completed":
        return (
          <Badge className="bg-primary/10 text-primary border-primary/20">
            Completed
          </Badge>
        );
      case "draft":
      default:
        return (
          <Badge variant="secondary">
            Draft
          </Badge>
        );
    }
  };

  const getChannelIcons = (channel: string | null) => {
    if (!channel) return <span className="text-muted-foreground">—</span>;
    
    const channels = channel.toLowerCase();
    return (
      <div className="flex items-center gap-1">
        {(channels.includes("email") || channels.includes("all")) && (
          <Mail className="h-4 w-4 text-primary" />
        )}
        {(channels.includes("sms") || channels.includes("all")) && (
          <MessageSquare className="h-4 w-4 text-primary" />
        )}
        {(channels.includes("call") || channels.includes("phone") || channels.includes("all")) && (
          <Phone className="h-4 w-4 text-primary" />
        )}
      </div>
    );
  };

  const filterTabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "paused", label: "Paused" },
    { key: "completed", label: "Completed" },
    { key: "draft", label: "Draft" },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="font-display text-3xl font-bold text-foreground">
            📊 Campaigns
          </h1>
          <Button variant="default" onClick={() => navigate("/")}>
            <Plus className="h-4 w-4 mr-2" />
            New Campaign
          </Button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl bg-card shadow-card p-4 border-l-4 border-success">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                <Activity className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-foreground">{stats.active}</p>
              </div>
            </div>
          </div>
          
          <div className="rounded-xl bg-card shadow-card p-4 border-l-4 border-warning">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
                <Pause className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Paused</p>
                <p className="text-2xl font-bold text-foreground">{stats.paused}</p>
              </div>
            </div>
          </div>
          
          <div className="rounded-xl bg-card shadow-card p-4 border-l-4 border-primary">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <CheckCircle2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-foreground">{stats.completed}</p>
              </div>
            </div>
          </div>
          
          <div className="rounded-xl bg-card shadow-card p-4 border-l-4 border-muted-foreground">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Leads</p>
                <p className="text-2xl font-bold text-foreground">{stats.totalLeads}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          {/* Filter Tabs */}
          <div className="flex gap-1 p-1 rounded-lg bg-secondary/50">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveFilter(tab.key)}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium transition-all",
                  activeFilter === tab.key
                    ? "bg-card shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search campaigns or jobs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Campaigns Table */}
        <div className="rounded-xl bg-card shadow-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/30">
                <TableHead className="font-semibold">Campaign</TableHead>
                <TableHead className="font-semibold">Job</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Channels</TableHead>
                <TableHead className="font-semibold text-center">Leads</TableHead>
                <TableHead className="font-semibold text-center">Sent</TableHead>
                <TableHead className="font-semibold text-center">Replies</TableHead>
                <TableHead className="font-semibold">Created</TableHead>
                <TableHead className="font-semibold w-12">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Clock className="h-5 w-5 animate-spin" />
                      Loading campaigns...
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredCampaigns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12">
                    <p className="text-muted-foreground">No campaigns found</p>
                    <Button 
                      variant="outline" 
                      className="mt-4"
                      onClick={() => navigate("/")}
                    >
                      Create Your First Campaign
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                filteredCampaigns.map((campaign) => (
                  <TableRow 
                    key={campaign.id}
                    className="cursor-pointer hover:bg-secondary/30 transition-colors"
                    onClick={() => navigate(`/campaigns/${campaign.id}`)}
                  >
                    <TableCell>
                      <span className="font-medium text-foreground hover:text-primary transition-colors">
                        {campaign.name || "Untitled Campaign"}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {campaign.jobs?.job_name || "—"}
                    </TableCell>
                    <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                    <TableCell>{getChannelIcons(campaign.channel)}</TableCell>
                    <TableCell className="text-center font-medium">
                      {campaign.leads_count || 0}
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">—</TableCell>
                    <TableCell className="text-center text-muted-foreground">—</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {campaign.created_at
                        ? formatDistanceToNow(new Date(campaign.created_at), { addSuffix: true })
                        : "—"}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/campaigns/${campaign.id}`)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handlePauseResume(campaign.id, campaign.status || "")}
                          >
                            {campaign.status === "active" ? (
                              <>
                                <Pause className="h-4 w-4 mr-2" />
                                Pause
                              </>
                            ) : (
                              <>
                                <Play className="h-4 w-4 mr-2" />
                                Resume
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => handleDelete(campaign.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </Layout>
  );
};

export default Campaigns;

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  ArrowLeft, Play, Pause, Send, Eye, MousePointerClick, 
  MessageSquare, Star, Clock, Phone, Mail, User, Calendar
} from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow, format } from "date-fns";

interface Campaign {
  id: string;
  name: string | null;
  status: string | null;
  channel: string | null;
  leads_count: number | null;
  created_at: string | null;
  jobs?: {
    job_name: string | null;
    facility_name: string | null;
    state: string | null;
  } | null;
}

interface CampaignLead {
  id: string;
  candidate_name: string | null;
  candidate_email: string | null;
  candidate_phone: string | null;
  status: string | null;
  last_contact_at: string | null;
  emails_sent: number | null;
  emails_opened: number | null;
  emails_clicked: number | null;
  emails_replied: number | null;
  calls_attempted: number | null;
  calls_connected: number | null;
  interest_level: string | null;
}

interface ActivityLog {
  id: string;
  action_type: string;
  user_name: string;
  created_at: string | null;
  metadata: unknown;
  channel: string | null;
}

const CampaignDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [leads, setLeads] = useState<CampaignLead[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("candidates");

  useEffect(() => {
    if (id) {
      fetchCampaignData();
    }
  }, [id]);

  const fetchCampaignData = async () => {
    try {
      // Fetch campaign with job details
      const { data: campaignData, error: campaignError } = await supabase
        .from("campaigns")
        .select(`
          *,
          jobs (
            job_name,
            facility_name,
            state
          )
        `)
        .eq("id", id)
        .single();

      if (campaignError) throw campaignError;
      setCampaign(campaignData);

      // Fetch campaign leads
      const { data: leadsData, error: leadsError } = await supabase
        .from("campaign_leads_v2")
        .select("*")
        .eq("campaign_id", id)
        .order("created_at", { ascending: false });

      if (leadsError) throw leadsError;
      setLeads(leadsData || []);

      // Fetch activity log
      const { data: activityData, error: activityError } = await supabase
        .from("activity_log")
        .select("*")
        .eq("campaign_id", id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (activityError) throw activityError;
      setActivities(activityData || []);
    } catch (error) {
      console.error("Error fetching campaign data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePauseResume = async () => {
    if (!campaign) return;
    const newStatus = campaign.status === "active" ? "paused" : "active";
    try {
      await supabase
        .from("campaigns")
        .update({ status: newStatus })
        .eq("id", campaign.id);
      setCampaign({ ...campaign, status: newStatus });
    } catch (error) {
      console.error("Error updating campaign:", error);
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-success/10 text-success border-success/20">
            <span className="w-2 h-2 rounded-full bg-success mr-1.5 animate-pulse" />
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
      default:
        return <Badge variant="secondary">Draft</Badge>;
    }
  };

  const getLeadStatusBadge = (status: string | null) => {
    switch (status) {
      case "interested":
        return <Badge className="bg-success/10 text-success border-success/20">Interested</Badge>;
      case "replied":
        return <Badge className="bg-primary/10 text-primary border-primary/20">Replied</Badge>;
      case "opened":
        return <Badge className="bg-info/10 text-info border-info/20">Opened</Badge>;
      case "contacted":
        return <Badge className="bg-warning/10 text-warning border-warning/20">Contacted</Badge>;
      case "placed":
        return <Badge className="bg-success/10 text-success border-success/20">Placed</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const getActivityIcon = (actionType: string, channel: string | null) => {
    if (channel === "email" || actionType.includes("email")) {
      return <Mail className="h-4 w-4 text-primary" />;
    }
    if (channel === "sms" || actionType.includes("sms")) {
      return <MessageSquare className="h-4 w-4 text-info" />;
    }
    if (channel === "call" || actionType.includes("call")) {
      return <Phone className="h-4 w-4 text-success" />;
    }
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  // Calculate metrics from leads
  const metrics = {
    sent: leads.reduce((sum, l) => sum + (l.emails_sent || 0), 0),
    opened: leads.filter(l => (l.emails_opened || 0) > 0).length,
    clicked: leads.filter(l => (l.emails_clicked || 0) > 0).length,
    replied: leads.filter(l => (l.emails_replied || 0) > 0).length,
    interested: leads.filter(l => l.interest_level === "high" || l.status === "interested").length,
  };

  const openRate = metrics.sent > 0 ? Math.round((metrics.opened / metrics.sent) * 100) : 0;
  const clickRate = metrics.sent > 0 ? Math.round((metrics.clicked / metrics.sent) * 100) : 0;

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Clock className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!campaign) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Campaign not found</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/campaigns")}>
            Back to Campaigns
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <button
            onClick={() => navigate("/campaigns")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors w-fit"
          >
            <ArrowLeft className="h-4 w-4" />
            All Campaigns
          </button>

          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="font-display text-3xl font-bold text-foreground">
                  {campaign.name || "Untitled Campaign"}
                </h1>
                {getStatusBadge(campaign.status)}
              </div>
              {campaign.jobs && (
                <p className="text-muted-foreground">
                  {campaign.jobs.job_name} • {campaign.jobs.facility_name}, {campaign.jobs.state}
                </p>
              )}
            </div>

            <Button
              variant={campaign.status === "active" ? "outline" : "default"}
              onClick={handlePauseResume}
            >
              {campaign.status === "active" ? (
                <>
                  <Pause className="h-4 w-4 mr-2" />
                  Pause Campaign
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Resume Campaign
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="rounded-xl bg-card shadow-card p-4 border-l-4 border-primary">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Send className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sent</p>
                <p className="text-2xl font-bold text-foreground">{metrics.sent}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-card shadow-card p-4 border-l-4 border-info">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10">
                <Eye className="h-5 w-5 text-info" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Opened</p>
                <p className="text-2xl font-bold text-foreground">{openRate}%</p>
                <p className="text-xs text-muted-foreground">{metrics.opened} total</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-card shadow-card p-4 border-l-4 border-warning">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
                <MousePointerClick className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Clicked</p>
                <p className="text-2xl font-bold text-foreground">{clickRate}%</p>
                <p className="text-xs text-muted-foreground">{metrics.clicked} total</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-card shadow-card p-4 border-l-4 border-success">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                <MessageSquare className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Replied</p>
                <p className="text-2xl font-bold text-foreground">{metrics.replied}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-card shadow-card p-4 border-l-4 border-accent">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                <Star className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Interested</p>
                <p className="text-2xl font-bold text-foreground">{metrics.interested}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="candidates">Candidates ({leads.length})</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="sequence">Sequence</TabsTrigger>
          </TabsList>

          {/* Candidates Tab */}
          <TabsContent value="candidates">
            <div className="rounded-xl bg-card shadow-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/30">
                    <TableHead className="font-semibold">Name</TableHead>
                    <TableHead className="font-semibold">Email</TableHead>
                    <TableHead className="font-semibold">Phone</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Last Contact</TableHead>
                    <TableHead className="font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                        No candidates in this campaign yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    leads.map((lead) => (
                      <TableRow key={lead.id} className="hover:bg-secondary/30 transition-colors">
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="h-4 w-4 text-primary" />
                            </div>
                            {lead.candidate_name || "Unknown"}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {lead.candidate_email || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {lead.candidate_phone || "—"}
                        </TableCell>
                        <TableCell>{getLeadStatusBadge(lead.status)}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {lead.last_contact_at
                            ? formatDistanceToNow(new Date(lead.last_contact_at), { addSuffix: true })
                            : "Never"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Phone className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Mail className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity">
            <div className="rounded-xl bg-card shadow-card p-6">
              {activities.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">No activity yet</p>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {activities.map((activity) => (
                      <div key={activity.id} className="flex items-start gap-4 pb-4 border-b border-border last:border-0">
                        <div className="h-10 w-10 rounded-full bg-secondary/50 flex items-center justify-center shrink-0">
                          {getActivityIcon(activity.action_type, activity.channel)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            {activity.action_type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            by {activity.user_name}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {activity.created_at
                            ? formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })
                            : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </TabsContent>

          {/* Sequence Tab */}
          <TabsContent value="sequence">
            <div className="rounded-xl bg-card shadow-card p-6">
              <div className="space-y-6">
                {/* Day 1 */}
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <div className="h-10 w-10 rounded-full bg-success flex items-center justify-center text-success-foreground font-bold">
                      1
                    </div>
                    <div className="w-0.5 h-16 bg-border mt-2" />
                  </div>
                  <div className="flex-1 pt-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Mail className="h-4 w-4 text-primary" />
                      <span className="font-medium">Initial Email</span>
                      <Badge variant="secondary" className="text-xs">Day 1</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Personalized outreach introducing the opportunity
                    </p>
                    <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Send className="h-3 w-3" /> {metrics.sent} sent
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" /> {metrics.opened} opened
                      </span>
                    </div>
                  </div>
                </div>

                {/* Day 3 */}
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
                      2
                    </div>
                    <div className="w-0.5 h-16 bg-border mt-2" />
                  </div>
                  <div className="flex-1 pt-1">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="h-4 w-4 text-info" />
                      <span className="font-medium">SMS Follow-up</span>
                      <Badge variant="secondary" className="text-xs">Day 3</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Brief text message for those who haven't responded
                    </p>
                  </div>
                </div>

                {/* Day 5 */}
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <div className="h-10 w-10 rounded-full bg-warning flex items-center justify-center text-warning-foreground font-bold">
                      3
                    </div>
                    <div className="w-0.5 h-16 bg-border mt-2" />
                  </div>
                  <div className="flex-1 pt-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Phone className="h-4 w-4 text-success" />
                      <span className="font-medium">AI Phone Call</span>
                      <Badge variant="secondary" className="text-xs">Day 5</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Automated call to gauge interest and schedule callback
                    </p>
                  </div>
                </div>

                {/* Day 7 */}
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground font-bold">
                      4
                    </div>
                  </div>
                  <div className="flex-1 pt-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Mail className="h-4 w-4 text-primary" />
                      <span className="font-medium">Final Email</span>
                      <Badge variant="secondary" className="text-xs">Day 7</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Last touch with urgency messaging
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default CampaignDetail;

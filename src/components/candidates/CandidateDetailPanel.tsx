import { useState, useEffect } from "react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import {
  Phone,
  MessageSquare,
  Mail,
  Users,
  X,
  ExternalLink,
  MapPin,
  Award,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CandidateDetail {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  personal_email: string | null;
  personal_mobile: string | null;
  specialty: string | null;
  city: string | null;
  state: string | null;
  licenses: string[] | null;
  enrichment_tier: string | null;
  last_enrichment_date: string | null;
  notes: string | null;
}

interface Interaction {
  id: string;
  channel: string | null;
  content: string | null;
  outcome: string | null;
  timestamp: string | null;
}

interface Campaign {
  id: string;
  name: string | null;
}

interface CandidateDetailPanelProps {
  candidateId: string | null;
  onClose: () => void;
}

const CandidateDetailPanel = ({ candidateId, onClose }: CandidateDetailPanelProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [candidate, setCandidate] = useState<CandidateDetail | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");

  useEffect(() => {
    if (candidateId) {
      loadCandidate();
      loadInteractions();
      loadCampaigns();
    }
  }, [candidateId]);

  const loadCandidate = async () => {
    if (!candidateId) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("candidates")
      .select("id, first_name, last_name, email, phone, personal_email, personal_mobile, specialty, city, state, licenses, enrichment_tier, last_enrichment_date, notes")
      .eq("id", candidateId)
      .single();

    if (error) {
      console.error("Error loading candidate:", error);
    } else {
      setCandidate(data);
      setNotes(data.notes || "");
    }
    setLoading(false);
  };

  const loadInteractions = async () => {
    if (!candidateId) return;

    const { data } = await supabase
      .from("interactions")
      .select("id, channel, content, outcome, timestamp")
      .eq("candidate_id", candidateId)
      .order("timestamp", { ascending: false })
      .limit(5);

    setInteractions(data || []);
  };

  const loadCampaigns = async () => {
    const { data } = await supabase
      .from("campaigns")
      .select("id, name")
      .order("created_at", { ascending: false });
    setCampaigns(data || []);
  };

  const handleSaveNote = async () => {
    if (!candidateId) return;
    setSavingNote(true);

    const { error } = await supabase
      .from("candidates")
      .update({ notes })
      .eq("id", candidateId);

    if (error) {
      toast({ title: "Error saving note", variant: "destructive" });
    } else {
      toast({ title: "Note saved" });
    }
    setSavingNote(false);
  };

  const handleAddToCampaign = async () => {
    if (!selectedCampaignId || !candidateId) return;

    const { error } = await supabase.from("campaign_leads_v2").insert({
      campaign_id: selectedCampaignId,
      candidate_id: candidateId,
      candidate_name: `${candidate?.first_name || ""} ${candidate?.last_name || ""}`.trim(),
      candidate_email: candidate?.email,
      candidate_phone: candidate?.phone,
      candidate_specialty: candidate?.specialty,
      candidate_state: candidate?.state,
      status: "pending",
    });

    if (error) {
      toast({ title: "Error adding to campaign", variant: "destructive" });
    } else {
      toast({ title: "Added to campaign" });
      setCampaignModalOpen(false);
    }
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
        {tier === "Platinum" && "✨ "}
        {tier}
      </Badge>
    );
  };

  const getChannelIcon = (channel: string | null) => {
    switch (channel) {
      case "email":
        return <Mail className="h-3 w-3" />;
      case "sms":
        return <MessageSquare className="h-3 w-3" />;
      case "call":
        return <Phone className="h-3 w-3" />;
      default:
        return <Clock className="h-3 w-3" />;
    }
  };

  const candidateName = candidate
    ? `${candidate.first_name || ""} ${candidate.last_name || ""}`.trim() || "Unknown"
    : "";

  return (
    <>
      <Sheet open={!!candidateId} onOpenChange={() => onClose()}>
        <SheetContent className="w-[400px] p-0 flex flex-col">
          <SheetHeader className="p-6 pb-4 border-b border-border">
            <div className="flex items-start justify-between">
              <div>
                <SheetTitle className="text-xl">{candidateName}</SheetTitle>
                {candidate?.specialty && (
                  <p className="text-sm text-muted-foreground mt-1">{candidate.specialty}</p>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </SheetHeader>

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          ) : candidate ? (
            <ScrollArea className="flex-1">
              <div className="p-6 space-y-6">
                {/* Contact Section */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Contact
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Work Email</span>
                      <span className="text-sm text-foreground">{candidate.email || "—"}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Work Phone</span>
                      <span className="text-sm text-foreground">{candidate.phone || "—"}</span>
                    </div>
                    {candidate.personal_email && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Personal Email</span>
                        <span className="text-sm text-foreground">{candidate.personal_email}</span>
                      </div>
                    )}
                    {candidate.personal_mobile && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Personal Mobile</span>
                        <span className="text-sm text-foreground">{candidate.personal_mobile}</span>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Location Section */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Location
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">City, State</span>
                      <span className="text-sm text-foreground">
                        {candidate.city && candidate.state
                          ? `${candidate.city}, ${candidate.state}`
                          : candidate.state || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground block mb-2">Licenses</span>
                      <div className="flex flex-wrap gap-1">
                        {candidate.licenses && candidate.licenses.length > 0 ? (
                          candidate.licenses.map((license, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {license}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">No licenses</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Enrichment Section */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <Award className="h-4 w-4" />
                    Enrichment
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Tier</span>
                      <span>{getTierBadge(candidate.enrichment_tier)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Last Enriched</span>
                      <span className="text-sm text-foreground">
                        {candidate.last_enrichment_date
                          ? format(new Date(candidate.last_enrichment_date), "MMM d, yyyy")
                          : "—"}
                      </span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Quick Actions */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Quick Actions
                  </h3>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const phone = candidate.personal_mobile || candidate.phone;
                        if (phone) {
                          navigate(`/communications?call=${encodeURIComponent(phone)}`);
                        }
                      }}
                      disabled={!candidate.phone && !candidate.personal_mobile}
                    >
                      <Phone className="h-4 w-4 mr-1" />
                      Call
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const phone = candidate.personal_mobile || candidate.phone;
                        if (phone) {
                          navigate(`/communications?sms=${encodeURIComponent(phone)}`);
                        }
                      }}
                      disabled={!candidate.phone && !candidate.personal_mobile}
                    >
                      <MessageSquare className="h-4 w-4 mr-1" />
                      SMS
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const email = candidate.personal_email || candidate.email;
                        if (email) {
                          window.open(`mailto:${email}`, '_blank');
                        }
                      }}
                      disabled={!candidate.email && !candidate.personal_email}
                    >
                      <Mail className="h-4 w-4 mr-1" />
                      Email
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => setCampaignModalOpen(true)}
                    >
                      <Users className="h-4 w-4 mr-1" />
                      Add to Campaign
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Activity Section */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Recent Activity
                  </h3>
                  {interactions.length > 0 ? (
                    <div className="space-y-2">
                      {interactions.map((interaction) => (
                        <div
                          key={interaction.id}
                          className="flex items-start gap-3 text-sm"
                        >
                          <div className="mt-1 text-muted-foreground">
                            {getChannelIcon(interaction.channel)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-foreground truncate">
                              {interaction.content || interaction.outcome || "Activity"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {interaction.timestamp
                                ? format(new Date(interaction.timestamp), "MMM d, yyyy h:mm a")
                                : "—"}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No recent activity</p>
                  )}
                </div>

                <Separator />

                {/* Notes Section */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Notes
                  </h3>
                  <Textarea
                    placeholder="Add notes about this candidate..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                  />
                  <Button
                    size="sm"
                    onClick={handleSaveNote}
                    disabled={savingNote}
                  >
                    {savingNote ? "Saving..." : "Save Note"}
                  </Button>
                </div>
              </div>
            </ScrollArea>
          ) : null}
        </SheetContent>
      </Sheet>

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
              {campaigns.map((campaign) => (
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
              Add to Campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CandidateDetailPanel;

import { useState } from "react";
import { cn } from "@/lib/utils";
import { JobCandidateCard } from "./JobCandidateCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface CampaignLead {
  id: string;
  candidate_id: string | null;
  candidate_name: string | null;
  candidate_email: string | null;
  candidate_phone: string | null;
  candidate_specialty: string | null;
  candidate_state: string | null;
  status: string | null;
  tier: number | null;
  emails_sent: number | null;
  emails_opened: number | null;
  emails_replied: number | null;
  sms_sent: number | null;
  sms_replied: number | null;
  calls_attempted: number | null;
  calls_connected: number | null;
  last_contact_at: string | null;
  updated_at: string | null;
  interest_level: string | null;
  sentiment: string | null;
}

const STAGES = [
  { id: "sourced", label: "Sourced", color: "border-t-muted-foreground" },
  { id: "contacted", label: "Contacted", color: "border-t-blue-500" },
  { id: "engaged", label: "Engaged", color: "border-t-warning" },
  { id: "interested", label: "Interested", color: "border-t-success" },
  { id: "submitted", label: "Submitted", color: "border-t-purple-500" },
  { id: "placed", label: "Placed", color: "border-t-emerald-500" },
];

interface JobCandidateKanbanProps {
  leads: CampaignLead[];
  onLeadClick?: (lead: CampaignLead) => void;
  onCall?: (lead: CampaignLead) => void;
  onSMS?: (lead: CampaignLead) => void;
  onEmail?: (lead: CampaignLead) => void;
  onStatusChange?: (leadId: string, newStatus: string) => void;
}

export const JobCandidateKanban = ({ 
  leads, 
  onLeadClick, 
  onCall, 
  onSMS, 
  onEmail,
  onStatusChange 
}: JobCandidateKanbanProps) => {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    setDraggingId(leadId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverStage(null);
  };

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    setDragOverStage(stageId);
  };

  const handleDrop = async (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    if (!draggingId) return;

    const lead = leads.find(l => l.id === draggingId);
    if (!lead || lead.status === stageId) {
      setDraggingId(null);
      setDragOverStage(null);
      return;
    }

    try {
      const { error } = await supabase
        .from("campaign_leads_v2")
        .update({ status: stageId, updated_at: new Date().toISOString() })
        .eq("id", draggingId);

      if (error) throw error;

      onStatusChange?.(draggingId, stageId);
      toast({
        title: "Status updated",
        description: `Moved ${lead.candidate_name || "Candidate"} to ${stageId.replace("_", " ")}`,
      });
    } catch (err) {
      console.error("Error updating lead status:", err);
      toast({
        title: "Error",
        description: "Failed to update candidate status",
        variant: "destructive",
      });
    }

    setDraggingId(null);
    setDragOverStage(null);
  };

  const getLeadsByStage = (stageId: string) => {
    return leads.filter(lead => (lead.status || "sourced") === stageId);
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {STAGES.map((stage) => {
        const stageLeads = getLeadsByStage(stage.id);
        const isOver = dragOverStage === stage.id;

        return (
          <div
            key={stage.id}
            className={cn(
              "flex-shrink-0 w-80 rounded-lg border border-border bg-muted/30",
              "border-t-4",
              stage.color,
              isOver && "ring-2 ring-primary"
            )}
            onDragOver={(e) => handleDragOver(e, stage.id)}
            onDragLeave={() => setDragOverStage(null)}
            onDrop={(e) => handleDrop(e, stage.id)}
          >
            {/* Column header */}
            <div className="p-3 border-b border-border">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-foreground">{stage.label}</h3>
                <span className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  {stageLeads.length}
                </span>
              </div>
            </div>

            {/* Cards */}
            <ScrollArea className="h-[500px]">
              <div className="p-3 space-y-3">
                {stageLeads.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No candidates
                  </div>
                ) : (
                  stageLeads.map((lead) => (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, lead.id)}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        "cursor-grab active:cursor-grabbing",
                        draggingId === lead.id && "opacity-50"
                      )}
                    >
                      <JobCandidateCard
                        lead={lead}
                        onClick={onLeadClick}
                        onCall={onCall}
                        onSMS={onSMS}
                        onEmail={onEmail}
                      />
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        );
      })}
    </div>
  );
};

export default JobCandidateKanban;

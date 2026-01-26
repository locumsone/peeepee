import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Clock, Phone, User, Calendar, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { formatPhoneNumber } from "@/lib/formatPhone";

interface PostCallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  callData: {
    phoneNumber: string;
    candidateName?: string;
    candidateId?: string;
    duration: number;
  };
}

const OUTCOMES = [
  { value: "interested", label: "Interested" },
  { value: "callback_requested", label: "Callback Requested" },
  { value: "not_interested", label: "Not Interested" },
  { value: "voicemail", label: "Left Voicemail" },
  { value: "no_answer", label: "No Answer" },
];

export const PostCallModal = ({ open, onOpenChange, callData }: PostCallModalProps) => {
  const [notes, setNotes] = useState("");
  const [outcome, setOutcome] = useState<string>("");
  const [scheduleCallback, setScheduleCallback] = useState(false);
  const [callbackTime, setCallbackTime] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const queryClient = useQueryClient();

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Auto-trigger AI analysis after save
  const triggerAIAnalysis = async (callId: string, transcript: string | null) => {
    if (!transcript) return;
    
    setIsAnalyzing(true);
    try {
      await supabase.functions.invoke("analyze-call", {
        body: { call_id: callId, transcript },
      });
      toast.success("AI analysis complete");
      queryClient.invalidateQueries({ queryKey: ["ai-call-logs"] });
    } catch (err) {
      console.error("AI analysis error:", err);
      // Don't show error - analysis is optional
    } finally {
      setIsAnalyzing(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      // First, try to find the existing call log (created by voice-incoming webhook)
      const { data: existingCall } = await supabase
        .from("ai_call_logs")
        .select("id, transcript_text")
        .eq("phone_number", callData.phoneNumber)
        .gte("created_at", new Date(Date.now() - 300000).toISOString()) // Within last 5 mins
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let savedCallId: string | null = null;
      let transcript: string | null = null;

      if (existingCall) {
        // Update existing record created by webhook
        const { error: updateError } = await supabase
          .from("ai_call_logs")
          .update({
            call_summary: notes,
            call_result: outcome,
            duration_seconds: callData.duration,
            status: "completed",
            candidate_id: callData.candidateId || null,
            candidate_name: callData.candidateName || null,
          })
          .eq("id", existingCall.id);

        if (updateError) throw updateError;
        savedCallId = existingCall.id;
        transcript = existingCall.transcript_text;
      } else {
        // Create new record (fallback for manual calls without webhook)
        const { data: newCall, error: insertError } = await supabase.from("ai_call_logs").insert({
          phone_number: callData.phoneNumber,
          candidate_id: callData.candidateId || null,
          candidate_name: callData.candidateName || null,
          call_summary: notes,
          call_result: outcome,
          duration_seconds: callData.duration,
          status: "completed",
          call_type: "manual",
          platform: "twilio",
          created_at: new Date().toISOString(),
        }).select("id").single();

        if (insertError) throw insertError;
        savedCallId = newCall?.id || null;
      }

      // Insert scheduled callback if requested
      if (scheduleCallback && callbackTime) {
        const { error: callbackError } = await supabase.from("scheduled_callbacks").insert({
          candidate_id: callData.candidateId || null,
          candidate_name: callData.candidateName || null,
          phone: callData.phoneNumber,
          scheduled_time: callbackTime,
          status: "pending",
        });

        if (callbackError) throw callbackError;
      }

      return { savedCallId, transcript };
    },
    onSuccess: async ({ savedCallId, transcript }) => {
      queryClient.invalidateQueries({ queryKey: ["ai-call-logs"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-callbacks"] });
      toast.success("Call notes saved");
      
      // Auto-trigger AI analysis if we have a transcript
      if (savedCallId && transcript) {
        await triggerAIAnalysis(savedCallId, transcript);
      }
      
      handleClose();
    },
    onError: (err) => {
      console.error("Save error:", err);
      toast.error("Failed to save call notes");
    },
  });

  const handleClose = () => {
    setNotes("");
    setOutcome("");
    setScheduleCallback(false);
    setCallbackTime("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            Call Ended
          </DialogTitle>
          <DialogDescription>
            Add notes and schedule follow-up for this call
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Enhanced Call Summary with prominent name/phone */}
          <div className="p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl border border-primary/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-full bg-primary/20">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-base text-foreground">
                    {callData.candidateName || "Unknown Caller"}
                  </p>
                  <p className="text-sm text-muted-foreground font-mono">
                    {formatPhoneNumber(callData.phoneNumber)}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-1.5 text-lg font-mono font-semibold text-foreground">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  {formatDuration(callData.duration)}
                </div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Duration</span>
              </div>
            </div>
          </div>

          {/* Outcome Select */}
          <div className="space-y-2">
            <Label>Call Outcome</Label>
            <Select value={outcome} onValueChange={setOutcome}>
              <SelectTrigger>
                <SelectValue placeholder="Select outcome..." />
              </SelectTrigger>
              <SelectContent>
                {OUTCOMES.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Call Notes</Label>
            <Textarea
              placeholder="Add notes about this call..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[100px]"
            />
          </div>

          {/* Schedule Callback */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="schedule-callback"
                checked={scheduleCallback}
                onCheckedChange={(checked) => setScheduleCallback(checked === true)}
              />
              <Label htmlFor="schedule-callback" className="cursor-pointer">
                Schedule follow-up callback
              </Label>
            </div>

            {scheduleCallback && (
              <div className="flex items-center gap-2 pl-6">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="datetime-local"
                  value={callbackTime}
                  onChange={(e) => setCallbackTime(e.target.value)}
                  className="flex-1"
                />
              </div>
            )}
          </div>

          {/* AI Analysis Indicator */}
          {isAnalyzing && (
            <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg border border-primary/20">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm text-primary">Analyzing call with AI...</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={handleClose} className="flex-1" disabled={saveMutation.isPending || isAnalyzing}>
              Skip
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || isAnalyzing}
              className="flex-1 gradient-primary"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Save & Analyze
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Send, 
  Sparkles, 
  Loader2,
  Scissors,
  Stethoscope,
  Ban,
  DollarSign,
  MapPin,
  Users,
  Mail,
  MessageSquare,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Candidate {
  id: string;
  first_name?: string;
  last_name?: string;
  specialty?: string;
  licenses?: string[];
  email_subject?: string;
  email_body?: string;
  sms_message?: string;
}

interface BulkMessageRefinerProps {
  candidates: Candidate[];
  messageType: "email" | "sms" | "both";
  jobContext: {
    rate: string;
    location: string;
    call_status?: string;
    facility_name?: string;
  };
  playbookData?: any;
  onApply: (updatedCandidates: Candidate[]) => void;
  onClose?: () => void;
}

interface RefineResult {
  candidateId: string;
  candidateName: string;
  success: boolean;
  emailRefined?: boolean;
  smsRefined?: boolean;
  error?: string;
}

const QUICK_ACTIONS = [
  { id: "shorten", label: "Shorten All", icon: Scissors, description: "100-120 words" },
  { id: "more_clinical", label: "More Clinical", icon: Stethoscope, description: "Add procedures" },
  { id: "less_salesy", label: "Less Salesy", icon: Ban, description: "Remove recruiter-speak" },
  { id: "emphasize_rate", label: "Rate First", icon: DollarSign, description: "Lead with pay" },
  { id: "emphasize_location", label: "Location First", icon: MapPin, description: "Lead with geography" },
];

export function BulkMessageRefiner({
  candidates,
  messageType,
  jobContext,
  playbookData,
  onApply,
  onClose,
}: BulkMessageRefinerProps) {
  const [inputValue, setInputValue] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<RefineResult[]>([]);
  const [updatedCandidates, setUpdatedCandidates] = useState<Map<string, Candidate>>(new Map());
  const [refineEmails, setRefineEmails] = useState(messageType === "email" || messageType === "both");
  const [refineSms, setRefineSms] = useState(messageType === "sms" || messageType === "both");

  // Filter candidates that have content to refine
  const eligibleCandidates = candidates.filter(c => {
    if (refineEmails && c.email_body) return true;
    if (refineSms && c.sms_message) return true;
    return false;
  });

  const handleBulkRefine = async (prompt: string) => {
    if (!prompt.trim()) return;
    if (eligibleCandidates.length === 0) {
      toast.error("No candidates with generated messages to refine");
      return;
    }

    setIsRefining(true);
    setProgress(0);
    setResults([]);
    const newUpdates = new Map<string, Candidate>();
    const newResults: RefineResult[] = [];

    try {
      // Process in batches of 3 to avoid overwhelming the API
      const batchSize = 3;
      const batches = [];
      for (let i = 0; i < eligibleCandidates.length; i += batchSize) {
        batches.push(eligibleCandidates.slice(i, i + batchSize));
      }

      let processed = 0;

      for (const batch of batches) {
        const batchPromises = batch.map(async (candidate) => {
          const result: RefineResult = {
            candidateId: candidate.id,
            candidateName: `Dr. ${candidate.last_name}`,
            success: false,
          };

          try {
            let updatedCandidate = { ...candidate };
            
            // Refine email if enabled and has content
            if (refineEmails && candidate.email_body) {
              const { data: emailData, error: emailError } = await supabase.functions.invoke("refine-message", {
                body: {
                  message_type: "email",
                  current_subject: candidate.email_subject,
                  current_body: candidate.email_body,
                  refinement_prompt: prompt,
                  candidate_context: {
                    name: `Dr. ${candidate.last_name}`,
                    specialty: candidate.specialty,
                    licenses: candidate.licenses,
                  },
                  job_context: jobContext,
                  playbook_data: playbookData,
                },
              });

              if (!emailError && emailData?.success) {
                updatedCandidate.email_subject = emailData.refined_subject || candidate.email_subject;
                updatedCandidate.email_body = emailData.refined_body;
                result.emailRefined = true;
              }
            }

            // Refine SMS if enabled and has content
            if (refineSms && candidate.sms_message) {
              const { data: smsData, error: smsError } = await supabase.functions.invoke("refine-message", {
                body: {
                  message_type: "sms",
                  current_body: candidate.sms_message,
                  refinement_prompt: prompt,
                  candidate_context: {
                    name: `Dr. ${candidate.last_name}`,
                    specialty: candidate.specialty,
                    licenses: candidate.licenses,
                  },
                  job_context: jobContext,
                  playbook_data: playbookData,
                },
              });

              if (!smsError && smsData?.success) {
                updatedCandidate.sms_message = smsData.refined_body;
                result.smsRefined = true;
              }
            }

            if (result.emailRefined || result.smsRefined) {
              newUpdates.set(candidate.id, updatedCandidate);
              result.success = true;
            }

            return result;
          } catch (error) {
            result.error = error instanceof Error ? error.message : "Unknown error";
            return result;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        newResults.push(...batchResults);
        processed += batch.length;
        setProgress(Math.round((processed / eligibleCandidates.length) * 100));
        setResults([...newResults]);
      }

      setUpdatedCandidates(newUpdates);
      
      const successCount = newResults.filter(r => r.success).length;
      if (successCount > 0) {
        toast.success(`Refined ${successCount} of ${eligibleCandidates.length} messages`);
      } else {
        toast.error("No messages were refined");
      }
    } catch (error) {
      console.error("Bulk refine error:", error);
      toast.error("Bulk refinement failed");
    } finally {
      setIsRefining(false);
      setInputValue("");
    }
  };

  const handleQuickAction = (actionId: string) => {
    handleBulkRefine(actionId);
  };

  const handleApply = () => {
    if (updatedCandidates.size === 0) {
      toast.error("No changes to apply");
      return;
    }

    // Merge updates with original candidates
    const finalCandidates = candidates.map(c => {
      const updated = updatedCandidates.get(c.id);
      return updated || c;
    });

    onApply(finalCandidates);
    toast.success(`Applied changes to ${updatedCandidates.size} candidates`);
  };

  const successCount = results.filter(r => r.success).length;
  const errorCount = results.filter(r => r.error).length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">Bulk AI Editor</span>
          </div>
          <Badge variant="outline" className="text-xs">
            <Users className="h-3 w-3 mr-1" />
            {eligibleCandidates.length} candidates
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Apply AI refinements to all generated messages at once
        </p>
      </div>

      {/* Channel Selection */}
      <div className="p-4 border-b border-border space-y-3">
        <Label className="text-xs text-muted-foreground">Channels to refine:</Label>
        <div className="flex gap-4">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="refine-emails" 
              checked={refineEmails}
              onCheckedChange={(checked) => setRefineEmails(checked as boolean)}
            />
            <label htmlFor="refine-emails" className="text-sm flex items-center gap-1 cursor-pointer">
              <Mail className="h-3 w-3" />
              Emails ({candidates.filter(c => c.email_body).length})
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="refine-sms" 
              checked={refineSms}
              onCheckedChange={(checked) => setRefineSms(checked as boolean)}
            />
            <label htmlFor="refine-sms" className="text-sm flex items-center gap-1 cursor-pointer">
              <MessageSquare className="h-3 w-3" />
              SMS ({candidates.filter(c => c.sms_message).length})
            </label>
          </div>
        </div>
      </div>

      {/* Progress / Results */}
      {(isRefining || results.length > 0) && (
        <div className="p-4 border-b border-border space-y-3">
          {isRefining && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Refining messages...</span>
                <span className="text-muted-foreground">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
          
          {!isRefining && results.length > 0 && (
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span>{successCount} refined</span>
              </div>
              {errorCount > 0 && (
                <div className="flex items-center gap-1 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span>{errorCount} failed</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Results List */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-2">
          {results.length === 0 && !isRefining && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Use quick actions or enter a custom prompt</p>
              <p className="text-xs mt-1">Changes will be applied to all {eligibleCandidates.length} messages</p>
            </div>
          )}
          
          {results.map((result) => (
            <div
              key={result.candidateId}
              className={cn(
                "p-2 rounded-lg text-xs flex items-center justify-between",
                result.success ? "bg-green-500/10" : result.error ? "bg-destructive/10" : "bg-muted"
              )}
            >
              <span className="font-medium">{result.candidateName}</span>
              <div className="flex items-center gap-2">
                {result.emailRefined && (
                  <Badge variant="outline" className="text-xs h-5">
                    <Mail className="h-3 w-3 mr-1" />
                    Email
                  </Badge>
                )}
                {result.smsRefined && (
                  <Badge variant="outline" className="text-xs h-5">
                    <MessageSquare className="h-3 w-3 mr-1" />
                    SMS
                  </Badge>
                )}
                {result.error && (
                  <span className="text-destructive text-xs">{result.error}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Quick Actions */}
      <div className="p-3 border-t border-border">
        <p className="text-xs text-muted-foreground mb-2">Quick Actions</p>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_ACTIONS.map((action) => (
            <Button
              key={action.id}
              variant="outline"
              size="sm"
              className="text-xs h-7 px-2"
              onClick={() => handleQuickAction(action.id)}
              disabled={isRefining || eligibleCandidates.length === 0}
            >
              <action.icon className="h-3 w-3 mr-1" />
              {action.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Custom Input */}
      <div className="p-3 border-t border-border">
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleBulkRefine(inputValue);
          }}
          className="flex gap-2"
        >
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Custom refinement (e.g., 'Add urgency to all')"
            className="text-sm"
            disabled={isRefining}
          />
          <Button 
            type="submit" 
            size="icon" 
            disabled={isRefining || !inputValue.trim() || eligibleCandidates.length === 0}
          >
            {isRefining ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>

      {/* Apply Button */}
      <div className="p-3 border-t border-border">
        <Button
          className="w-full"
          onClick={handleApply}
          disabled={isRefining || updatedCandidates.size === 0}
        >
          <CheckCircle2 className="h-4 w-4 mr-2" />
          Apply Changes ({updatedCandidates.size})
        </Button>
      </div>
    </div>
  );
}

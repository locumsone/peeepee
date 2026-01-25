import { useState } from "react";
import { Sparkles, Loader2, CheckCircle2, Edit2, Save, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { PersonalizationHook, SelectedCandidate } from "./types";

interface PersonalizationPanelProps {
  jobId: string | null;
  candidates: SelectedCandidate[];
  onCandidatesUpdate: (candidates: SelectedCandidate[]) => void;
}

export function PersonalizationPanel({
  jobId,
  candidates,
  onCandidatesUpdate,
}: PersonalizationPanelProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [hooks, setHooks] = useState<PersonalizationHook[]>([]);

  // Initialize hooks from candidates if they already have icebreakers
  useState(() => {
    const existingHooks = candidates
      .filter((c) => c.icebreaker)
      .map((c) => ({
        candidate_id: c.id,
        candidate_name: `${c.first_name} ${c.last_name}`,
        icebreaker: c.icebreaker || "",
        talking_points: c.talking_points || [],
        confidence: "high",
      }));
    if (existingHooks.length > 0) {
      setHooks(existingHooks);
    }
  });

  const runPersonalization = async () => {
    if (!jobId || candidates.length === 0) return;

    setIsRunning(true);
    setProgress({ current: 0, total: candidates.length });

    try {
      const { data, error } = await supabase.functions.invoke("personalization-research", {
        body: {
          job_id: jobId,
          candidate_ids: candidates.map((c) => c.id),
          deep_research: false,
          batch_size: 10,
        },
      });

      if (error) throw error;

      if (data?.results) {
        const newHooks: PersonalizationHook[] = data.results.map((r: any) => ({
          candidate_id: r.candidate_id,
          candidate_name: r.candidate_name,
          icebreaker: r.icebreaker || r.hook,
          talking_points: r.talking_points || [],
          confidence: r.confidence || "medium",
        }));

        setHooks(newHooks);

        // Update candidates with new hooks
        const updatedCandidates = candidates.map((c) => {
          const hook = newHooks.find((h) => h.candidate_id === c.id);
          if (hook) {
            return {
              ...c,
              icebreaker: hook.icebreaker,
              talking_points: hook.talking_points,
            };
          }
          return c;
        });

        onCandidatesUpdate(updatedCandidates);
        toast({
          title: "Personalization Complete",
          description: `Generated hooks for ${newHooks.length} candidates`,
        });
      }
    } catch (err) {
      console.error("Personalization failed:", err);
      toast({
        title: "Personalization Failed",
        description: "Could not generate personalization hooks",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const startEditing = (candidateId: string) => {
    setHooks((prev) =>
      prev.map((h) =>
        h.candidate_id === candidateId
          ? { ...h, isEditing: true, editedIcebreaker: h.icebreaker }
          : h
      )
    );
  };

  const cancelEditing = (candidateId: string) => {
    setHooks((prev) =>
      prev.map((h) =>
        h.candidate_id === candidateId
          ? { ...h, isEditing: false, editedIcebreaker: undefined }
          : h
      )
    );
  };

  const saveEditing = (candidateId: string) => {
    setHooks((prev) =>
      prev.map((h) =>
        h.candidate_id === candidateId
          ? { ...h, icebreaker: h.editedIcebreaker || h.icebreaker, isEditing: false }
          : h
      )
    );

    // Update candidates
    const hook = hooks.find((h) => h.candidate_id === candidateId);
    if (hook) {
      const updatedCandidates = candidates.map((c) =>
        c.id === candidateId ? { ...c, icebreaker: hook.editedIcebreaker || hook.icebreaker } : c
      );
      onCandidatesUpdate(updatedCandidates);
    }
  };

  const updateEditedIcebreaker = (candidateId: string, value: string) => {
    setHooks((prev) =>
      prev.map((h) =>
        h.candidate_id === candidateId ? { ...h, editedIcebreaker: value } : h
      )
    );
  };

  const personalizedCount = hooks.length;
  const totalCount = candidates.length;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Personalization Research
          </CardTitle>
          <div className="flex items-center gap-3">
            {personalizedCount > 0 && (
              <Badge variant="secondary">
                {personalizedCount}/{totalCount} personalized
              </Badge>
            )}
            <Button
              variant={personalizedCount > 0 ? "outline" : "default"}
              size="sm"
              onClick={runPersonalization}
              disabled={isRunning || !jobId || candidates.length === 0}
            >
              {isRunning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Researching...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  {personalizedCount > 0 ? "Re-run" : "Run Research"}
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {hooks.length === 0 && !isRunning && (
          <div className="text-center py-8 text-muted-foreground">
            <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm mb-2">No personalization hooks generated yet</p>
            <p className="text-xs">
              Run AI research to generate personalized icebreakers for each candidate
            </p>
          </div>
        )}

        {isRunning && (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 mx-auto mb-3 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Researching candidates...
            </p>
            {progress.total > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {progress.current}/{progress.total} complete
              </p>
            )}
          </div>
        )}

        {hooks.length > 0 && !isRunning && (
          <ScrollArea className="h-64">
            <div className="space-y-3">
              {hooks.map((hook) => (
                <div
                  key={hook.candidate_id}
                  className="p-3 rounded-lg bg-muted/30 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-foreground">
                        {hook.candidate_name}
                      </span>
                      <Badge
                        variant="outline"
                        className={
                          hook.confidence === "high"
                            ? "text-green-400 border-green-500/30"
                            : hook.confidence === "medium"
                            ? "text-yellow-400 border-yellow-500/30"
                            : "text-muted-foreground"
                        }
                      >
                        {hook.confidence}
                      </Badge>
                    </div>
                    {hook.isEditing ? (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => saveEditing(hook.candidate_id)}
                        >
                          <Save className="h-3.5 w-3.5 text-green-400" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => cancelEditing(hook.candidate_id)}
                        >
                          <X className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => startEditing(hook.candidate_id)}
                      >
                        <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                  {hook.isEditing ? (
                    <Textarea
                      value={hook.editedIcebreaker || hook.icebreaker}
                      onChange={(e) => updateEditedIcebreaker(hook.candidate_id, e.target.value)}
                      className="text-sm bg-background"
                      rows={3}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">{hook.icebreaker}</p>
                  )}
                  {hook.talking_points && hook.talking_points.length > 0 && !hook.isEditing && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {hook.talking_points.slice(0, 3).map((point, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {point.length > 40 ? point.substring(0, 40) + "..." : point}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

import { useState } from "react";
import { ChevronLeft, ChevronRight, Mail, MessageSquare, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SelectedCandidate } from "./types";

interface StepPreviewMessageProps {
  candidates: SelectedCandidate[];
}

export function StepPreviewMessage({ candidates }: StepPreviewMessageProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeDay, setActiveDay] = useState("day1");

  const currentCandidate = candidates[currentIndex];

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : candidates.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < candidates.length - 1 ? prev + 1 : 0));
  };

  if (!currentCandidate) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        No candidates to preview
      </div>
    );
  }

  const days = [
    { id: "day1", label: "Day 1", type: "email" },
    { id: "day3", label: "Day 3", type: "email" },
    { id: "day5", label: "Day 5", type: "email" },
    { id: "day7", label: "Day 7", type: "email" },
    { id: "day14", label: "Day 14", type: "email" },
  ];

  // Get message content based on day
  const getEmailContent = (day: string) => {
    if (day === "day1") {
      return {
        subject: currentCandidate.email_subject || `Opportunity at ${currentCandidate.city || "your area"}`,
        body: currentCandidate.email_body || "Hi Dr. " + (currentCandidate.last_name || "Candidate") + ",\n\nI noticed your background and thought you'd be a great fit for an opportunity we have...",
      };
    }
    // For follow-up days, show placeholder or stored sequence content
    return {
      subject: `Following up - Day ${day.replace("day", "")}`,
      body: `Hi Dr. ${currentCandidate.last_name || "Candidate"},\n\nI wanted to follow up on my previous message...`,
    };
  };

  const emailContent = getEmailContent(activeDay);

  return (
    <div className="space-y-4">
      {/* Candidate Selector */}
      <div className="flex items-center justify-between bg-muted/30 rounded-lg p-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={handlePrev}
          disabled={candidates.length <= 1}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/20 rounded-full">
            <User className="h-4 w-4 text-primary" />
          </div>
          <div className="text-center">
            <p className="font-medium text-foreground">
              Dr. {currentCandidate.first_name} {currentCandidate.last_name}
            </p>
            <p className="text-sm text-muted-foreground">
              {currentIndex + 1} of {candidates.length}
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleNext}
          disabled={candidates.length <= 1}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Day Tabs */}
      <Tabs value={activeDay} onValueChange={setActiveDay}>
        <TabsList className="w-full grid grid-cols-5">
          {days.map((day) => (
            <TabsTrigger key={day.id} value={day.id} className="text-xs">
              {day.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {days.map((day) => (
          <TabsContent key={day.id} value={day.id} className="mt-4">
            {/* Email Preview */}
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-4 py-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Email Preview</span>
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {day.label}
                  </Badge>
                </div>
              </div>
              
              <div className="p-4 space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Subject</p>
                  <p className="text-sm font-medium text-foreground">{emailContent.subject}</p>
                </div>
                
                <div className="border-t border-border pt-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Body</p>
                  <div className="text-sm text-foreground whitespace-pre-wrap bg-background rounded p-3 max-h-48 overflow-y-auto">
                    {emailContent.body}
                  </div>
                </div>
              </div>
            </div>

            {/* SMS Preview (Day 1 only) */}
            {day.id === "day1" && currentCandidate.sms_message && (
              <div className="border border-border rounded-lg overflow-hidden mt-4">
                <div className="bg-muted/50 px-4 py-2 border-b border-border">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">SMS Preview</span>
                    <Badge variant="outline" className="ml-auto text-xs">
                      {currentCandidate.sms_message.length}/300 chars
                    </Badge>
                  </div>
                </div>
                <div className="p-4">
                  <div className="bg-primary/10 rounded-lg p-3 max-w-[80%]">
                    <p className="text-sm text-foreground">{currentCandidate.sms_message}</p>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Candidate Quick Info */}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
        {currentCandidate.specialty && (
          <Badge variant="secondary">{currentCandidate.specialty}</Badge>
        )}
        {currentCandidate.city && currentCandidate.state && (
          <Badge variant="outline">{currentCandidate.city}, {currentCandidate.state}</Badge>
        )}
        {currentCandidate.enrichment_source && (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
            ✓ {currentCandidate.enrichment_source}
          </Badge>
        )}
      </div>
    </div>
  );
}

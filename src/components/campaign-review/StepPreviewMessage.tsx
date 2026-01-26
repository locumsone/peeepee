import { useState } from "react";
import { ChevronLeft, ChevronRight, Mail, MessageSquare, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SelectedCandidate, Job } from "./types";

interface StepPreviewMessageProps {
  candidates: SelectedCandidate[];
  job: Job | null;
}

// Specialty-specific procedure lists for Day 3 (Clinical Scope)
const SPECIALTY_PROCEDURES: Record<string, string[]> = {
  'Interventional Radiology': [
    'CT/US-guided biopsies and drainages',
    'Port and PICC placements',
    'Embolization procedures',
    'Venous access and thrombolysis'
  ],
  'Gastroenterology': [
    'EGD and colonoscopy',
    'ERCP with sphincterotomy',
    'EUS with FNA',
    'Capsule endoscopy reviews'
  ],
  'Emergency Medicine': [
    'Acute resuscitation and trauma',
    'Bedside ultrasound procedures',
    'Central line and chest tube placement',
    'Procedural sedation'
  ],
  'Hospitalist': [
    'Acute inpatient management',
    'Cross-cover and admissions',
    'Discharge planning coordination',
    'Rapid response and code support'
  ],
  'Anesthesiology': [
    'General and regional anesthesia',
    'Cardiac and neuro cases',
    'Labor epidurals',
    'Post-op pain management'
  ],
  default: [
    'Full scope clinical practice',
    'Inpatient and outpatient coverage',
    'Procedure support as needed',
    'Collaborative care coordination'
  ]
};

// Day 3: Clinical Scope - "What will I do?"
const generateDay3Content = (candidate: SelectedCandidate, job: Job) => {
  const specialty = job.specialty || 'General Practice';
  const procedures = SPECIALTY_PROCEDURES[specialty] || SPECIALTY_PROCEDURES.default;
  const procedureList = procedures.map(p => `• ${p}`).join('\n');
  const payRate = job.hourly_rate || job.pay_rate || job.bill_rate || 500;
  
  return {
    subject: `Clinical scope at ${job.facility_name || job.city}`,
    body: `Dr. ${candidate.last_name},

Following up on the ${specialty} opportunity in ${job.city}.

Daily case mix includes:
${procedureList}

Sustainable daily volume—no production pressure. The $${payRate}/hr rate is still available.

Happy to walk through the case distribution if helpful.

Best,
Rainey`
  };
};

// Day 5: Lifestyle - "Will it fit my life?"
const generateDay5Content = (candidate: SelectedCandidate, job: Job) => {
  const payRate = job.hourly_rate || job.pay_rate || job.bill_rate || 500;
  const benefits: string[] = [];
  
  // Check if candidate is local
  if (candidate.state === job.state) {
    benefits.push('• No relocating required—you\'re already in-state');
  }
  
  benefits.push('• Flexible scheduling—build your own calendar');
  benefits.push('• No hospital politics, no admin burden');
  benefits.push('• Zero call requirements');
  
  return {
    subject: `Schedule flexibility in ${job.city}`,
    body: `Dr. ${candidate.last_name},

Circling back on the ${job.city} ${job.specialty || 'locums'} role.

What works for most physicians here:
${benefits.join('\n')}

$${payRate}/hr if timing makes sense.

Worth a quick call?

Rainey`
  };
};

// Day 7: Curiosity - "Am I missing something?"
const generateDay7Content = (candidate: SelectedCandidate, job: Job) => {
  const payRate = job.hourly_rate || job.pay_rate || job.bill_rate || 500;
  
  return {
    subject: `Quick question - ${job.specialty || 'locums'} in ${job.state}`,
    body: `Dr. ${candidate.last_name},

I realize I've sent a few notes about the ${job.specialty || 'locums'} position at ${job.facility_name || job.city}.

Curious if timing isn't right, or if there's something specific about the role that doesn't fit what you're looking for?

Either way, the $${payRate}/hr opportunity remains open. Happy to discuss or step back if you'd prefer.

Rainey`
  };
};

// Day 14: Breakup/Resource - "Can this person help me later?"
const generateDay14Content = (candidate: SelectedCandidate, job: Job) => {
  const specialty = job.specialty || 'your specialty';
  const specialtyLower = specialty.toLowerCase();
  
  return {
    subject: `Closing the loop - ${specialty} opportunity`,
    body: `Dr. ${candidate.last_name},

I'll assume the timing isn't right for the ${job.city} opportunity and won't follow up further on this role.

That said—if you ever want to discuss:
• Current ${specialtyLower} locums rates by region
• Market conditions for ${specialtyLower}
• Credentialing timelines in specific states

Feel free to reach out anytime. No pitch, just information.

Best,
Rainey`
  };
};

export function StepPreviewMessage({ candidates, job }: StepPreviewMessageProps) {
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

  // Get message content based on day - uses dynamic generators
  const getEmailContent = (day: string) => {
    if (!job) {
      return {
        subject: 'No job data available',
        body: 'Please ensure job data is loaded to preview messages.'
      };
    }

    switch (day) {
      case 'day1':
        return {
          subject: currentCandidate.email_subject || `Opportunity at ${job.city || "your area"}`,
          body: currentCandidate.email_body || `Hi Dr. ${currentCandidate.last_name || "Candidate"},\n\nI noticed your background and thought you'd be a great fit for an opportunity we have...`,
        };
      case 'day3':
        return generateDay3Content(currentCandidate, job);
      case 'day5':
        return generateDay5Content(currentCandidate, job);
      case 'day7':
        return generateDay7Content(currentCandidate, job);
      case 'day14':
        return generateDay14Content(currentCandidate, job);
      default:
        return { subject: '', body: '' };
    }
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
                  <p className="text-sm font-medium text-foreground">{getEmailContent(day.id).subject}</p>
                </div>
                
                <div className="border-t border-border pt-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Body</p>
                  <div className="text-sm text-foreground whitespace-pre-wrap bg-background rounded p-3 max-h-48 overflow-y-auto">
                    {getEmailContent(day.id).body}
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

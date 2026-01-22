import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Sparkles, Loader2, Save } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import ParsedJobCard, { ParsedJob as CardParsedJob } from "@/components/jobs/ParsedJobCard";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ParsedJob extends CardParsedJob {
  city: string;
  state: string;
  startDate: string | null;
  endDate: string | null;
  description: string | null;
  jobTitle: string;
  onCall: boolean;
  onCallDetails: string | null;
}

const JobEntry = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [jobText, setJobText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [parsedJob, setParsedJob] = useState<ParsedJob | null>(null);

  const parseJobPosting = async () => {
    if (!jobText.trim()) {
      toast({
        title: "No job posting entered",
        description: "Please paste a job posting to parse.",
        variant: "destructive",
      });
      return;
    }

    setIsParsing(true);

    try {
      const { data, error } = await supabase.functions.invoke('parse-job', {
        body: { jobText },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Failed to parse job');
      }

      const parsed: ParsedJob = {
        id: crypto.randomUUID(),
        ...data.job,
      };

      setParsedJob(parsed);

      toast({
        title: "Job parsed successfully! ✨",
        description: `Found ${parsed.specialty || 'position'} at ${parsed.facility || 'facility'}`,
      });
    } catch (error) {
      console.error('Parse error:', error);
      toast({
        title: "Failed to parse job",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsParsing(false);
    }
  };

  const handleFieldUpdate = (field: keyof CardParsedJob, value: string | number) => {
    if (!parsedJob) return;
    
    setParsedJob(prev => {
      if (!prev) return prev;
      
      // Auto-calculate pay rate when bill rate changes
      if (field === 'billRate') {
        const billRate = typeof value === 'number' ? value : parseFloat(String(value)) || 0;
        return {
          ...prev,
          billRate,
          payRate: Math.round(billRate * 0.73),
        };
      }
      
      // Update location when city/state-like fields change
      if (field === 'location') {
        const parts = String(value).split(',').map(s => s.trim());
        return {
          ...prev,
          location: String(value),
          city: parts[0] || prev.city,
          state: parts[1] || prev.state,
        };
      }
      
      return {
        ...prev,
        [field]: value,
      };
    });
  };

  const handleSaveJob = async () => {
    if (!parsedJob) return;

    setIsSaving(true);

    try {
      // Format start date
      let formattedStartDate = null;
      if (parsedJob.startDate) {
        const parts = parsedJob.startDate.split('/');
        if (parts.length === 3) {
          const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
          formattedStartDate = `${year}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
        }
      }

      const { data, error } = await supabase
        .from('jobs')
        .insert({
          job_name: parsedJob.jobTitle || `${parsedJob.specialty} - ${parsedJob.location}`,
          facility_name: parsedJob.facility,
          city: parsedJob.city,
          state: parsedJob.state,
          specialty: parsedJob.specialty,
          bill_rate: parsedJob.billRate,
          pay_rate: parsedJob.payRate,
          start_date: formattedStartDate,
          schedule: parsedJob.schedule,
          requirements: parsedJob.requirements,
          raw_job_text: parsedJob.description,
          status: 'open',
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Job saved! 🎉",
        description: "Now let's find candidates for this position.",
      });

      // Store job data and navigate to candidate matching
      sessionStorage.setItem("currentJob", JSON.stringify({
        ...parsedJob,
        id: data.id,
      }));
      
      navigate(`/candidates/matching?jobId=${data.id}`);

    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: "Failed to save job",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartOver = () => {
    setParsedJob(null);
    setJobText("");
  };

  return (
    <Layout currentStep={1}>
      <div className="mx-auto max-w-3xl space-y-8">
        {/* Page Header */}
        <div className="text-center space-y-2">
          <h1 className="font-display text-3xl font-bold text-foreground sm:text-4xl">
            Create New Campaign
          </h1>
          <p className="text-muted-foreground">
            Paste a job posting and let AI extract the key details
          </p>
        </div>

        {/* Loading State */}
        {isParsing && (
          <div className="rounded-2xl bg-card shadow-card p-12 animate-fade-in">
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="relative">
                <div className="h-16 w-16 rounded-full gradient-primary animate-pulse-glow flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-primary-foreground" />
                </div>
              </div>
              <div className="text-center space-y-1">
                <h3 className="font-semibold text-foreground">Parsing with AI...</h3>
                <p className="text-sm text-muted-foreground">
                  Extracting job details from your posting
                </p>
              </div>
              <Loader2 className="h-6 w-6 text-primary animate-spin" />
            </div>
          </div>
        )}

        {/* Job Input Card - Hidden when parsed or parsing */}
        {!parsedJob && !isParsing && (
          <div className="rounded-2xl bg-card shadow-card p-6 space-y-4 animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Job Posting</h2>
                <p className="text-sm text-muted-foreground">
                  Paste the full job description below
                </p>
              </div>
            </div>

            <Textarea
              placeholder="Paste your job posting here...

Example:
Seeking a Board-Certified Interventional Radiologist for a locum tenens position at Memorial Hermann Northeast Hospital in Humble, TX. Coverage needed February 2026. M-F 8a-5p. Bill rate: $625/hour."
              className="min-h-[200px] resize-y text-base leading-relaxed bg-secondary/50 border-border focus:border-primary focus:ring-primary"
              value={jobText}
              onChange={(e) => setJobText(e.target.value)}
            />

            <Button
              variant="gradient"
              size="lg"
              className="w-full"
              onClick={parseJobPosting}
              disabled={!jobText.trim()}
            >
              <Sparkles className="h-5 w-5" />
              Parse Job Posting
            </Button>
          </div>
        )}

        {/* Parsed Job Result - Inline Editable */}
        {parsedJob && !isParsing && (
          <ParsedJobCard 
            job={{
              id: parsedJob.id,
              specialty: parsedJob.specialty,
              location: parsedJob.location,
              facility: parsedJob.facility,
              dates: parsedJob.dates,
              billRate: parsedJob.billRate,
              payRate: parsedJob.payRate,
              schedule: parsedJob.schedule || undefined,
              requirements: parsedJob.requirements || undefined,
            }} 
            onUpdate={handleFieldUpdate}
          />
        )}

        {/* Footer with Action Buttons */}
        <div className="flex justify-between pt-4">
          {parsedJob && (
            <Button
              variant="outline"
              onClick={handleStartOver}
            >
              Start Over
            </Button>
          )}
          <div className="flex gap-3 ml-auto">
            {parsedJob && (
              <Button
                variant="gradient"
                size="lg"
                onClick={handleSaveJob}
                disabled={isSaving}
                className="min-w-[200px]"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-5 w-5" />
                    Save & Find Candidates
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default JobEntry;

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Sparkles, Loader2, ArrowRight } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import ParsedJobCard, { ParsedJob } from "@/components/jobs/ParsedJobCard";
import { useToast } from "@/hooks/use-toast";

const JobEntry = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [jobText, setJobText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
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

    // Simulate AI parsing with 2 second delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Mock parsed data matching the example
    const parsed: ParsedJob = {
      id: crypto.randomUUID(),
      specialty: "Interventional Radiology",
      location: "Eau Claire, WI",
      facility: "Chippewa Valley Vein Center",
      dates: "March 2026",
      billRate: 725,
      payRate: Math.round(725 * 0.73), // $529
      schedule: "Every other week",
      requirements: "BC/BE, WI license",
    };

    setParsedJob(parsed);
    setIsParsing(false);

    toast({
      title: "Job parsed successfully! ✨",
      description: `Found ${parsed.specialty} position at ${parsed.facility}`,
    });
  };

  const handleEdit = () => {
    setParsedJob(null);
  };

  const handleNext = () => {
    if (parsedJob) {
      sessionStorage.setItem("currentJob", JSON.stringify(parsedJob));
      navigate("/candidates");
    }
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
Seeking a Board-Certified Interventional Radiologist for a locum tenens position at Chippewa Valley Vein Center in Eau Claire, WI. Coverage needed March 2026, every other week. Must have WI license. Bill rate: $725/hour."
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

        {/* Parsed Job Result */}
        {parsedJob && !isParsing && (
          <ParsedJobCard job={parsedJob} onEdit={handleEdit} />
        )}

        {/* Footer with Next Button */}
        <div className="flex justify-end pt-4">
          <Button
            variant="gradient"
            size="lg"
            onClick={handleNext}
            disabled={!parsedJob}
            className="min-w-[160px]"
          >
            Next
            <ArrowRight className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </Layout>
  );
};

export default JobEntry;

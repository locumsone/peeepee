import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Sparkles, Loader2 } from "lucide-react";
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

    // Simulate AI parsing (in production, this would call an API)
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Extract information from the job posting text
    const text = jobText.toLowerCase();
    
    // Parse specialty
    const specialties = [
      "Cardiology", "Emergency Medicine", "Family Medicine", "Internal Medicine",
      "Neurology", "Orthopedics", "Pediatrics", "Psychiatry", "Radiology",
      "Anesthesiology", "Surgery", "Oncology", "Dermatology", "Hospitalist"
    ];
    const foundSpecialty = specialties.find(s => text.includes(s.toLowerCase())) || "General Practice";

    // Parse location - look for city, state patterns
    const locationMatch = text.match(/([a-z\s]+),\s*([a-z]{2})/i);
    const location = locationMatch ? `${locationMatch[1].trim()}, ${locationMatch[2].toUpperCase()}` : "Remote / Various Locations";

    // Parse facility
    const facilityPatterns = ["hospital", "medical center", "clinic", "health system"];
    let facility = "Healthcare Facility";
    for (const pattern of facilityPatterns) {
      const idx = text.indexOf(pattern);
      if (idx !== -1) {
        const start = Math.max(0, idx - 30);
        const snippet = jobText.slice(start, idx + pattern.length);
        const words = snippet.split(/\s+/).slice(-4).join(" ");
        facility = words.charAt(0).toUpperCase() + words.slice(1);
        break;
      }
    }

    // Parse dates
    const datePatterns = [
      /(\d{1,2}\/\d{1,2}\/\d{2,4})\s*[-–to]+\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
      /(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}/gi,
      /starting\s+(immediately|asap)/i,
    ];
    let dates = "Flexible Start Date";
    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        dates = match[0];
        break;
      }
    }

    // Parse bill rate
    const rateMatch = text.match(/\$?\s*(\d{2,4})\s*(?:\/\s*hr|per\s*hour|hourly)?/);
    const billRate = rateMatch ? parseInt(rateMatch[1]) : 175;
    const payRate = Math.round(billRate * 0.73);

    const parsed: ParsedJob = {
      id: crypto.randomUUID(),
      specialty: foundSpecialty,
      location,
      facility,
      dates,
      billRate,
      payRate,
    };

    setParsedJob(parsed);
    setIsParsing(false);

    toast({
      title: "Job parsed successfully! ✨",
      description: `Found ${foundSpecialty} position at ${facility}`,
    });
  };

  const handleFindCandidates = () => {
    if (parsedJob) {
      // Store job in sessionStorage for the next page
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

        {/* Job Input Card */}
        <div className="rounded-2xl bg-card shadow-card p-6 space-y-4">
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
Seeking a Board-Certified Cardiologist for a locum tenens position at Memorial Hospital in Austin, TX. Coverage needed from January 15 - March 30, 2025. Must have active Texas license. Bill rate: $200/hour. Contact us for more details."
            className="min-h-[200px] resize-y text-base leading-relaxed bg-secondary/50 border-border focus:border-primary focus:ring-primary"
            value={jobText}
            onChange={(e) => setJobText(e.target.value)}
          />

          <Button
            variant="gradient"
            size="lg"
            className="w-full"
            onClick={parseJobPosting}
            disabled={isParsing || !jobText.trim()}
          >
            {isParsing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Parsing with AI...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                Parse Job Posting
              </>
            )}
          </Button>
        </div>

        {/* Parsed Job Result */}
        {parsedJob && (
          <ParsedJobCard job={parsedJob} onFindCandidates={handleFindCandidates} />
        )}
      </div>
    </Layout>
  );
};

export default JobEntry;

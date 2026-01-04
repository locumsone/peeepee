import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, Sparkles, ArrowRight, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

interface ParsedJob {
  jobTitle: string;
  requisitionId: string;
  facility: string;
  city: string;
  state: string;
  specialty: string;
  schedule: string;
  startDate: Date | undefined;
  onCall: boolean;
  callDetails: string;
  requirements: string;
  billRate: number;
  payRate: number;
}

const NewJobEntry = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [rawText, setRawText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [isParsed, setIsParsed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [parsedJob, setParsedJob] = useState<ParsedJob>({
    jobTitle: "",
    requisitionId: "",
    facility: "",
    city: "",
    state: "",
    specialty: "",
    schedule: "",
    startDate: undefined,
    onCall: false,
    callDetails: "",
    requirements: "",
    billRate: 0,
    payRate: 0,
  });

  const parseJobText = (text: string): ParsedJob => {
    const result: ParsedJob = {
      jobTitle: "",
      requisitionId: "",
      facility: "",
      city: "",
      state: "",
      specialty: "",
      schedule: "",
      startDate: undefined,
      onCall: false,
      callDetails: "",
      requirements: "",
      billRate: 0,
      payRate: 0,
    };

    // Extract bill rate patterns like "$XXX/hr" or "$XXX - $XXX/hr"
    const rateMatch = text.match(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:\/hr|per hour|hourly)/i);
    if (rateMatch) {
      result.billRate = parseFloat(rateMatch[1].replace(",", ""));
      result.payRate = Math.round(result.billRate * 0.73 * 100) / 100;
    }

    // Extract state abbreviations
    const stateMatch = text.match(/\b([A-Z]{2})\b/g);
    if (stateMatch) {
      const validState = stateMatch.find(s => US_STATES.includes(s));
      if (validState) result.state = validState;
    }

    // Extract schedule patterns
    const schedulePatterns = [
      /M-F\s*[\d:]+\s*(?:am|pm)?\s*-\s*[\d:]+\s*(?:am|pm)?/i,
      /Monday\s*-\s*Friday/i,
      /\d+\s*(?:days?|shifts?)\s*(?:per|\/)\s*week/i,
      /7\s*on\s*\/?\s*7\s*off/i,
    ];
    for (const pattern of schedulePatterns) {
      const match = text.match(pattern);
      if (match) {
        result.schedule = match[0];
        break;
      }
    }

    // Extract dates
    const datePatterns = [
      /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}/i,
      /\d{1,2}\/\d{1,2}\/\d{2,4}/,
    ];
    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        const parsed = new Date(match[0]);
        if (!isNaN(parsed.getTime())) {
          result.startDate = parsed;
          break;
        }
      }
    }

    // Extract specialty keywords
    const specialties = ["IR", "Interventional Radiology", "Radiology", "Cardiology", "Emergency", "ER", "ICU", "General"];
    for (const spec of specialties) {
      if (text.toLowerCase().includes(spec.toLowerCase())) {
        result.specialty = spec;
        break;
      }
    }

    // Check for on-call mentions
    if (text.toLowerCase().includes("on call") || text.toLowerCase().includes("on-call")) {
      result.onCall = true;
    }

    // Extract facility name (look for "at" or "for" patterns)
    const facilityMatch = text.match(/(?:at|for)\s+([A-Z][A-Za-z\s]+(?:Hospital|Medical Center|Clinic|Health|Healthcare))/i);
    if (facilityMatch) {
      result.facility = facilityMatch[1].trim();
    }

    // Generate a job title from specialty and state
    if (result.specialty && result.state) {
      result.jobTitle = `${result.specialty} Physician - ${result.state}`;
    } else if (result.specialty) {
      result.jobTitle = `${result.specialty} Physician`;
    }

    return result;
  };

  const handleParse = async () => {
    setIsParsing(true);
    
    // Simulate 2-second parsing delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const parsed = parseJobText(rawText);
    setParsedJob(parsed);
    setIsParsed(true);
    setIsParsing(false);
    
    toast({
      title: "Job parsed successfully",
      description: "Review the extracted details and make any corrections.",
    });
  };

  const handleEditRaw = () => {
    setIsParsed(false);
  };

  const updateField = <K extends keyof ParsedJob>(field: K, value: ParsedJob[K]) => {
    setParsedJob(prev => ({ ...prev, [field]: value }));
  };

  const handleBillRateChange = (value: number) => {
    const payRate = Math.round(value * 0.73 * 100) / 100;
    setParsedJob(prev => ({ ...prev, billRate: value, payRate }));
  };

  const malpractice = Math.round(parsedJob.payRate * 0.10 * 100) / 100;
  const margin = Math.round((parsedJob.billRate - parsedJob.payRate - malpractice) * 100) / 100;
  const marginPercent = parsedJob.billRate > 0 
    ? Math.round((margin / parsedJob.billRate) * 100) 
    : 0;

  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      const { data, error } = await supabase
        .from("jobs")
        .insert({
          job_name: parsedJob.jobTitle,
          facility_name: parsedJob.facility,
          city: parsedJob.city,
          state: parsedJob.state,
          specialty: parsedJob.specialty,
          schedule: parsedJob.schedule,
          start_date: parsedJob.startDate ? format(parsedJob.startDate, "yyyy-MM-dd") : null,
          requirements: parsedJob.requirements,
          bill_rate: parsedJob.billRate,
          pay_rate: parsedJob.payRate,
          raw_job_text: rawText,
          status: "active",
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Job saved successfully",
        description: "Navigating to candidate matching...",
      });

      navigate(`/candidates?jobId=${data.id}`);
    } catch (error) {
      console.error("Error saving job:", error);
      toast({
        title: "Error saving job",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Create New Job</h1>
          <p className="text-muted-foreground mt-1">
            Paste a raw job requisition and we'll parse it for you
          </p>
        </div>

        {!isParsed ? (
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">Raw Job Text</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste raw job requisition text here..."
                className="min-h-[250px] font-mono text-sm"
                rows={10}
              />
              <p className="text-xs text-muted-foreground">
                Example: "Looking for an IR physician at Memorial Hospital, WI. Rate: $250/hr. 
                Schedule: M-F 8am-5pm. Start date: Feb 01, 2026. On-call required."
              </p>
              <Button
                onClick={handleParse}
                disabled={!rawText.trim() || isParsing}
                className="w-full"
                variant="gradient"
                size="lg"
              >
                {isParsing ? (
                  <>
                    <Sparkles className="h-4 w-4 animate-spin" />
                    Parsing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Parse Job ✨
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Job Details Card */}
            <Card className="border-border">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Job Details</CardTitle>
                <Button
                  variant="link"
                  onClick={handleEditRaw}
                  className="text-sm text-muted-foreground"
                >
                  Edit Raw Text
                </Button>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="jobTitle">Job Title</Label>
                    <Input
                      id="jobTitle"
                      value={parsedJob.jobTitle}
                      onChange={(e) => updateField("jobTitle", e.target.value)}
                      placeholder="e.g., IR Physician - WI"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="requisitionId">Requisition ID (optional)</Label>
                    <Input
                      id="requisitionId"
                      value={parsedJob.requisitionId}
                      onChange={(e) => updateField("requisitionId", e.target.value)}
                      placeholder="e.g., REQ-2026-001"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="facility">Facility</Label>
                    <Input
                      id="facility"
                      value={parsedJob.facility}
                      onChange={(e) => updateField("facility", e.target.value)}
                      placeholder="e.g., Memorial Hospital"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={parsedJob.city}
                      onChange={(e) => updateField("city", e.target.value)}
                      placeholder="e.g., Madison"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Select
                      value={parsedJob.state}
                      onValueChange={(value) => updateField("state", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {US_STATES.map((state) => (
                          <SelectItem key={state} value={state}>
                            {state}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="specialty">Specialty</Label>
                    <Input
                      id="specialty"
                      value={parsedJob.specialty}
                      onChange={(e) => updateField("specialty", e.target.value)}
                      placeholder="e.g., 80% IR / 20% General"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="schedule">Schedule</Label>
                    <Input
                      id="schedule"
                      value={parsedJob.schedule}
                      onChange={(e) => updateField("schedule", e.target.value)}
                      placeholder="e.g., M-F 8am-5pm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !parsedJob.startDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {parsedJob.startDate 
                            ? format(parsedJob.startDate, "PPP") 
                            : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={parsedJob.startDate}
                          onSelect={(date) => updateField("startDate", date)}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="onCall" className="flex items-center gap-2">
                      On Call
                      <Switch
                        id="onCall"
                        checked={parsedJob.onCall}
                        onCheckedChange={(checked) => updateField("onCall", checked)}
                      />
                    </Label>
                  </div>

                  {parsedJob.onCall && (
                    <div className="space-y-2">
                      <Label htmlFor="callDetails">Call Details</Label>
                      <Input
                        id="callDetails"
                        value={parsedJob.callDetails}
                        onChange={(e) => updateField("callDetails", e.target.value)}
                        placeholder="e.g., 1:4 call coverage"
                      />
                    </div>
                  )}

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="requirements">Requirements</Label>
                    <Textarea
                      id="requirements"
                      value={parsedJob.requirements}
                      onChange={(e) => updateField("requirements", e.target.value)}
                      placeholder="e.g., Board certified, 3+ years experience..."
                      rows={3}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pay Calculation Card */}
            <Card className="border-border overflow-hidden">
              <CardHeader className="bg-success/10 border-b border-border">
                <CardTitle className="text-lg flex items-center gap-2 text-success">
                  💰 Pay Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="overflow-x-auto">
                  <table className="w-full font-mono text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Type</th>
                        <th className="text-right py-2 px-3 text-muted-foreground font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-border">
                        <td className="py-3 px-3 text-foreground">Bill Rate</td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-muted-foreground">$</span>
                            <Input
                              type="number"
                              value={parsedJob.billRate || ""}
                              onChange={(e) => handleBillRateChange(parseFloat(e.target.value) || 0)}
                              className="w-24 text-right font-mono"
                            />
                            <span className="text-muted-foreground">/hr</span>
                          </div>
                        </td>
                      </tr>
                      <tr className="border-b border-border bg-success/5">
                        <td className="py-3 px-3 text-success font-medium">Pay Rate (73%)</td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-success">$</span>
                            <Input
                              type="number"
                              value={parsedJob.payRate || ""}
                              onChange={(e) => updateField("payRate", parseFloat(e.target.value) || 0)}
                              className="w-24 text-right font-mono text-success border-success/30"
                            />
                            <span className="text-success">/hr</span>
                          </div>
                        </td>
                      </tr>
                      <tr className="border-b border-border">
                        <td className="py-3 px-3 text-muted-foreground">Malpractice (10%)</td>
                        <td className="py-3 px-3 text-right text-muted-foreground">
                          ${malpractice.toFixed(2)}/hr
                        </td>
                      </tr>
                      <tr className="bg-muted/30">
                        <td className="py-3 px-3 text-foreground font-medium">
                          Margin (~{marginPercent}%)
                        </td>
                        <td className="py-3 px-3 text-right font-medium text-foreground">
                          ${margin.toFixed(2)}/hr
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-4">
              <Button
                variant="outline"
                onClick={() => navigate("/")}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                variant="gradient"
                onClick={handleSave}
                disabled={isSaving || !parsedJob.jobTitle}
              >
                {isSaving ? "Saving..." : "Save & Find Candidates"}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NewJobEntry;

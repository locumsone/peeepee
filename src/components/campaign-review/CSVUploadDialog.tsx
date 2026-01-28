import { useState, useRef, useCallback } from "react";
import { Upload, FileText, Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { SelectedCandidate } from "./types";

interface CSVUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidates: SelectedCandidate[];
  onCandidatesUpdate: (candidates: SelectedCandidate[]) => void;
}

interface ParsedRow {
  candidate_id: string;
  first_name: string;
  last_name: string;
  specialty: string;
  city: string;
  state: string;
  personal_email: string;
  personal_phone: string;
}

interface MatchedRecord {
  candidateId: string;
  candidateName: string;
  email: string | null;
  phone: string | null;
  status: "matched" | "no_data" | "not_found";
  originalCandidate?: SelectedCandidate;
}

type UploadStep = "upload" | "preview" | "saving" | "complete";

export function CSVUploadDialog({
  open,
  onOpenChange,
  candidates,
  onCandidatesUpdate,
}: CSVUploadDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<UploadStep>("upload");
  const [parsedRecords, setParsedRecords] = useState<MatchedRecord[]>([]);
  const [saveProgress, setSaveProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState({ updated: 0, skipped: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // Parse CSV text, handling quoted values with commas
  const parseCSV = (text: string): ParsedRow[] => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) return [];

    // Parse header row
    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
    
    // Required columns
    const requiredColumns = ["candidate_id"];
    const missingColumns = requiredColumns.filter(col => !headers.includes(col));
    if (missingColumns.length > 0) {
      throw new Error(`Missing required columns: ${missingColumns.join(", ")}`);
    }

    // Parse data rows
    const rows: ParsedRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length !== headers.length) continue;

      const row: Record<string, string> = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx]?.trim() || "";
      });

      rows.push({
        candidate_id: row.candidate_id || "",
        first_name: row.first_name || "",
        last_name: row.last_name || "",
        specialty: row.specialty || "",
        city: row.city || "",
        state: row.state || "",
        personal_email: row.personal_email || row.email || "",
        personal_phone: row.personal_phone || row.phone || "",
      });
    }

    return rows;
  };

  // Parse a single CSV line, handling quoted values
  const parseCSVLine = (line: string): string[] => {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        values.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current);

    return values;
  };

  // Normalize phone number to E.164 format
  const normalizePhone = (phone: string): string | null => {
    if (!phone) return null;
    
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) {
      return `+1${digits}`;
    } else if (digits.length === 11 && digits.startsWith("1")) {
      return `+${digits}`;
    } else if (digits.length > 0) {
      return phone; // Return original if non-standard
    }
    return null;
  };

  // Validate email format
  const isValidEmail = (email: string): boolean => {
    if (!email) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  // Process uploaded file
  const handleFileUpload = useCallback(async (file: File) => {
    if (!file.name.endsWith(".csv")) {
      toast({ title: "Invalid file type", description: "Please upload a CSV file", variant: "destructive" });
      return;
    }

    try {
      const text = await file.text();
      const parsed = parseCSV(text);

      if (parsed.length === 0) {
        toast({ title: "No data found", description: "The CSV file appears to be empty", variant: "destructive" });
        return;
      }

      // Match parsed rows with candidates
      const matched: MatchedRecord[] = [];
      for (const row of parsed) {
        const candidate = candidates.find(c => c.id === row.candidate_id);
        
        if (!candidate) {
          matched.push({
            candidateId: row.candidate_id,
            candidateName: `${row.first_name} ${row.last_name}`.trim() || "Unknown",
            email: row.personal_email || null,
            phone: row.personal_phone || null,
            status: "not_found",
          });
          continue;
        }

        const email = row.personal_email && isValidEmail(row.personal_email) ? row.personal_email : null;
        const phone = normalizePhone(row.personal_phone);

        if (!email && !phone) {
          matched.push({
            candidateId: candidate.id,
            candidateName: `Dr. ${candidate.first_name} ${candidate.last_name}`,
            email: null,
            phone: null,
            status: "no_data",
            originalCandidate: candidate,
          });
        } else {
          matched.push({
            candidateId: candidate.id,
            candidateName: `Dr. ${candidate.first_name} ${candidate.last_name}`,
            email,
            phone,
            status: "matched",
            originalCandidate: candidate,
          });
        }
      }

      setParsedRecords(matched);
      setStep("preview");
    } catch (error) {
      console.error("CSV parse error:", error);
      toast({ 
        title: "Failed to parse CSV", 
        description: error instanceof Error ? error.message : "Invalid file format",
        variant: "destructive" 
      });
    }
  }, [candidates]);

  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  // Handle drag and drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  // Save matched records to database
  const handleSave = async () => {
    const recordsToUpdate = parsedRecords.filter(r => r.status === "matched");
    if (recordsToUpdate.length === 0) {
      toast({ title: "No records to update", description: "Please add contact info to the CSV and re-upload" });
      return;
    }

    setStep("saving");
    setSaveProgress({ current: 0, total: recordsToUpdate.length });

    let updated = 0;
    let skipped = 0;
    const updatedCandidates = [...candidates];

    for (let i = 0; i < recordsToUpdate.length; i++) {
      const record = recordsToUpdate[i];

      try {
        const updateData: Record<string, unknown> = {
          enrichment_source: "CSV Import",
          contact_enrichment_source: "CSV Import",
          enriched_at: new Date().toISOString(),
          enrichment_tier: "Platinum",
          enrichment_needed: false,
        };

        if (record.email) updateData.personal_email = record.email;
        if (record.phone) updateData.personal_mobile = record.phone;

        const { error } = await supabase
          .from("candidates")
          .update(updateData)
          .eq("id", record.candidateId);

        if (error) {
          console.error(`Failed to update ${record.candidateName}:`, error);
          skipped++;
        } else {
          updated++;
          
          // Update local state
          const idx = updatedCandidates.findIndex(c => c.id === record.candidateId);
          if (idx !== -1) {
            updatedCandidates[idx] = {
              ...updatedCandidates[idx],
              personal_email: record.email || updatedCandidates[idx].personal_email,
              personal_mobile: record.phone || updatedCandidates[idx].personal_mobile,
              enrichment_source: "CSV Import",
              enrichment_tier: "Platinum",
            };
          }
        }
      } catch (err) {
        console.error(`Error updating ${record.candidateName}:`, err);
        skipped++;
      }

      setSaveProgress({ current: i + 1, total: recordsToUpdate.length });
    }

    setResults({ updated, skipped });
    onCandidatesUpdate(updatedCandidates);
    setStep("complete");

    toast({
      title: "Import Complete",
      description: `Updated ${updated} candidate${updated !== 1 ? "s" : ""} with contact info`,
    });
  };

  // Reset dialog state
  const handleClose = () => {
    setStep("upload");
    setParsedRecords([]);
    setSaveProgress({ current: 0, total: 0 });
    setResults({ updated: 0, skipped: 0 });
    onOpenChange(false);
  };

  const matchedCount = parsedRecords.filter(r => r.status === "matched").length;
  const noDataCount = parsedRecords.filter(r => r.status === "no_data").length;
  const notFoundCount = parsedRecords.filter(r => r.status === "not_found").length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload Enriched Contacts</DialogTitle>
          <DialogDescription>
            {step === "upload" && "Upload a CSV file with contact information for your candidates"}
            {step === "preview" && "Review the matched records before saving"}
            {step === "saving" && "Saving contact information to the database..."}
            {step === "complete" && "Import complete"}
          </DialogDescription>
        </DialogHeader>

        {/* Upload Step */}
        {step === "upload" && (
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
            <p className="text-foreground font-medium mb-1">
              Drop your CSV file here
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              or click to browse
            </p>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileText className="h-4 w-4 mr-2" />
              Select CSV File
            </Button>
            <p className="text-xs text-muted-foreground mt-4">
              The CSV must include a "candidate_id" column and "personal_email" / "personal_phone" columns
            </p>
          </div>
        )}

        {/* Preview Step */}
        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {matchedCount} ready to import
              </Badge>
              {noDataCount > 0 && (
                <Badge variant="outline" className="text-amber-400 border-amber-500/30">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {noDataCount} no data
                </Badge>
              )}
              {notFoundCount > 0 && (
                <Badge variant="outline" className="text-destructive border-destructive/30">
                  <XCircle className="h-3 w-3 mr-1" />
                  {notFoundCount} not found
                </Badge>
              )}
            </div>

            <ScrollArea className="h-[300px] border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Status</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRecords.map((record, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        {record.status === "matched" && (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        )}
                        {record.status === "no_data" && (
                          <AlertTriangle className="h-4 w-4 text-amber-400" />
                        )}
                        {record.status === "not_found" && (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{record.candidateName}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {record.email || "--"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {record.phone || "--"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}

        {/* Saving Step */}
        {step === "saving" && (
          <div className="py-8 space-y-4">
            <div className="flex items-center justify-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-foreground font-medium">
                Updating candidates... {saveProgress.current}/{saveProgress.total}
              </span>
            </div>
            <Progress
              value={(saveProgress.current / saveProgress.total) * 100}
              className="h-2"
            />
          </div>
        )}

        {/* Complete Step */}
        {step === "complete" && (
          <div className="py-8 text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-3 bg-emerald-500/20 rounded-full">
                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              </div>
            </div>
            <div>
              <p className="text-foreground font-semibold text-lg">Import Complete!</p>
              <p className="text-muted-foreground">
                Successfully updated {results.updated} candidate{results.updated !== 1 ? "s" : ""}
                {results.skipped > 0 && ` (${results.skipped} skipped)`}
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === "upload" && (
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("upload")}>
                Back
              </Button>
              <Button onClick={handleSave} disabled={matchedCount === 0}>
                Import {matchedCount} Contacts
              </Button>
            </>
          )}
          {step === "complete" && (
            <Button onClick={handleClose}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

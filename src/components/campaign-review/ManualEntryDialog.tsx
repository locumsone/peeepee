import { useState } from "react";
import { Loader2, User, Mail, Phone, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface ManualEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: {
    id: string;
    name: string;
    currentEmail?: string | null;
    currentPhone?: string | null;
  };
  onSave: (candidateId: string, email: string | null, phone: string | null) => void;
}

export function ManualEntryDialog({
  open,
  onOpenChange,
  candidate,
  onSave,
}: ManualEntryDialogProps) {
  const [email, setEmail] = useState(candidate.currentEmail || "");
  const [phone, setPhone] = useState(candidate.currentPhone || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!email && !phone) {
      toast({
        title: "Enter at least one",
        description: "Please provide an email or phone number",
        variant: "destructive",
      });
      return;
    }

    // Basic validation
    if (email && !email.includes("@")) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    if (phone && !/^[\d\s\-\+\(\)]+$/.test(phone)) {
      toast({
        title: "Invalid phone",
        description: "Please enter a valid phone number",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      // Normalize phone to E.164 if provided
      let normalizedPhone = phone;
      if (phone) {
        const digits = phone.replace(/\D/g, "");
        if (digits.length === 10) {
          normalizedPhone = `+1${digits}`;
        } else if (digits.length === 11 && digits.startsWith("1")) {
          normalizedPhone = `+${digits}`;
        }
      }

      // Update the candidate record in the database
      const { error } = await supabase
        .from("candidates")
        .update({
          personal_email: email || null,
          personal_mobile: normalizedPhone || null,
          contact_enrichment_source: "Manual",
          contact_enriched_at: new Date().toISOString(),
          enrichment_tier: "Platinum",
          enrichment_needed: false,
        })
        .eq("id", candidate.id);

      if (error) throw error;

      toast({
        title: "Contact saved",
        description: `Updated contact info for ${candidate.name}`,
      });

      onSave(candidate.id, email || null, normalizedPhone || null);
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to save manual entry:", err);
      toast({
        title: "Save failed",
        description: "Could not save contact info. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <User className="h-5 w-5 text-primary" />
            Manual Contact Entry
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Enter contact information for {candidate.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2 text-foreground">
              <Mail className="h-4 w-4 text-muted-foreground" />
              Email Address
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="doctor@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-muted/30"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="flex items-center gap-2 text-foreground">
              <Phone className="h-4 w-4 text-muted-foreground" />
              Phone Number
            </Label>
            <Input
              id="phone"
              type="tel"
              placeholder="(404) 555-1234"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="bg-muted/30"
            />
            <p className="text-xs text-muted-foreground">
              Will be normalized to +1 format for SMS
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Contact
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

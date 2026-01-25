import { useState, useEffect } from "react";
import { useUserSignature, UserSignatureInput } from "@/hooks/useUserSignature";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, Save, User, Briefcase, Building2, Phone, Mail, MessageSquare } from "lucide-react";

export function SignatureSettings() {
  const { signature, loading, error, saveSignature, hasSignature } = useUserSignature();
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState<UserSignatureInput>({
    full_name: '',
    first_name: '',
    title: 'Clinical Consultant',
    company: 'Locums One',
    phone: '',
  });

  // Load existing signature data into form
  useEffect(() => {
    if (signature) {
      setFormData({
        full_name: signature.full_name,
        first_name: signature.first_name,
        title: signature.title,
        company: signature.company,
        phone: signature.phone || '',
      });
    }
  }, [signature]);

  const handleChange = (field: keyof UserSignatureInput, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.full_name.trim() || !formData.first_name.trim()) {
      toast.error("Full name and first name are required");
      return;
    }

    setIsSaving(true);
    const success = await saveSignature(formData);
    setIsSaving(false);

    if (success) {
      toast.success("Signature saved successfully");
    } else {
      toast.error("Failed to save signature");
    }
  };

  // Preview components
  const emailPreview = `Best regards,
${formData.full_name || 'Your Name'}
${formData.title || 'Clinical Consultant'}
${formData.company || 'Locums One'}${formData.phone ? `\n${formData.phone}` : ''}`;

  const smsPreview = `...Worth 15 min? - ${formData.first_name || 'Name'}@Locums.one`;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Signature Settings
        </CardTitle>
        <CardDescription>
          Configure your email and SMS signature for outreach messages
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Form Fields */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="full_name" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Full Name *
              </Label>
              <Input
                id="full_name"
                placeholder="e.g., Marc Jacobsohn"
                value={formData.full_name}
                onChange={(e) => handleChange('full_name', e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">Used in email signatures</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="first_name" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                First Name *
              </Label>
              <Input
                id="first_name"
                placeholder="e.g., Marc"
                value={formData.first_name}
                onChange={(e) => handleChange('first_name', e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">Used in SMS signatures (e.g., Marc@Locums.one)</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title" className="flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                Title
              </Label>
              <Input
                id="title"
                placeholder="e.g., Clinical Consultant"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Company
              </Label>
              <Input
                id="company"
                placeholder="Locums One"
                value={formData.company}
                onChange={(e) => handleChange('company', e.target.value)}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Phone (optional)
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="e.g., (555) 123-4567"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
              />
            </div>
          </div>

          <Separator />

          {/* Preview Section */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                Email Signature Preview
              </Label>
              <pre className="rounded-md bg-muted p-3 text-sm whitespace-pre-wrap font-mono">
                {emailPreview}
              </pre>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-muted-foreground">
                <MessageSquare className="h-4 w-4" />
                SMS Signature Preview
              </Label>
              <pre className="rounded-md bg-muted p-3 text-sm whitespace-pre-wrap font-mono">
                {smsPreview}
              </pre>
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {hasSignature ? 'Update Signature' : 'Save Signature'}
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

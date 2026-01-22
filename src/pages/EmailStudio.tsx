import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Mail, Sparkles, Send, Copy, RefreshCw, 
  Users, Zap, Eye, Edit3, FileText,
  ArrowLeft, BarChart3, Layers, Check
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface EmailResult {
  subject: string;
  body: string;
}

interface Candidate {
  id: string;
  first_name: string;
  last_name: string;
  specialty: string;
  email: string;
  personal_email: string;
}

export default function EmailStudio() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const candidateId = searchParams.get('candidateId');
  const jobId = searchParams.get('jobId');

  const [selectedType, setSelectedType] = useState<'initial' | 'followup' | 'value_prop' | 'fellowship' | 'custom'>('initial');
  const [customInstructions, setCustomInstructions] = useState('');
  const [includeFullDetails, setIncludeFullDetails] = useState(false);
  const [generatedEmail, setGeneratedEmail] = useState<EmailResult | null>(null);
  const [editedSubject, setEditedSubject] = useState('');
  const [editedBody, setEditedBody] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  // Fetch candidate data
  const { data: candidate } = useQuery({
    queryKey: ['candidate', candidateId],
    queryFn: async () => {
      if (!candidateId) return null;
      const { data, error } = await supabase
        .from('candidates')
        .select('id, first_name, last_name, specialty, email, personal_email')
        .eq('id', candidateId)
        .single();
      if (error) throw error;
      return data as Candidate;
    },
    enabled: !!candidateId,
  });

  // Fetch job data
  const { data: job } = useQuery({
    queryKey: ['job', jobId],
    queryFn: async () => {
      if (!jobId) return null;
      const { data, error } = await supabase
        .from('jobs')
        .select('id, job_name, facility_name, city, state, specialty, bill_rate')
        .eq('id', jobId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!jobId,
  });

  // Fetch email templates
  const { data: templates = [] } = useQuery({
    queryKey: ['email-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('is_active', true)
        .order('sequence_day');
      if (error) throw error;
      return data || [];
    },
  });

  const handleGenerate = async () => {
    if (!candidateId || !jobId) {
      toast.error('Please select a candidate and job first');
      return;
    }

    setIsGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please log in to generate emails');
        return;
      }

      const response = await supabase.functions.invoke('generate-email', {
        body: {
          candidate_id: candidateId,
          job_id: jobId,
          template_type: selectedType,
          custom_instructions: customInstructions || undefined,
          include_full_details: includeFullDetails,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = response.data;
      if (result.email) {
        setGeneratedEmail(result.email);
        setEditedSubject(result.email.subject);
        setEditedBody(result.email.body);
        toast.success('Email generated!');
      }
    } catch (error) {
      console.error('Generation error:', error);
      toast.error('Failed to generate email');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const copyFullEmail = () => {
    const fullEmail = `Subject: ${editedSubject}\n\n${editedBody}`;
    navigator.clipboard.writeText(fullEmail);
    toast.success('Full email copied to clipboard');
  };

  // Convert markdown to simple HTML for preview
  const renderMarkdown = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
      .replace(/^## (.*$)/gm, '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>')
      .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mt-6 mb-4">$1</h1>')
      .replace(/^- (.*$)/gm, '<li class="ml-4">$1</li>')
      .replace(/\n/g, '<br />');
  };

  return (
    <Layout>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                  <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Mail className="h-6 w-6 text-primary" />
                    Email Studio
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    AI-powered personalized email composer
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={() => navigate('/communications')}>
                  <BarChart3 className="h-4 w-4 mr-2" />
                  View Inbox
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-6 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Panel - Configuration */}
            <div className="space-y-6">
              {/* Context Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Campaign Context</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {candidate && (
                    <div className="p-3 rounded-lg bg-secondary/50">
                      <div className="flex items-center gap-2 mb-1">
                        <Users className="h-4 w-4 text-primary" />
                        <span className="font-medium">
                          Dr. {candidate.first_name} {candidate.last_name}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{candidate.specialty}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {candidate.personal_email || candidate.email || 'No email'}
                      </p>
                    </div>
                  )}

                  {job && (
                    <div className="p-3 rounded-lg bg-secondary/50">
                      <div className="flex items-center gap-2 mb-1">
                        <Zap className="h-4 w-4 text-warning" />
                        <span className="font-medium">{job.job_name}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {job.facility_name} • {job.city}, {job.state}
                      </p>
                      {job.bill_rate && (
                        <Badge variant="secondary" className="mt-2">
                          ${job.bill_rate}/hr
                        </Badge>
                      )}
                    </div>
                  )}

                  {!candidate && !job && (
                    <div className="text-center py-6 text-muted-foreground">
                      <p className="text-sm">Add ?candidateId=...&jobId=... to URL</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Email Type Selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Email Type</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Select value={selectedType} onValueChange={(v) => setSelectedType(v as typeof selectedType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="initial">📧 Initial Outreach</SelectItem>
                      <SelectItem value="followup">🔄 Follow-up</SelectItem>
                      <SelectItem value="value_prop">💰 Value Proposition</SelectItem>
                      <SelectItem value="fellowship">🎓 Fellowship-Focused</SelectItem>
                      <SelectItem value="custom">✏️ Custom</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="full-details" className="text-sm">Include full compensation breakdown</Label>
                    <Switch
                      id="full-details"
                      checked={includeFullDetails}
                      onCheckedChange={setIncludeFullDetails}
                    />
                  </div>

                  {selectedType === 'custom' && (
                    <div className="space-y-2">
                      <Label>Custom Instructions</Label>
                      <Textarea
                        placeholder="E.g., 'Focus on their IR fellowship at Mayo and reference the Texas no-income-tax benefit'"
                        value={customInstructions}
                        onChange={(e) => setCustomInstructions(e.target.value)}
                        className="min-h-[100px]"
                      />
                    </div>
                  )}

                  <Button 
                    onClick={handleGenerate} 
                    disabled={isGenerating || !candidateId || !jobId}
                    className="w-full"
                  >
                    {isGenerating ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate Email
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Template Library */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    Template Library
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-2">
                      {templates.map((template) => (
                        <div
                          key={template.id}
                          className="p-3 rounded-lg border hover:border-primary/50 cursor-pointer transition-colors"
                          onClick={() => {
                            setEditedSubject(template.subject_template);
                            setEditedBody(template.body_template);
                            toast.success('Template loaded');
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">{template.name}</span>
                            {template.sequence_day && (
                              <Badge variant="outline" className="text-xs">
                                Day {template.sequence_day}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {template.subject_template}
                          </p>
                        </div>
                      ))}
                      {templates.length === 0 && (
                        <div className="text-center py-4 text-muted-foreground text-sm">
                          No templates saved yet
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Right Panel - Editor/Preview */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="h-full">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      {isPreviewMode ? 'Email Preview' : 'Email Editor'}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Button
                        variant={isPreviewMode ? 'outline' : 'secondary'}
                        size="sm"
                        onClick={() => setIsPreviewMode(false)}
                      >
                        <Edit3 className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant={isPreviewMode ? 'secondary' : 'outline'}
                        size="sm"
                        onClick={() => setIsPreviewMode(true)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Preview
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Subject Line */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Subject Line</Label>
                    {isPreviewMode ? (
                      <div className="p-3 rounded-lg bg-secondary/50 font-medium">
                        {editedSubject || 'No subject'}
                      </div>
                    ) : (
                      <Input
                        placeholder="Enter subject line..."
                        value={editedSubject}
                        onChange={(e) => setEditedSubject(e.target.value)}
                        className="text-base"
                      />
                    )}
                  </div>

                  <Separator />

                  {/* Email Body */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Email Body</Label>
                    {isPreviewMode ? (
                      <ScrollArea className="h-[500px] rounded-lg border p-4 bg-white">
                        <div 
                          className="prose prose-sm max-w-none text-foreground"
                          dangerouslySetInnerHTML={{ __html: renderMarkdown(editedBody || 'No content') }}
                        />
                      </ScrollArea>
                    ) : (
                      <Textarea
                        placeholder="Compose your email (supports Markdown)..."
                        value={editedBody}
                        onChange={(e) => setEditedBody(e.target.value)}
                        className="min-h-[500px] font-mono text-sm"
                      />
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="text-sm text-muted-foreground">
                      {editedBody.length} characters • ~{Math.ceil(editedBody.split(/\s+/).length)} words
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        onClick={copyFullEmail}
                        disabled={!editedSubject && !editedBody}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Email
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          // Open email client with draft
                          const email = candidate?.personal_email || candidate?.email;
                          if (email) {
                            const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(editedSubject)}&body=${encodeURIComponent(editedBody.replace(/\n/g, '\r\n'))}`;
                            window.open(mailtoUrl, '_blank');
                          } else {
                            toast.error('No email address available');
                          }
                        }}
                        disabled={!candidate}
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        Open in Mail
                      </Button>
                      <Button
                        onClick={() => {
                          toast.info('Instantly integration coming soon');
                        }}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Send via Instantly
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

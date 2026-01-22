import { useState, useEffect } from 'react';
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
  MessageSquare, Sparkles, Send, Copy, RefreshCw, 
  Users, Zap, Clock, AlertTriangle, CheckCircle2,
  ChevronRight, ArrowLeft, Settings, BarChart3
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface SMSOption {
  sms: string;
  style: string;
  char_count: number;
}

interface Candidate {
  id: string;
  first_name: string;
  last_name: string;
  specialty: string;
  phone: string;
  personal_mobile: string;
}

interface TemplateStats {
  name: string;
  times_used: number;
  times_replied: number;
  reply_rate: number;
}

export default function SMSStudio() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const candidateId = searchParams.get('candidateId');
  const jobId = searchParams.get('jobId');

  const [selectedStyle, setSelectedStyle] = useState<'punchy' | 'friendly' | 'urgent' | 'value_prop'>('punchy');
  const [customContext, setCustomContext] = useState('');
  const [generatedOptions, setGeneratedOptions] = useState<SMSOption[]>([]);
  const [selectedSMS, setSelectedSMS] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [sendDelay, setSendDelay] = useState(30); // seconds between messages

  // Fetch candidate data
  const { data: candidate } = useQuery({
    queryKey: ['candidate', candidateId],
    queryFn: async () => {
      if (!candidateId) return null;
      const { data, error } = await supabase
        .from('candidates')
        .select('id, first_name, last_name, specialty, phone, personal_mobile')
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

  // Fetch template performance stats
  const { data: templateStats = [] } = useQuery({
    queryKey: ['sms-template-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sms_templates')
        .select('name, times_used, times_replied, performance_score')
        .order('performance_score', { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data || []).map(t => ({
        name: t.name,
        times_used: t.times_used || 0,
        times_replied: t.times_replied || 0,
        reply_rate: t.times_used ? ((t.times_replied || 0) / t.times_used * 100) : 0
      })) as TemplateStats[];
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
        toast.error('Please log in to generate SMS');
        return;
      }

      const response = await supabase.functions.invoke('generate-sms', {
        body: {
          candidate_id: candidateId,
          job_id: jobId,
          template_style: selectedStyle,
          custom_context: customContext || undefined,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = response.data;
      if (result.sms_options) {
        setGeneratedOptions(result.sms_options);
        if (result.sms_options.length > 0) {
          setSelectedSMS(result.sms_options[0].sms);
        }
        toast.success('SMS options generated!');
      }
    } catch (error) {
      console.error('Generation error:', error);
      toast.error('Failed to generate SMS options');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSend = async () => {
    if (!selectedSMS) {
      toast.error('Please select or enter an SMS to send');
      return;
    }

    const phoneNumber = candidate?.personal_mobile || candidate?.phone;
    if (!phoneNumber) {
      toast.error('No phone number available for this candidate');
      return;
    }

    setIsSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please log in to send SMS');
        return;
      }

      const response = await fetch(
        'https://qpvyzyspwxwtwjhfcuhh.supabase.co/functions/v1/sms-campaign-send',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            to_phone: phoneNumber,
            custom_message: selectedSMS,
            from_number: '+12185628671',
            candidate_id: candidateId,
            job_id: jobId,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to send SMS');
      }

      toast.success('SMS sent successfully!');
      setSelectedSMS('');
      setGeneratedOptions([]);
    } catch (error) {
      console.error('Send error:', error);
      toast.error('Failed to send SMS');
    } finally {
      setIsSending(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
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
                    <MessageSquare className="h-6 w-6 text-primary" />
                    SMS Studio
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    AI-powered personalized SMS drafting
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
                  <CardDescription>Select candidate and job for personalization</CardDescription>
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
                        {candidate.personal_mobile || candidate.phone || 'No phone'}
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
                      <p className="text-xs mt-1">or select from Candidate Matching page</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Style Selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Message Style</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Select value={selectedStyle} onValueChange={(v) => setSelectedStyle(v as typeof selectedStyle)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="punchy">⚡ Punchy - Short & impactful</SelectItem>
                      <SelectItem value="friendly">😊 Friendly - Warm & conversational</SelectItem>
                      <SelectItem value="urgent">🔥 Urgent - Creates FOMO</SelectItem>
                      <SelectItem value="value_prop">💰 Value-First - Lead with money</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="space-y-2">
                    <Label>Additional Context (optional)</Label>
                    <Textarea
                      placeholder="E.g., 'They mentioned interest in Texas on LinkedIn' or 'Fellowship-trained at Mayo'"
                      value={customContext}
                      onChange={(e) => setCustomContext(e.target.value)}
                      className="min-h-[80px]"
                    />
                  </div>

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
                        Generate SMS Options
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Twilio Best Practices */}
              <Card className="border-warning/50 bg-warning/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    Twilio Best Practices
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-2 text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-3 w-3 text-success mt-0.5" />
                    <span>Keep messages under 160 characters</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-3 w-3 text-success mt-0.5" />
                    <span>Space bulk sends 30+ seconds apart</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-3 w-3 text-success mt-0.5" />
                    <span>Limit to 200 messages/day per number</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-3 w-3 text-success mt-0.5" />
                    <span>Include opt-out instructions periodically</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Middle Panel - Generated Options */}
            <div className="lg:col-span-2 space-y-6">
              <Tabs defaultValue="generate" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="generate">Generate</TabsTrigger>
                  <TabsTrigger value="templates">Templates</TabsTrigger>
                  <TabsTrigger value="analytics">Analytics</TabsTrigger>
                </TabsList>

                <TabsContent value="generate" className="space-y-4 mt-4">
                  {/* Generated Options */}
                  {generatedOptions.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">AI-Generated Options</CardTitle>
                        <CardDescription>Click to select, then edit or send</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {generatedOptions.map((option, index) => (
                          <div
                            key={index}
                            onClick={() => setSelectedSMS(option.sms)}
                            className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                              selectedSMS === option.sms 
                                ? 'border-primary bg-primary/5' 
                                : 'border-border hover:border-primary/50'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm flex-1">{option.sms}</p>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(option.sms);
                                }}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className="text-xs">
                                {option.style}
                              </Badge>
                              <span className={`text-xs ${option.char_count > 160 ? 'text-destructive' : 'text-muted-foreground'}`}>
                                {option.char_count}/160 chars
                              </span>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* Compose/Edit Area */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Compose Message</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Textarea
                        placeholder="Enter or edit your SMS message..."
                        value={selectedSMS}
                        onChange={(e) => setSelectedSMS(e.target.value)}
                        className="min-h-[120px] text-base"
                        maxLength={160}
                      />
                      <div className="flex items-center justify-between">
                        <span className={`text-sm ${selectedSMS.length > 160 ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                          {selectedSMS.length}/160 characters
                          {selectedSMS.length > 160 && ' (will be split into multiple messages)'}
                        </span>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            onClick={() => copyToClipboard(selectedSMS)}
                            disabled={!selectedSMS}
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Copy
                          </Button>
                          <Button
                            onClick={handleSend}
                            disabled={isSending || !selectedSMS || !candidate}
                          >
                            {isSending ? (
                              <>
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                Sending...
                              </>
                            ) : (
                              <>
                                <Send className="h-4 w-4 mr-2" />
                                Send SMS
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="templates" className="mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Saved Templates</CardTitle>
                      <CardDescription>Your most effective SMS templates</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[400px]">
                        <div className="space-y-3">
                          {templateStats.map((template, index) => (
                            <div
                              key={index}
                              className="p-4 rounded-lg border hover:border-primary/50 cursor-pointer transition-colors"
                              onClick={() => toast.info('Template selection coming soon')}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-medium">{template.name}</span>
                                <Badge variant={template.reply_rate > 10 ? 'default' : 'secondary'}>
                                  {template.reply_rate.toFixed(1)}% reply rate
                                </Badge>
                              </div>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span>{template.times_used} sent</span>
                                <span>{template.times_replied} replies</span>
                              </div>
                            </div>
                          ))}
                          {templateStats.length === 0 && (
                            <div className="text-center py-8 text-muted-foreground">
                              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                              <p>No templates saved yet</p>
                              <p className="text-sm mt-1">Your AI-generated messages will appear here</p>
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="analytics" className="mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">SMS Performance</CardTitle>
                      <CardDescription>Track your messaging effectiveness</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="text-center p-4 rounded-lg bg-secondary/50">
                          <div className="text-3xl font-bold text-primary">--</div>
                          <div className="text-sm text-muted-foreground">Sent Today</div>
                        </div>
                        <div className="text-center p-4 rounded-lg bg-secondary/50">
                          <div className="text-3xl font-bold text-success">--</div>
                          <div className="text-sm text-muted-foreground">Replies</div>
                        </div>
                        <div className="text-center p-4 rounded-lg bg-secondary/50">
                          <div className="text-3xl font-bold text-warning">--%</div>
                          <div className="text-sm text-muted-foreground">Reply Rate</div>
                        </div>
                      </div>
                      <div className="text-center py-8 text-muted-foreground">
                        <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>Detailed analytics coming soon</p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { 
  FileText, Sparkles, Copy, RefreshCw, Download,
  MessageSquare, Mail, Target, Shield, Search,
  Users, DollarSign, MapPin, Clock, CheckCircle2,
  ArrowLeft, Zap, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface SMSTemplate {
  name: string;
  category: string;
  template: string;
  char_count: number;
}

interface PersonalizationHook {
  name: string;
  use_case: string;
  pattern: string;
  examples: string[];
}

interface Objection {
  objection: string;
  response: string;
}

interface CandidateTier {
  tier: number;
  description: string;
  priority: string;
}

interface Playbook {
  job_id: string;
  job_name: string;
  facility: string;
  location: string;
  compensation: {
    hourly: number;
    daily: number;
    weekly: number;
    monthly: number;
    annual: number;
  };
  key_selling_points?: string[];
  candidate_tiers?: CandidateTier[];
  sms_templates?: SMSTemplate[];
  personalization_hooks?: PersonalizationHook[];
  objection_handling?: Objection[];
  linkedin_criteria?: {
    job_titles: string[];
    keywords_include: string[];
    keywords_exclude: string[];
    locations: string[];
  };
}

export default function PlaybookBuilder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const jobId = searchParams.get('jobId');

  const [isGenerating, setIsGenerating] = useState(false);
  const [playbook, setPlaybook] = useState<Playbook | null>(null);
  const [activeSection, setActiveSection] = useState('overview');

  // Fetch job data
  const { data: job, isLoading: jobLoading } = useQuery({
    queryKey: ['job', jobId],
    queryFn: async () => {
      if (!jobId) return null;
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!jobId,
  });

  const handleGeneratePlaybook = async () => {
    if (!jobId) {
      toast.error('Please select a job first');
      return;
    }

    setIsGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please log in');
        return;
      }

      const response = await supabase.functions.invoke('generate-playbook', {
        body: { job_id: jobId },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.playbook) {
        setPlaybook(response.data.playbook);
        toast.success('Playbook generated!');
      }
    } catch (error) {
      console.error('Generation error:', error);
      toast.error('Failed to generate playbook');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const exportPlaybook = () => {
    if (!playbook) return;
    
    let markdown = `# Playbook: ${playbook.job_name}\n\n`;
    markdown += `**Facility:** ${playbook.facility}\n`;
    markdown += `**Location:** ${playbook.location}\n\n`;
    markdown += `## Compensation\n`;
    markdown += `- Hourly: $${playbook.compensation.hourly}\n`;
    markdown += `- Daily: $${playbook.compensation.daily.toLocaleString()}\n`;
    markdown += `- Weekly: $${playbook.compensation.weekly.toLocaleString()}\n`;
    markdown += `- Annual: $${playbook.compensation.annual.toLocaleString()}\n\n`;

    if (playbook.sms_templates?.length) {
      markdown += `## SMS Templates\n\n`;
      playbook.sms_templates.forEach((t, i) => {
        markdown += `### ${i + 1}. ${t.name} (${t.category})\n`;
        markdown += `${t.template}\n`;
        markdown += `*${t.char_count} characters*\n\n`;
      });
    }

    if (playbook.personalization_hooks?.length) {
      markdown += `## Personalization Hooks\n\n`;
      playbook.personalization_hooks.forEach((h, i) => {
        markdown += `### ${i + 1}. ${h.name}\n`;
        markdown += `**Use when:** ${h.use_case}\n\n`;
        markdown += `**Pattern:** ${h.pattern}\n\n`;
        markdown += `**Examples:**\n`;
        h.examples.forEach(ex => {
          markdown += `- ${ex}\n`;
        });
        markdown += '\n';
      });
    }

    if (playbook.objection_handling?.length) {
      markdown += `## Objection Handling\n\n`;
      playbook.objection_handling.forEach(o => {
        markdown += `**"${o.objection}"**\n`;
        markdown += `${o.response}\n\n`;
      });
    }

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `playbook-${playbook.job_name.toLowerCase().replace(/\s+/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Playbook exported!');
  };

  if (jobLoading) {
    return (
      <Layout showSteps={false}>
        <div className="flex items-center justify-center min-h-screen">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout showSteps={false}>
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
                    <FileText className="h-6 w-6 text-primary" />
                    Playbook Builder
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Generate comprehensive recruitment playbooks with SMS, Email, and Hooks
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {playbook && (
                  <Button variant="outline" onClick={exportPlaybook}>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                )}
                <Button 
                  onClick={handleGeneratePlaybook}
                  disabled={isGenerating || !jobId}
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Playbook
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-6 py-8">
          {!jobId ? (
            <Card className="max-w-lg mx-auto">
              <CardContent className="py-12 text-center">
                <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-warning" />
                <h3 className="text-lg font-medium mb-2">No Job Selected</h3>
                <p className="text-muted-foreground mb-4">
                  Add ?jobId=... to the URL or select a job from the Jobs page
                </p>
                <Button onClick={() => navigate('/jobs')}>
                  Go to Jobs
                </Button>
              </CardContent>
            </Card>
          ) : !playbook ? (
            <div className="max-w-2xl mx-auto">
              {/* Job Preview */}
              {job && (
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-warning" />
                      {job.job_name}
                    </CardTitle>
                    <CardDescription>
                      {job.facility_name} • {job.city}, {job.state}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-3 rounded-lg bg-secondary/50">
                        <DollarSign className="h-5 w-5 mx-auto mb-1 text-success" />
                        <div className="font-bold">${job.bill_rate}/hr</div>
                        <div className="text-xs text-muted-foreground">Rate</div>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-secondary/50">
                        <MapPin className="h-5 w-5 mx-auto mb-1 text-primary" />
                        <div className="font-bold">{job.state}</div>
                        <div className="text-xs text-muted-foreground">Location</div>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-secondary/50">
                        <Users className="h-5 w-5 mx-auto mb-1 text-info" />
                        <div className="font-bold">{job.specialty}</div>
                        <div className="text-xs text-muted-foreground">Specialty</div>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-secondary/50">
                        <Clock className="h-5 w-5 mx-auto mb-1 text-warning" />
                        <div className="font-bold">{job.start_date || 'ASAP'}</div>
                        <div className="text-xs text-muted-foreground">Start</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Generation CTA */}
              <Card className="border-primary/50 bg-primary/5">
                <CardContent className="py-12 text-center">
                  <FileText className="h-16 w-16 mx-auto mb-4 text-primary" />
                  <h3 className="text-xl font-bold mb-2">Generate Your Playbook</h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    AI will create personalization hooks, SMS templates, email templates, 
                    objection handling, and LinkedIn search criteria for this job.
                  </p>
                  <Button 
                    size="lg"
                    onClick={handleGeneratePlaybook}
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <>
                        <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                        Generating Playbook...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-5 w-5 mr-2" />
                        Generate Full Playbook
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : (
            /* Playbook Display */
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Sidebar Navigation */}
              <div className="lg:col-span-1">
                <Card className="sticky top-24">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Sections</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {[
                      { id: 'overview', label: 'Overview', icon: FileText },
                      { id: 'sms', label: 'SMS Templates', icon: MessageSquare },
                      { id: 'hooks', label: 'Personalization', icon: Target },
                      { id: 'objections', label: 'Objections', icon: Shield },
                      { id: 'linkedin', label: 'LinkedIn', icon: Search },
                      { id: 'tiers', label: 'Candidate Tiers', icon: Users },
                    ].map(section => (
                      <Button
                        key={section.id}
                        variant={activeSection === section.id ? 'secondary' : 'ghost'}
                        className="w-full justify-start"
                        onClick={() => setActiveSection(section.id)}
                      >
                        <section.icon className="h-4 w-4 mr-2" />
                        {section.label}
                      </Button>
                    ))}
                  </CardContent>
                </Card>
              </div>

              {/* Main Content */}
              <div className="lg:col-span-3 space-y-6">
                {/* Overview */}
                {activeSection === 'overview' && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        Position Overview
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-4 rounded-xl bg-gradient-to-br from-success/20 to-success/5 border border-success/20">
                          <div className="text-3xl font-bold text-success">
                            ${playbook.compensation.hourly}
                          </div>
                          <div className="text-sm text-muted-foreground">Per Hour</div>
                        </div>
                        <div className="text-center p-4 rounded-xl bg-secondary/50">
                          <div className="text-2xl font-bold">
                            ${playbook.compensation.daily.toLocaleString()}
                          </div>
                          <div className="text-sm text-muted-foreground">Per Day</div>
                        </div>
                        <div className="text-center p-4 rounded-xl bg-secondary/50">
                          <div className="text-2xl font-bold">
                            ${playbook.compensation.weekly.toLocaleString()}
                          </div>
                          <div className="text-sm text-muted-foreground">Per Week</div>
                        </div>
                        <div className="text-center p-4 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
                          <div className="text-2xl font-bold text-primary">
                            ${(playbook.compensation.annual / 1000000).toFixed(2)}M
                          </div>
                          <div className="text-sm text-muted-foreground">Annual</div>
                        </div>
                      </div>

                      <Separator />

                      <div>
                        <h4 className="font-medium mb-3">Key Selling Points</h4>
                        <div className="space-y-2">
                          {playbook.key_selling_points?.map((point, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <CheckCircle2 className="h-4 w-4 text-success mt-0.5" />
                              <span className="text-sm">{point}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* SMS Templates */}
                {activeSection === 'sms' && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <MessageSquare className="h-5 w-5 text-info" />
                        SMS Templates
                      </CardTitle>
                      <CardDescription>
                        Punchy, under-160-character messages for each scenario
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {playbook.sms_templates?.map((template, i) => (
                          <div
                            key={i}
                            className="p-4 rounded-lg border hover:border-primary/50 transition-colors"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{template.category}</Badge>
                                <span className="font-medium">{template.name}</span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(template.template)}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                            <p className="text-sm bg-secondary/50 p-3 rounded-lg">
                              {template.template}
                            </p>
                            <div className="text-xs text-muted-foreground mt-2">
                              {template.char_count}/160 characters
                            </div>
                          </div>
                        )) || (
                          <div className="text-center py-8 text-muted-foreground">
                            No SMS templates generated yet
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Personalization Hooks */}
                {activeSection === 'hooks' && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Target className="h-5 w-5 text-warning" />
                        Personalization Hooks
                      </CardTitle>
                      <CardDescription>
                        10 targeted approaches for different candidate profiles
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Accordion type="single" collapsible className="w-full">
                        {playbook.personalization_hooks?.map((hook, i) => (
                          <AccordionItem key={i} value={`hook-${i}`}>
                            <AccordionTrigger className="hover:no-underline">
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary">{i + 1}</Badge>
                                <span>{hook.name}</span>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="space-y-4">
                              <div>
                                <h5 className="text-sm font-medium text-muted-foreground mb-1">
                                  Use when:
                                </h5>
                                <p className="text-sm">{hook.use_case}</p>
                              </div>
                              <div>
                                <h5 className="text-sm font-medium text-muted-foreground mb-1">
                                  Pattern:
                                </h5>
                                <p className="text-sm bg-secondary/50 p-3 rounded-lg">
                                  {hook.pattern}
                                </p>
                              </div>
                              <div>
                                <h5 className="text-sm font-medium text-muted-foreground mb-1">
                                  Examples:
                                </h5>
                                <div className="space-y-2">
                                  {hook.examples.map((ex, j) => (
                                    <div
                                      key={j}
                                      className="text-sm p-3 rounded-lg border flex items-start justify-between gap-2"
                                    >
                                      <span>{ex}</span>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="shrink-0"
                                        onClick={() => copyToClipboard(ex)}
                                      >
                                        <Copy className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        )) || (
                          <div className="text-center py-8 text-muted-foreground">
                            No hooks generated yet
                          </div>
                        )}
                      </Accordion>
                    </CardContent>
                  </Card>
                )}

                {/* Objection Handling */}
                {activeSection === 'objections' && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-destructive" />
                        Objection Handling
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {playbook.objection_handling?.map((obj, i) => (
                          <div key={i} className="p-4 rounded-lg border">
                            <div className="flex items-start gap-3 mb-3">
                              <Badge variant="destructive" className="shrink-0">
                                Objection
                              </Badge>
                              <p className="font-medium">"{obj.objection}"</p>
                            </div>
                            <div className="flex items-start gap-3">
                              <Badge variant="default" className="shrink-0 bg-success">
                                Response
                              </Badge>
                              <p className="text-sm text-muted-foreground">{obj.response}</p>
                            </div>
                          </div>
                        )) || (
                          <div className="text-center py-8 text-muted-foreground">
                            No objections generated yet
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* LinkedIn Criteria */}
                {activeSection === 'linkedin' && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Search className="h-5 w-5 text-info" />
                        LinkedIn Search Criteria
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div>
                        <h4 className="font-medium mb-2">Job Titles to Search</h4>
                        <div className="flex flex-wrap gap-2">
                          {playbook.linkedin_criteria?.job_titles.map((title, i) => (
                            <Badge key={i} variant="secondary">{title}</Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2 text-success">Keywords to Include</h4>
                        <div className="flex flex-wrap gap-2">
                          {playbook.linkedin_criteria?.keywords_include.map((kw, i) => (
                            <Badge key={i} variant="outline" className="border-success text-success">{kw}</Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2 text-destructive">Keywords to Exclude</h4>
                        <div className="flex flex-wrap gap-2">
                          {playbook.linkedin_criteria?.keywords_exclude.map((kw, i) => (
                            <Badge key={i} variant="outline" className="border-destructive text-destructive">{kw}</Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2">Target Locations</h4>
                        <div className="flex flex-wrap gap-2">
                          {playbook.linkedin_criteria?.locations.map((loc, i) => (
                            <Badge key={i} variant="secondary">{loc}</Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Candidate Tiers */}
                {activeSection === 'tiers' && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        Candidate Priority Tiers
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {playbook.candidate_tiers?.map((tier) => (
                          <div
                            key={tier.tier}
                            className="flex items-center gap-4 p-4 rounded-lg border"
                          >
                            <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-white ${
                              tier.tier === 1 ? 'bg-success' :
                              tier.tier === 2 ? 'bg-primary' :
                              tier.tier === 3 ? 'bg-warning' :
                              tier.tier === 4 ? 'bg-info' : 'bg-muted-foreground'
                            }`}>
                              {tier.tier}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium">{tier.description}</p>
                            </div>
                            <Badge variant={
                              tier.priority === 'IMMEDIATE' ? 'default' :
                              tier.priority === 'FAST' ? 'secondary' : 'outline'
                            }>
                              {tier.priority}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

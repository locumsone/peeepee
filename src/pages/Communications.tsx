import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useTwilioDevice } from "@/hooks/useTwilioDevice";
import { formatDistanceToNow } from "date-fns";
import { 
  Phone, 
  MessageSquare, 
  Mail, 
  Search, 
  PhoneCall, 
  PhoneOff, 
  PhoneMissed,
  Mic,
  MicOff,
  Pause,
  Play,
  X,
  Minimize2,
  Maximize2,
  ExternalLink
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

interface SMSConversation {
  id: string;
  candidate_id: string;
  candidate_name: string;
  phone_number: string;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

interface CallLog {
  id: string;
  candidate_id: string;
  candidate_name: string;
  phone_number: string;
  duration_seconds: number;
  status: string;
  call_result: string;
  transcript_text: string;
  created_at: string;
}

interface Message {
  id: string;
  type: 'sms' | 'call';
  direction: 'inbound' | 'outbound';
  content: string;
  timestamp: string;
  duration_seconds?: number;
  call_result?: string;
  transcript_text?: string;
}

interface Candidate {
  id: string;
  first_name: string;
  last_name: string;
  specialty: string;
  phone: string;
  email: string;
  personal_mobile: string;
  city: string;
  state: string;
  licenses: string[];
  enrichment_tier: string;
}

interface CampaignLead {
  id: string;
  campaign_id: string;
  campaign_name: string;
  status: string;
}

export default function Communications() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'sms' | 'calls'>('sms');
  const [searchQuery, setSearchQuery] = useState('');
  const [conversations, setConversations] = useState<SMSConversation[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [campaignLeads, setCampaignLeads] = useState<CampaignLead[]>([]);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [callWidgetMinimized, setCallWidgetMinimized] = useState(false);
  const [loading, setLoading] = useState(true);
  const initialActionHandled = useRef(false);

  const twilioDevice = useTwilioDevice('recruiter-1');

  // Handle query params for call/sms actions
  useEffect(() => {
    if (initialActionHandled.current) return;
    
    const callPhone = searchParams.get('call');
    const smsPhone = searchParams.get('sms');
    
    if (callPhone || smsPhone) {
      const phone = callPhone || smsPhone;
      setSelectedPhone(phone);
      
      if (callPhone) {
        setActiveTab('calls');
        // Auto-initiate call when device is ready
        if (twilioDevice.isReady && !twilioDevice.currentCall) {
          twilioDevice.makeCall(callPhone, '+18001234567');
          toast.success('Initiating call...');
          initialActionHandled.current = true;
          // Clear the query param
          setSearchParams({});
        }
      } else if (smsPhone) {
        setActiveTab('sms');
        initialActionHandled.current = true;
        // Clear the query param
        setSearchParams({});
      }
    }
  }, [searchParams, twilioDevice.isReady, twilioDevice.currentCall, twilioDevice, setSearchParams]);

  // Fetch candidate by phone when selectedPhone is set from query params
  useEffect(() => {
    if (!selectedPhone) return;
    
    const fetchCandidateByPhone = async () => {
      const { data } = await supabase
        .from('candidates')
        .select('*')
        .or(`phone.eq.${selectedPhone},personal_mobile.eq.${selectedPhone}`)
        .limit(1)
        .single();
      
      if (data) {
        setCandidate({
          id: data.id,
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          specialty: data.specialty || '',
          phone: data.phone || '',
          email: data.email || '',
          personal_mobile: data.personal_mobile || '',
          city: data.city || '',
          state: data.state || '',
          licenses: data.licenses || [],
          enrichment_tier: data.enrichment_tier || ''
        });
      }
    };
    
    fetchCandidateByPhone();
  }, [selectedPhone]);

  // Fetch conversations/calls
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      if (activeTab === 'sms') {
        // For now, we'll aggregate from ai_call_logs where there might be SMS records
        // In production, this would query sms_conversations table
        const { data } = await supabase
          .from('ai_call_logs')
          .select('*')
          .not('candidate_name', 'is', null)
          .order('created_at', { ascending: false })
          .limit(50);
        
        if (data) {
          const grouped = data.reduce((acc: Record<string, SMSConversation>, log) => {
            const key = log.phone_number;
            if (!acc[key]) {
              acc[key] = {
                id: log.id,
                candidate_id: log.candidate_id || '',
                candidate_name: log.candidate_name || 'Unknown',
                phone_number: log.phone_number,
                last_message: log.call_summary || 'No messages yet',
                last_message_at: log.created_at || new Date().toISOString(),
                unread_count: 0
              };
            }
            return acc;
          }, {});
          setConversations(Object.values(grouped));
        }
      } else {
        const { data } = await supabase
          .from('ai_call_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);
        
        if (data) {
          setCallLogs(data.map(log => ({
            id: log.id,
            candidate_id: log.candidate_id || '',
            candidate_name: log.candidate_name || 'Unknown',
            phone_number: log.phone_number,
            duration_seconds: log.duration_seconds || 0,
            status: log.status || 'completed',
            call_result: log.call_result || '',
            transcript_text: log.transcript_text || '',
            created_at: log.created_at || new Date().toISOString()
          })));
        }
      }
      
      setLoading(false);
    };

    fetchData();
  }, [activeTab]);

  // Fetch messages when selection changes
  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      setCandidate(null);
      setCampaignLeads([]);
      return;
    }

    const fetchMessages = async () => {
      // Get candidate info
      const selectedItem = activeTab === 'sms' 
        ? conversations.find(c => c.id === selectedId)
        : callLogs.find(c => c.id === selectedId);
      
      if (!selectedItem) return;

      // Fetch candidate details
      if (selectedItem.candidate_id) {
        const { data: candidateData } = await supabase
          .from('candidates')
          .select('*')
          .eq('id', selectedItem.candidate_id)
          .single();
        
        if (candidateData) {
          setCandidate({
            id: candidateData.id,
            first_name: candidateData.first_name || '',
            last_name: candidateData.last_name || '',
            specialty: candidateData.specialty || '',
            phone: candidateData.phone || '',
            email: candidateData.email || '',
            personal_mobile: candidateData.personal_mobile || '',
            city: candidateData.city || '',
            state: candidateData.state || '',
            licenses: candidateData.licenses || [],
            enrichment_tier: candidateData.enrichment_tier || ''
          });

          // Fetch campaign leads
          const { data: leadsData } = await supabase
            .from('campaign_leads_v2')
            .select('id, campaign_id, status, campaigns(name)')
            .eq('candidate_id', candidateData.id)
            .limit(5);
          
          if (leadsData) {
            setCampaignLeads(leadsData.map((lead: any) => ({
              id: lead.id,
              campaign_id: lead.campaign_id,
              campaign_name: lead.campaigns?.name || 'Unknown Campaign',
              status: lead.status || 'active'
            })));
          }
        }
      }

      // Fetch call logs for this phone number to build message history
      const { data: callData } = await supabase
        .from('ai_call_logs')
        .select('*')
        .eq('phone_number', selectedItem.phone_number)
        .order('created_at', { ascending: true });
      
      if (callData) {
        const msgs: Message[] = callData.map(log => ({
          id: log.id,
          type: 'call' as const,
          direction: log.call_type === 'inbound' ? 'inbound' as const : 'outbound' as const,
          content: log.call_summary || 'Call completed',
          timestamp: log.created_at || new Date().toISOString(),
          duration_seconds: log.duration_seconds || 0,
          call_result: log.call_result || '',
          transcript_text: log.transcript_text || ''
        }));
        setMessages(msgs);
      }
    };

    fetchMessages();
  }, [selectedId, activeTab, conversations, callLogs]);

  const handleCall = () => {
    if (!candidate?.phone && !candidate?.personal_mobile) {
      toast.error('No phone number available');
      return;
    }
    const phoneNumber = candidate.personal_mobile || candidate.phone;
    twilioDevice.makeCall(phoneNumber, '+18001234567');
    toast.success('Initiating call...');
  };

  const handleSendSMS = async () => {
    if (!replyText.trim() || !candidate?.phone) return;
    
    setSending(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sms-campaign-send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          to: candidate.personal_mobile || candidate.phone,
          message: replyText
        })
      });

      if (response.ok) {
        toast.success('SMS sent successfully');
        setReplyText('');
        // Add to messages
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          type: 'sms',
          direction: 'outbound',
          content: replyText,
          timestamp: new Date().toISOString()
        }]);
      } else {
        toast.error('Failed to send SMS');
      }
    } catch (error) {
      toast.error('Failed to send SMS');
    }
    setSending(false);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getCallStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <PhoneCall className="h-4 w-4 text-green-500" />;
      case 'missed':
      case 'no-answer':
        return <PhoneMissed className="h-4 w-4 text-red-500" />;
      case 'voicemail':
        return <Phone className="h-4 w-4 text-yellow-500" />;
      default:
        return <Phone className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const filteredConversations = conversations.filter(c =>
    c.candidate_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone_number.includes(searchQuery)
  );

  const filteredCallLogs = callLogs.filter(c =>
    c.candidate_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone_number.includes(searchQuery)
  );

  const selectedItem = activeTab === 'sms'
    ? conversations.find(c => c.id === selectedId)
    : callLogs.find(c => c.id === selectedId);

  return (
    <Layout>
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
        {/* LEFT COLUMN - Conversations List */}
        <div className="w-[280px] border-r border-border flex flex-col bg-card">
          {/* Tab Toggle */}
          <div className="p-3 border-b border-border">
            <div className="flex rounded-lg bg-muted p-1">
              <button
                onClick={() => setActiveTab('sms')}
                className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'sms' 
                    ? 'bg-background text-foreground shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                💬 SMS
              </button>
              <button
                onClick={() => setActiveTab('calls')}
                className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'calls' 
                    ? 'bg-background text-foreground shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                📞 Calls
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* List */}
          <ScrollArea className="flex-1">
            {loading ? (
              <div className="p-4 text-center text-muted-foreground">Loading...</div>
            ) : activeTab === 'sms' ? (
              filteredConversations.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">No conversations</div>
              ) : (
                filteredConversations.map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => setSelectedId(conv.id)}
                    className={`p-3 cursor-pointer border-b border-border/50 hover:bg-muted/50 transition-colors ${
                      selectedId === conv.id ? 'bg-primary/10 border-l-2 border-l-primary' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{conv.candidate_name}</span>
                          {conv.unread_count > 0 && (
                            <Badge variant="destructive" className="h-5 w-5 p-0 flex items-center justify-center text-xs">
                              {conv.unread_count}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {conv.last_message}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                ))
              )
            ) : (
              filteredCallLogs.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">No calls</div>
              ) : (
                filteredCallLogs.map((call) => (
                  <div
                    key={call.id}
                    onClick={() => setSelectedId(call.id)}
                    className={`p-3 cursor-pointer border-b border-border/50 hover:bg-muted/50 transition-colors ${
                      selectedId === call.id ? 'bg-primary/10 border-l-2 border-l-primary' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {getCallStatusIcon(call.status)}
                          <span className="font-medium text-sm truncate">{call.candidate_name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDuration(call.duration_seconds)} • {call.call_result || 'Completed'}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(call.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                ))
              )
            )}
          </ScrollArea>
        </div>

        {/* MIDDLE COLUMN - Conversation View */}
        <div className="flex-1 flex flex-col bg-background">
          {!selectedItem ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Select a conversation to view</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="p-4 border-b border-border bg-card">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-lg">
                      {selectedItem.candidate_name}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {selectedItem.phone_number}
                      {candidate?.specialty && ` • ${candidate.specialty}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleCall}
                      disabled={twilioDevice.isConnecting || !!twilioDevice.currentCall}
                    >
                      <Phone className="h-4 w-4 mr-1" />
                      Call
                    </Button>
                    <Button variant="outline" size="sm">
                      <MessageSquare className="h-4 w-4 mr-1" />
                      SMS
                    </Button>
                    <Button variant="outline" size="sm">
                      <Mail className="h-4 w-4 mr-1" />
                      Email
                    </Button>
                  </div>
                </div>
              </div>

              {/* Messages Area */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <div key={msg.id}>
                      {msg.type === 'sms' ? (
                        <div className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[70%] rounded-lg px-4 py-2 ${
                            msg.direction === 'outbound'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}>
                            <p className="text-sm">{msg.content}</p>
                            <p className={`text-xs mt-1 ${
                              msg.direction === 'outbound' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                            }`}>
                              {formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-card border border-border rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium text-sm">
                              {msg.direction === 'outbound' ? 'Outbound Call' : 'Inbound Call'}
                            </span>
                            <Badge variant="outline" className="ml-auto">
                              {formatDuration(msg.duration_seconds || 0)}
                            </Badge>
                          </div>
                          {msg.call_result && (
                            <p className="text-sm text-muted-foreground mb-2">
                              Outcome: {msg.call_result}
                            </p>
                          )}
                          {msg.content && (
                            <p className="text-sm">{msg.content}</p>
                          )}
                          {msg.transcript_text && (
                            <details className="mt-2">
                              <summary className="text-xs text-primary cursor-pointer">
                                View transcript
                              </summary>
                              <p className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap">
                                {msg.transcript_text}
                              </p>
                            </details>
                          )}
                          <p className="text-xs text-muted-foreground mt-2">
                            {formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true })}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Reply Composer */}
              <div className="p-4 border-t border-border bg-card">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Textarea
                      placeholder="Type your message..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      className="min-h-[80px] resize-none pr-16"
                      maxLength={160}
                    />
                    <span className="absolute bottom-2 right-2 text-xs text-muted-foreground">
                      {replyText.length}/160
                    </span>
                  </div>
                  <Button
                    onClick={handleSendSMS}
                    disabled={!replyText.trim() || sending}
                    className="self-end"
                  >
                    Send SMS
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* RIGHT COLUMN - Candidate Info */}
        <div className="w-[300px] border-l border-border bg-card overflow-auto">
          {!candidate ? (
            <div className="p-6 text-center text-muted-foreground">
              <p className="text-sm">Select a conversation to view candidate details</p>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {/* Photo Placeholder */}
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center text-3xl">
                  👤
                </div>
                <h3 className="font-semibold text-lg mt-3">
                  {candidate.first_name} {candidate.last_name}
                </h3>
                <p className="text-sm text-muted-foreground">{candidate.specialty}</p>
              </div>

              <Separator />

              {/* Contact Info */}
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Contact
                </h4>
                <div className="space-y-1 text-sm">
                  <p>📱 {candidate.phone || 'N/A'}</p>
                  <p>📞 {candidate.personal_mobile || 'N/A'}</p>
                  <p>✉️ {candidate.email || 'N/A'}</p>
                </div>
              </div>

              <Separator />

              {/* Location */}
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Location
                </h4>
                <p className="text-sm">
                  📍 {candidate.city && candidate.state 
                    ? `${candidate.city}, ${candidate.state}` 
                    : 'Location not specified'}
                </p>
              </div>

              <Separator />

              {/* Licenses */}
              {candidate.licenses && candidate.licenses.length > 0 && (
                <>
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Licenses
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {candidate.licenses.map((license, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {license}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* Enrichment Tier */}
              {candidate.enrichment_tier && (
                <>
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Tier
                    </h4>
                    <Badge className={
                      candidate.enrichment_tier === 'platinum' ? 'bg-purple-500' :
                      candidate.enrichment_tier === 'gold' ? 'bg-yellow-500' :
                      candidate.enrichment_tier === 'silver' ? 'bg-gray-400' : ''
                    }>
                      {candidate.enrichment_tier}
                    </Badge>
                  </div>
                  <Separator />
                </>
              )}

              {/* View Profile Link */}
              <Link
                to={`/candidates/search?candidateId=${candidate.id}`}
                className="flex items-center justify-center gap-2 text-sm text-primary hover:underline"
              >
                View Full Profile
                <ExternalLink className="h-3 w-3" />
              </Link>

              {/* Recent Campaigns */}
              {campaignLeads.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Recent Campaigns
                    </h4>
                    <div className="space-y-2">
                      {campaignLeads.map((lead) => (
                        <Link
                          key={lead.id}
                          to={`/campaigns/${lead.campaign_id}`}
                          className="block p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors"
                        >
                          <p className="text-sm font-medium">{lead.campaign_name}</p>
                          <Badge variant="outline" className="text-xs mt-1">
                            {lead.status}
                          </Badge>
                        </Link>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Floating Call Widget */}
      {twilioDevice.currentCall && (
        <div className={`fixed bottom-6 right-6 bg-card border border-border rounded-xl shadow-lg transition-all ${
          callWidgetMinimized ? 'w-[200px]' : 'w-[320px]'
        }`}>
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                <span className="font-medium text-sm">
                  {callWidgetMinimized ? 'On Call' : 'Active Call'}
                </span>
              </div>
              <button
                onClick={() => setCallWidgetMinimized(!callWidgetMinimized)}
                className="p-1 hover:bg-muted rounded"
              >
                {callWidgetMinimized ? (
                  <Maximize2 className="h-4 w-4" />
                ) : (
                  <Minimize2 className="h-4 w-4" />
                )}
              </button>
            </div>

            {!callWidgetMinimized && (
              <>
                <p className="text-sm text-muted-foreground mb-2">
                  {selectedItem?.candidate_name || 'Unknown'}
                </p>
                <p className="text-2xl font-mono text-center mb-4">
                  {formatDuration(twilioDevice.callDuration)}
                </p>
              </>
            )}

            <div className={`flex items-center ${callWidgetMinimized ? 'gap-2' : 'justify-center gap-4'}`}>
              <Button
                variant="outline"
                size={callWidgetMinimized ? 'sm' : 'default'}
                onClick={twilioDevice.toggleMute}
                className={twilioDevice.isMuted ? 'bg-yellow-500/20' : ''}
              >
                {twilioDevice.isMuted ? (
                  <MicOff className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </Button>
              
              {!callWidgetMinimized && (
                <Button
                  variant="outline"
                  onClick={twilioDevice.toggleHold}
                  className={twilioDevice.isOnHold ? 'bg-yellow-500/20' : ''}
                >
                  {twilioDevice.isOnHold ? (
                    <Play className="h-4 w-4" />
                  ) : (
                    <Pause className="h-4 w-4" />
                  )}
                </Button>
              )}

              <Button
                variant="destructive"
                size={callWidgetMinimized ? 'sm' : 'default'}
                onClick={twilioDevice.hangUp}
              >
                <PhoneOff className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { formatPhoneNumber } from '@/lib/formatPhone';

interface SoftphoneSMSProps {
  unreadCount?: number;
}

export const SoftphoneSMS = ({ unreadCount = 0 }: SoftphoneSMSProps) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const queryClient = useQueryClient();

  // Fetch recent conversations - uses same base query key as Communications Hub
  const { data: recentConversations = [], refetch } = useQuery({
    queryKey: ['sms-conversations-softphone'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sms_conversations')
        .select('id, contact_name, candidate_phone, last_message_preview, last_message_at, unread_count')
        .order('last_message_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data || [];
    },
  });

  // Real-time subscription to sync with Communications Hub
  useEffect(() => {
    const channel = supabase
      .channel("softphone-sms-sync")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sms_conversations",
        },
        () => {
          console.log("[Softphone] Conversation update - syncing");
          refetch();
          // Also invalidate the main Communications Hub queries
          queryClient.invalidateQueries({ queryKey: ['sms-conversations'] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "sms_messages",
        },
        () => {
          console.log("[Softphone] New message - syncing");
          refetch();
          queryClient.invalidateQueries({ queryKey: ['sms-conversations'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch, queryClient]);

  const handleSend = async () => {
    if (!phoneNumber || !message) {
      toast.error('Please enter phone number and message');
      return;
    }

    setSending(true);
    try {
      // Use supabase.functions.invoke for authenticated request
      const { data, error } = await supabase.functions.invoke('sms-campaign-send', {
        body: {
          to_phone: phoneNumber,
          custom_message: message,
        },
      });

      if (error) {
        throw error;
      }

      toast.success('SMS sent successfully');
      setPhoneNumber('');
      setMessage('');
      
      // Refresh both softphone and Communications Hub queries
      refetch();
      queryClient.invalidateQueries({ queryKey: ['sms-conversations'] });
    } catch (error) {
      console.error('Error sending SMS:', error);
      toast.error('Failed to send SMS');
    } finally {
      setSending(false);
    }
  };

  const formatTimeAgo = (timestamp: string | null) => {
    if (!timestamp) return '';
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: false });
    } catch {
      return '';
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Unread Badge */}
      {unreadCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 border-b border-slate-700/50">
          <MessageSquare className="h-4 w-4 text-primary" />
          <span className="text-xs text-slate-200">
            {unreadCount} unread message{unreadCount > 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Quick Compose */}
      <div className="p-3 space-y-2 border-b border-slate-700/50">
        <div>
          <label className="text-[10px] text-slate-500 uppercase">To:</label>
          <Input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+1 (555) 555-5555"
            className="mt-0.5 h-8 text-sm bg-slate-800 border-slate-700 text-slate-100"
          />
        </div>

        <div>
          <label className="text-[10px] text-slate-500 uppercase">Message:</label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
            className="mt-0.5 bg-slate-800 border-slate-700 text-slate-100 min-h-[60px] text-sm resize-none"
            maxLength={160}
          />
          <p className="text-[10px] text-slate-500 mt-0.5 text-right">
            {message.length}/160
          </p>
        </div>

        <Button
          onClick={handleSend}
          disabled={sending || !phoneNumber || !message}
          size="sm"
          className="w-full bg-primary hover:bg-primary/90"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          {sending ? 'Sending...' : 'Send SMS'}
        </Button>
      </div>

      {/* Recent Conversations */}
      <div className="flex-1 overflow-hidden">
        <p className="text-[10px] text-slate-500 uppercase px-3 py-2">Recent Conversations</p>
        <ScrollArea className="h-[calc(100%-24px)]">
          {recentConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-500">
              <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-xs">No recent conversations</p>
            </div>
          ) : (
            <div className="space-y-0.5 px-1">
              {recentConversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setPhoneNumber(conv.candidate_phone)}
                  className="w-full flex items-start gap-2 p-2 rounded-lg hover:bg-slate-800 text-left transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium text-slate-200 truncate">
                        {conv.contact_name || formatPhoneNumber(conv.candidate_phone)}
                      </p>
                      {conv.unread_count > 0 && (
                        <span className="min-w-4 h-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">
                      {conv.last_message_preview}
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-500 shrink-0">
                    {formatTimeAgo(conv.last_message_at)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
};

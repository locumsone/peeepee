import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, Send } from 'lucide-react';
import { toast } from 'sonner';

interface SoftphoneSMSProps {
  unreadCount?: number;
}

export const SoftphoneSMS = ({ unreadCount = 0 }: SoftphoneSMSProps) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!phoneNumber || !message) {
      toast.error('Please enter phone number and message');
      return;
    }

    setSending(true);
    try {
      const response = await fetch(
        'https://qpvyzyspwxwtwjhfcuhh.supabase.co/functions/v1/sms-campaign-send',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: phoneNumber,
            message,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to send SMS');
      }

      toast.success('SMS sent successfully');
      setPhoneNumber('');
      setMessage('');
    } catch (error) {
      console.error('Error sending SMS:', error);
      toast.error('Failed to send SMS');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Unread Badge */}
      {unreadCount > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10">
          <MessageSquare className="h-5 w-5 text-primary" />
          <span className="text-sm text-foreground">
            {unreadCount} unread message{unreadCount > 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Quick Compose */}
      <div className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground">To:</label>
          <Input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+1 (555) 555-5555"
            className="mt-1 bg-muted/30 border-border"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Message:</label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
            className="mt-1 bg-muted/30 border-border min-h-[100px]"
            maxLength={160}
          />
          <p className="text-xs text-muted-foreground mt-1 text-right">
            {message.length}/160
          </p>
        </div>

        <Button
          onClick={handleSend}
          disabled={sending || !phoneNumber || !message}
          className="w-full bg-primary hover:bg-primary/90"
        >
          <Send className="h-4 w-4 mr-2" />
          {sending ? 'Sending...' : 'Send SMS'}
        </Button>
      </div>

      {/* Placeholder for conversations list */}
      <div className="mt-6">
        <h4 className="text-xs font-medium text-muted-foreground mb-3">Recent Conversations</h4>
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <MessageSquare className="h-10 w-10 mb-2 opacity-50" />
          <p className="text-sm">No recent conversations</p>
        </div>
      </div>
    </div>
  );
};

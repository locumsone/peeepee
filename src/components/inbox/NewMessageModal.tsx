import { MessageSquare, Phone, Bot } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface NewMessageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const NewMessageModal = ({ open, onOpenChange }: NewMessageModalProps) => {
  const channels = [
    {
      id: "sms",
      label: "Send SMS",
      description: "Send a text message to a candidate",
      icon: MessageSquare,
      color: "bg-accent/20 text-accent",
    },
    {
      id: "call",
      label: "Make Call",
      description: "Call a candidate directly",
      icon: Phone,
      color: "bg-success/20 text-success",
    },
    {
      id: "ai_call",
      label: "AI Call",
      description: "Schedule an AI-powered outreach call",
      icon: Bot,
      color: "bg-primary/20 text-primary",
    },
  ];

  const handleChannelSelect = (channelId: string) => {
    // TODO: Implement channel-specific flows
    console.log("Selected channel:", channelId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">New Message</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-4">
          {channels.map((channel) => (
            <Button
              key={channel.id}
              variant="outline"
              className="h-auto p-4 justify-start gap-4 hover:bg-muted"
              onClick={() => handleChannelSelect(channel.id)}
            >
              <div className={`p-2.5 rounded-lg ${channel.color}`}>
                <channel.icon className="h-5 w-5" />
              </div>
              <div className="text-left">
                <div className="font-medium text-foreground">{channel.label}</div>
                <div className="text-sm text-muted-foreground">
                  {channel.description}
                </div>
              </div>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

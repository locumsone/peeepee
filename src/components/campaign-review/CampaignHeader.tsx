import { ArrowLeft, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CampaignHeaderProps {
  campaignName: string;
  onCampaignNameChange: (name: string) => void;
  onStartOver: () => void;
  onBack: () => void;
}

export function CampaignHeader({
  campaignName,
  onCampaignNameChange,
  onStartOver,
  onBack,
}: CampaignHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Review & Launch</h1>
          <p className="text-sm text-muted-foreground">
            Final review before launching your campaign
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="campaign-name" className="text-sm text-muted-foreground whitespace-nowrap">
            Campaign Name:
          </Label>
          <Input
            id="campaign-name"
            value={campaignName}
            onChange={(e) => onCampaignNameChange(e.target.value)}
            placeholder="Enter campaign name..."
            className="w-64 bg-card border-border"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onStartOver}
          className="text-muted-foreground"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Start Over
        </Button>
      </div>
    </div>
  );
}

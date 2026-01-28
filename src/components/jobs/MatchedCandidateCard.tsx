import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Phone, MessageSquare, User, MapPin, Award, CheckCircle, AlertCircle, 
  X, AlertTriangle, Sparkles 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface MatchedCandidate {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  specialty: string | null;
  state: string | null;
  licenses: string[] | null;
  board_certified: boolean | null;
  match_score: number | null;
  match_reasons: string[] | null;
  match_concerns: string[] | null;
  matched_at: string | null;
}

interface MatchedCandidateCardProps {
  candidate: MatchedCandidate;
  requiredState?: string;
  onAddToCampaign?: (candidateId: string) => void;
  onRemove?: (candidateId: string) => void;
  isSelected?: boolean;
  onSelect?: (candidateId: string, selected: boolean) => void;
  showActions?: boolean;
}

export const MatchedCandidateCard = ({
  candidate,
  requiredState,
  onAddToCampaign,
  onRemove,
  isSelected = false,
  onSelect,
  showActions = true,
}: MatchedCandidateCardProps) => {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);

  const fullName = [candidate.first_name, candidate.last_name]
    .filter(Boolean)
    .join(" ") || "Unknown";

  const hasRequiredLicense = requiredState && candidate.licenses?.some(
    (lic) => lic.toLowerCase().includes(requiredState.toLowerCase())
  );

  const matchScoreColor = candidate.match_score 
    ? candidate.match_score >= 80 
      ? "text-success" 
      : candidate.match_score >= 60 
        ? "text-warning" 
        : "text-muted-foreground"
    : "text-muted-foreground";

  const hasConcerns = candidate.match_concerns && candidate.match_concerns.length > 0;

  return (
    <TooltipProvider>
      <Card 
        className={cn(
          "group transition-all border-border hover:border-primary/40 cursor-pointer relative",
          isHovered && "ring-1 ring-primary/20",
          isSelected && "ring-2 ring-primary border-primary/60"
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Selection Checkbox */}
        {onSelect && (
          <div 
            className={cn(
              "absolute top-3 right-3 z-10 transition-opacity",
              isHovered || isSelected ? "opacity-100" : "opacity-0"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked) => onSelect(candidate.id, !!checked)}
            />
          </div>
        )}

        {/* Remove Button */}
        {onRemove && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "absolute top-3 right-3 h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 z-10 transition-opacity",
                  onSelect ? "right-10" : "right-3",
                  isHovered ? "opacity-100" : "opacity-0"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(candidate.id);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Remove Match</TooltipContent>
          </Tooltip>
        )}

        <CardContent className="p-4">
          {/* Header Row */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0 pr-8">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-foreground truncate">
                  {fullName}
                </h3>
                {candidate.match_score && (
                  <Badge variant="outline" className={cn("font-mono shrink-0", matchScoreColor)}>
                    <Sparkles className="h-3 w-3 mr-1" />
                    {candidate.match_score}%
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {candidate.specialty && (
                  <span className="truncate">{candidate.specialty}</span>
                )}
                {candidate.state && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1 shrink-0">
                      <MapPin className="h-3 w-3" />
                      {candidate.state}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Board Certified Badge */}
            {candidate.board_certified && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="secondary" className="text-xs shrink-0">
                    <Award className="h-3 w-3 mr-1" />
                    BC
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>Board Certified</TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* License Status */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {hasRequiredLicense ? (
              <Badge variant="outline" className="text-success border-success/30 text-xs">
                <CheckCircle className="h-3 w-3 mr-1" />
                {requiredState} Licensed
              </Badge>
            ) : requiredState ? (
              <Badge variant="outline" className="text-warning border-warning/30 text-xs">
                <AlertCircle className="h-3 w-3 mr-1" />
                No {requiredState} License
              </Badge>
            ) : null}
            
            {candidate.licenses && candidate.licenses.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {candidate.licenses.length} license{candidate.licenses.length !== 1 ? "s" : ""}
              </span>
            )}

            {hasConcerns && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="text-warning border-warning/30 text-xs">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {candidate.match_concerns!.length} concern{candidate.match_concerns!.length !== 1 ? "s" : ""}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <ul className="text-xs space-y-1">
                    {candidate.match_concerns!.map((c, i) => (
                      <li key={i}>• {c}</li>
                    ))}
                  </ul>
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Match Reasons */}
          {candidate.match_reasons && candidate.match_reasons.length > 0 && (
            <div className="mb-3">
              <div className="flex flex-wrap gap-1">
                {candidate.match_reasons.slice(0, 3).map((reason, i) => (
                  <Badge key={i} variant="secondary" className="text-xs font-normal">
                    {reason}
                  </Badge>
                ))}
                {candidate.match_reasons.length > 3 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="text-xs cursor-help">
                        +{candidate.match_reasons.length - 3}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <ul className="text-xs space-y-1">
                        {candidate.match_reasons.slice(3).map((r, i) => (
                          <li key={i}>• {r}</li>
                        ))}
                      </ul>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
          )}

          {/* Actions - Always visible on mobile, hover on desktop */}
          {showActions && (
            <div className={cn(
              "flex items-center gap-2 transition-opacity",
              "md:opacity-0 md:group-hover:opacity-100 opacity-100"
            )}>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/communications?phone=${candidate.phone}`);
                }}
                disabled={!candidate.phone}
              >
                <Phone className="h-3 w-3 mr-1" />
                Call
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/communications?phone=${candidate.phone}`);
                }}
                disabled={!candidate.phone}
              >
                <MessageSquare className="h-3 w-3 mr-1" />
                SMS
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  // Navigate to candidate profile
                }}
              >
                <User className="h-3 w-3 mr-1" />
                Profile
              </Button>
              {onAddToCampaign && (
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddToCampaign(candidate.id);
                  }}
                  className="ml-auto"
                >
                  Add to Campaign
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};

export default MatchedCandidateCard;

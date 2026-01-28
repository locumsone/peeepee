import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Phone, MessageSquare, User, MapPin, Award, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
}

export const MatchedCandidateCard = ({
  candidate,
  requiredState,
  onAddToCampaign,
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

  return (
    <TooltipProvider>
      <Card 
        className={cn(
          "group transition-all border-border hover:border-primary/40 cursor-pointer",
          isHovered && "ring-1 ring-primary/20"
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <CardContent className="p-4">
          {/* Header Row */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-foreground truncate">
                  {fullName}
                </h3>
                {candidate.match_score && (
                  <Badge variant="outline" className={cn("font-mono", matchScoreColor)}>
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
                    <span className="flex items-center gap-1">
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
                <TooltipTrigger>
                  <Badge variant="secondary" className="text-xs">
                    <Award className="h-3 w-3 mr-1" />
                    BC
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>Board Certified</TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* License Status */}
          <div className="flex items-center gap-2 mb-3">
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
                  <Badge variant="outline" className="text-xs">
                    +{candidate.match_reasons.length - 3}
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className={cn(
            "flex items-center gap-2 transition-opacity",
            isHovered ? "opacity-100" : "opacity-0"
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
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};

export default MatchedCandidateCard;

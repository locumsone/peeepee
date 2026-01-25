import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  DollarSign, MapPin, Clock, Calendar, Phone, Building2, 
  ChevronDown, ChevronUp, Target, Lightbulb, MessageSquare,
  AlertTriangle, RefreshCw, CheckCircle2, XCircle, Briefcase, FileText
} from "lucide-react";
import { cn } from "@/lib/utils";

// Structured playbook cache interface
export interface StructuredPlaybookCache {
  notion_id: string;
  notion_url?: string;
  title: string;
  synced_at: string;
  content_length: number;
  
  compensation: {
    hourly: string | null;
    daily: string | null;
    weekly: string | null;
    annual: string | null;
    salary_range: string | null;
  };
  
  position: {
    title: string | null;
    facility_name: string | null;
    facility_type: string | null;
    location_city: string | null;
    location_state: string | null;
    location_metro: string | null;
    contract_type: string | null;
  };
  
  clinical: {
    procedures: string | null;
    case_types: string | null;
    case_mix: string | null;
    volume: string | null;
    call_status: string | null;
    schedule_days: string | null;
    schedule_hours: string | null;
    duration: string | null;
    tech_stack: string | null;
  };
  
  credentialing: {
    required_license: string | null;
    days_to_credential: number | null;
    temps_available: boolean | null;
    requirements: string | null;
  };
  
  positioning: {
    selling_points: string | null;
    pain_points_solved: string | null;
    ideal_candidate: string | null;
    differentiators: string | null;
    messaging_tone: string | null;
    objection_responses: string | null;
    facility_context: string | null;
  };
}

interface PlaybookCacheCardProps {
  cache: StructuredPlaybookCache;
  onSync?: () => void;
  isSyncing?: boolean;
}

export function PlaybookCacheCard({ cache, onSync, isSyncing }: PlaybookCacheCardProps) {
  const [isPositioningOpen, setIsPositioningOpen] = useState(false);
  const [isPositionOpen, setIsPositionOpen] = useState(false);
  
  // Calculate cache age
  const syncedAt = new Date(cache.synced_at);
  const now = new Date();
  const ageInDays = Math.floor((now.getTime() - syncedAt.getTime()) / (1000 * 60 * 60 * 24));
  const isStale = ageInDays > 7;
  
  // Validation checks
  const hasCompensation = !!(cache.compensation.hourly || cache.compensation.salary_range);
  const hasPositioning = !!(cache.positioning.selling_points || cache.positioning.differentiators);
  const hasPosition = !!(cache.position.title || cache.position.facility_name || cache.position.facility_type);
  const isReadyForGeneration = hasCompensation;
  
  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            {cache.title}
          </CardTitle>
          <div className="flex items-center gap-2">
            {isStale && (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {ageInDays}d old
              </Badge>
            )}
            {onSync && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onSync}
                disabled={isSyncing}
              >
                <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Quick Facts Section */}
        <div className="grid grid-cols-2 gap-3">
          {/* Rate */}
          <div className="flex items-center gap-2 p-2 rounded-md bg-background/50">
            <DollarSign className="h-4 w-4 text-green-600" />
            <div>
              <div className="text-xs text-muted-foreground">Rate</div>
              <div className="font-semibold text-sm">
                {cache.compensation.hourly || cache.compensation.salary_range || (
                  <span className="text-red-500">Missing</span>
                )}
              </div>
            </div>
          </div>
          
          {/* Call Status */}
          <div className="flex items-center gap-2 p-2 rounded-md bg-background/50">
            <Phone className="h-4 w-4 text-blue-600" />
            <div>
              <div className="text-xs text-muted-foreground">Call</div>
              <div className="font-semibold text-sm">
                {cache.clinical.call_status || "Not specified"}
              </div>
            </div>
          </div>
          
          {/* Location */}
          <div className="flex items-center gap-2 p-2 rounded-md bg-background/50">
            <MapPin className="h-4 w-4 text-purple-600" />
            <div>
              <div className="text-xs text-muted-foreground">Location</div>
              <div className="font-semibold text-sm">
                {cache.position.location_city && cache.position.location_state 
                  ? `${cache.position.location_city}, ${cache.position.location_state}`
                  : cache.position.location_state || "Not specified"}
              </div>
            </div>
          </div>
          
          {/* Credential Time */}
          <div className="flex items-center gap-2 p-2 rounded-md bg-background/50">
            <Calendar className="h-4 w-4 text-orange-600" />
            <div>
              <div className="text-xs text-muted-foreground">Credential</div>
              <div className="font-semibold text-sm">
                {cache.credentialing.days_to_credential 
                  ? `${cache.credentialing.days_to_credential} days`
                  : "Not specified"}
              </div>
            </div>
          </div>
        </div>
        
        {/* Additional Clinical Details */}
        {(cache.clinical.procedures || cache.clinical.duration || cache.clinical.schedule_hours) && (
          <div className="flex flex-wrap gap-1.5">
            {cache.clinical.duration && (
              <Badge variant="outline" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                {cache.clinical.duration}
              </Badge>
            )}
            {cache.clinical.schedule_hours && (
              <Badge variant="outline" className="text-xs">
                {cache.clinical.schedule_hours}
              </Badge>
            )}
            {cache.position.contract_type && (
              <Badge variant="outline" className="text-xs bg-primary/10">
                {cache.position.contract_type}
              </Badge>
            )}
          </div>
        )}
        
        {/* Procedures Preview */}
        {cache.clinical.procedures && (
          <div className="text-xs text-muted-foreground">
            <span className="font-medium">Procedures: </span>
            {cache.clinical.procedures.substring(0, 100)}
            {cache.clinical.procedures.length > 100 && "..."}
          </div>
        )}
        
        {/* Validation Status */}
        <div className="flex items-center gap-2 pt-2 border-t">
          {isReadyForGeneration ? (
            <Badge className="bg-green-500/10 text-green-600 border-green-500/30">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Ready for generation
            </Badge>
          ) : (
            <Badge variant="destructive">
              <XCircle className="h-3 w-3 mr-1" />
              Missing compensation
            </Badge>
          )}
          {!hasPositioning && (
            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
              No positioning content
            </Badge>
          )}
          {!hasPosition && (
            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">
              No position data
            </Badge>
          )}
        </div>
        
        {/* Position Section (Expandable) */}
        {hasPosition && (
          <Collapsible open={isPositionOpen} onOpenChange={setIsPositionOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Position Details
                </span>
                {isPositionOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              {/* Position Title */}
              {cache.position.title && (
                <PositioningItem 
                  icon={<FileText className="h-4 w-4 text-indigo-500" />}
                  label="Position Title"
                  content={cache.position.title}
                />
              )}
              
              {/* Facility Name */}
              {cache.position.facility_name && (
                <PositioningItem 
                  icon={<Building2 className="h-4 w-4 text-blue-500" />}
                  label="Facility"
                  content={cache.position.facility_name}
                />
              )}
              
              {/* Facility Type */}
              {cache.position.facility_type && (
                <PositioningItem 
                  icon={<Target className="h-4 w-4 text-purple-500" />}
                  label="Facility Type"
                  content={cache.position.facility_type}
                />
              )}
              
              {/* Location Metro */}
              {cache.position.location_metro && (
                <PositioningItem 
                  icon={<MapPin className="h-4 w-4 text-green-500" />}
                  label="Metro Area"
                  content={cache.position.location_metro}
                />
              )}
              
              {/* Contract Type */}
              {cache.position.contract_type && (
                <PositioningItem 
                  icon={<Briefcase className="h-4 w-4 text-orange-500" />}
                  label="Contract Type"
                  content={cache.position.contract_type}
                />
              )}
            </CollapsibleContent>
          </Collapsible>
        )}
        
        {/* Positioning Section (Expandable) */}
        {hasPositioning && (
          <Collapsible open={isPositioningOpen} onOpenChange={setIsPositioningOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Positioning Guidance
                </span>
                {isPositioningOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              {/* Selling Points */}
              {cache.positioning.selling_points && (
                <PositioningItem 
                  icon={<Lightbulb className="h-4 w-4 text-yellow-500" />}
                  label="Selling Points"
                  content={cache.positioning.selling_points}
                />
              )}
              
              {/* Ideal Candidate */}
              {cache.positioning.ideal_candidate && (
                <PositioningItem 
                  icon={<Target className="h-4 w-4 text-blue-500" />}
                  label="Ideal Candidate"
                  content={cache.positioning.ideal_candidate}
                />
              )}
              
              {/* Messaging Tone */}
              {cache.positioning.messaging_tone && (
                <PositioningItem 
                  icon={<MessageSquare className="h-4 w-4 text-green-500" />}
                  label="Messaging Tone"
                  content={cache.positioning.messaging_tone}
                />
              )}
              
              {/* Differentiators */}
              {cache.positioning.differentiators && (
                <PositioningItem 
                  icon={<Target className="h-4 w-4 text-purple-500" />}
                  label="Differentiators"
                  content={cache.positioning.differentiators}
                />
              )}
              
              {/* Objection Responses */}
              {cache.positioning.objection_responses && (
                <PositioningItem 
                  icon={<MessageSquare className="h-4 w-4 text-orange-500" />}
                  label="Objection Responses"
                  content={cache.positioning.objection_responses}
                />
              )}
            </CollapsibleContent>
          </Collapsible>
        )}
        
        {/* Metadata */}
        <div className="text-xs text-muted-foreground pt-2 border-t flex items-center justify-between">
          <span>
            Synced {syncedAt.toLocaleDateString()} at {syncedAt.toLocaleTimeString()}
          </span>
          <span>
            {cache.content_length.toLocaleString()} chars → {Math.round(JSON.stringify(cache).length / 1000)}KB cache
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// Helper component for positioning items
function PositioningItem({ 
  icon, 
  label, 
  content 
}: { 
  icon: React.ReactNode; 
  label: string; 
  content: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const preview = content.substring(0, 100);
  const hasMore = content.length > 100;
  
  return (
    <div className="p-2 rounded-md bg-background/50 space-y-1">
      <div className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {label}
      </div>
      <div className="text-xs text-muted-foreground">
        {isExpanded ? content : preview}
        {hasMore && !isExpanded && "..."}
        {hasMore && (
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="ml-1 text-primary hover:underline"
          >
            {isExpanded ? "less" : "more"}
          </button>
        )}
      </div>
    </div>
  );
}

export default PlaybookCacheCard;

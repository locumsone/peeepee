import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface TeamMember {
  id: string;
  user_id: string;
  role: "primary" | "support";
  users?: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
}

interface TeamMemberAvatarsProps {
  assignments: TeamMember[];
  maxVisible?: number;
  size?: "sm" | "md" | "lg";
  showRoleBorder?: boolean;
}

const sizeClasses = {
  sm: "h-6 w-6 text-xs",
  md: "h-8 w-8 text-sm",
  lg: "h-10 w-10 text-base",
};

const getInitials = (name: string | null | undefined, email: string | null | undefined): string => {
  if (name) {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
  if (email) {
    return email.substring(0, 2).toUpperCase();
  }
  return "??";
};

const getAvatarColor = (id: string): string => {
  const colors = [
    "bg-blue-500",
    "bg-green-500",
    "bg-purple-500",
    "bg-orange-500",
    "bg-pink-500",
    "bg-teal-500",
    "bg-indigo-500",
    "bg-rose-500",
  ];
  const hash = id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

export const TeamMemberAvatars = ({
  assignments,
  maxVisible = 3,
  size = "md",
  showRoleBorder = true,
}: TeamMemberAvatarsProps) => {
  if (assignments.length === 0) return null;

  const visibleMembers = assignments.slice(0, maxVisible);
  const remainingCount = assignments.length - maxVisible;

  // Sort to show primary first
  const sorted = [...visibleMembers].sort((a, b) => 
    a.role === "primary" ? -1 : b.role === "primary" ? 1 : 0
  );

  return (
    <TooltipProvider>
      <div className="flex items-center -space-x-2">
        {sorted.map((assignment, index) => {
          const user = assignment.users;
          const displayName = user?.name || user?.email || "Unknown";
          const initials = getInitials(user?.name, user?.email);
          const isPrimary = assignment.role === "primary";

          return (
            <Tooltip key={assignment.id}>
              <TooltipTrigger asChild>
                <Avatar
                  className={cn(
                    sizeClasses[size],
                    "border-2 border-background cursor-default transition-transform hover:scale-110 hover:z-10",
                    showRoleBorder && isPrimary && "ring-2 ring-success ring-offset-1 ring-offset-background",
                    showRoleBorder && !isPrimary && "ring-1 ring-muted-foreground/30"
                  )}
                  style={{ zIndex: visibleMembers.length - index }}
                >
                  <AvatarFallback 
                    className={cn(
                      "text-white font-medium",
                      getAvatarColor(assignment.user_id)
                    )}
                  >
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <div className="font-medium">{displayName}</div>
                <div className="text-muted-foreground capitalize">
                  {assignment.role} recruiter
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
        
        {remainingCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Avatar
                className={cn(
                  sizeClasses[size],
                  "border-2 border-background bg-muted cursor-default"
                )}
              >
                <AvatarFallback className="bg-muted text-muted-foreground text-xs font-medium">
                  +{remainingCount}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {remainingCount} more team member{remainingCount > 1 ? "s" : ""}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
};

export default TeamMemberAvatars;

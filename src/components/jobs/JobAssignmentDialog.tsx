import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, UserPlus, Crown, Users } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

interface User {
  id: string;
  name: string | null;
  email: string | null;
}

interface Assignment {
  user_id: string;
  role: "primary" | "support";
}

interface JobAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  jobName: string;
  currentAssignments: Assignment[];
  onAssignmentsUpdated: () => void;
}

const getInitials = (name: string | null, email: string | null): string => {
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

export const JobAssignmentDialog = ({
  open,
  onOpenChange,
  jobId,
  jobName,
  currentAssignments,
  onAssignmentsUpdated,
}: JobAssignmentDialogProps) => {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Map<string, "primary" | "support">>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      fetchUsers();
      // Initialize selected users from current assignments
      const map = new Map<string, "primary" | "support">();
      currentAssignments.forEach((a) => map.set(a.user_id, a.role));
      setSelectedUsers(map);
    }
  }, [open, currentAssignments]);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      // Only fetch actual app users (@locums.one), not email sending accounts
      const { data, error } = await supabase
        .from("users")
        .select("id, name, email")
        .like("email", "%@locums.one")
        .order("name");

      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error("Error fetching users:", err);
      toast({
        title: "Error",
        description: "Failed to load team members",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleUser = (userId: string) => {
    const newMap = new Map(selectedUsers);
    if (newMap.has(userId)) {
      newMap.delete(userId);
    } else {
      newMap.set(userId, "support");
    }
    setSelectedUsers(newMap);
  };

  const toggleRole = (userId: string) => {
    const newMap = new Map(selectedUsers);
    const currentRole = newMap.get(userId);
    if (currentRole === "primary") {
      newMap.set(userId, "support");
    } else {
      // When setting as primary, demote current primary to support
      newMap.forEach((role, uid) => {
        if (role === "primary") {
          newMap.set(uid, "support");
        }
      });
      newMap.set(userId, "primary");
    }
    setSelectedUsers(newMap);
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);

    try {
      // Get current assignments to determine what to add/remove
      const currentUserIds = new Set(currentAssignments.map((a) => a.user_id));
      const newUserIds = new Set(selectedUsers.keys());

      // Users to remove
      const toRemove = [...currentUserIds].filter((uid) => !newUserIds.has(uid));
      
      // Users to add or update
      const toUpsert = [...selectedUsers.entries()].map(([userId, role]) => ({
        job_id: jobId,
        user_id: userId,
        role,
        assigned_by: user.id,
      }));

      // Remove assignments
      if (toRemove.length > 0) {
        const { error: deleteError } = await supabase
          .from("job_assignments")
          .delete()
          .eq("job_id", jobId)
          .in("user_id", toRemove);

        if (deleteError) throw deleteError;
      }

      // Upsert new/updated assignments
      if (toUpsert.length > 0) {
        const { error: upsertError } = await supabase
          .from("job_assignments")
          .upsert(toUpsert, { onConflict: "job_id,user_id" });

        if (upsertError) throw upsertError;
      }

      toast({
        title: "Assignments Updated",
        description: `Team assignments for ${jobName} have been updated.`,
      });

      onAssignmentsUpdated();
      onOpenChange(false);
    } catch (err) {
      console.error("Error saving assignments:", err);
      toast({
        title: "Error",
        description: "Failed to save assignments",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Assign Team Members
          </DialogTitle>
          <DialogDescription>
            Select team members to work on "{jobName}"
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No team members found
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {users.map((u) => {
                const isSelected = selectedUsers.has(u.id);
                const role = selectedUsers.get(u.id);
                const isPrimary = role === "primary";

                return (
                  <div
                    key={u.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                      isSelected
                        ? "border-primary/50 bg-primary/5"
                        : "border-border hover:border-primary/30 hover:bg-muted/50"
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleUser(u.id)}
                    />
                    
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs bg-primary/20 text-primary">
                        {getInitials(u.name, u.email)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {u.name || "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {u.email}
                      </p>
                    </div>

                    {isSelected && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "h-7 gap-1",
                          isPrimary && "text-success"
                        )}
                        onClick={() => toggleRole(u.id)}
                      >
                        {isPrimary ? (
                          <>
                            <Crown className="h-3 w-3" />
                            Primary
                          </>
                        ) : (
                          <>
                            <UserPlus className="h-3 w-3" />
                            Support
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Assignments
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default JobAssignmentDialog;

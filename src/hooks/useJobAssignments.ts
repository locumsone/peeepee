import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface JobAssignment {
  id: string;
  job_id: string;
  user_id: string;
  role: "primary" | "support";
  assigned_at: string;
  users?: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
}

interface UseJobAssignmentsResult {
  assignments: Record<string, JobAssignment[]>;
  isLoading: boolean;
  refetch: () => Promise<void>;
  assignToJob: (jobId: string, role?: "primary" | "support") => Promise<void>;
  unassignFromJob: (jobId: string) => Promise<void>;
  isAssignedToJob: (jobId: string) => boolean;
  getMyRole: (jobId: string) => "primary" | "support" | null;
}

export const useJobAssignments = (jobIds?: string[]): UseJobAssignmentsResult => {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<Record<string, JobAssignment[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchAssignments = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      // Fetch assignments
      let assignmentQuery = supabase
        .from("job_assignments")
        .select("id, job_id, user_id, role, assigned_at")
        .order("assigned_at", { ascending: true });

      if (jobIds && jobIds.length > 0) {
        assignmentQuery = assignmentQuery.in("job_id", jobIds);
      }

      const { data: assignmentsData, error: assignmentError } = await assignmentQuery;

      if (assignmentError) throw assignmentError;

      // Get unique user IDs from assignments
      const userIds = [...new Set((assignmentsData || []).map(a => a.user_id))];
      
      // Fetch user details separately
      let usersMap: Record<string, { id: string; name: string | null; email: string | null }> = {};
      
      if (userIds.length > 0) {
        const { data: usersData, error: usersError } = await supabase
          .from("users")
          .select("id, name, email")
          .in("id", userIds);

        if (!usersError && usersData) {
          usersData.forEach(u => {
            usersMap[u.id] = u;
          });
        }
      }

      // Group by job_id and attach user info
      const grouped: Record<string, JobAssignment[]> = {};
      (assignmentsData || []).forEach((assignment) => {
        const jobId = assignment.job_id;
        if (!grouped[jobId]) {
          grouped[jobId] = [];
        }
        grouped[jobId].push({
          id: assignment.id,
          job_id: assignment.job_id,
          user_id: assignment.user_id,
          role: assignment.role as "primary" | "support",
          assigned_at: assignment.assigned_at,
          users: usersMap[assignment.user_id] || null,
        });
      });

      setAssignments(grouped);
    } catch (err) {
      console.error("Error fetching job assignments:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user, jobIds?.join(",")]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const assignToJob = async (jobId: string, role: "primary" | "support" = "support") => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("job_assignments")
        .upsert({
          job_id: jobId,
          user_id: user.id,
          role,
          assigned_by: user.id,
        }, { onConflict: "job_id,user_id" });

      if (error) throw error;
      await fetchAssignments();
    } catch (err) {
      console.error("Error assigning to job:", err);
      throw err;
    }
  };

  const unassignFromJob = async (jobId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("job_assignments")
        .delete()
        .eq("job_id", jobId)
        .eq("user_id", user.id);

      if (error) throw error;
      await fetchAssignments();
    } catch (err) {
      console.error("Error unassigning from job:", err);
      throw err;
    }
  };

  const isAssignedToJob = (jobId: string): boolean => {
    if (!user) return false;
    const jobAssignments = assignments[jobId] || [];
    return jobAssignments.some((a) => a.user_id === user.id);
  };

  const getMyRole = (jobId: string): "primary" | "support" | null => {
    if (!user) return null;
    const jobAssignments = assignments[jobId] || [];
    const myAssignment = jobAssignments.find((a) => a.user_id === user.id);
    return myAssignment?.role || null;
  };

  return {
    assignments,
    isLoading,
    refetch: fetchAssignments,
    assignToJob,
    unassignFromJob,
    isAssignedToJob,
    getMyRole,
  };
};

export default useJobAssignments;

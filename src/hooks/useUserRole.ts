import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type AppRole = "admin" | "moderator" | "user";

interface UseUserRoleResult {
  role: AppRole | null;
  isAdmin: boolean;
  isModerator: boolean;
  isLoading: boolean;
}

export const useUserRole = (): UseUserRoleResult => {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRole = async () => {
      if (!user) {
        setRole(null);
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          console.error("Error fetching user role:", error);
          setRole(null);
        } else {
          setRole(data?.role as AppRole || null);
        }
      } catch (err) {
        console.error("Error in useUserRole:", err);
        setRole(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRole();
  }, [user?.id]);

  return {
    role,
    isAdmin: role === "admin",
    isModerator: role === "moderator",
    isLoading,
  };
};

export default useUserRole;

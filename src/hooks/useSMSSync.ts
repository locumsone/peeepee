import { useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Centralized SMS synchronization hook
 * Ensures all components stay in sync with the database
 */
export function useSMSSync() {
  const queryClient = useQueryClient();

  const invalidateAll = useCallback(() => {
    console.log("[SMS Sync] Invalidating all SMS queries");
    // Invalidate all possible SMS query keys
    queryClient.invalidateQueries({ queryKey: ["sms-conversations"] });
    queryClient.invalidateQueries({ queryKey: ["sms-conversations-softphone"] });
    queryClient.invalidateQueries({ queryKey: ["sms-messages"] });
  }, [queryClient]);

  const refetchAll = useCallback(async () => {
    console.log("[SMS Sync] Refetching all SMS queries");
    await queryClient.refetchQueries({ queryKey: ["sms-conversations"] });
    await queryClient.refetchQueries({ queryKey: ["sms-conversations-softphone"] });
  }, [queryClient]);

  // Set up real-time subscription
  useEffect(() => {
    console.log("[SMS Sync] Setting up real-time subscription");

    const channel = supabase
      .channel("sms-global-sync")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sms_conversations",
        },
        (payload) => {
          console.log("[SMS Sync] Conversation change:", payload.eventType);
          invalidateAll();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sms_messages",
        },
        (payload) => {
          console.log("[SMS Sync] Message change:", payload.eventType);
          invalidateAll();
        }
      )
      .subscribe((status) => {
        console.log("[SMS Sync] Subscription status:", status);
      });

    return () => {
      console.log("[SMS Sync] Cleaning up subscription");
      supabase.removeChannel(channel);
    };
  }, [invalidateAll]);

  return { invalidateAll, refetchAll };
}

/**
 * Trigger SMS sync from anywhere in the app
 * Use this after sending messages to ensure immediate UI update
 */
export function useSMSSyncTrigger() {
  const queryClient = useQueryClient();

  return useCallback(() => {
    console.log("[SMS Sync] Manual trigger");
    queryClient.invalidateQueries({ queryKey: ["sms-conversations"] });
    queryClient.invalidateQueries({ queryKey: ["sms-conversations-softphone"] });
    queryClient.invalidateQueries({ queryKey: ["sms-messages"] });
  }, [queryClient]);
}

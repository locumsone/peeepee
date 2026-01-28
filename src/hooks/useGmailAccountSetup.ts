import { useEffect } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook to automatically set up Gmail account and signature when user signs in with Google OAuth
 */
export function useGmailAccountSetup(session: Session | null) {
  useEffect(() => {
    if (!session?.user) return;

    const setupGmailAccount = async () => {
      const user = session.user;
      const provider = user.app_metadata?.provider;

      // Only setup for Google OAuth users
      if (provider !== "google") return;

      const email = user.email;
      const fullName = user.user_metadata?.full_name || user.user_metadata?.name || "";
      const firstName = fullName?.split(" ")[0] || "";

      if (!email) return;

      try {
        // Upsert Gmail account
        await supabase.from("gmail_accounts").upsert(
          {
            user_id: user.id,
            email: email,
            display_name: fullName ? `${fullName} - Locums One` : email,
            is_primary: true,
            provider: "google_oauth",
          },
          { onConflict: "user_id,email" }
        );

        // Also create/update user signature if not exists
        const { data: existingSignature } = await supabase
          .from("user_signatures")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!existingSignature) {
          await supabase.from("user_signatures").insert({
            user_id: user.id,
            full_name: fullName,
            first_name: firstName,
            company: "Locums One",
          });
        }
      } catch (err) {
        console.error("Failed to setup Gmail account:", err);
      }
    };

    setupGmailAccount();
  }, [session?.user?.id]);
}

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useGoogleAuth() {
  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
        scopes: "email profile",
      },
    });

    if (error) {
      toast.error(error.message);
      return { error };
    }

    return { error: null };
  };

  return { signInWithGoogle };
}

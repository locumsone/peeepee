import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface GmailAccount {
  id: string;
  email: string;
  display_name: string | null;
  is_primary: boolean;
  provider: string;
}

export function useGmailAccounts() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<GmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [primaryAccount, setPrimaryAccount] = useState<GmailAccount | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setAccounts([]);
      setPrimaryAccount(null);
      setLoading(false);
      return;
    }

    const fetchAccounts = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("gmail_accounts")
        .select("*")
        .eq("user_id", user.id)
        .order("is_primary", { ascending: false });

      if (!error && data) {
        setAccounts(data);
        setPrimaryAccount(data.find((a) => a.is_primary) || data[0] || null);
      }
      setLoading(false);
    };

    fetchAccounts();
  }, [user?.id]);

  return { accounts, primaryAccount, loading };
}

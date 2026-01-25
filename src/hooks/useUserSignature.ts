import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface UserSignature {
  id: string;
  user_id: string;
  full_name: string;
  first_name: string;
  title: string;
  company: string;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserSignatureInput {
  full_name: string;
  first_name: string;
  title: string;
  company: string;
  phone?: string;
}

const DEFAULT_SIGNATURE: Omit<UserSignature, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
  full_name: 'Locums One',
  first_name: 'Locums',
  title: 'Clinical Consultant',
  company: 'Locums One',
  phone: null,
};

export function useUserSignature() {
  const { user } = useAuth();
  const [signature, setSignature] = useState<UserSignature | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSignature = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('user_signatures')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching signature:', fetchError);
        setError(fetchError.message);
      } else {
        setSignature(data);
      }
    } catch (err) {
      console.error('Unexpected error fetching signature:', err);
      setError('Failed to load signature');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchSignature();
  }, [fetchSignature]);

  const saveSignature = useCallback(async (input: UserSignatureInput): Promise<boolean> => {
    if (!user?.id) {
      setError('Not authenticated');
      return false;
    }

    try {
      setError(null);

      const signatureData = {
        user_id: user.id,
        full_name: input.full_name.trim(),
        first_name: input.first_name.trim(),
        title: input.title.trim(),
        company: input.company.trim() || 'Locums One',
        phone: input.phone?.trim() || null,
      };

      if (signature?.id) {
        // Update existing
        const { data, error: updateError } = await supabase
          .from('user_signatures')
          .update(signatureData)
          .eq('id', signature.id)
          .select()
          .single();

        if (updateError) throw updateError;
        setSignature(data);
      } else {
        // Insert new
        const { data, error: insertError } = await supabase
          .from('user_signatures')
          .insert(signatureData)
          .select()
          .single();

        if (insertError) throw insertError;
        setSignature(data);
      }

      return true;
    } catch (err: any) {
      console.error('Error saving signature:', err);
      setError(err.message || 'Failed to save signature');
      return false;
    }
  }, [user?.id, signature?.id]);

  // Get signature for email (formatted block)
  const getEmailSignature = useCallback(() => {
    const sig = signature || DEFAULT_SIGNATURE;
    let emailSig = `Best regards,\n${sig.full_name}\n${sig.title}\n${sig.company}`;
    if (sig.phone) {
      emailSig += `\n${sig.phone}`;
    }
    return emailSig;
  }, [signature]);

  // Get signature for SMS (short format)
  const getSmsSignature = useCallback(() => {
    const firstName = signature?.first_name || 'Locums';
    return ` - ${firstName}@Locums.one`;
  }, [signature]);

  // Get signature data for edge functions
  const getSignatureData = useCallback(() => {
    return {
      full_name: signature?.full_name || DEFAULT_SIGNATURE.full_name,
      first_name: signature?.first_name || DEFAULT_SIGNATURE.first_name,
      title: signature?.title || DEFAULT_SIGNATURE.title,
      company: signature?.company || DEFAULT_SIGNATURE.company,
      phone: signature?.phone || null,
    };
  }, [signature]);

  return {
    signature,
    loading,
    error,
    saveSignature,
    refetch: fetchSignature,
    getEmailSignature,
    getSmsSignature,
    getSignatureData,
    hasSignature: !!signature,
  };
}

import { useCallback } from 'react';

// Custom event for triggering softphone calls
export const SOFTPHONE_CALL_EVENT = 'softphone:call';

export interface SoftphoneCallPayload {
  phoneNumber: string;
  candidateName?: string;
  candidateId?: string;
}

// Hook to trigger softphone calls from anywhere
export const useSoftphoneActions = () => {
  const initiateCall = useCallback((payload: SoftphoneCallPayload) => {
    const event = new CustomEvent(SOFTPHONE_CALL_EVENT, { detail: payload });
    window.dispatchEvent(event);
  }, []);

  return { initiateCall };
};

// Helper to format phone for dialing (E.164)
export const formatPhoneForDialing = (phone: string | null | undefined): string => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return phone.startsWith('+') ? phone : `+${digits}`;
};

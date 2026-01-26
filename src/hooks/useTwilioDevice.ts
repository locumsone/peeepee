import { useState, useEffect, useCallback, useRef } from 'react';
import { Device, Call } from '@twilio/voice-sdk';
import { supabase } from '@/integrations/supabase/client';

export interface TwilioDeviceState {
  device: Device | null;
  isReady: boolean;
  isConnecting: boolean;
  currentCall: Call | null;
  callDuration: number;
  isMuted: boolean;
  isOnHold: boolean;
  incomingCall: Call | null;
  callerContext: any | null;
  error: string | null;
}

export const useTwilioDevice = (userId: string | null) => {
  const [state, setState] = useState<TwilioDeviceState>({
    device: null,
    isReady: false,
    isConnecting: false,
    currentCall: null,
    callDuration: 0,
    isMuted: false,
    isOnHold: false,
    incomingCall: null,
    callerContext: null,
    error: null,
  });

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const deviceRef = useRef<Device | null>(null);

  const startDurationTimer = useCallback(() => {
    timerRef.current = setInterval(() => {
      setState(prev => ({ ...prev, callDuration: prev.callDuration + 1 }));
    }, 1000);
  }, []);

  const stopDurationTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const initializeDevice = useCallback(async () => {
    if (!userId) return;

    try {
      setState(prev => ({ ...prev, isConnecting: true, error: null }));

      const { data, error: invokeError } = await supabase.functions.invoke('voice-token', {
        body: { user_id: userId },
      });

      if (invokeError) {
        throw new Error(invokeError.message || 'Failed to get voice token');
      }

      const { token } = data;


      const device = new Device(token, {
        logLevel: 1,
        codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
      });

      device.on('registered', () => {
        setState(prev => ({ ...prev, isReady: true, isConnecting: false }));
      });

      device.on('error', (error) => {
        console.error('Twilio Device Error:', error);
        setState(prev => ({ ...prev, error: error.message }));
      });

      device.on('incoming', async (call) => {
        // Try to get caller context - first from ARIA transfers, then from candidate database
        let callerContext = null;
        const fromNumber = call.parameters.From;
        const normalizedPhone = fromNumber?.replace(/\D/g, '') || '';
        
        try {
          // Check for ARIA transfers first
          const { data: ariaTransfer } = await supabase
            .from('ai_call_logs')
            .select('*')
            .eq('phone_number', fromNumber)
            .eq('transferred_to_recruiter', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (ariaTransfer) {
            callerContext = {
              ...ariaTransfer,
              source: 'aria_transfer'
            };
          } else {
            // Try to match caller to candidate in database
            const { data: candidate } = await supabase
              .from('candidates')
              .select('id, first_name, last_name, specialty, state, phone, personal_mobile')
              .or(`phone.ilike.%${normalizedPhone},personal_mobile.ilike.%${normalizedPhone}`)
              .limit(1)
              .maybeSingle();
            
            if (candidate) {
              callerContext = {
                candidate_id: candidate.id,
                candidate_name: `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim(),
                specialty: candidate.specialty,
                state: candidate.state,
                source: 'database_match'
              };
            }
          }
        } catch (e) {
          console.log('No caller context found:', e);
        }

        setState(prev => ({ 
          ...prev, 
          incomingCall: call, 
          callerContext 
        }));

        call.on('disconnect', () => {
          setState(prev => ({
            ...prev,
            incomingCall: null,
            currentCall: null,
            callerContext: null,
            callDuration: 0,
          }));
          stopDurationTimer();
        });
      });

      await device.register();
      deviceRef.current = device;
      setState(prev => ({ ...prev, device }));

    } catch (error: any) {
      console.error('Failed to initialize device:', error);
      setState(prev => ({ 
        ...prev, 
        isConnecting: false, 
        error: error.message 
      }));
    }
  }, [userId, stopDurationTimer]);

  const makeCall = useCallback(async (phoneNumber: string, fromNumber: string) => {
    const device = deviceRef.current;
    if (!device) {
      setState(prev => ({ ...prev, error: 'Device not initialized' }));
      return;
    }

    try {
      setState(prev => ({ ...prev, isConnecting: true, error: null }));

      const call = await device.connect({
        params: {
          To: phoneNumber,
          From: fromNumber,
        },
      });

      call.on('accept', () => {
        setState(prev => ({ 
          ...prev, 
          currentCall: call, 
          isConnecting: false,
          callDuration: 0,
        }));
        startDurationTimer();
      });

      call.on('disconnect', () => {
        setState(prev => ({
          ...prev,
          currentCall: null,
          callDuration: 0,
          isMuted: false,
          isOnHold: false,
        }));
        stopDurationTimer();
      });

      call.on('error', (error: any) => {
        console.error('Call error:', error);
        // Handle microphone/media errors gracefully
        const errorMessage = error.message || error.name || 'Call failed';
        setState(prev => ({ 
          ...prev, 
          error: errorMessage.includes('NotFoundError') 
            ? 'Microphone not found. Please check your audio settings.'
            : errorMessage,
          isConnecting: false,
          currentCall: null,
        }));
      });

    } catch (error: any) {
      console.error('Failed to make call:', error);
      setState(prev => ({ 
        ...prev, 
        isConnecting: false, 
        error: error.message 
      }));
    }
  }, [startDurationTimer, stopDurationTimer]);

  const acceptIncomingCall = useCallback(() => {
    const { incomingCall } = state;
    if (!incomingCall) return;

    incomingCall.accept();
    setState(prev => ({
      ...prev,
      currentCall: incomingCall,
      incomingCall: null,
      callDuration: 0,
    }));
    startDurationTimer();
  }, [state, startDurationTimer]);

  const rejectIncomingCall = useCallback(() => {
    const { incomingCall } = state;
    if (!incomingCall) return;

    incomingCall.reject();
    setState(prev => ({
      ...prev,
      incomingCall: null,
      callerContext: null,
    }));
  }, [state]);

  const hangUp = useCallback(() => {
    const { currentCall } = state;
    if (currentCall) {
      currentCall.disconnect();
    }
    stopDurationTimer();
    setState(prev => ({
      ...prev,
      currentCall: null,
      callDuration: 0,
      isMuted: false,
      isOnHold: false,
    }));
  }, [state, stopDurationTimer]);

  const toggleMute = useCallback(() => {
    const { currentCall, isMuted } = state;
    if (currentCall) {
      currentCall.mute(!isMuted);
      setState(prev => ({ ...prev, isMuted: !isMuted }));
    }
  }, [state]);

  const toggleHold = useCallback(() => {
    // Hold is not directly supported, we simulate by muting
    const { isMuted, isOnHold } = state;
    setState(prev => ({ ...prev, isOnHold: !isOnHold }));
    if (!isMuted) {
      toggleMute();
    }
  }, [state, toggleMute]);

  const sendDigits = useCallback((digits: string) => {
    const { currentCall } = state;
    if (currentCall) {
      currentCall.sendDigits(digits);
    }
  }, [state]);

  useEffect(() => {
    if (userId) {
      initializeDevice();
    }

    return () => {
      if (deviceRef.current) {
        deviceRef.current.destroy();
      }
      stopDurationTimer();
    };
  }, [userId, initializeDevice, stopDurationTimer]);

  return {
    ...state,
    makeCall,
    hangUp,
    toggleMute,
    toggleHold,
    sendDigits,
    acceptIncomingCall,
    rejectIncomingCall,
    initializeDevice,
  };
};

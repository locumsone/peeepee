import { useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Phone, Minus, Mic, MicOff, Pause, Play, PhoneOff, Delete } from 'lucide-react';
import { SOFTPHONE_CALL_EVENT, type SoftphoneCallPayload, formatPhoneForDialing } from '@/hooks/useSoftphoneActions';
import { cn } from '@/lib/utils';
import { useTwilioDevice } from '@/hooks/useTwilioDevice';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PostCallModal } from './PostCallModal';
import { formatDistanceToNow } from 'date-fns';

const KEYPAD = [
  { digit: '1', letters: '' },
  { digit: '2', letters: 'ABC' },
  { digit: '3', letters: 'DEF' },
  { digit: '4', letters: 'GHI' },
  { digit: '5', letters: 'JKL' },
  { digit: '6', letters: 'MNO' },
  { digit: '7', letters: 'PQRS' },
  { digit: '8', letters: 'TUV' },
  { digit: '9', letters: 'WXYZ' },
  { digit: '*', letters: '' },
  { digit: '0', letters: '+' },
  { digit: '#', letters: '' },
];

// Local phone formatter for dialer input
const formatPhoneNumberInput = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
};

// Import the shared formatPhoneNumber for display
import { formatPhoneNumber } from '@/lib/formatPhone';

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const Softphone = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showPostCallModal, setShowPostCallModal] = useState(false);
  const [lastCallData, setLastCallData] = useState<{
    phoneNumber: string;
    candidateName?: string;
    candidateId?: string;
    duration: number;
  } | null>(null);
  
  // Available Twilio numbers for outbound calls
  const TWILIO_CALLER_IDS = ['+12185628671', '+14355628671'];
  const [selectedCallerId, setSelectedCallerId] = useState(TWILIO_CALLER_IDS[0]);
  
  const userId = 'recruiter-1';
  
  const {
    isReady,
    isConnecting,
    currentCall,
    callDuration,
    isMuted,
    isOnHold,
    incomingCall,
    callerContext,
    error: deviceError,
    makeCall,
    hangUp,
    toggleMute,
    toggleHold,
    sendDigits,
    acceptIncomingCall,
    rejectIncomingCall,
  } = useTwilioDevice(userId);

  // Fetch recent calls from ai_call_logs
  const { data: recentCalls = [] } = useQuery({
    queryKey: ['recent-calls'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_call_logs')
        .select('id, candidate_name, phone_number, created_at, status, call_type, duration_seconds')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data || [];
    },
  });

  // Listen for external call requests (from Comms Hub Call button)
  useEffect(() => {
    const handleExternalCall = (event: CustomEvent<SoftphoneCallPayload>) => {
      const { phoneNumber: targetPhone, candidateName, candidateId } = event.detail;
      const formattedPhone = formatPhoneForDialing(targetPhone);
      
      if (!formattedPhone || !isReady || currentCall) return;
      
      // Open the softphone if closed
      setIsOpen(true);
      
      // Set the phone number and initiate call
      setLastCallData({
        phoneNumber: formattedPhone,
        candidateName,
        candidateId,
        duration: 0,
      });
      
      makeCall(formattedPhone, selectedCallerId);
    };

    window.addEventListener(SOFTPHONE_CALL_EVENT, handleExternalCall as EventListener);
    return () => window.removeEventListener(SOFTPHONE_CALL_EVENT, handleExternalCall as EventListener);
  }, [isReady, currentCall, makeCall, selectedCallerId]);

  // Track when call ends to show post-call modal
  useEffect(() => {
    if (!currentCall && lastCallData && lastCallData.duration > 0) {
      setShowPostCallModal(true);
    }
  }, [currentCall, lastCallData]);

  // Update lastCallData while on call
  useEffect(() => {
    if (currentCall) {
      // Get phone from call params, normalize if needed
      let toNumber = currentCall.parameters?.To || currentCall.parameters?.From || '';
      
      // If toNumber is empty, try to get from phoneNumber state (formatted)
      if (!toNumber && phoneNumber) {
        const digits = phoneNumber.replace(/\D/g, '');
        if (digits.length >= 10) {
          toNumber = `+1${digits.slice(-10)}`;
        }
      }
      
      setLastCallData((prev) => ({
        phoneNumber: toNumber || prev?.phoneNumber || '',
        candidateName: callerContext?.candidate_name || prev?.candidateName,
        candidateId: callerContext?.candidate_id || prev?.candidateId,
        duration: callDuration,
      }));
    }
  }, [currentCall, callDuration, callerContext, phoneNumber]);

  const handleDigitClick = useCallback((digit: string) => {
    if (currentCall) {
      sendDigits(digit);
    } else {
      setPhoneNumber(prev => {
        const digits = prev.replace(/\D/g, '');
        if (digits.length < 10) return formatPhoneNumberInput(digits + digit);
        return prev;
      });
    }
  }, [currentCall, sendDigits]);

  const handleBackspace = useCallback(() => {
    setPhoneNumber(prev => {
      const digits = prev.replace(/\D/g, '').slice(0, -1);
      return formatPhoneNumberInput(digits);
    });
  }, []);


  const handleCall = useCallback(() => {
    const digits = phoneNumber.replace(/\D/g, '');
    if (digits.length >= 10) {
      setLastCallData({
        phoneNumber: `+1${digits}`,
        duration: 0,
      });
      makeCall(`+1${digits}`, selectedCallerId);
    }
  }, [phoneNumber, makeCall, selectedCallerId]);

  const handleCallBack = useCallback((number: string, candidateName?: string | null) => {
    const digits = number.replace(/\D/g, '');
    setLastCallData({
      phoneNumber: number,
      candidateName: candidateName || undefined,
      duration: 0,
    });
    makeCall(`+1${digits}`, selectedCallerId);
  }, [makeCall, selectedCallerId]);

  const handleHangUp = useCallback(() => {
    // Capture final duration before hanging up
    if (currentCall) {
      setLastCallData(prev => prev ? { ...prev, duration: callDuration } : null);
    }
    hangUp();
  }, [hangUp, currentCall, callDuration]);

  const getCallTypeIcon = (callType: string | null, status: string | null) => {
    if (status === 'failed' || status === 'no_answer') return 'text-destructive';
    if (callType === 'ai') return 'text-cyan-400';
    return 'text-success';
  };

  const formatTimeAgo = (timestamp: string | null) => {
    if (!timestamp) return '';
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: false });
    } catch {
      return '';
    }
  };

  // Floating button when collapsed
  if (!isOpen) {
    return (
      <>
        <button
          onClick={() => setIsOpen(true)}
          className={cn(
            "fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-xl transition-all duration-300 flex items-center justify-center",
            "bg-primary hover:bg-primary/90 text-primary-foreground hover:scale-105",
            incomingCall && "animate-pulse ring-4 ring-green-500/50"
          )}
        >
          <Phone className="h-6 w-6" />
          {incomingCall && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full animate-ping" />
          )}
        </button>

        {/* Post-call modal */}
        {lastCallData && (
          <PostCallModal
            open={showPostCallModal}
            onOpenChange={(open) => {
              setShowPostCallModal(open);
              if (!open) setLastCallData(null);
            }}
            callData={lastCallData}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50 w-[300px] h-[400px] bg-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-700/50">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-800/50 border-b border-slate-700/50">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-2 h-2 rounded-full",
              isReady ? "bg-green-500" : "bg-red-500"
            )} />
            <span className="text-sm font-medium text-slate-200">Locums One Softphone</span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <Minus className="h-4 w-4" />
          </button>
        </div>

        {/* Active Call Display */}
        {currentCall ? (
          <div className="flex-1 flex flex-col items-center justify-center p-4 gap-4">
            <div className="text-center">
              <p className="text-lg font-semibold text-slate-100">
                {callerContext?.candidate_name || currentCall.parameters.To || currentCall.parameters.From || 'Unknown'}
              </p>
              <p className="text-2xl font-mono text-primary mt-2">
                {formatDuration(callDuration)}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={toggleMute}
                className={cn(
                  "w-12 h-12 rounded-full border-slate-600",
                  isMuted ? "bg-red-500/20 text-red-400 border-red-500/50" : "text-slate-300 hover:bg-slate-700"
                )}
              >
                {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </Button>
              
              <Button
                variant="outline"
                size="icon"
                onClick={toggleHold}
                className={cn(
                  "w-12 h-12 rounded-full border-slate-600",
                  isOnHold ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/50" : "text-slate-300 hover:bg-slate-700"
                )}
              >
                {isOnHold ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
              </Button>
              
              <Button
                variant="destructive"
                size="icon"
                onClick={handleHangUp}
                className="w-14 h-14 rounded-full"
              >
                <PhoneOff className="h-6 w-6" />
              </Button>
            </div>
          </div>
        ) : incomingCall ? (
          /* Incoming Call Display */
          <div className="flex-1 flex flex-col items-center justify-center p-4 gap-4">
            <div className="text-center">
              <p className="text-sm text-slate-400">Incoming Call</p>
              <p className="text-lg font-semibold text-slate-100 mt-1">
                {callerContext?.candidate_name || incomingCall.parameters.From || 'Unknown'}
              </p>
              {callerContext?.candidate_name && (
                <p className="text-sm text-slate-400">{incomingCall.parameters.From}</p>
              )}
            </div>
            
            <div className="flex items-center gap-4">
              <Button
                variant="destructive"
                size="icon"
                onClick={rejectIncomingCall}
                className="w-14 h-14 rounded-full"
              >
                <PhoneOff className="h-6 w-6" />
              </Button>
              
              <Button
                size="icon"
                onClick={acceptIncomingCall}
                className="w-14 h-14 rounded-full bg-green-600 hover:bg-green-500"
              >
                <Phone className="h-6 w-6" />
              </Button>
            </div>
          </div>
        ) : (
          /* Dialpad */
          <div className="flex-1 flex flex-col p-3 gap-2">
            {/* Phone Input */}
            <div className="relative">
              <Input
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(formatPhoneNumber(e.target.value))}
                placeholder="Enter number"
                className="bg-slate-800 border-slate-700 text-slate-100 text-center text-lg h-10 pr-10"
              />
              {phoneNumber && (
                <button
                  onClick={handleBackspace}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200"
                >
                  <Delete className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-1.5">
              {KEYPAD.map(({ digit, letters }) => (
                <button
                  key={digit}
                  onClick={() => handleDigitClick(digit)}
                  className="h-11 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 flex flex-col items-center justify-center transition-colors"
                >
                  <span className="text-lg font-medium">{digit}</span>
                  {letters && <span className="text-[9px] text-slate-500 -mt-0.5">{letters}</span>}
                </button>
              ))}
            </div>

            {/* Error Display */}
            {deviceError && (
              <div className="bg-red-500/20 text-red-300 text-xs p-2 rounded-lg border border-red-500/30">
                {deviceError}
              </div>
            )}

            {/* Call Button */}
            <Button
              onClick={handleCall}
              disabled={!isReady || isConnecting || phoneNumber.replace(/\D/g, '').length < 10}
              className="h-11 bg-green-600 hover:bg-green-500 text-white font-medium"
            >
              <Phone className="h-4 w-4 mr-2" />
              {isConnecting ? 'Connecting...' : 'Call'}
            </Button>

            {/* Recent Calls - Real Data */}
            <ScrollArea className="flex-1 -mx-1">
              <div className="px-1 space-y-1">
                <p className="text-xs text-slate-500 font-medium px-1">Recent</p>
                {recentCalls.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-2">No recent calls</p>
                ) : (
                  recentCalls
                    .filter((call) => call.phone_number && call.phone_number !== '') // Filter out calls with no phone
                    .slice(0, 5)
                    .map((call) => {
                      const displayName = call.candidate_name || formatPhoneNumber(call.phone_number);
                      return (
                        <button
                          key={call.id}
                          onClick={() => handleCallBack(call.phone_number, call.candidate_name)}
                          className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-slate-800 text-left transition-colors"
                        >
                          <Phone className={cn("h-3 w-3", getCallTypeIcon(call.call_type, call.status))} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-slate-200 truncate">
                              {displayName}
                            </p>
                            {call.candidate_name && (
                              <p className="text-[10px] text-slate-500 truncate font-mono">
                                {formatPhoneNumber(call.phone_number)}
                              </p>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500 shrink-0">
                            {formatTimeAgo(call.created_at)}
                          </span>
                        </button>
                      );
                    })
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Post-call modal */}
      {lastCallData && (
        <PostCallModal
          open={showPostCallModal}
          onOpenChange={(open) => {
            setShowPostCallModal(open);
            if (!open) setLastCallData(null);
          }}
          callData={lastCallData}
        />
      )}
    </>
  );
};

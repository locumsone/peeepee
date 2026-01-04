import { useState, useCallback } from 'react';
import { Phone, Minus, Mic, MicOff, Pause, Play, PhoneOff, Delete } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTwilioDevice } from '@/hooks/useTwilioDevice';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

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

const formatPhoneNumber = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
};

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// Mock recent calls - in production, fetch from database
const RECENT_CALLS = [
  { id: '1', name: 'Dr. Sarah Johnson', number: '+1 (555) 123-4567', time: '10 min ago', type: 'outbound' },
  { id: '2', name: 'Unknown', number: '+1 (555) 987-6543', time: '1 hour ago', type: 'missed' },
  { id: '3', name: 'Dr. Michael Chen', number: '+1 (555) 456-7890', time: '2 hours ago', type: 'inbound' },
  { id: '4', name: 'Dr. Emily Davis', number: '+1 (555) 321-0987', time: 'Yesterday', type: 'outbound' },
  { id: '5', name: 'Unknown', number: '+1 (555) 654-3210', time: 'Yesterday', type: 'inbound' },
];

export const Softphone = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  
  const userId = 'recruiter-1';
  
  const {
    isReady,
    isConnecting,
    currentCall,
    callDuration,
    isMuted,
    isOnHold,
    incomingCall,
    makeCall,
    hangUp,
    toggleMute,
    toggleHold,
    sendDigits,
    acceptIncomingCall,
    rejectIncomingCall,
  } = useTwilioDevice(userId);

  const handleDigitClick = useCallback((digit: string) => {
    if (currentCall) {
      sendDigits(digit);
    } else {
      setPhoneNumber(prev => {
        const digits = prev.replace(/\D/g, '');
        if (digits.length < 10) return formatPhoneNumber(digits + digit);
        return prev;
      });
    }
  }, [currentCall, sendDigits]);

  const handleBackspace = useCallback(() => {
    setPhoneNumber(prev => {
      const digits = prev.replace(/\D/g, '').slice(0, -1);
      return formatPhoneNumber(digits);
    });
  }, []);

  const handleCall = useCallback(() => {
    const digits = phoneNumber.replace(/\D/g, '');
    if (digits.length >= 10) {
      makeCall(`+1${digits}`, '+12185628671');
    }
  }, [phoneNumber, makeCall]);

  const handleCallBack = useCallback((number: string) => {
    const digits = number.replace(/\D/g, '');
    makeCall(`+1${digits}`, '+12185628671');
  }, [makeCall]);

  // Floating button when collapsed
  if (!isOpen) {
    return (
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
    );
  }

  return (
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
              {currentCall.parameters.To || currentCall.parameters.From || 'Unknown'}
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
              onClick={hangUp}
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
              {incomingCall.parameters.From || 'Unknown'}
            </p>
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

          {/* Call Button */}
          <Button
            onClick={handleCall}
            disabled={!isReady || isConnecting || phoneNumber.replace(/\D/g, '').length < 10}
            className="h-11 bg-green-600 hover:bg-green-500 text-white font-medium"
          >
            <Phone className="h-4 w-4 mr-2" />
            {isConnecting ? 'Connecting...' : 'Call'}
          </Button>

          {/* Recent Calls */}
          <ScrollArea className="flex-1 -mx-1">
            <div className="px-1 space-y-1">
              <p className="text-xs text-slate-500 font-medium px-1">Recent</p>
              {RECENT_CALLS.slice(0, 5).map((call) => (
                <button
                  key={call.id}
                  onClick={() => handleCallBack(call.number)}
                  className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-slate-800 text-left transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-200 truncate">{call.name}</p>
                    <p className="text-[10px] text-slate-500 truncate">{call.number}</p>
                  </div>
                  <span className="text-[10px] text-slate-500 shrink-0">{call.time}</span>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
};

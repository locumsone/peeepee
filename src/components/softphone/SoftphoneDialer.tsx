import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Phone, Delete } from 'lucide-react';

interface SoftphoneDialerProps {
  onCall: (phoneNumber: string, fromNumber: string) => void;
  isConnecting: boolean;
  isReady: boolean;
}

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

const OUTBOUND_NUMBERS = [
  { value: '+12185628671', label: '+1 (218) 562-8671' },
  { value: '+14355628671', label: '+1 (435) 562-8671' },
];

const formatPhoneNumber = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 3) {
    return digits;
  } else if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  } else if (digits.length <= 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else {
    return `+${digits.slice(0, 1)} (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 11)}`;
  }
};

export const SoftphoneDialer = ({ onCall, isConnecting, isReady }: SoftphoneDialerProps) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [fromNumber, setFromNumber] = useState(OUTBOUND_NUMBERS[0].value);

  const handleDigitClick = useCallback((digit: string) => {
    setPhoneNumber(prev => prev + digit);
  }, []);

  const handleBackspace = useCallback(() => {
    setPhoneNumber(prev => prev.slice(0, -1));
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneNumber(formatted);
  }, []);

  const handleCall = useCallback(() => {
    const digits = phoneNumber.replace(/\D/g, '');
    if (digits.length >= 10) {
      onCall(`+1${digits.slice(-10)}`, fromNumber);
    }
  }, [phoneNumber, fromNumber, onCall]);

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Phone Number Input */}
      <div className="relative">
        <Input
          type="tel"
          value={phoneNumber}
          onChange={handleInputChange}
          placeholder="Enter phone number"
          className="text-center text-xl font-medium bg-muted/50 border-border h-14"
        />
        {phoneNumber && (
          <button
            onClick={handleBackspace}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Delete className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-2">
        {KEYPAD.map(({ digit, letters }) => (
          <button
            key={digit}
            onClick={() => handleDigitClick(digit)}
            className="flex flex-col items-center justify-center h-16 rounded-lg bg-muted/30 hover:bg-muted/60 active:bg-muted transition-colors"
          >
            <span className="text-2xl font-semibold text-foreground">{digit}</span>
            {letters && (
              <span className="text-[10px] text-muted-foreground tracking-widest">{letters}</span>
            )}
          </button>
        ))}
      </div>

      {/* Outbound Number Selector */}
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">Call from:</label>
        <Select value={fromNumber} onValueChange={setFromNumber}>
          <SelectTrigger className="bg-muted/30 border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OUTBOUND_NUMBERS.map((num) => (
              <SelectItem key={num.value} value={num.value}>
                {num.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Call Button */}
      <Button
        onClick={handleCall}
        disabled={phoneNumber.replace(/\D/g, '').length < 10 || isConnecting || !isReady}
        className="w-full h-14 text-lg font-semibold bg-success hover:bg-success/90 text-success-foreground"
      >
        <Phone className="h-5 w-5 mr-2" />
        {isConnecting ? 'Connecting...' : 'Call'}
      </Button>

      {!isReady && (
        <p className="text-xs text-center text-muted-foreground">
          Initializing phone system...
        </p>
      )}
    </div>
  );
};

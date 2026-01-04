import { useState, useCallback } from 'react';
import { Phone, Minus, X } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useTwilioDevice } from '@/hooks/useTwilioDevice';
import { SoftphoneDialer } from './SoftphoneDialer';
import { SoftphoneActiveCall } from './SoftphoneActiveCall';
import { SoftphoneRecent } from './SoftphoneRecent';
import { SoftphoneVoicemails } from './SoftphoneVoicemails';
import { SoftphoneSMS } from './SoftphoneSMS';
import { SoftphoneIncoming } from './SoftphoneIncoming';

const OUTBOUND_NUMBERS = [
  { value: '+12185628671', label: '+1 (218) 562-8671' },
  { value: '+14355628671', label: '+1 (435) 562-8671' },
];

export const Softphone = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dialer');
  
  // In production, get this from auth context
  const userId = 'demo-user-id';
  
  const {
    isReady,
    isConnecting,
    currentCall,
    callDuration,
    isMuted,
    isOnHold,
    incomingCall,
    callerContext,
    error,
    makeCall,
    hangUp,
    toggleMute,
    toggleHold,
    sendDigits,
    acceptIncomingCall,
    rejectIncomingCall,
  } = useTwilioDevice(userId);

  const handleCall = useCallback((phoneNumber: string, fromNumber: string) => {
    makeCall(phoneNumber, fromNumber);
  }, [makeCall]);

  const handleCallBack = useCallback((phoneNumber: string) => {
    setActiveTab('dialer');
    makeCall(phoneNumber, OUTBOUND_NUMBERS[0].value);
  }, [makeCall]);

  // Floating button when collapsed
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center group"
      >
        <Phone className="h-6 w-6 group-hover:scale-110 transition-transform" />
        {incomingCall && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-success rounded-full animate-ping" />
        )}
      </button>
    );
  }

  return (
    <>
      {/* Incoming Call Modal */}
      {incomingCall && (
        <SoftphoneIncoming
          phoneNumber={incomingCall.parameters.From}
          callerContext={callerContext}
          onAccept={acceptIncomingCall}
          onReject={rejectIncomingCall}
        />
      )}

      {/* Softphone Panel */}
      <div className="fixed bottom-6 right-6 z-50 w-[400px] h-[600px] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b border-border">
          <div className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            <span className="font-semibold text-foreground">Locums One Phone</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge 
              variant="outline" 
              className={cn(
                "text-xs",
                isReady 
                  ? "border-success/50 text-success" 
                  : "border-destructive/50 text-destructive"
              )}
            >
              <span className={cn(
                "w-2 h-2 rounded-full mr-1.5",
                isReady ? "bg-success" : "bg-destructive"
              )} />
              {isReady ? 'Online' : 'Offline'}
            </Badge>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <Minus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        {currentCall ? (
          <SoftphoneActiveCall
            phoneNumber={currentCall.parameters.To || currentCall.parameters.From || 'Unknown'}
            callDuration={callDuration}
            isMuted={isMuted}
            isOnHold={isOnHold}
            onToggleMute={toggleMute}
            onToggleHold={toggleHold}
            onSendDigits={sendDigits}
            onHangUp={hangUp}
            callerContext={callerContext}
          />
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="grid grid-cols-4 mx-4 mt-4 bg-muted/30">
              <TabsTrigger value="dialer" className="text-xs">Dialer</TabsTrigger>
              <TabsTrigger value="recent" className="text-xs">Recent</TabsTrigger>
              <TabsTrigger value="voicemails" className="text-xs">Voicemails</TabsTrigger>
              <TabsTrigger value="sms" className="text-xs">SMS</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-hidden">
              <TabsContent value="dialer" className="h-full mt-0">
                <SoftphoneDialer
                  onCall={handleCall}
                  isConnecting={isConnecting}
                  isReady={isReady}
                />
              </TabsContent>

              <TabsContent value="recent" className="h-full mt-0 overflow-y-auto">
                <SoftphoneRecent onCallBack={handleCallBack} />
              </TabsContent>

              <TabsContent value="voicemails" className="h-full mt-0 overflow-y-auto">
                <SoftphoneVoicemails />
              </TabsContent>

              <TabsContent value="sms" className="h-full mt-0 overflow-y-auto">
                <SoftphoneSMS />
              </TabsContent>
            </div>
          </Tabs>
        )}

        {/* Error Display */}
        {error && (
          <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20">
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}
      </div>
    </>
  );
};

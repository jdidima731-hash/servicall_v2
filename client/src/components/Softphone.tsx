import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Plus,
  X,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { RGPDConsentDialog } from "@/components/RGPDConsentDialog";
import { useRGPDConsent } from "@/_core/hooks/useRGPDConsent";
import { useTenant } from "@/contexts/TenantContext";
import { useCallStore } from "@/lib/callStore";
import { useTranslation } from "react-i18next";

interface Call {
  id: string;
  number: string;
  status: "connecting" | "active" | "on-hold";
  duration: number;
  isActive: boolean;
}

export function Softphone() {
  const { t } = useTranslation('common');
  const [calls, setCalls] = useState<Call[]>([]);
  const [inputNumber, setInputNumber] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isDialing, setIsDialing] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const { tenantId, requireTenantId } = useTenant();
  const { isOpen, openConsent, closeConsent, recordConsent } = useRGPDConsent();
  const { pendingCall: storePendingCall, clearPendingCall } = useCallStore();
  const [pendingCall, setPendingCall] = useState<{ number: string; prospectId?: number; campaignId?: number } | null>(null);

  // Sync with store
  useEffect(() => {
    if (storePendingCall) {
      setPendingCall({
        number: storePendingCall.phoneNumber,
        prospectId: storePendingCall.prospectId,
        campaignId: storePendingCall.campaignId
      });
      setInputNumber(storePendingCall.phoneNumber);
      openConsent();
      clearPendingCall();
    }
  }, [storePendingCall, openConsent, clearPendingCall]);

  // Mutations
  const createCallMutation = trpc.calls.create.useMutation({
    onSuccess: (data: any) => {
      toast.success(t('softphone.call_initiated'));
      // Update local state with the new call
      const newCall: Call = {
        id: data?.id?.toString() || Date.now().toString(),
        number: inputNumber,
        status: "active",
        duration: 0,
        isActive: true,
      };
      setCalls([...calls, newCall]);
      setInputNumber("");
      setIsDialing(false);
    },
    onError: (error) => {
      toast.error(`${t('status.failed')}: ${error.message}`);
      setIsDialing(false);
    },
  });

  // Simulate call timer
  useEffect(() => {
    const interval = setInterval(() => {
      setCalls((prevCalls) =>
        prevCalls.map((call) =>
          call.status === "active"
            ? { ...call, duration: call.duration + 1 }
            : call
        )
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleDial = async () => {
    // Nettoyer le numéro (garder uniquement chiffres et +)
    const cleanedNumber = inputNumber.replace(/[^\d+]/g, "");
    
    if (!cleanedNumber || cleanedNumber.length < 3) {
      toast.error(t('softphone.error_invalid_number'));
      return;
    }

    // Vérifier que tenantId est défini
    if (tenantId === null) {
      toast.error(t('softphone.error_no_tenant'));
      return;
    }

    // Ouvrir le dialogue de consentement RGPD
    setPendingCall({ number: cleanedNumber });
    openConsent();
  };

  const handleConsentConfirm = async (consent: any) => {
    if (!pendingCall) return;

    // Enregistrer le consentement
    recordConsent({
      prospectId: pendingCall.prospectId || 0,
      consentGiven: consent.consentGiven,
      recordingConsent: consent.recordingConsent,
      aiDisclosure: consent.aiDisclosure,
      timestamp: consent.timestamp,
    });

    if (!consent.consentGiven) {
      toast.error(t('softphone.consent_denied'));
      closeConsent();
      setPendingCall(null);
      return;
    }

    setIsDialing(true);

    // Lancer l'appel via l'API
    try {
      const currentTenantId = requireTenantId();
      await createCallMutation.mutateAsync({
        tenantId: currentTenantId,
        toNumber: pendingCall.number,
        prospectId: pendingCall.prospectId,
        campaignId: pendingCall.campaignId,
        fromNumber: "+33100000000", // Numéro par défaut en mode démo
        direction: "outbound",
        status: "in-progress",
      } as any);
    } catch (error) {
      console.error("Dial error:", error);
      setIsDialing(false);
      closeConsent();
      setPendingCall(null);
      return;
    }

    closeConsent();
    setPendingCall(null);
  };

  const handleHangup = async (callId: string) => {
    const call = calls.find((c) => c.id === callId);
    if (!call) return;

    setCalls((prevCalls) => prevCalls.filter((c) => c.id !== callId));
    toast.success(t('softphone.call_ended'));
  };

  const handleAddCall = () => {
    if (calls.length > 0) {
      setCalls((prevCalls) =>
        prevCalls.map((call) => ({ ...call, status: "on-hold" }))
      );
    }
  };

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    toast.info(nextMuted ? t('softphone.mic_off') : t('softphone.mic_on'));
  };

  const handleToggleSpeaker = () => {
    const nextSpeaker = !isSpeakerOn;
    setIsSpeakerOn(nextSpeaker);
    toast.info(nextSpeaker ? t('softphone.speaker_on') : t('softphone.speaker_off'));
  };

  const activeCall = calls.find((call) => call.status === "active");
  const onHoldCalls = calls.filter((call) => call.status === "on-hold");

  return (
    <div className="space-y-4">
      {/* Active Call Display */}
      {activeCall && (
        <Card className="p-6 bg-gradient-to-br from-primary/10 to-primary/5">
          <div className="text-center space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">{t('softphone.active_call')}</p>
              <p className="text-3xl font-bold text-primary">{activeCall.number}</p>
              <p className="text-lg text-muted-foreground mt-2">
                {formatDuration(activeCall.duration)}
              </p>
            </div>

            {/* Call Controls */}
            <div className="flex items-center justify-center gap-4">
              <Button
                variant={isMuted ? "destructive" : "outline"}
                size="icon"
                onClick={handleToggleMute}
                className="rounded-full w-12 h-12"
              >
                {isMuted ? (
                  <MicOff className="w-5 h-5" />
                ) : (
                  <Mic className="w-5 h-5" />
                )}
              </Button>

              <Button
                variant={isSpeakerOn ? "default" : "outline"}
                size="icon"
                onClick={handleToggleSpeaker}
                className="rounded-full w-12 h-12"
              >
                {isSpeakerOn ? (
                  <Volume2 className="w-5 h-5" />
                ) : (
                  <VolumeX className="w-5 h-5" />
                )}
              </Button>

              <Button
                variant="destructive"
                size="icon"
                onClick={() => handleHangup(activeCall.id)}
                className="rounded-full w-12 h-12"
              >
                <PhoneOff className="w-5 h-5" />
              </Button>

              {onHoldCalls.length === 0 && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleAddCall}
                  className="rounded-full w-12 h-12"
                >
                  <Plus className="w-5 h-5" />
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* On Hold Calls */}
      {onHoldCalls.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            {t('softphone.on_hold_calls', { count: onHoldCalls.length })}
          </p>
          {onHoldCalls.map((call) => (
            <Card key={call.id} className="p-3 flex items-center justify-between">
              <div>
                <p className="font-medium">{call.number}</p>
                <p className="text-xs text-muted-foreground">
                  {t('softphone.on_hold')} - {formatDuration(call.duration)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCalls((prevCalls) =>
                      prevCalls.map((c) =>
                        c.id === call.id
                          ? { ...c, status: "active" }
                          : { ...c, status: "on-hold" }
                      )
                    );
                  }}
                >
                  {t('softphone.resume')}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleHangup(call.id)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Dial Pad */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="tel"
              value={inputNumber}
              onChange={(e) => setInputNumber(e.target.value)}
              placeholder={t('softphone.dial_placeholder')}
              className="flex-1"
            />
            <Button
              onClick={handleDial}
              disabled={!inputNumber.trim() || isDialing || createCallMutation.isPending}
              className="gap-2"
            >
              {isDialing || createCallMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('softphone.dialing')}
                </>
              ) : (
                <>
                  <Phone className="w-4 h-4" />
                  {t('softphone.call_button')}
                </>
              )}
            </Button>
          </div>

          {/* Dial Pad Buttons */}
          <div className="grid grid-cols-3 gap-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map(
              (digit) => (
                <Button
                  key={digit}
                  variant="outline"
                  onClick={() => setInputNumber(inputNumber + digit)}
                  className="h-12 text-lg font-semibold"
                >
                  {digit}
                </Button>
              )
            )}
          </div>

          {/* Backspace */}
          <Button
            variant="outline"
            onClick={() => setInputNumber(inputNumber.slice(0, -1))}
            className="w-full"
          >
            {t('softphone.clear')}
          </Button>
        </div>
      </Card>

      {/* Call Status */}
      {calls.length === 0 && (
        <Card className="p-6 text-center text-muted-foreground">
          <Phone className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>{t('softphone.no_active_call')}</p>
        </Card>
      )}

      {/* Hidden Audio Element */}
      <audio ref={audioRef} />

      {/* RGPD Consent Dialog */}
      <RGPDConsentDialog
        isOpen={isOpen}
        onOpenChange={closeConsent}
        onConfirm={handleConsentConfirm}
        isLoading={isDialing}
        prospectName={pendingCall?.number || "Prospect"}
        isAI={false}
        agentName="Agent"
      />
    </div>
  );
}

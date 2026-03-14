import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  PhoneOff,
  Mic,
  MicOff,
  Clock,
  FileText,
  Loader,
  TrendingUp,
  TrendingDown,
  Activity,
  MessageSquare,
  FastForward,
  Target,
  UserCheck,
  UserMinus
} from "lucide-react";
import { AgentAssist } from "./AgentAssist";
import { CallTransferControl } from "./CallTransferControl";
import { useTenant } from "@/contexts/TenantContext";
import { useCallStore } from "@/lib/callStore";

interface ActiveCall {
  call: any;
  direction: "inbound" | "outbound";
  phoneNumber: string;
  status: "connecting" | "ringing" | "active" | "on-hold";
  duration: number;
  startTime: Date;
  callSid?: string;
  prospectId?: number;
  campaignId?: number;
  sentiment?: "positive" | "neutral" | "negative";
  qualityScore?: number;
  transcription: string;
}

export function SoftphoneAdvanced() {
  const { tenantId } = useTenant();
  const { pendingCall, clearPendingCall } = useCallStore();
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [_isSpeakerOn, _setIsSpeakerOn] = useState(true);
  const [callNotes, setCallNotes] = useState("");
  const [isPowerDialerMode, setIsPowerDialerMode] = useState(false);

  // Bloquer l'accès si tenantId n'est pas défini
  if (!tenantId) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Veuillez sélectionner une entreprise pour accéder au softphone.
      </div>
    );
  }

  const effectiveTenantId = tenantId;

  // tRPC Queries & Mutations
  const { data: prospectData, isPending: isProspectLoading, isError: isProspectError } = trpc.softphone.getProspectForCall.useQuery(
    { prospectId: activeCall?.prospectId || 0 },
    { 
      enabled: !!activeCall?.prospectId,
      retry: 1,
      staleTime: 30000,
    }
  );

  const saveNotesMutation = trpc.softphone.saveCallNotes.useMutation();
  const blindTransferMutation = trpc.softphone.blindTransfer.useMutation();
  const transferToAIMutation = trpc.softphone.transferToAI.useMutation();
  const qualifyMutation = trpc.softphone.qualifyAndNext.useMutation();

  // Handle pending calls from store (Initiated from Campaign or Prospect page)
  useEffect(() => {
    if (pendingCall) {
      handleStartCall(pendingCall.phoneNumber, pendingCall.prospectId, pendingCall.campaignId);
      clearPendingCall();
      if (pendingCall.campaignId) setIsPowerDialerMode(true);
    }
  }, [pendingCall]);

  const handleStartCall = (phoneNumber: string, prospectId?: number, campaignId?: number) => {
    setActiveCall({
      call: {},
      direction: "outbound",
      phoneNumber,
      status: "active",
      duration: 0,
      startTime: new Date(),
      callSid: Math.floor(Math.random() * 1000000).toString(),
      prospectId,
      campaignId,
      sentiment: "neutral",
      qualityScore: 70,
      transcription: ""
    });
    setCallNotes("");
    toast.info(`Appel vers ${phoneNumber} initié...`);
  };

  const handleQualify = async (status: string) => {
    if (!activeCall?.prospectId) return;
    
    try {
      const result = await qualifyMutation.mutateAsync({
        campaignId: activeCall.campaignId || 0,
        prospectId: activeCall.prospectId,
        status: status as any,
        notes: callNotes
      });

      toast.success(`Prospect qualifié: ${status}`);
      
      const nextProspect = (result as any)?.nextProspect;
      if (isPowerDialerMode && nextProspect) {
        toast.info("Passage au prospect suivant dans 3 secondes...");
        setActiveCall(null);
        setTimeout(() => {
          handleStartCall(
            nextProspect.phone || "", 
            nextProspect.id, 
            activeCall.campaignId
          );
        }, 3000);
      } else {
        setActiveCall(null);
      }
    } catch (error) {
      toast.error("Erreur lors de la qualification");
    }
  };

  // Real-time WebSocket simulation
  useEffect(() => {
    if (activeCall?.status === "active") {
      const interval = setInterval(() => {
        setActiveCall(prev => {
          if (!prev) return null;
          return {
            ...prev,
            duration: prev.duration + 1,
            sentiment: Math.random() > 0.8 ? (Math.random() > 0.5 ? "positive" : "negative") : prev.sentiment || "neutral",
            qualityScore: Math.min(100, Math.max(0, (prev.qualityScore || 70) + (Math.random() * 10 - 5))),
            transcription: prev.transcription + (Math.random() > 0.7 ? " ... " : "")
          };
        });
      }, 1000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [activeCall?.status]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 p-4">
      {/* Left Column: Call Controls & Campaign Context */}
      <div className="xl:col-span-1 space-y-4">
        <Card className={`overflow-hidden border-2 ${activeCall?.campaignId ? 'border-orange-500/50' : 'border-primary/20'}`}>
          <CardHeader className={`${activeCall?.campaignId ? 'bg-orange-50' : 'bg-primary/5'} pb-4`}>
            <div className="flex justify-between items-center">
              <Badge variant={activeCall?.campaignId ? "default" : "outline"} className={activeCall?.campaignId ? "bg-orange-500" : "animate-pulse"}>
                {activeCall?.campaignId ? "MODE CAMPAGNE" : (activeCall?.status === "active" ? "EN DIRECT" : "PRÊT")}
              </Badge>
              {activeCall?.status === "active" && (
                <CallTransferControl 
                  callId={parseInt(activeCall?.callSid || "0") || 0} 
                  onTransferToAI={() => {
                    toast.promise(transferToAIMutation.mutateAsync({ callId: parseInt(activeCall?.callSid || "0") || 0 }), {
                      loading: 'Transfert vers l\'IA en cours...',
                      success: 'Appel transféré à l\'IA avec succès',
                      error: 'Échec du transfert vers l\'IA'
                    });
                  }}
                  onTransferToHuman={(agentId) => {
                    toast.promise(blindTransferMutation.mutateAsync({ 
                      callId: parseInt(activeCall?.callSid || "0") || 0, 
                      targetPhoneNumber: agentId 
                    }), {
                      loading: 'Transfert vers l\'agent en cours...',
                      success: 'Appel transféré avec succès',
                      error: 'Échec du transfert'
                    });
                  }}
                />
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-6 text-center space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">
                {activeCall?.phoneNumber || "Prêt pour un appel"}
              </h2>
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span className="font-mono text-lg">
                  {activeCall ? formatDuration(activeCall.duration) : "00:00"}
                </span>
              </div>
            </div>

            <div className="flex justify-center gap-4">
              <Button
                variant={isMuted ? "destructive" : "outline"}
                size="icon"
                className="rounded-full h-12 w-12"
                onClick={() => {
                  const newMuted = !isMuted;
                  setIsMuted(newMuted);
                  toast.info(newMuted ? "Micro coupé" : "Micro activé");
                }}
              >
                {isMuted ? <MicOff /> : <Mic />}
              </Button>
              <Button
                variant="destructive"
                size="icon"
                className="rounded-full h-14 w-14 shadow-lg shadow-red-200"
                onClick={() => setActiveCall(null)}
              >
                <PhoneOff className="h-6 w-6" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Power Dialer Controls */}
        {activeCall?.campaignId && (
          <Card className="bg-orange-50 border-orange-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold text-orange-800 uppercase flex items-center gap-2">
                <Target className="w-3 h-3" /> Actions de Campagne
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <Button size="sm" variant="outline" className="bg-white border-orange-200 text-orange-700 hover:bg-orange-100" onClick={() => handleQualify("qualified")}>
                <UserCheck className="w-4 h-4 mr-2" /> Qualifié
              </Button>
              <Button size="sm" variant="outline" className="bg-white border-orange-200 text-orange-700 hover:bg-orange-100" onClick={() => handleQualify("lost")}>
                <UserMinus className="w-4 h-4 mr-2" /> Perdu
              </Button>
              <Button size="sm" variant="outline" className="bg-white border-orange-200 text-orange-700 hover:bg-orange-100 col-span-2" onClick={() => handleQualify("contacted")}>
                <FastForward className="w-4 h-4 mr-2" /> Suivant (Pas de réponse)
              </Button>
            </CardContent>
          </Card>
        )}

        {activeCall?.prospectId && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Fiche Prospect</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {isProspectLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : isProspectError || !prospectData ? (
                <div className="text-center py-2 text-muted-foreground italic">
                  Détails indisponibles
                </div>
              ) : (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Nom:</span>
                    <span className="font-medium">{(prospectData as any).firstName} {(prospectData as any).lastName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Entreprise:</span>
                    <span className="font-medium">{(prospectData as any).company || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <Badge variant="outline" className="capitalize">{(prospectData as any).status}</Badge>
                  </div>
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground mb-1">Dernière note:</p>
                    <p className="text-xs italic">{(prospectData as any).notes || "Aucune note"}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Middle Column: Live Transcription & Sentiment */}
      <div className="xl:col-span-2 space-y-4">
        <Card className="h-full flex flex-col">
          <CardHeader className="pb-2 border-b">
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" /> Transcription en direct
              </CardTitle>
              {activeCall && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    {activeCall.sentiment === "positive" ? <TrendingUp className="text-green-500 w-4 h-4" /> : 
                     activeCall.sentiment === "negative" ? <TrendingDown className="text-red-500 w-4 h-4" /> : 
                     <Activity className="text-blue-500 w-4 h-4" />}
                    <span className="text-xs font-bold uppercase">{activeCall.sentiment}</span>
                  </div>
                  <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${activeCall.qualityScore && activeCall.qualityScore > 70 ? 'bg-green-500' : activeCall.qualityScore && activeCall.qualityScore > 40 ? 'bg-orange-500' : 'bg-red-500'}`} 
                      style={{ width: `${activeCall.qualityScore || 0}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-sm">
            {!activeCall && (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 space-y-4">
                <MessageSquare className="w-12 h-12" />
                <p>En attente d'un appel actif...</p>
              </div>
            )}
            
            <div className="space-y-2">
              <p className="text-primary font-bold">Client:</p>
              <p className="bg-gray-50 p-2 rounded-lg border border-gray-100">
                {activeCall?.transcription || "En attente de parole..."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Column: AI Assist & Notes */}
      <div className="xl:col-span-1 space-y-4">
        {activeCall && (
          <AgentAssist 
            tenantId={effectiveTenantId}
            callSid={activeCall.callSid || ""}
            transcription={activeCall.transcription}
            onSuggestionClick={(suggestion) => {
              setCallNotes(prev => prev + "\n" + suggestion);
            }}
          />
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Notes de Qualification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={callNotes}
              onChange={(e) => setCallNotes(e.target.value)}
              placeholder="Prendre des notes pour la campagne..."
              className="min-h-[150px] text-sm"
            />
            <Button 
              className="w-full" 
              onClick={() => {
                if (activeCall?.prospectId) {
                  saveNotesMutation.mutate({ 
                    callId: parseInt(activeCall?.callSid || "0") || 0,
                    notes: callNotes 
                  });
                  toast.success("Notes enregistrées");
                }
              }}
              disabled={!activeCall?.prospectId || saveNotesMutation.isPending}
            >
              <FileText className="w-4 h-4 mr-2" /> Enregistrer les notes
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

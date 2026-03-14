import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { 
  MessageSquare, 
  Search, 
  Filter, 
  Smartphone, 
  MessageCircle, 
  Clock, 
  CheckCircle2, 
  XCircle,
  ChevronRight,
  Send,
  Users
} from "lucide-react";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { toast } from "sonner";

/** Type représentant le résultat d'un envoi individuel dans un envoi groupé */
type MessageSendResult = {
  success: boolean;
  phone?: string;
  error?: string;
};

export default function Messages() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  
  // État du formulaire d'envoi multiple
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [recipients, setRecipients] = useState("");
  const [messageContent, setMessageContent] = useState("");
  const [messageType, setMessageType] = useState<"sms" | "whatsapp">("sms");
  const [isSending, setIsSending] = useState(false);

  const {data: messages, isPending, refetch} = trpc.messaging.list.useQuery({});
  const sendMultipleMutation = // @ts-ignore - TODO: Add sendMultiple to router
    trpc.messaging.sendMultiple.useMutation();

  const filteredMessages = messages?.data?.filter((msg: any) => {
    const matchType = filterType === "all" || msg.type === filterType;
    const matchStatus = filterStatus === "all" || msg.status === filterStatus;
    const matchSearch = searchTerm === "" || 
      msg.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      msg.externalSid?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchType && matchStatus && matchSearch;
  }) || [];

  // Validation des numéros de téléphone
  const validatePhoneNumber = (phone: string): boolean => {
    // Accepte les formats internationaux avec + suivi de chiffres
    const phoneRegex = /^\+\d{1,3}\d{6,14}$/;
    return phoneRegex.test(phone.trim());
  };

  // Normalisation des numéros
  const normalizePhoneNumber = (phone: string): string => {
    return phone.trim().replace(/\s+/g, '');
  };

  // Gestion de l'envoi multiple
  const handleSendMultiple = async () => {
    if (!messageContent.trim()) {
      toast.error("Le message ne peut pas être vide");
      return;
    }

    if (!recipients.trim()) {
      toast.error("Veuillez saisir au moins un numéro de téléphone");
      return;
    }

    // Séparer les numéros par virgule et les nettoyer
    const phoneNumbers = recipients
      .split(',')
      .map(normalizePhoneNumber)
      .filter(phone => phone.length > 0);

    if (phoneNumbers.length === 0) {
      toast.error("Aucun numéro valide détecté");
      return;
    }

    // Valider tous les numéros
    const invalidNumbers = phoneNumbers.filter(phone => !validatePhoneNumber(phone));
    if (invalidNumbers.length > 0) {
      toast.error(
        `Numéros invalides détectés : ${invalidNumbers.join(', ')}. ` +
        `Format attendu : +33612345678, +49123456789, etc.`
      );
      return;
    }

    setIsSending(true);

    try {
      const result = await (sendMultipleMutation as any).mutateAsync({
        phoneNumbers,
        content: messageContent,
        type: messageType
      });

      // Afficher le résultat
      const successCount = result.results.filter((r: MessageSendResult) => r.success).length;
      const failCount = result.results.filter((r: MessageSendResult) => !r.success).length;

      if (failCount === 0) {
        toast.success(`✅ Message envoyé à ${successCount}/${phoneNumbers.length} contacts`);
      } else {
        toast.warning(
          `Message envoyé à ${successCount}/${phoneNumbers.length} contacts. ` +
          `${failCount} échec(s).`
        );
      }

      // Réinitialiser le formulaire et fermer le dialog
      setRecipients("");
      setMessageContent("");
      setIsDialogOpen(false);
      
      // Rafraîchir la liste des messages
      refetch();
    } catch (error: any) {
      toast.error(`Erreur lors de l'envoi : ${error.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 gap-1.5 font-medium"><CheckCircle2 className="w-3.5 h-3.5" /> Envoyé</Badge>;
      case "delivered":
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20 gap-1.5 font-medium"><CheckCircle2 className="w-3.5 h-3.5" /> Reçu</Badge>;
      case "failed":
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/20 gap-1.5 font-medium"><XCircle className="w-3.5 h-3.5" /> Échoué</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 gap-1.5 font-medium"><Clock className="w-3.5 h-3.5" /> En attente</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeIcon = (type: string) => {
    return type === "whatsapp" ? 
      <MessageCircle className="w-4 h-4 text-green-500" /> : 
      <Smartphone className="w-4 h-4 text-blue-500" />;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-primary flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <MessageSquare className="w-8 h-8 text-primary" />
            </div>
            {t('nav.messages', 'Messages')}
          </h1>
          <p className="text-muted-foreground mt-1 font-medium">
            Envoyez des messages à plusieurs contacts simultanément et consultez l'historique complet.
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Send className="w-4 h-4" />
              Envoyer un message
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Envoi de message groupé
              </DialogTitle>
              <DialogDescription>
                Envoyez un message à plusieurs contacts en une seule fois. Séparez les numéros par des virgules.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">
                  Type de message
                </label>
                <Select value={messageType} onValueChange={(value: "sms" | "whatsapp") => setMessageType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sms">
                      <div className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4" />
                        SMS
                      </div>
                    </SelectItem>
                    <SelectItem value="whatsapp">
                      <div className="flex items-center gap-2">
                        <MessageCircle className="w-4 h-4" />
                        WhatsApp
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">
                  Destinataires
                  <span className="text-muted-foreground font-normal ml-2">
                    (séparés par des virgules)
                  </span>
                </label>
                <Input
                  placeholder="+33612345678, +49123456789, +41123456789"
                  value={recipients}
                  onChange={(e) => setRecipients(e.target.value)}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Format international requis : +33 (France), +49 (Allemagne), +41 (Suisse), etc.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">
                  Message
                </label>
                <Textarea
                  placeholder="Saisissez votre message ici..."
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  rows={5}
                  className="resize-none"
                />
                <div className="flex justify-between items-center text-xs text-muted-foreground">
                  <span>{messageContent.length} caractères</span>
                  {messageType === "sms" && messageContent.length > 160 && (
                    <span className="text-yellow-600">
                      ⚠️ Message long ({Math.ceil(messageContent.length / 160)} SMS)
                    </span>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isSending}
              >
                Annuler
              </Button>
              <Button
                onClick={handleSendMultiple}
                disabled={isSending || !messageContent.trim() || !recipients.trim()}
                className="gap-2"
              >
                {isSending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Envoyer
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none shadow-sm bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Recherche</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Rechercher dans le contenu ou SID..." 
                  className="pl-9 bg-background/50 border-border/50 focus:ring-primary/20 transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="w-full md:w-48 space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Canal</label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="bg-background/50 border-border/50">
                  <SelectValue placeholder="Tous les canaux" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les canaux</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full md:w-48 space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Statut</label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="bg-background/50 border-border/50">
                  <SelectValue placeholder="Tous les statuts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="sent">Envoyé</SelectItem>
                  <SelectItem value="delivered">Reçu</SelectItem>
                  <SelectItem value="failed">Échoué</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="icon" className="shrink-0 bg-background/50 border-border/50">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-border/50 overflow-hidden bg-background/30">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="font-bold text-xs uppercase tracking-wider py-4">Canal</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider">Destinataire</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider">Contenu</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-center">Statut</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider">Date</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isPending ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="animate-pulse">
                      <TableCell colSpan={6} className="h-16 bg-muted/20"></TableCell>
                    </TableRow>
                  ))
                ) : filteredMessages.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-64 text-center">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <div className="p-4 bg-muted/50 rounded-full">
                          <MessageSquare className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <div className="space-y-1">
                          <p className="font-bold text-lg">Aucun message trouvé</p>
                          <p className="text-muted-foreground text-sm">Ajustez vos filtres ou envoyez votre premier message.</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => {setFilterType("all"); setFilterStatus("all"); setSearchTerm("");}}>
                          Réinitialiser les filtres
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMessages.map((msg: any) => (
                    <TableRow key={msg.id} className="hover:bg-muted/30 transition-colors group cursor-pointer" onClick={() => msg.prospectId && setLocation(`/prospect/${msg.prospectId}`)}>
                      <TableCell>
                        <div className="flex items-center gap-2 font-semibold">
                          <div className={cn("p-1.5 rounded-lg", msg.type === "whatsapp" ? "bg-green-500/10" : "bg-blue-500/10")}>
                            {getTypeIcon(msg.type)}
                          </div>
                          <span className="capitalize text-sm">{msg.type}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {msg.prospectId ? (
                            <>
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                P{msg.prospectId}
                              </div>
                              <span className="font-medium text-sm">Prospect #{msg.prospectId}</span>
                            </>
                          ) : (
                            <span className="font-medium text-sm text-muted-foreground">Contact direct</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[300px]">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <p className="truncate text-sm text-foreground/80 font-medium">{msg.content}</p>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs p-3 bg-card border-border shadow-xl">
                              <p className="text-sm leading-relaxed">{msg.content}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(msg.status)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold">{format(new Date(msg.createdAt), "dd MMM yyyy", { locale: fr })}</span>
                          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">{format(new Date(msg.createdAt), "HH:mm")}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm bg-gradient-to-br from-blue-500/5 to-transparent border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total SMS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-blue-600">
              {messages?.data?.filter((m: any) => m.type === "sms").length || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">Messages envoyés ce mois</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-gradient-to-br from-green-500/5 to-transparent border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total WhatsApp</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-green-600">
              {messages?.data?.filter((m: any) => m.type === "whatsapp").length || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">Messages envoyés ce mois</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-gradient-to-br from-red-500/5 to-transparent border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Taux d'échec</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-red-600">
              {messages?.data?.length ? Math.round((messages.data.filter((m: any) => m.status === "failed").length / messages.data.length) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">Basé sur les 30 derniers jours</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

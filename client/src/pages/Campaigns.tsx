import React, { useState, useEffect } from "react";
import { 
  Target, 
  Plus, 
  Upload, 
  Link as LinkIcon, 
  Play, 
  Pause, 
  Settings, 
  FileText,
  Mail,
  MessageSquare,
  Phone,
  CheckCircle2,
  AlertCircle,
  Headphones,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useCallStore } from "@/lib/callStore";

export default function Campaigns() {
  const { initiateCall } = useCallStore();
  const [activeTab, setActiveTab] = useState("list");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "import") {
      setIsImportDialogOpen(true);
    }
  }, []);

  // TRPC Queries & Mutations
  const utils = trpc.useContext();
  const campaignsQuery = trpc.campaign.list.useQuery({}, {
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const createCampaignMutation = trpc.campaign.create.useMutation({
    onSuccess: async () => {
      toast.success("Campagne créée avec succès");
      setIsCreateDialogOpen(false);
      // [BLOC 3] Invalidation forcée pour visibilité immédiate
      await utils.campaign.list.invalidate();
      await campaignsQuery.refetch();
    },
    onError: (error) => {
      toast.error(`Échec de la création : ${error.message}`);
    }
  });

  // Mock data for UI demonstration if API is empty
  const mockCampaigns = [
    { id: 1, name: "Qualification Leads Immobiliers", type: "ai_qualification", status: "active", contacts: 1250, conversion: "12%" },
    { id: 2, name: "Relance Factures Impayées", type: "human_appointment", status: "paused", contacts: 450, conversion: "8%" },
    { id: 3, name: "Sondage Satisfaction Client", type: "ai_qualification", status: "active", contacts: 3200, conversion: "15%" },
  ];

  const displayCampaigns = campaignsQuery.data?.data && campaignsQuery.data.data.length > 0 
    ? campaignsQuery.data.data 
    : mockCampaigns;

  const handleCreateCampaign = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const tenantId = parseInt(
      new URLSearchParams(window.location.search).get("tenantId") || 
      localStorage.getItem('currentTenantId') || "1"
    );
    
    try {
      await createCampaignMutation.mutateAsync({
        tenantId,
        name: formData.get("name") as string,
        description: formData.get("description") as string,
        type: formData.get("type") as any,
        config: {},
      });
      // La fermeture et le toast sont gérés par onSuccess de la mutation
    } catch (error) {
      // L'erreur est gérée par onError de la mutation
    }
  };

  const handleImportCSV = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    toast.success("Importation CSV lancée... (Simulation)");
    setIsImportDialogOpen(false);
  };

  const handleLinkList = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    toast.success("Liste liée à la campagne avec succès !");
    setIsLinkDialogOpen(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Target className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-3xl font-black tracking-tight">Campagnes Commerciales</h1>
          </div>
          <p className="text-muted-foreground">
            Gérez vos campagnes d'appels, SMS et emails automatisées par l'IA.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Upload className="w-4 h-4" />
                Importer CSV
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleImportCSV}>
                <DialogHeader>
                  <DialogTitle>Importer des contacts</DialogTitle>
                  <DialogDescription>
                    Téléchargez un fichier CSV pour ajouter massivement des prospects à votre base.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="csvFile">Fichier CSV</Label>
                    <Input id="csvFile" type="file" accept=".csv" required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="listName">Nom de la nouvelle liste</Label>
                    <Input id="listName" placeholder="ex: Prospects Salon 2024" required />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">Lancer l'importation</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 shadow-lg shadow-primary/20">
                <Plus className="w-4 h-4" />
                Nouvelle Campagne
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreateCampaign}>
                <DialogHeader>
                  <DialogTitle>Créer une campagne</DialogTitle>
                  <DialogDescription>
                    Configurez les paramètres de votre nouvelle action commerciale.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Nom de la campagne</Label>
                    <Input id="name" name="name" placeholder="ex: Campagne de Printemps" required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="type">Type de campagne</Label>
                    <Select name="type" defaultValue="ai_qualification">
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez un type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ai_qualification">Qualification IA (Appels)</SelectItem>
                        <SelectItem value="human_appointment">Prise de RDV Humaine</SelectItem>
                        <SelectItem value="hybrid_reception">Réception Hybride</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description">Description</Label>
                    <Input id="description" name="description" placeholder="Objectif de la campagne..." />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createCampaignMutation.isPending} className="gap-2">
                    {createCampaignMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Création en cours...
                      </>
                    ) : (
                      "Créer la campagne"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 bg-muted/50 p-1 rounded-xl border border-border">
          <TabsTrigger value="list" className="gap-2">
            <FileText className="w-4 h-4" />
            Mes Campagnes
          </TabsTrigger>
          <TabsTrigger value="stats" className="gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Statistiques Globales
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayCampaigns.map((campaign: any) => (
              <Card key={campaign.id} className="overflow-hidden border-border hover:border-primary/50 transition-colors group">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                      campaign.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {campaign.status === 'active' ? 'En cours' : 'En pause'}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <CardTitle className="text-xl mt-2">{campaign.name}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {campaign.description || "Aucune description fournie."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-muted/50 p-3 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Contacts</p>
                      <p className="text-lg font-bold">{campaign.contacts || 0}</p>
                    </div>
                    <div className="bg-muted/50 p-3 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Conversion</p>
                      <p className="text-lg font-bold text-primary">{campaign.conversion || "0%"}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mb-6">
                    <div className="flex -space-x-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="w-8 h-8 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-bold">
                          {String.fromCharCode(64 + i)}
                        </div>
                      ))}
                      <div className="w-8 h-8 rounded-full border-2 border-background bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                        +12
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">Listes liées</span>
                  </div>

                  <div className="flex gap-2">
                    {campaign.status === 'active' && (
                      <Button 
                        variant="default" 
                        className="flex-1 gap-2 bg-orange-600 hover:bg-orange-700"
                        onClick={() => {
                          initiateCall({
                            phoneNumber: "06 12 34 56 78", // Simulation du premier prospect
                            prospectId: 1,
                            campaignId: campaign.id,
                            prospectName: "Jean Dupont"
                          });
                          toast.info("Session de campagne lancée");
                        }}
                      >
                        <Headphones className="w-4 h-4" /> Lancer Session
                      </Button>
                    )}
                    <Button 
                      variant={campaign.status === 'active' ? "outline" : "default"} 
                      className={campaign.status === 'active' ? "flex-1 gap-2" : "w-full gap-2"}
                      onClick={() => {
                        toast.success(campaign.status === 'active' ? "Campagne suspendue" : "Campagne relancée");
                      }}
                    >
                      {campaign.status === 'active' ? (
                        <><Pause className="w-4 h-4" /> Suspendre</>
                      ) : (
                        <><Play className="w-4 h-4" /> Relancer</>
                      )}
                    </Button>
                    
                    <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="secondary" size="icon" className="shrink-0">
                          <LinkIcon className="w-4 h-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <form onSubmit={handleLinkList}>
                          <DialogHeader>
                            <DialogTitle>Lier une liste de contacts</DialogTitle>
                            <DialogDescription>
                              Sélectionnez une liste de prospects à injecter dans la campagne "{campaign.name}".
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                              <Label htmlFor="listSelect">Choisir une liste</Label>
                              <Select required>
                                <SelectTrigger>
                                  <SelectValue placeholder="Sélectionnez une liste existante" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="list1">Prospects Salon 2024 (500 contacts)</SelectItem>
                                  <SelectItem value="list2">Leads Site Web Janvier (120 contacts)</SelectItem>
                                  <SelectItem value="list3">Anciens Clients Relance (850 contacts)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg flex gap-3">
                              <AlertCircle className="w-5 h-5 text-blue-600 shrink-0" />
                              <p className="text-xs text-blue-800">
                                Lier une liste lancera automatiquement les actions programmées (Appels IA, SMS, etc.) pour les nouveaux contacts.
                              </p>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button type="submit">Confirmer la liaison</Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Empty State / Add Card */}
            <button 
              onClick={() => setIsCreateDialogOpen(true)}
              className="border-2 border-dashed border-muted-foreground/20 rounded-xl p-6 flex flex-col items-center justify-center gap-3 hover:border-primary/50 hover:bg-primary/5 transition-all group"
            >
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                <Plus className="w-6 h-6 text-muted-foreground group-hover:text-primary" />
              </div>
              <div className="text-center">
                <p className="font-bold text-muted-foreground group-hover:text-primary">Nouvelle Campagne</p>
                <p className="text-xs text-muted-foreground">Créez une action commerciale en 2 minutes</p>
              </div>
            </button>
          </div>
        </TabsContent>

        <TabsContent value="stats" className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Appels IA</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">12,450</div>
                <p className="text-xs text-green-600 mt-1">+15% par rapport au mois dernier</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">RDV Qualifiés</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">842</div>
                <p className="text-xs text-green-600 mt-1">+5% par rapport au mois dernier</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Économie Réalisée</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">4,250 €</div>
                <p className="text-xs text-muted-foreground mt-1">Basé sur le coût agent humain</p>
              </CardContent>
            </Card>
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Canaux de Communication</CardTitle>
              <CardDescription>Répartition de l'engagement par canal</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <div className="flex items-center gap-2"><Phone className="w-4 h-4" /> Appels IA</div>
                    <span className="font-bold">65%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary w-[65%]"></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <div className="flex items-center gap-2"><MessageSquare className="w-4 h-4" /> SMS / WhatsApp</div>
                    <span className="font-bold">25%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 w-[25%]"></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <div className="flex items-center gap-2"><Mail className="w-4 h-4" /> Emails</div>
                    <span className="font-bold">10%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-slate-400 w-[10%]"></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

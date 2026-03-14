import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmailConfigCard } from "./EmailConfigCard";
import { 
  ShoppingCart, 
  Globe, 
  Cloud, 
  MessageSquare, 
  Calendar, 
  ExternalLink, 
  Settings2,
  CheckCircle2,
  Plus,
  Mail
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface IntegrationApp {
  id: string;
  name: string;
  description: string;
  category: "Caisse" | "Stockage" | "Web" | "Communication";
  icon: any;
  status: "connected" | "disconnected" | "coming_soon";
  color: string;
}

const APPS: IntegrationApp[] = [
  {
    id: "pos",
    name: "Caisse Enregistreuse",
    description: "Synchronisez vos commandes IA avec Lightspeed, SumUp ou Square.",
    category: "Caisse",
    icon: ShoppingCart,
    status: "connected",
    color: "text-blue-500 bg-blue-500/10",
  },
  {
    id: "drive",
    name: "Google Drive",
    description: "Sauvegardez vos rapports et réservations sur Google Sheets.",
    category: "Stockage",
    icon: Cloud,
    status: "disconnected",
    color: "text-green-500 bg-green-500/10",
  },
  {
    id: "website",
    name: "API Site Web",
    description: "Connectez votre site WordPress ou Shopify via Webhooks.",
    category: "Web",
    icon: Globe,
    status: "disconnected",
    color: "text-purple-500 bg-purple-500/10",
  },
  {
    id: "whatsapp",
    name: "WhatsApp Business",
    description: "Envoyez des confirmations de commande par message.",
    category: "Communication",
    icon: MessageSquare,
    status: "coming_soon",
    color: "text-emerald-500 bg-emerald-500/10",
  },
  {
    id: "calendar",
    name: "Google Calendar",
    description: "Synchronisation bidirectionnelle des rendez-vous.",
    category: "Communication",
    icon: Calendar,
    status: "disconnected",
    color: "text-red-500 bg-red-500/10",
  }
];

export function IntegrationMarketplace({ onConfigurePOS }: { onConfigurePOS?: () => void }) {
  const [_filter, _setFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<string>("apps");

  const handleAction = (appId: string) => {
    if (appId === "pos" && onConfigurePOS) {
      onConfigurePOS();
    } else {
      toast.info(`L'intégration ${appId} sera bientôt disponible en configuration directe.`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">App Marketplace</h2>
          <p className="text-muted-foreground">Connectez vos outils préférés en quelques secondes.</p>
        </div>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Suggérer une App
        </Button>
      </div>

      {/* Tabs pour Apps et Email */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-muted/50 p-1 rounded-xl border border-border">
          <TabsTrigger value="apps" className="gap-2 rounded-lg">
            <ShoppingCart className="w-4 h-4" />
            <span>Apps</span>
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-2 rounded-lg">
            <Mail className="w-4 h-4" />
            <span>Email</span>
          </TabsTrigger>
        </TabsList>

        {/* Apps Tab */}
        <TabsContent value="apps" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {APPS.map((app) => (
              <Card key={app.id} className={cn(
                "relative overflow-hidden transition-all hover:shadow-md border-border/50",
                app.status === "coming_soon" && "opacity-70 grayscale-[0.5]"
              )}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div className={cn("p-2 rounded-lg", app.color)}>
                      <app.icon className="w-6 h-6" />
                    </div>
                    <Badge variant={
                      app.status === "connected" ? "default" : 
                      app.status === "coming_soon" ? "secondary" : "outline"
                    }>
                      {app.status === "connected" ? "Connecté" : 
                       app.status === "coming_soon" ? "Bientôt" : "Disponible"}
                    </Badge>
                  </div>
                  <CardTitle className="mt-4 text-lg">{app.name}</CardTitle>
                  <CardDescription className="line-clamp-2 min-h-[40px]">
                    {app.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{app.category}</span>
                    {app.status === "connected" && (
                      <div className="flex items-center gap-1 text-green-600 font-medium">
                        <CheckCircle2 className="w-4 h-4" />
                        Actif
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="pt-2 border-t bg-muted/5">
                  <div className="flex w-full gap-2">
                    <Button 
                      variant={app.status === "connected" ? "outline" : "default"} 
                      className="flex-1 gap-2"
                      disabled={app.status === "coming_soon"}
                      onClick={() => handleAction(app.id)}
                    >
                      <Settings2 className="w-4 h-4" />
                      {app.status === "connected" ? "Configurer" : "Installer"}
                    </Button>
                    <Button variant="ghost" size="icon" disabled={app.status === "coming_soon"}>
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Email Tab */}
        <TabsContent value="email" className="space-y-4 pt-4">
          <EmailConfigCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * WORKFLOW BUILDER
 * Éditeur visuel pour la création et modification de workflows
 * ✅ CATALOGUE ENRICHI : IA, CRM, Communication, Logique, Technique, RDV, Commandes
 * ✅ BLOC 1 : Intégration des modèles de métiers (IndustryWorkflowsList)
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Plus, 
  Trash2, 
  Settings2, 
  ArrowRight, 
  Save, 
  Bot,
  MessageSquare,
  Calendar,
  Zap,
  Loader2,
  BrainCircuit,
  Target,
  FileSearch,
  Calculator,
  StickyNote,
  RefreshCw,
  Tag,
  UserCheck,
  Download,
  Bell,
  Split,
  Globe,
  ShoppingCart,
  Clock
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DynamicStepForm } from "./DynamicStepForm";
import { IndustryWorkflowsList } from "./IndustryWorkflowsList";
import { useTranslation } from "react-i18next";

interface WorkflowBuilderProps {
  tenantId: number;
  workflowId?: number;
  onSave?: () => void;
}

export function WorkflowBuilder({ tenantId, workflowId, onSave }: WorkflowBuilderProps) {
  const { t } = useTranslation(['common']);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [trigger, setTrigger] = useState("call_completed");
  const [steps, setSteps] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const utils = trpc.useContext();

  // Récupérer le métier configuré pour afficher les modèles correspondants
  const { data: configData } = trpc.industryConfig.getCurrentConfig.useQuery();
  const industryId = configData?.data?.industryId;

  // Charger le workflow si en mode édition
  const { data: workflow, isLoading: isLoadingWorkflow } = trpc.workflow.getById.useQuery(
    { workflowId: workflowId! },
    { 
      enabled: !!workflowId,
    }
  );

  // Mettre à jour l'état quand les données sont chargées
  useEffect(() => {
    if (workflow) {
      setName(workflow.name);
      setDescription(workflow.description || "");
      setTrigger(workflow.triggerType || "call_completed");
      
      let parsedActions = [];
      try {
        if (typeof workflow.actions === 'string') {
          parsedActions = JSON.parse(workflow.actions);
        } else if (Array.isArray(workflow.actions)) {
          parsedActions = workflow.actions;
        }
      } catch (e) {
        parsedActions = [];
      }
      setSteps(parsedActions);
    }
  }, [workflow]);

  // Mutation pour créer/mettre à jour
  const upsertMutation = trpc.workflow.create.useMutation({
    onSuccess: () => {
      toast.success("Workflow enregistré !");
      utils.workflow.list.invalidate();
      if (onSave) onSave();
    },
    onError: (err) => {
      toast.error(`Erreur : ${err.message}`);
    },
    onSettled: () => setIsSaving(false)
  });

  const addStep = (type: string, label: string) => {
    const newStep = {
      id: `step_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type,
      label,
      config: getDefaultConfig(type),
      order: steps.length
    };
    setSteps([...steps, newStep]);
    toast.info(`Action "${label}" ajoutée`);
  };

  const removeStep = (id: string) => {
    setSteps(steps.filter(s => s.id !== id));
  };

  const handleSave = () => {
    if (!name) {
      toast.error("Le nom du workflow est requis");
      return;
    }
    setIsSaving(true);
    upsertMutation.mutate({
      tenantId,
      name,
      description,
      triggerType: trigger as any,
      actions: steps,
          });
  };

  const getDefaultConfig = (type: string) => {
    switch (type) {
      case "ai_summary": return { type: "general", extract_key_points: true };
      case "ai_intent_analysis": return { model: "advanced", categories: ["DEVIS", "RDV", "RECLAMATION"] };
      case "send_sms": return { message: "Bonjour {{prospect.firstName}}, nous avons bien reçu votre appel." };
      case "crm_create_task": return { title: "Suivi client", priority: "medium" };
      case "ai_sentiment_analysis": return { detect_urgency: true };
      case "create_order": return { items: [], total: 0, currency: "EUR" };
      default: return {};
    }
  };

  if (workflowId && isLoadingWorkflow) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const ActionButton = ({ type, label, icon: Icon, color }: any) => (
    <Button 
      variant="outline" 
      className="flex flex-col h-auto py-4 gap-3 bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:border-primary transition-all"
      onClick={() => addStep(type, label)}
    >
      <Icon className={`w-6 h-6 ${color}`} />
      <span className="text-[10px] font-bold uppercase tracking-tighter text-center leading-tight">{label}</span>
    </Button>
  );

  const ActionCategory = ({ title, children }: any) => (
    <div className="space-y-3">
      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 px-1">{title}</h4>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {children}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header & General Info */}
      <Card className="border-none shadow-sm bg-slate-50/50">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2 text-2xl font-black">
              <Settings2 className="w-6 h-6 text-primary" />
              {workflowId ? "Configuration Workflow" : "Nouveau Workflow"}
            </CardTitle>
            <Button onClick={handleSave} disabled={isSaving} className="gap-2 font-bold shadow-lg shadow-primary/20">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isSaving ? "Enregistrement..." : "Sauvegarder"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-xs font-bold uppercase text-muted-foreground tracking-widest">{t('common:workflows.workflow_name', 'Nom du workflow')}</Label>
              <Input 
                id="name" 
                placeholder={t('common:workflows.workflow_name_example', 'Ex: Suivi après appel devis')} 
                className="bg-white border-none shadow-sm h-12"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trigger" className="text-xs font-bold uppercase text-muted-foreground tracking-widest">{t('common:workflows.trigger', 'Événement déclencheur')}</Label>
              <Select value={trigger} onValueChange={setTrigger}>
                <SelectTrigger id="trigger" className="bg-white border-none shadow-sm h-12">
                  <SelectValue placeholder={t('common:workflows.select_trigger', 'Choisir un déclencheur')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="call_received">Appel reçu (début)</SelectItem>
                  <SelectItem value="call_completed">Appel terminé (fin)</SelectItem>
                  <SelectItem value="prospect_created">Nouveau prospect créé</SelectItem>
                  <SelectItem value="appointment_scheduled">RDV planifié</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="desc" className="text-xs font-bold uppercase text-muted-foreground tracking-widest">{t('common:workflows.description', 'Description & Objectif')}</Label>
            <Input 
              id="desc" 
              placeholder={t('common:workflows.description_example', 'Ex: Envoie un SMS automatique et crée une tâche si le client demande un devis')} 
              className="bg-white border-none shadow-sm h-12"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* ✅ BLOC 1 : Modèles de métiers (Blueprints) */}
      {industryId && (
        <IndustryWorkflowsList 
          industryId={industryId} 
          tenantId={tenantId} 
        />
      )}

      {/* Catalogue d'Actions */}
      <Card className="border-none shadow-sm bg-slate-900 overflow-hidden">
        <CardHeader className="border-b border-slate-800 bg-slate-900/50">
          <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-500" />
            Catalogue d'Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-8">
          <ActionCategory title="Intelligence Artificielle">
            <ActionButton type="ai_summary" label="Résumé IA" icon={BrainCircuit} color="text-indigo-400" />
            <ActionButton type="ai_intent_analysis" label="Analyse Intention" icon={Target} color="text-purple-400" />
            <ActionButton type="ai_sentiment_analysis" label="Sentiment" icon={Bot} color="text-blue-400" />
          </ActionCategory>

          <ActionCategory title="Communication">
            <ActionButton type="send_sms" label="Envoyer SMS" icon={MessageSquare} color="text-green-400" />
            <ActionButton type="send_email" label="Envoyer Email" icon={Globe} color="text-sky-400" />
          </ActionCategory>

          <ActionCategory title="Métier & CRM">
            <ActionButton type="create_order" label="Créer Commande" icon={ShoppingCart} color="text-orange-400" />
            <ActionButton type="crm_create_task" label="Créer Tâche" icon={StickyNote} color="text-yellow-400" />
            <ActionButton type="appointment_create" label="Prendre RDV" icon={Calendar} color="text-red-400" />
          </ActionCategory>
        </CardContent>
      </Card>

      {/* Steps List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-black text-sm uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-primary" />
            Séquence d'actions
          </h3>
          <Badge variant="secondary" className="font-bold">{steps.length} étape(s)</Badge>
        </div>
        
        {steps.length === 0 ? (
          <Card className="border-dashed border-2 bg-muted/5 py-12">
            <CardContent className="text-center text-muted-foreground">
              <Plus className="w-12 h-12 mx-auto mb-4 opacity-10" />
              <p className="font-medium">Votre séquence est vide</p>
              <p className="text-xs mt-1">Ajoutez des actions depuis le catalogue ci-dessous.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {steps.map((step, index) => (
              <Card key={step.id || index} className="relative group border-none shadow-sm hover:shadow-md transition-all border-l-4 border-l-primary bg-white">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="bg-primary/10 text-primary w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg">
                    {index + 1}
                  </div>
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className="capitalize font-bold px-2 py-0">
                          {step.label || step.type.replace(/_/g, ' ')}
                        </Badge>
                        {step.type.startsWith('ai_') && (
                          <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-100 text-[10px] font-black uppercase">IA Engine</Badge>
                        )}
                      </div>
                    </div>
                    
                    {/* ✅ BLOC 7 : Formulaire dynamique par type d'action */}
                    <DynamicStepForm 
                      type={step.type} 
                      config={step.config || {}} 
                      onChange={(newConfig) => {
                        const newSteps = [...steps];
                        newSteps[index] = { ...newSteps[index], config: newConfig };
                        setSteps(newSteps);
                      }}
                    />
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-50"
                    onClick={() => removeStep(step.id)}
                  >
                    <Trash2 className="w-5 h-5" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add Step Buttons - ENRICHED CATALOG */}
      <Card className="bg-slate-900 border-none shadow-xl overflow-hidden">
        <CardContent className="p-6">
          <Label className="text-[10px] font-black uppercase text-slate-400 mb-4 block tracking-[0.2em]">Catalogue d'Actions – Secrétaire en Ligne</Label>
          
          <Tabs defaultValue="ai" className="w-full">
            <TabsList className="grid grid-cols-3 md:grid-cols-6 bg-slate-800 p-1 h-auto gap-1">
              <TabsTrigger value="ai" className="data-[state=active]:bg-primary font-bold">1. IA</TabsTrigger>
              <TabsTrigger value="crm" className="data-[state=active]:bg-primary font-bold">2. CRM</TabsTrigger>
              <TabsTrigger value="comm" className="data-[state=active]:bg-primary font-bold">3. Communication</TabsTrigger>
              <TabsTrigger value="logic" className="data-[state=active]:bg-primary font-bold">4. Logique</TabsTrigger>
              <TabsTrigger value="tech" className="data-[state=active]:bg-primary font-bold">5. Technique</TabsTrigger>
              <TabsTrigger value="orders" className="data-[state=active]:bg-primary font-bold">6. Commandes</TabsTrigger>
            </TabsList>

            <TabsContent value="ai" className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <ActionButton type="ai_summary" label={t('common:workflows.actions.ai_summary', 'Résumé IA')} icon={Bot} color="text-indigo-400" />
              <ActionButton type="ai_intent" label={t('common:workflows.actions.ai_intent', 'Intention IA')} icon={Target} color="text-emerald-400" />
              <ActionButton type="ai_sentiment" label={t('common:workflows.actions.ai_sentiment', 'Sentiment IA')} icon={Zap} color="text-amber-400" />
              <ActionButton type="ai_score" label={t('common:workflows.actions.ai_score', 'Scoring Lead')} icon={BrainCircuit} color="text-rose-400" />
              <ActionButton type="ai_cv_detect" label="Détection CV" icon={FileSearch} color="text-sky-400" />
              <ActionButton type="ai_cv_extract" label="Extraction CV" icon={Download} color="text-blue-400" />
              <ActionButton type="ai_cv_classify" label="Triage CV" icon={Tag} color="text-purple-400" />
              <ActionButton type="ai_calculate" label="Calcul IA" icon={Calculator} color="text-orange-400" />
            </TabsContent>

            <TabsContent value="crm" className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <ActionButton type="crm_create_task" label="Créer Tâche" icon={Calendar} color="text-rose-400" />
              <ActionButton type="crm_add_note" label="Ajouter Note" icon={StickyNote} color="text-amber-400" />
              <ActionButton type="crm_change_status" label="Changer Statut" icon={RefreshCw} color="text-emerald-400" />
              <ActionButton type="crm_add_tag" label="Ajouter Tag" icon={Tag} color="text-sky-400" />
              <ActionButton type="crm_assign_agent" label="Attribuer Agent" icon={UserCheck} color="text-indigo-400" />
              <ActionButton type="crm_export" label="Export Données" icon={Download} color="text-slate-400" />
            </TabsContent>

            <TabsContent value="comm" className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <ActionButton type="send_sms" label={t('common:workflows.actions.send_sms', 'Envoi SMS')} icon={MessageSquare} color="text-sky-400" />
              <ActionButton type="send_email" label={t('common:workflows.actions.send_email', 'Envoi Email')} icon={MessageSquare} color="text-blue-400" />
              <ActionButton type="drive" label="Drive / Fichiers" icon={Download} color="text-purple-400" />
              <ActionButton type="notify_agent" label="Notif Agent" icon={Bell} color="text-amber-400" />
              <ActionButton type="notify_client" label="Notif Client" icon={Bell} color="text-emerald-400" />
            </TabsContent>

            <TabsContent value="logic" className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <ActionButton type="logic_if_else" label="IF / ELSE" icon={Split} color="text-purple-400" />
              <ActionButton type="logic_delay" label="Temporisation" icon={Clock} color="text-slate-400" />
            </TabsContent>

            <TabsContent value="tech" className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <ActionButton type="tech_webhook" label="Webhook" icon={Globe} color="text-emerald-400" />
              <ActionButton type="tech_log" label="Log Interne" icon={FileSearch} color="text-slate-400" />
            </TabsContent>

            <TabsContent value="orders" className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <ActionButton type="order_create" label="Créer Commande" icon={ShoppingCart} color="text-rose-400" />
              <ActionButton type="order_status" label="Statut Livraison" icon={RefreshCw} color="text-sky-400" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

export default WorkflowBuilder;

import React, { useState } from "react";
import { logger } from "@/lib/logger";
import {
  Plus,
  Trash2,
  Save,
  Play,
  Settings,
  ArrowRight,
  Phone,
  MessageSquare,
  CheckSquare,
  Clock,
  Users,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ============================================
// TYPES
// ============================================

type WorkflowTrigger =
  | "call_received"
  | "call_completed"
  | "prospect_created"
  | "appointment_scheduled";

type WorkflowActionType =
  | "send_sms"
  | "send_email"
  | "create_task"
  | "assign_prospect"
  | "schedule_followup";

interface WorkflowAction {
  id: string;
  type: WorkflowActionType;
  config: Record<string, any>;
  position: { x: number; y: number };
}

interface Workflow {
  id: string;
  name: string;
  trigger: WorkflowTrigger;
  actions: WorkflowAction[];
  isActive: boolean;
}

// ============================================
// WORKFLOW EDITOR
// ============================================

export function WorkflowEditor() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState("");
  const [selectedTrigger, setSelectedTrigger] = useState<WorkflowTrigger>("call_received");
  const [_draggedAction, setDraggedAction] = useState<WorkflowActionType | null>(null);
  const [editingAction, setEditingAction] = useState<WorkflowAction | null>(null);

  const triggers: { value: WorkflowTrigger; label: string; icon: React.ReactNode }[] = [
    { value: "call_received", label: "Appel reçu", icon: <Phone size={20} /> },
    { value: "call_completed", label: "Appel terminé", icon: <Phone size={20} /> },
    { value: "prospect_created", label: "Prospect créé", icon: <Users size={20} /> },
    { value: "appointment_scheduled", label: "Rendez-vous planifié", icon: <Clock size={20} /> },
  ];

  const actions: { value: WorkflowActionType; label: string; icon: React.ReactNode }[] = [
    { value: "send_sms", label: "Envoyer SMS", icon: <MessageSquare size={20} /> },
    { value: "send_email", label: "Envoyer Email", icon: <MessageSquare size={20} /> },
    { value: "create_task", label: "Créer Tâche", icon: <CheckSquare size={20} /> },
    { value: "assign_prospect", label: "Assigner Prospect", icon: <Users size={20} /> },
    { value: "schedule_followup", label: "Planifier Relance", icon: <Clock size={20} /> },
  ];

  const handleCreateWorkflow = () => {
    if (!newWorkflowName) return;

    const newWorkflow: Workflow = {
      id: `workflow-${Date.now()}`,
      name: newWorkflowName,
      trigger: selectedTrigger,
      actions: [],
      isActive: true,
    };

    setWorkflows([...workflows, newWorkflow]);
    setSelectedWorkflow(newWorkflow);
    setNewWorkflowName("");
    setIsCreating(false);
  };

  const handleAddAction = (actionType: WorkflowActionType, x: number, y: number) => {
    if (!selectedWorkflow) return;

    const newAction: WorkflowAction = {
      id: `action-${Date.now()}`,
      type: actionType,
      config: {},
      position: { x, y },
    };

    const updatedWorkflow = {
      ...selectedWorkflow,
      actions: [...selectedWorkflow.actions, newAction],
    };

    setSelectedWorkflow(updatedWorkflow);
    setWorkflows(
      workflows.map((w) => (w.id === updatedWorkflow.id ? updatedWorkflow : w))
    );
  };

  const handleDeleteAction = (actionId: string) => {
    if (!selectedWorkflow) return;

    const updatedWorkflow = {
      ...selectedWorkflow,
      actions: selectedWorkflow.actions.filter((a) => a.id !== actionId),
    };

    setSelectedWorkflow(updatedWorkflow);
    setWorkflows(
      workflows.map((w) => (w.id === updatedWorkflow.id ? updatedWorkflow : w))
    );
  };

  const handleSaveWorkflow = async () => {
    if (!selectedWorkflow) return;

    // TODO: Call tRPC to save workflow
    logger.info("Saving workflow:", selectedWorkflow);
  };

  const handleTestWorkflow = async () => {
    if (!selectedWorkflow) return;

    // TODO: Call tRPC to test workflow
    logger.info("Testing workflow:", selectedWorkflow);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">Éditeur de Workflows</h1>
        <p className="text-slate-400">
          Créez des automatisations visuelles pour vos processus métier
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Workflows List */}
        <div className="lg:col-span-1">
          <Card className="bg-slate-800 border-slate-700 h-full">
            <CardHeader>
              <CardTitle className="text-white">Workflows</CardTitle>
              <CardDescription className="text-slate-400">
                {workflows.length} workflow(s)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {workflows.map((workflow) => (
                <div
                  key={workflow.id}
                  onClick={() => setSelectedWorkflow(workflow)}
                  className={`p-3 rounded-lg cursor-pointer transition-all ${
                    selectedWorkflow?.id === workflow.id
                      ? "bg-primary/20 border-2 border-primary"
                      : "bg-slate-700 hover:bg-slate-600 border border-slate-600"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-white text-sm">{workflow.name}</p>
                      <p className="text-slate-400 text-xs">
                        {workflow.actions.length} action(s)
                      </p>
                    </div>
                    {workflow.isActive && (
                      <Badge className="bg-green-500">Actif</Badge>
                    )}
                  </div>
                </div>
              ))}

              <Dialog open={isCreating} onOpenChange={setIsCreating}>
                <DialogTrigger asChild>
                  <Button className="w-full gap-2 bg-primary hover:bg-primary/90 text-white mt-4">
                    <Plus size={20} />
                    Nouveau Workflow
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-slate-800 border-slate-700">
                  <DialogHeader>
                    <DialogTitle className="text-white">Créer un workflow</DialogTitle>
                    <DialogDescription className="text-slate-400">
                      Définissez le nom et le déclencheur du workflow
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Input
                      placeholder="Nom du workflow"
                      value={newWorkflowName}
                      onChange={(e) => setNewWorkflowName(e.target.value)}
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                    <Select value={selectedTrigger} onValueChange={(value) => setSelectedTrigger(value as WorkflowTrigger)}>
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-700 border-slate-600">
                        {triggers.map((trigger) => (
                          <SelectItem key={trigger.value} value={trigger.value}>
                            {trigger.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleCreateWorkflow}
                      className="w-full bg-primary hover:bg-primary/90 text-white"
                    >
                      Créer
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </div>

        {/* Editor */}
        <div className="lg:col-span-3 space-y-6">
          {selectedWorkflow ? (
            <>
              {/* Workflow Header */}
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-white">{selectedWorkflow.name}</h2>
                      <p className="text-slate-400 text-sm">
                        Déclencheur:{" "}
                        {triggers.find((t) => t.value === selectedWorkflow.trigger)?.label}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={handleTestWorkflow}
                      >
                        <Play size={16} />
                        Tester
                      </Button>
                      <Button
                        size="sm"
                        className="gap-2 bg-primary hover:bg-primary/90 text-white"
                        onClick={handleSaveWorkflow}
                      >
                        <Save size={16} />
                        Enregistrer
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Canvas */}
              <Card className="bg-slate-800 border-slate-700 min-h-96">
                <CardContent className="pt-6">
                  <div className="relative bg-slate-900 rounded-lg p-8 min-h-96 border-2 border-dashed border-slate-600">
                    {/* Trigger Node */}
                    <div className="flex items-center gap-4">
                      <div className="bg-primary/20 border-2 border-primary rounded-lg p-4 text-center">
                        <Zap className="text-primary mx-auto mb-2" size={24} />
                        <p className="text-white text-sm font-semibold">
                          {triggers.find((t) => t.value === selectedWorkflow.trigger)?.label}
                        </p>
                      </div>

                      {/* Actions Chain */}
                      {selectedWorkflow.actions.length > 0 && (
                        <>
                          <ArrowRight className="text-slate-500" size={24} />
                          <div className="flex flex-wrap gap-4">
                            {selectedWorkflow.actions.map((action, index) => (
                              <div key={action.id} className="flex items-center gap-4">
                                <ActionNode
                                  action={action}
                                  onDelete={() => handleDeleteAction(action.id)}
                                  onEdit={() => setEditingAction(action)}
                                  actionLabel={
                                    actions.find((a) => a.value === action.type)?.label ||
                                    action.type
                                  }
                                />
                                {index < selectedWorkflow.actions.length - 1 && (
                                  <ArrowRight className="text-slate-500" size={24} />
                                )}
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Drop Zone */}
                    <div className="mt-8 p-8 border-2 border-dashed border-slate-600 rounded-lg text-center">
                      <p className="text-slate-400 mb-4">Glissez une action ici</p>
                      <div className="grid grid-cols-2 gap-2">
                        {actions.map((action) => (
                          <button
                            key={action.value}
                            draggable
                            onDragStart={() => setDraggedAction(action.value)}
                            onDragEnd={() => setDraggedAction(null)}
                            onClick={() => handleAddAction(action.value, 100, 200)}
                            className="p-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 hover:text-white transition-all text-sm font-medium flex items-center justify-center gap-2"
                          >
                            {action.icon}
                            {action.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Action Configuration */}
              {editingAction && (
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white">
                      Configuration de l'action
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ActionConfigPanel
                      action={editingAction}
                      actionType={editingAction.type}
                      onClose={() => setEditingAction(null)}
                    />
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card className="bg-slate-800 border-slate-700 h-96 flex items-center justify-center">
              <CardContent className="text-center">
                <Zap className="text-slate-600 mx-auto mb-4" size={48} />
                <p className="text-slate-400 text-lg">
                  Créez ou sélectionnez un workflow pour commencer
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// COMPONENTS
// ============================================

interface ActionNodeProps {
  action: WorkflowAction;
  onDelete: () => void;
  onEdit: () => void;
  actionLabel: string;
}

function ActionNode({ action, onDelete, onEdit, actionLabel }: ActionNodeProps) {
  const actionIcons: Record<WorkflowActionType, React.ReactNode> = {
    send_sms: <MessageSquare size={20} />,
    send_email: <MessageSquare size={20} />,
    create_task: <CheckSquare size={20} />,
    assign_prospect: <Users size={20} />,
    schedule_followup: <Clock size={20} />,
  };

  return (
    <div className="bg-slate-700 border-2 border-slate-600 rounded-lg p-4 text-center hover:border-primary transition-all">
      <div className="text-primary mb-2">{actionIcons[action.type]}</div>
      <p className="text-white text-sm font-semibold mb-3">{actionLabel}</p>
      <div className="flex gap-2">
        <button
          onClick={onEdit}
          className="flex-1 p-2 bg-slate-600 hover:bg-slate-500 rounded text-white text-xs transition-all"
        >
          <Settings size={14} className="mx-auto" />
        </button>
        <button
          onClick={onDelete}
          className="flex-1 p-2 bg-red-500/20 hover:bg-red-500/30 rounded text-red-400 text-xs transition-all"
        >
          <Trash2 size={14} className="mx-auto" />
        </button>
      </div>
    </div>
  );
}

interface ActionConfigPanelProps {
  action: WorkflowAction;
  actionType: WorkflowActionType;
  onClose: () => void;
}

function ActionConfigPanel({ action, actionType, onClose }: ActionConfigPanelProps) {
  const [config, setConfig] = useState(action.config);

  const renderConfigFields = () => {
    switch (actionType) {
      case "send_sms":
        return (
          <>
            <Input
              placeholder="Numéro de téléphone"
              value={config['toNumber'] || ""}
              onChange={(e) => setConfig({ ...config, toNumber: e.target.value })}
              className="bg-slate-700 border-slate-600 text-white"
            />
            <Textarea
              placeholder="Message"
              value={config['message'] || ""}
              onChange={(e) => setConfig({ ...config, message: e.target.value })}
              className="bg-slate-700 border-slate-600 text-white"
            />
          </>
        );
      case "send_email":
        return (
          <>
            <Input
              placeholder="Email"
              type="email"
              value={config['toEmail'] || ""}
              onChange={(e) => setConfig({ ...config, toEmail: e.target.value })}
              className="bg-slate-700 border-slate-600 text-white"
            />
            <Input
              placeholder="Sujet"
              value={config['subject'] || ""}
              onChange={(e) => setConfig({ ...config, subject: e.target.value })}
              className="bg-slate-700 border-slate-600 text-white"
            />
            <Textarea
              placeholder="Corps du message"
              value={config['body'] || ""}
              onChange={(e) => setConfig({ ...config, body: e.target.value })}
              className="bg-slate-700 border-slate-600 text-white"
            />
          </>
        );
      case "create_task":
        return (
          <>
            <Input
              placeholder="Titre de la tâche"
              value={config['title'] || ""}
              onChange={(e) => setConfig({ ...config, title: e.target.value })}
              className="bg-slate-700 border-slate-600 text-white"
            />
            <Textarea
              placeholder="Description"
              value={config['description'] || ""}
              onChange={(e) => setConfig({ ...config, description: e.target.value })}
              className="bg-slate-700 border-slate-600 text-white"
            />
          </>
        );
      case "schedule_followup":
        return (
          <>
            <Input
              placeholder="Nombre de jours"
              type="number"
              value={config['delayDays'] || 7}
              onChange={(e) => setConfig({ ...config, delayDays: parseInt(e.target.value) })}
              className="bg-slate-700 border-slate-600 text-white"
            />
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {renderConfigFields()}
      <Button
        onClick={onClose}
        className="w-full bg-primary hover:bg-primary/90 text-white"
      >
        Enregistrer
      </Button>
    </div>
  );
}

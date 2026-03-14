import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { trpc } from "../lib/trpc";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { toast } from "sonner";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "../components/ui/table";
import { 
  Phone, 
  Calendar, 
  CheckCircle, 
  XCircle, 
  Clock, 
  TrendingUp,
  FileText,
  Filter,
  Plus,
  Eye
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function RecruitmentInterviews() {
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedBusinessType, setSelectedBusinessType] = useState<string>("all");
  const [currentPage, _setCurrentPage] = useState(1);
  const [selectedInterview, setSelectedInterview] = useState<any>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Récupérer les entretiens avec filtres
  const { data: interviewsData, isLoading, refetch } = useQuery({
    queryKey: ["recruitment-interviews", currentPage, selectedStatus, selectedBusinessType],
    queryFn: async () => {
      const filters: any = { page: currentPage, limit: 20 };
      if (selectedStatus !== "all") filters.status = selectedStatus;
      if (selectedBusinessType !== "all") filters.businessType = selectedBusinessType;
      
      return (trpc.recruitment.listInterviews as any).fetch(filters);
    },
  });

  // Récupérer les statistiques
  const { data: statsData } = useQuery({
    queryKey: ["recruitment-stats", selectedBusinessType],
    queryFn: async () => {
      const filters: any = {};
      if (selectedBusinessType !== "all") filters.businessType = selectedBusinessType;
      return (trpc.recruitment.getStats as any).fetch(filters);
    },
  });

  // Mutation pour démarrer un entretien
  const startInterviewMutation = useMutation({
    mutationFn: async (interviewId: number) => {
      return await (trpc.recruitment.startInterview as any).mutate({ id: interviewId });
    },
    onSuccess: () => {
      toast.success("Entretien IA démarré avec succès");
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || "Impossible de démarrer l'entretien");
    },
  });

  // Mutation pour générer un rapport
  const generateReportMutation = useMutation({
    mutationFn: async (interviewId: number) => {
      return await (trpc.recruitment.generateReport as any).mutate({ id: interviewId });
    },
    onSuccess: () => {
      toast.success("Rapport généré avec succès");
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || "Impossible de générer le rapport");
    },
  });

  // Mutation pour mettre à jour la décision
  const updateDecisionMutation = useMutation({
    mutationFn: async ({ id, decision, notes }: any) => {
      return await (trpc.recruitment.updateEmployerDecision as any).mutate({ id, decision, notes });
    },
    onSuccess: () => {
      toast.success("Décision enregistrée");
      refetch();
      setSelectedInterview(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Impossible d'enregistrer la décision");
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; label: string; icon: any }> = {
      pending: { variant: "secondary", label: "En attente", icon: Clock },
      scheduled: { variant: "default", label: "Planifié", icon: Calendar },
      in_progress: { variant: "default", label: "En cours", icon: Phone },
      completed: { variant: "default", label: "Terminé", icon: CheckCircle },
      reviewed: { variant: "default", label: "Examiné", icon: Eye },
      shortlisted: { variant: "default", label: "Présélectionné", icon: TrendingUp },
      rejected: { variant: "destructive", label: "Rejeté", icon: XCircle },
      cancelled: { variant: "secondary", label: "Annulé", icon: XCircle },
    };

    const config = variants[status] || variants['pending'];
    const Icon = config!.icon;

    return (
      <Badge variant={config!.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config!.label}
      </Badge>
    );
  };

  const getRecommendationBadge = (recommendation: string) => {
    if (recommendation === "hire") {
      return <Badge variant="default" className="bg-green-600">Recommandé</Badge>;
    } else if (recommendation === "reject") {
      return <Badge variant="destructive">Non recommandé</Badge>;
    } else {
      return <Badge variant="secondary">À évaluer</Badge>;
    }
  };

  const interviews = interviewsData?.interviews || [];
  const stats = statsData || {};

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Entretiens de Recrutement IA</h1>
          <p className="text-muted-foreground">
            Gérez vos entretiens automatisés et consultez les analyses comportementales
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nouvel entretien
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Créer un entretien candidat</DialogTitle>
              <DialogDescription>
                Planifiez un nouvel entretien IA pour un candidat
              </DialogDescription>
            </DialogHeader>
            <CreateInterviewForm onSuccess={() => {
              setShowCreateDialog(false);
              refetch();
            }} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">En attente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Terminés</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Présélectionnés</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.shortlisted || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Score moyen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.averageScore ? `${stats.averageScore.toFixed(1)}/10` : "N/A"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtres */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtres
          </CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="flex-1">
            <Label>Statut</Label>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Tous les statuts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="scheduled">Planifié</SelectItem>
                <SelectItem value="in_progress">En cours</SelectItem>
                <SelectItem value="completed">Terminé</SelectItem>
                <SelectItem value="reviewed">Examiné</SelectItem>
                <SelectItem value="shortlisted">Présélectionné</SelectItem>
                <SelectItem value="rejected">Rejeté</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Label>Type de métier</Label>
            <Select value={selectedBusinessType} onValueChange={setSelectedBusinessType}>
              <SelectTrigger>
                <SelectValue placeholder="Tous les métiers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les métiers</SelectItem>
                <SelectItem value="medical_secretary">Secrétaire médical</SelectItem>
                <SelectItem value="restaurant_server">Serveur restaurant</SelectItem>
                <SelectItem value="hotel_receptionist">Réceptionniste hôtel</SelectItem>
                <SelectItem value="sales_representative">Commercial</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Liste des entretiens */}
      <Card>
        <CardHeader>
          <CardTitle>Entretiens</CardTitle>
          <CardDescription>
            {interviews?.length || 0} entretien(s) trouvé(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Chargement...</div>
          ) : interviews.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucun entretien trouvé
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidat</TableHead>
                  <TableHead>Poste</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Recommandation</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {interviews.map((interview: any) => (
                  <TableRow key={interview.id}>
                    <TableCell className="font-medium">
                      {interview.candidateName || "Candidat anonyme"}
                    </TableCell>
                    <TableCell>{interview.jobPosition}</TableCell>
                    <TableCell>
                      {interview.scheduledAt 
                        ? format(new Date(interview.scheduledAt), "dd MMM yyyy HH:mm", { locale: fr })
                        : "Non planifié"}
                    </TableCell>
                    <TableCell>{getStatusBadge(interview.status)}</TableCell>
                    <TableCell>
                      {interview.notesJson?.globalScore ? (
                        <span className="font-semibold">
                          {interview.notesJson.globalScore}/10
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {interview.aiRecommendation 
                        ? getRecommendationBadge(interview.aiRecommendation)
                        : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {interview.status === "pending" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startInterviewMutation.mutate(interview.id)}
                          >
                            <Phone className="h-4 w-4 mr-1" />
                            Démarrer
                          </Button>
                        )}
                        {interview.status === "completed" && !interview.notesJson && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => generateReportMutation.mutate(interview.id)}
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            Analyser
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedInterview(interview)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog de détails */}
      {selectedInterview && (
        <InterviewDetailDialog
          interview={selectedInterview}
          onClose={() => setSelectedInterview(null)}
          onDecision={(decision, notes) => {
            updateDecisionMutation.mutate({ 
              id: selectedInterview.id, 
              decision, 
              notes 
            });
          }}
        />
      )}
    </div>
  );
}

// Composant de formulaire de création
function CreateInterviewForm({ onSuccess }: { onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    candidateName: "",
    candidateEmail: "",
    candidatePhone: "",
    businessType: "medical_secretary",
    jobPosition: "",
    scheduledAt: "",
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await (trpc.recruitment.createInterview as any).mutate(data);
    },
    onSuccess: () => {
      toast.success("Entretien créé avec succès");
      onSuccess();
    },
    onError: (error: any) => {
      toast.error(error.message || "Impossible de créer l'entretien");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Nom du candidat</Label>
        <Input
          value={formData.candidateName}
          onChange={(e) => setFormData({ ...formData, candidateName: e.target.value })}
          required
        />
      </div>
      <div>
        <Label>Email (optionnel)</Label>
        <Input
          type="email"
          value={formData.candidateEmail}
          onChange={(e) => setFormData({ ...formData, candidateEmail: e.target.value })}
        />
      </div>
      <div>
        <Label>Téléphone</Label>
        <Input
          value={formData.candidatePhone}
          onChange={(e) => setFormData({ ...formData, candidatePhone: e.target.value })}
          required
        />
      </div>
      <div>
        <Label>Type de métier</Label>
        <Select 
          value={formData.businessType} 
          onValueChange={(value) => setFormData({ ...formData, businessType: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="medical_secretary">Secrétaire médical</SelectItem>
            <SelectItem value="restaurant_server">Serveur restaurant</SelectItem>
            <SelectItem value="hotel_receptionist">Réceptionniste hôtel</SelectItem>
            <SelectItem value="sales_representative">Commercial</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Poste</Label>
        <Input
          value={formData.jobPosition}
          onChange={(e) => setFormData({ ...formData, jobPosition: e.target.value })}
          required
        />
      </div>
      <div>
        <Label>Date et heure planifiée</Label>
        <Input
          type="datetime-local"
          value={formData.scheduledAt}
          onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
        />
      </div>
      <Button type="submit" className="w-full" disabled={createMutation.isPending}>
        {createMutation.isPending ? "Création..." : "Créer l'entretien"}
      </Button>
    </form>
  );
}

// Dialog de détails d'entretien
function InterviewDetailDialog({ 
  interview, 
  onClose, 
  onDecision 
}: { 
  interview: any; 
  onClose: () => void;
  onDecision: (decision: string, notes: string) => void;
}) {
  const [notes, setNotes] = useState("");
  const notesJson = interview.notesJson || {};

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Détails de l'entretien</DialogTitle>
          <DialogDescription>
            {interview.jobPosition} - {interview.candidateName}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="summary">
          <TabsList>
            <TabsTrigger value="summary">Résumé</TabsTrigger>
            <TabsTrigger value="scores">Scores</TabsTrigger>
            <TabsTrigger value="behavioral">Analyse comportementale</TabsTrigger>
            <TabsTrigger value="transcript">Transcript</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Recommandation IA</h3>
              {interview.aiRecommendation && (
                interview.aiRecommendation === "hire" 
                  ? <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Recommandé</span>
                  : interview.aiRecommendation === "reject"
                    ? <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">Non recommandé</span>
                    : <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">À évaluer</span>
              )}
              <p className="text-sm text-muted-foreground mt-2">
                Confiance: {interview.aiConfidence}%
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Résumé</h3>
              <p className="text-sm">{interview.aiSummary || "Aucun résumé disponible"}</p>
            </div>
            {notesJson.strengths?.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Points forts</h3>
                <ul className="list-disc list-inside text-sm">
                  {notesJson.strengths.map((s: string, i: number) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {notesJson.redFlags?.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2 text-red-600">Signaux d'alerte</h3>
                <ul className="list-disc list-inside text-sm">
                  {notesJson.redFlags.map((r: string, i: number) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </TabsContent>

          <TabsContent value="scores">
            <div className="space-y-2">
              <div className="flex justify-between items-center p-3 bg-muted rounded">
                <span className="font-semibold">Score global</span>
                <span className="text-2xl font-bold">{notesJson.globalScore || "N/A"}/10</span>
              </div>
              {notesJson.criteriaScores && Object.entries(notesJson.criteriaScores).map(([key, value]: any) => (
                <div key={key} className="p-3 border rounded">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium capitalize">{key}</span>
                    <span className="font-semibold">{value.score}/10</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{value.comment}</p>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="behavioral">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Émotions détectées</h3>
                <div className="flex flex-wrap gap-2">
                  {notesJson.behavioralAnalysis?.emotions?.map((emotion: string, i: number) => (
                    <Badge key={i} variant="outline">{emotion}</Badge>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 border rounded">
                  <div className="text-sm text-muted-foreground">Cohérence</div>
                  <div className="text-xl font-bold">
                    {notesJson.behavioralAnalysis?.coherenceScore || "N/A"}/10
                  </div>
                </div>
                <div className="p-3 border rounded">
                  <div className="text-sm text-muted-foreground">Honnêteté</div>
                  <div className="text-xl font-bold">
                    {notesJson.behavioralAnalysis?.honestyScore || "N/A"}/10
                  </div>
                </div>
                <div className="p-3 border rounded">
                  <div className="text-sm text-muted-foreground">Communication</div>
                  <div className="text-xl font-bold">
                    {notesJson.behavioralAnalysis?.communicationScore || "N/A"}/10
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="transcript">
            <div className="p-4 bg-muted rounded max-h-96 overflow-y-auto">
              <pre className="whitespace-pre-wrap text-sm">
                {interview.transcript || "Aucun transcript disponible"}
              </pre>
            </div>
          </TabsContent>
        </Tabs>

        {interview.status === "completed" && !interview.employerDecision && (
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-semibold">Votre décision</h3>
            <div>
              <Label>Notes (optionnel)</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ajoutez vos notes..."
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="default"
                className="flex-1"
                onClick={() => onDecision("hired", notes)}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Embaucher
              </Button>
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => onDecision("pending", notes)}
              >
                <Clock className="h-4 w-4 mr-2" />
                En attente
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => onDecision("rejected", notes)}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Rejeter
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

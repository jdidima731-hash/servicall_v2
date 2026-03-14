import { useState } from "react";
import {
  CreditCard,
  Download,
  CheckCircle2,
  AlertCircle,
  Package,
  Loader2,
  Edit2,
  Trash2,
  TrendingUp,
  DollarSign,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Page d'administration complète de la facturation
 * Gère les abonnements, les plans, les factures et les paiements
 */
export default function BillingAdmin() {
  const tenantId = parseInt(
    new URLSearchParams(window.location.search).get("tenantId") || "1"
  );

  const [selectedPlan, setSelectedPlan] = useState<string>("pro");
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  // Queries
  const { data: subscription, isPending: subscriptionLoading } =
    trpc.billing.getSubscription.useQuery({ tenantId });
  const {data: invoices, isPending: _invoicesLoading} =
    trpc.billing.getInvoices.useQuery({ tenantId, limit: 50 });
  const { data: plans, isPending: plansLoading } =
    trpc.billing.getPlans.useQuery();
  const { data: billingStats, isPending: statsLoading } =
    trpc.billing.getBillingStats.useQuery({ tenantId });

  // Mutations
  // const _createSubscriptionMutation =
    trpc.billing.createOrUpdateSubscription.useMutation();
  const updatePlanMutation = trpc.billing.updateSubscriptionPlan.useMutation();
  const cancelSubscriptionMutation =
    trpc.billing.cancelSubscription.useMutation();
  const downloadInvoiceMutation = trpc.billing.downloadInvoice.useMutation();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return (
          <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
            PAYÉE
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
            EN ATTENTE
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
            ÉCHOUÉE
          </Badge>
        );
      case "open":
        return (
          <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
            OUVERTE
          </Badge>
        );
      default:
        return <Badge variant="outline">{status.toUpperCase()}</Badge>;
    }
  };

  const getSubscriptionStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
            ACTIF
          </Badge>
        );
      case "inactive":
        return (
          <Badge className="bg-gray-500/10 text-gray-500 border-gray-500/20">
            INACTIF
          </Badge>
        );
      case "suspended":
        return (
          <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
            SUSPENDU
          </Badge>
        );
      case "cancelled":
        return (
          <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
            ANNULÉ
          </Badge>
        );
      default:
        return <Badge variant="outline">{status.toUpperCase()}</Badge>;
    }
  };

  const handleUpgradePlan = async () => {
    if (!subscription?.id) {
      toast.error("Abonnement non trouvé");
      return;
    }

    try {
      await updatePlanMutation.mutateAsync({
        tenantId,
        subscriptionId: subscription.id,
        newPlanId: selectedPlan as "starter" | "pro" | "enterprise",
      });
      toast.success("Plan mis à jour avec succès");
      setShowUpgradeDialog(false);
    } catch (error) {
      toast.error("Erreur lors de la mise à jour du plan");
    }
  };

  const handleCancelSubscription = async () => {
    if (!subscription?.id) {
      toast.error("Abonnement non trouvé");
      return;
    }

    try {
      await cancelSubscriptionMutation.mutateAsync({
        tenantId,
        subscriptionId: subscription.id,
        reason: "Demande de l'utilisateur",
      });
      toast.success("Abonnement annulé avec succès");
      setShowCancelDialog(false);
    } catch (error) {
      toast.error("Erreur lors de l'annulation de l'abonnement");
    }
  };

  const handleDownloadInvoice = async (invoiceId: string) => {
    try {
      const result = await downloadInvoiceMutation.mutateAsync({
        invoiceId,
      });
      if (result.pdfUrl) {
        window.open(result.pdfUrl, "_blank");
        toast.success("Téléchargement de la facture en cours...");
      }
    } catch (error) {
      toast.error("Erreur lors du téléchargement de la facture");
    }
  };

  if (subscriptionLoading || plansLoading || statsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const planNames: Record<string, string> = {
    starter: "Starter",
    pro: "Pro",
    enterprise: "Enterprise",
  };

  const planPrices: Record<string, string> = {
    starter: "29,00 €",
    pro: "149,00 €",
    enterprise: "Personnalisé",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Gestion de la Facturation
        </h1>
        <p className="text-muted-foreground">
          Gérez votre abonnement, vos factures et vos méthodes de paiement.
        </p>
      </div>

      {/* Statistiques de Facturation */}
      {billingStats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Revenu Total
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {billingStats.totalRevenue.toFixed(2)} €
              </div>
              <p className="text-xs text-muted-foreground">
                {billingStats.totalInvoices} factures
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Factures Payées
              </CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {billingStats.paidInvoices}
              </div>
              <p className="text-xs text-muted-foreground">
                {((billingStats.paidInvoices / billingStats.totalInvoices) * 100).toFixed(0)}% du total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Factures en Attente
              </CardTitle>
              <AlertCircle className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {billingStats.pendingInvoices}
              </div>
              <p className="text-xs text-muted-foreground">
                À relancer
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Moyenne par Facture
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {billingStats.averageInvoiceAmount.toFixed(2)} €
              </div>
              <p className="text-xs text-muted-foreground">
                Montant moyen
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Abonnement Actuel */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              Abonnement Actuel
            </CardTitle>
            <CardDescription>
              Vous êtes sur le forfait{" "}
              <strong>
                {subscription ? planNames[subscription.plan] : "N/A"}
              </strong>
              .
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-end">
              <div className="text-3xl font-bold">
                {subscription ? planPrices[subscription.plan] : "N/A"}
                <span className="text-sm font-normal text-muted-foreground">
                  /mois
                </span>
              </div>
              {subscription &&
                subscription.status &&
                getSubscriptionStatusBadge(subscription.status)}
            </div>
            {subscription && (
              <>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Appels inclus</span>
                    <span>
                      {(subscription as any)?.currentUsage?.calls || 0} /{" "}
                      {(subscription as any)?.callsIncluded === -1
                        ? "∞"
                        : (subscription as any)?.callsIncluded}
                    </span>
                  </div>
                  {(subscription as any)?.callsIncluded > 0 && (
                    <Progress
                      value={
                        ((subscription as any)?.currentUsage?.calls || 0) /
                        (subscription as any)?.callsIncluded *
                        100
                      }
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Sièges agents</span>
                    <span>
                      {(subscription as any)?.currentUsage?.agents || 0} /{" "}
                      {(subscription as any)?.agentSeats === -1
                        ? "∞"
                        : (subscription as any)?.agentSeats}
                    </span>
                  </div>
                  {(subscription as any)?.agentSeats > 0 && (
                    <Progress
                      value={
                        ((subscription as any)?.currentUsage?.agents || 0) /
                        (subscription as any)?.agentSeats *
                        100
                      }
                    />
                  )}
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Renouvellement</span>
                  <span>
                    {(subscription as any)?.renewalDate
                      ? new Date((subscription as any)?.renewalDate).toLocaleDateString(
                          "fr-FR"
                        )
                      : "N/A"}
                  </span>
                </div>
              </>
            )}
          </CardContent>
          <CardFooter className="flex gap-2">
            <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex-1">
                  <Edit2 className="w-4 h-4 mr-2" />
                  Changer de forfait
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Changer de forfait</DialogTitle>
                  <DialogDescription>
                    Sélectionnez un nouveau forfait pour votre abonnement.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionnez un forfait" />
                    </SelectTrigger>
                    <SelectContent>
                      {plans?.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name} - {plan.price}€/mois
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleUpgradePlan}
                    disabled={updatePlanMutation.isPending}
                    className="w-full"
                  >
                    {updatePlanMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Mise à jour...
                      </>
                    ) : (
                      "Mettre à jour"
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
              <DialogTrigger asChild>
                <Button variant="destructive" className="flex-1">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Annuler
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Annuler l'abonnement</DialogTitle>
                  <DialogDescription>
                    Êtes-vous sûr de vouloir annuler votre abonnement ? Cette
                    action est irréversible.
                  </DialogDescription>
                </DialogHeader>
                <Button
                  onClick={handleCancelSubscription}
                  disabled={cancelSubscriptionMutation.isPending}
                  variant="destructive"
                  className="w-full"
                >
                  {cancelSubscriptionMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Annulation...
                    </>
                  ) : (
                    "Confirmer l'annulation"
                  )}
                </Button>
              </DialogContent>
            </Dialog>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              Méthode de Paiement
            </CardTitle>
            <CardDescription>
              Votre carte par défaut pour le prélèvement automatique.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-4 py-6">
            <div className="w-12 h-8 bg-slate-200 rounded flex items-center justify-center font-bold text-xs">
              VISA
            </div>
            <div className="flex-1">
              <p className="font-medium">Visa se terminant par 4242</p>
              <p className="text-sm text-muted-foreground">Expire le 12/2028</p>
            </div>
            <Button variant="ghost" size="sm">
              Modifier
            </Button>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full">
              Ajouter une méthode
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Historique des Factures */}
      <Card>
        <CardHeader>
          <CardTitle>Historique des Factures</CardTitle>
          <CardDescription>
            Téléchargez vos factures passées au format PDF.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invoices && invoices.length > 0 ? (
            <div className="space-y-4">
              {invoices.map((invoice: any) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-primary/10 rounded">
                      <Calendar className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Facture {invoice.number}</p>
                      <p className="text-sm text-muted-foreground">
                        {invoice.createdAt
                          ? new Date(invoice.createdAt).toLocaleDateString(
                              "fr-FR"
                            )
                          : "N/A"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div>
                      <p className="font-bold">
                        {invoice.amount.toFixed(2)} €
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {invoice.amountPaid.toFixed(2)} € payé
                      </p>
                    </div>
                    {getStatusBadge(invoice.status)}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDownloadInvoice(invoice.id)}
                      disabled={downloadInvoiceMutation.isPending}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>Aucune facture disponible</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plans Disponibles */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Plans Disponibles</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {plans?.map((plan) => (
            <Card
              key={plan.id}
              className={
                subscription?.plan === plan.id
                  ? "border-primary border-2"
                  : ""
              }
            >
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>
                  <span className="text-2xl font-bold">
                    {plan.price === 0 ? "Personnalisé" : `${plan.price}€`}
                  </span>
                  <span className="text-muted-foreground">/mois</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="font-semibold text-sm mb-2">Inclus :</p>
                  <ul className="space-y-2">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="text-sm flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
              <CardFooter>
                {subscription?.plan === plan.id ? (
                  <Badge className="w-full justify-center">Plan actuel</Badge>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setSelectedPlan(plan.id);
                      setShowUpgradeDialog(true);
                    }}
                  >
                    Choisir ce plan
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

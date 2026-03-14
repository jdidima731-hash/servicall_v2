/**
 * Page /subscription — Gestion de l'abonnement Servicall CRM
 * ✅ CORRECTION: Route /subscription créée pour résoudre le 404
 */
import { CreditCard, Package, CheckCircle, AlertCircle, ArrowUpCircle } from "lucide-react";
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
import { trpc } from "@/lib/trpc";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: "49 €",
    period: "/ mois",
    description: "Idéal pour les petites équipes",
    features: [
      "5 agents",
      "1 000 appels / mois",
      "IA de qualification basique",
      "Support email",
    ],
    badge: null,
  },
  {
    id: "pro",
    name: "Pro",
    price: "149 €",
    period: "/ mois",
    description: "Pour les équipes en croissance",
    features: [
      "20 agents",
      "10 000 appels / mois",
      "IA avancée (scoring + copilote)",
      "Intégrations CRM",
      "Support prioritaire",
    ],
    badge: "Populaire",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Sur devis",
    period: "",
    description: "Pour les grandes organisations",
    features: [
      "Agents illimités",
      "Appels illimités",
      "Pipeline vocal IA (Retell / Bland AI)",
      "SLA garanti 99,9 %",
      "Support dédié 24/7",
    ],
    badge: "Meilleure valeur",
  },
];

export default function SubscriptionPage() {
  const tenantId = parseInt(
    new URLSearchParams(window.location.search).get("tenantId") || "1"
  );

  const { data: subscriptionRaw, isPending: loading } =
    trpc.billing.getSubscription.useQuery({ tenantId });
  const subscription = subscriptionRaw as any;

  const currentPlanId: string = subscription?.plan?.toLowerCase() ?? "starter";

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      {/* En-tête */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Gestion abonnement</h1>
        <p className="text-muted-foreground mt-1">
          Modifier votre plan Servicall et gérer votre facturation.
        </p>
      </div>

      {/* Plan actuel */}
      {!loading && subscription && (
        <Card className="mb-8 border-primary/40 bg-primary/5">
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <CheckCircle className="text-primary h-5 w-5" />
            <CardTitle className="text-lg">Plan actuel</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-xl capitalize">
                {subscription.plan ?? "Starter"}
              </p>
              <p className="text-sm text-muted-foreground">
                Statut :{" "}
                <Badge
                  className={
                    subscription.status === "active"
                      ? "bg-green-500/10 text-green-600 border-green-500/20"
                      : "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
                  }
                >
                  {subscription.status === "active" ? "Actif" : "Inactif"}
                </Badge>
              </p>
            </div>
            <Button variant="outline" size="sm">
              <CreditCard className="mr-2 h-4 w-4" />
              Gérer la facturation
            </Button>
          </CardContent>
        </Card>
      )}

      {loading && (
        <Card className="mb-8 animate-pulse">
          <CardContent className="h-20" />
        </Card>
      )}

      {/* Grille des plans */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          return (
            <Card
              key={plan.id}
              className={`relative flex flex-col ${
                isCurrent ? "border-primary ring-2 ring-primary/30" : ""
              }`}
            >
              {plan.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                  {plan.badge}
                </span>
              )}
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  <CardTitle>{plan.name}</CardTitle>
                </div>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-2">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground text-sm">
                    {plan.period}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                {isCurrent ? (
                  <Button className="w-full" disabled variant="outline">
                    Plan actuel
                  </Button>
                ) : (
                  <Button className="w-full" variant="default">
                    <ArrowUpCircle className="mr-2 h-4 w-4" />
                    {plan.id === "enterprise"
                      ? "Nous contacter"
                      : "Passer à ce plan"}
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Avertissement */}
      <div className="mt-8 flex items-start gap-3 p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/5">
        <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground">
          Tout changement de plan prend effet immédiatement. Les frais sont
          calculés au prorata. Pour toute question, contactez notre support.
        </p>
      </div>
    </div>
  );
}

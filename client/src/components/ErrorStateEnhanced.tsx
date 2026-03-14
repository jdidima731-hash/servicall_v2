import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ErrorStateEnhancedProps {
  title?: string;
  message?: string;
  error?: Error | unknown;
  onRetry?: () => void;
  variant?: "default" | "inline" | "minimal";
  className?: string;
}

/**
 * Composant ErrorState amélioré pour gérer les états d'erreur
 * avec une UX professionnelle et des options de retry
 */
export function ErrorStateEnhanced({
  title = "Une erreur est survenue",
  message = "Impossible de charger les données. Veuillez réessayer.",
  error,
  onRetry,
  variant = "default",
  className = "",
}: ErrorStateEnhancedProps) {
  const errorMessage = error instanceof Error ? error.message : message;

  if (variant === "minimal") {
    return (
      <div className={`flex items-center gap-2 text-destructive py-4 ${className}`}>
        <AlertCircle className="w-5 h-5" />
        <span className="text-sm">{errorMessage}</span>
        {onRetry && (
          <Button variant="ghost" size="sm" onClick={onRetry} className="ml-auto">
            <RefreshCw className="w-4 h-4 mr-2" />
            Réessayer
          </Button>
        )}
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <Alert variant="destructive" className={className}>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <span>{errorMessage}</span>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry} className="ml-4">
              <RefreshCw className="w-4 h-4 mr-2" />
              Réessayer
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  // Variant "default"
  return (
    <Card className={`border-destructive/50 ${className}`}>
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-destructive/10 p-6 mb-4">
          <AlertCircle className="w-12 h-12 text-destructive" />
        </div>
        <h3 className="font-semibold text-foreground mb-2 text-xl">{title}</h3>
        <p className="text-muted-foreground mb-6 max-w-md">{errorMessage}</p>
        {onRetry && (
          <Button onClick={onRetry} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Réessayer
          </Button>
        )}
      </div>
    </Card>
  );
}

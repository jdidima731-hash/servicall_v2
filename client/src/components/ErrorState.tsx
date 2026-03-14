import { AlertCircle, ShieldAlert, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

interface ErrorStateProps {
  title?: string;
  message?: string;
  code?: string;
  onRetry?: () => void;
}

export function ErrorState({ 
  title = "Une erreur est survenue", 
  message = "Nous n'avons pas pu charger les données. Veuillez réessayer.", 
  code,
  onRetry 
}: ErrorStateProps) {
  const [, setLocation] = useLocation();

  const isForbidden = code === "FORBIDDEN" || code === "UNAUTHORIZED";

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center animate-in fade-in zoom-in duration-300">
      <div className="mb-6 p-4 rounded-full bg-destructive/10">
        {isForbidden ? (
          <ShieldAlert className="w-12 h-12 text-destructive" />
        ) : (
          <AlertCircle className="w-12 h-12 text-destructive" />
        )}
      </div>
      
      <h2 className="text-2xl font-bold tracking-tight mb-2">
        {isForbidden ? "Accès Refusé" : title}
      </h2>
      
      <p className="text-muted-foreground max-w-md mb-8">
        {isForbidden 
          ? "Vous n'avez pas les permissions nécessaires pour accéder à cette ressource." 
          : message}
      </p>
      
      <div className="flex gap-4">
        {onRetry && !isForbidden && (
          <Button onClick={onRetry} variant="default" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Réessayer
          </Button>
        )}
        
        <Button 
          onClick={() => setLocation("/")} 
          variant="outline" 
          className="gap-2"
        >
          <Home className="w-4 h-4" />
          Retour à l'accueil
        </Button>
      </div>
      
      {code && (
        <p className="mt-8 text-xs font-mono text-muted-foreground opacity-50">
          Error Code: {code}
        </p>
      )}
    </div>
  );
}

export function ForbiddenState() {
  return <ErrorState code="FORBIDDEN" />;
}

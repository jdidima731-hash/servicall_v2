import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface LoadingStateEnhancedProps {
  message?: string;
  variant?: "spinner" | "skeleton" | "minimal";
  skeletonCount?: number;
  className?: string;
}

/**
 * Composant LoadingState amélioré pour gérer les états de chargement
 * avec différentes variantes selon le contexte
 */
export function LoadingStateEnhanced({
  message = "Chargement en cours...",
  variant = "spinner",
  skeletonCount = 3,
  className = "",
}: LoadingStateEnhancedProps) {
  if (variant === "minimal") {
    return (
      <div className={`flex items-center justify-center py-8 ${className}`}>
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (variant === "skeleton") {
    return (
      <div className={`space-y-4 ${className}`}>
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <Card key={i} className="p-6">
            <div className="space-y-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  // Variant "spinner" (default)
  return (
    <Card className={`border-dashed ${className}`}>
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">{message}</p>
      </div>
    </Card>
  );
}

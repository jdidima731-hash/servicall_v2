import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface EmptyStateEnhancedProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  variant?: "default" | "compact" | "centered";
}

/**
 * Composant EmptyState amélioré pour gérer les états vides
 * avec une UX professionnelle et cohérente
 */
export function EmptyStateEnhanced({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  variant = "default",
}: EmptyStateEnhancedProps) {
  const isCompact = variant === "compact";
  const isCentered = variant === "centered";

  const content = (
    <div className={`flex flex-col items-center justify-center text-center ${isCompact ? "py-8" : "py-16"} ${isCentered ? "min-h-[400px]" : ""}`}>
      <div className={`rounded-full bg-muted p-4 mb-4 ${isCompact ? "p-3" : "p-6"}`}>
        <Icon className={`text-muted-foreground ${isCompact ? "w-8 h-8" : "w-12 h-12"}`} />
      </div>
      <h3 className={`font-semibold text-foreground mb-2 ${isCompact ? "text-lg" : "text-xl"}`}>
        {title}
      </h3>
      <p className={`text-muted-foreground mb-6 max-w-md ${isCompact ? "text-sm" : ""}`}>
        {description}
      </p>
      {(actionLabel || secondaryActionLabel) && (
        <div className="flex gap-3">
          {actionLabel && onAction && (
            <Button onClick={onAction} size={isCompact ? "sm" : "default"}>
              {actionLabel}
            </Button>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <Button onClick={onSecondaryAction} variant="outline" size={isCompact ? "sm" : "default"}>
              {secondaryActionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );

  if (variant === "centered") {
    return <div className="flex items-center justify-center min-h-[400px]">{content}</div>;
  }

  return <Card className="border-dashed">{content}</Card>;
}

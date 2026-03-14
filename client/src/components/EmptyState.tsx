import React from "react";
import { Inbox, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  title?: string;
  message?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ 
  title = "Aucune donnée trouvée", 
  message = "Il n'y a aucun élément à afficher pour le moment.", 
  icon = <Inbox className="w-12 h-12 text-muted-foreground/50" />,
  actionLabel,
  onAction 
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed rounded-xl bg-muted/30 animate-in fade-in duration-500">
      <div className="mb-4">
        {icon}
      </div>
      
      <h3 className="text-lg font-semibold mb-1">
        {title}
      </h3>
      
      <p className="text-sm text-muted-foreground max-w-xs mb-6">
        {message}
      </p>
      
      {actionLabel && onAction && (
        <Button onClick={onAction} variant="outline" className="gap-2">
          <Plus className="w-4 h-4" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

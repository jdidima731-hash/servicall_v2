import { PlusIcon, InboxIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { 
  Empty, 
  EmptyHeader, 
  EmptyTitle, 
  EmptyDescription, 
  EmptyContent,
  EmptyMedia 
} from "./empty";

interface EmptyStateProps {
  className?: string;
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  showAction?: boolean;
}

export function EmptyState({ 
  className,
  icon,
  title,
  description,
  actionLabel = "Créer",
  onAction,
  showAction = true
}: EmptyStateProps) {
  return (
    <Empty className={cn("min-h-[400px]", className)}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          {icon || <InboxIcon className="size-6" />}
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {description && (
          <EmptyDescription>{description}</EmptyDescription>
        )}
      </EmptyHeader>
      {showAction && onAction && (
        <EmptyContent>
          <Button onClick={onAction} className="gap-2">
            <PlusIcon className="size-4" />
            {actionLabel}
          </Button>
        </EmptyContent>
      )}
    </Empty>
  );
}

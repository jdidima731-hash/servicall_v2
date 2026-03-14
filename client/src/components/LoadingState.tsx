import { Loader2 } from "lucide-react";

interface LoadingStateProps {
  message?: string;
  fullScreen?: boolean;
}

export function LoadingState({ 
  message = "Chargement des données...", 
  fullScreen = false 
}: LoadingStateProps) {
  const content = (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
      <p className="text-muted-foreground font-medium animate-pulse">
        {message}
      </p>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
        {content}
      </div>
    );
  }

  return content;
}

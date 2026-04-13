import { type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        {icon && <div className="mb-3 text-muted-foreground/40">{icon}</div>}
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground/70">{description}</p>
        )}
        {action && (
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

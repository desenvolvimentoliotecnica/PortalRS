import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: "default" | "outline" | "ghost";
}

interface EmptyStateProps {
  icon?: React.ElementType;
  title: string;
  description?: string;
  actions?: EmptyStateAction[];
  className?: string;
}

/**
 * Rich empty state used throughout the app when a list/table has no items.
 * Replaces the generic "Nenhum resultado encontrado." text nodes.
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  actions = [],
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/60 bg-muted/20 px-6 py-12 text-center",
        className,
      )}
    >
      {Icon && (
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Icon className="size-6 text-muted-foreground" />
        </div>
      )}

      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {actions.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          {actions.map((action) =>
            action.href ? (
              <Button
                key={action.label}
                variant={action.variant ?? "outline"}
                size="sm"
                asChild
              >
                <a href={action.href}>{action.label}</a>
              </Button>
            ) : (
              <Button
                key={action.label}
                variant={action.variant ?? "outline"}
                size="sm"
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

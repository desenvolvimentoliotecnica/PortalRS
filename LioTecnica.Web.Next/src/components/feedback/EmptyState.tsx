import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Card className="shadow-lt">
      <CardHeader className="space-y-2">
        <div className="flex items-center gap-3">
          {icon ? (
            <div className="bg-secondary text-secondary-foreground grid size-10 place-items-center rounded-xl">
              {icon}
            </div>
          ) : null}
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
        {description ? <div className="text-muted-foreground text-sm">{description}</div> : null}
      </CardHeader>
      {action ? <CardContent>{action}</CardContent> : null}
    </Card>
  );
}

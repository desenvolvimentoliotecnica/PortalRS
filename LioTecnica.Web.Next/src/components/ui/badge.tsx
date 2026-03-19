import * as React from "react";

const variantClasses: Record<string, string> = {
  default:     "bg-primary/10 text-primary border-primary/20",
  secondary:   "bg-muted text-muted-foreground border-border/40",
  destructive: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300",
  outline:     "bg-transparent text-foreground border-border",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "destructive" | "outline";
}

export function Badge({ variant = "default", className = "", children, ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${variantClasses[variant] ?? variantClasses.default} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}

"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Logotipo Microsoft (4 quadrados) — não alterar cores/forma (diretrizes oficiais). */
function MicrosoftLogo({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="21"
      height="21"
      viewBox="0 0 21 21"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

export type MicrosoftSignInButtonProps = {
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Texto PT-BR conforme diretrizes Microsoft (padrão: versão curta oficial). */
  label?: string;
  className?: string;
  type?: "button" | "submit";
};

/**
 * Botão claro "Entrar com a Microsoft" — diretrizes de identidade visual
 * https://learn.microsoft.com/pt-br/entra/identity-platform/howto-add-branding-in-apps
 */
export function MicrosoftSignInButton({
  onClick,
  disabled = false,
  loading = false,
  label = "Entrar com a Microsoft",
  className,
  type = "button",
}: MicrosoftSignInButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      aria-busy={loading}
      className={cn(
        "inline-flex h-[41px] w-full items-center justify-center gap-3",
        "rounded-[2px] border border-[#8C8C8C] bg-white px-3",
        "font-semibold text-[15px] leading-none text-[#5E5E5E]",
        "transition-colors duration-150",
        "hover:bg-[#F2F2F2] active:bg-[#E5E5E5]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0078D4]",
        "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-white",
        className,
      )}
      style={{ fontFamily: '"Segoe UI", "Segoe UI Web (West European)", system-ui, sans-serif' }}
    >
      <MicrosoftLogo />
      <span className="truncate">
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="size-4 animate-spin text-[#5E5E5E]" aria-hidden="true" />
            Aguarde…
          </span>
        ) : (
          label
        )}
      </span>
    </button>
  );
}

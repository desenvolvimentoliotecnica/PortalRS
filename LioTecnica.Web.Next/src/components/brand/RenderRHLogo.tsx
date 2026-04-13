"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

interface RenderRHLogoProps {
  /** Tamanho do ícone em px (default 40) */
  size?: number;
  /**
   * "on-dark"  → círculo branco + R azul (sidebar com bg azul)
   * "on-light" → círculo gradiente + R branco (login / topbar)
   */
  variant?: "on-dark" | "on-light";
  /** Exibe o wordmark "RENDER" ao lado do ícone */
  showWordmark?: boolean;
  /** Tamanho do wordmark */
  wordmarkSize?: "sm" | "lg";
  className?: string;
}

/**
 * Logo oficial do Render.
 *
 * Ícone: círculo com gradiente azul profundo + "R" monoline dinâmico.
 * — Perna do R levemente curva (movimento/inovação)
 * — Nó de conexão no ponto de junção (data node)
 * — Accent: arco externo sutil no canto superior-direito
 */
export default function RenderRHLogo({
  size = 40,
  variant = "on-dark",
  showWordmark = false,
  wordmarkSize = "sm",
  className,
}: RenderRHLogoProps) {
  const uid = useId();
  const mainGrad = `render-main-${uid}`;
  const bgGrad   = `render-bg-${uid}`;
  const isDark = variant === "on-dark";
  const sw = (size / 40) * 3.5;          // stroke proporcional

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {/* ── Ícone ── */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Render"
        role="img"
        className="shrink-0"
      >
        <defs>
          {/* Gradiente principal (on-light) */}
          <linearGradient id={mainGrad} x1="3" y1="3" x2="37" y2="37" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor="#4f8ef7" />
            <stop offset="55%"  stopColor="#1d4ed8" />
            <stop offset="100%" stopColor="#0d2657" />
          </linearGradient>

          {/* Gradiente do R quando on-dark */}
          <linearGradient id={bgGrad} x1="10" y1="9" x2="30" y2="31" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor="#1d4ed8" />
            <stop offset="100%" stopColor="#0c3a64" />
          </linearGradient>

        </defs>

        {/* ── Fundo circular ── */}
        <circle
          cx="20" cy="20" r="19.5"
          fill={isDark ? "#ffffff" : `url(#${mainGrad})`}
        />

        {/* Anel interno sutil (brilho de borda) */}
        <circle
          cx="20" cy="20" r="18.8"
          fill="none"
          stroke={isDark ? "#e2ebf4" : "white"}
          strokeWidth="0.6"
          strokeOpacity={isDark ? 0.5 : 0.12}
        />

        {/*
          ── R dinâmico ──

          Haste:   M 12 31 L 12 9
          Topo:    L 22 9
          Barriga: A 5.5 5.5 0 0 1 22 20   (semicírculo perfeito; bojo vai até x≈27.5)
          Meio:    L 12 20
          Perna:   M 17 20  Q 23 26  29 31  (curva dinâmica — quadratic bezier)
        */}
        <path
          d="M 12 31 L 12 9 L 22 9 A 5.5 5.5 0 0 1 22 20 L 12 20 M 17 20 Q 23 26 29 31"
          stroke={isDark ? `url(#${bgGrad})` : "white"}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* Accent arc externo — canto superior-direito (spark de renderização) */}
        <path
          d="M 30 8 A 5 5 0 0 1 35 13"
          stroke={isDark ? "#60a5fa" : "#bfdbfe"}
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          strokeOpacity="0.8"
        />
      </svg>

      {/* ── Wordmark ── */}
      {showWordmark && (
        <span
          className={cn(
            "truncate font-black tracking-[0.2em] uppercase leading-none select-none",
            wordmarkSize === "lg" ? "text-3xl" : "text-sm",
            isDark ? "text-white" : "text-lt-primary",
          )}
        >
          Render
        </span>
      )}
    </div>
  );
}

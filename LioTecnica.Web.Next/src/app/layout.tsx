import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

import { Toaster } from "@/components/ui/sonner";
import ThemeProvider from "@/components/providers/ThemeProvider";
import ConfirmDialogProvider from "@/components/providers/ConfirmDialogProvider";
import QueryProvider from "@/components/providers/QueryProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Portal de RH - Gestão de Pessoas",
  description: "Render — Gestão de RH",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/*
          Polyfill de crypto.randomUUID para browsers/contextos que ainda não
          suportam (ex.: HTTP local em produção sem TLS). Precisa rodar antes
          de qualquer hidratação React, daí strategy="beforeInteractive".
          IMPORTANTE: <Script beforeInteractive> só pode existir dentro do <head>
          em App Router (Next.js 16+) — fora dali gera hydration error.
        */}
        <Script id="crypto-random-uuid-polyfill" strategy="beforeInteractive">
          {`
            (function () {
              function fallbackUuid() {
                var cryptoObj = globalThis.crypto;
                if (cryptoObj && typeof cryptoObj.getRandomValues === "function") {
                  var bytes = new Uint8Array(16);
                  cryptoObj.getRandomValues(bytes);
                  bytes[6] = (bytes[6] & 15) | 64;
                  bytes[8] = (bytes[8] & 63) | 128;
                  var hex = Array.prototype.map.call(bytes, function (b) {
                    return b.toString(16).padStart(2, "0");
                  }).join("");
                  return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20);
                }
                return "req-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
              }

              try {
                if (!globalThis.crypto) {
                  Object.defineProperty(globalThis, "crypto", { value: {}, configurable: true });
                }
                if (typeof globalThis.crypto.randomUUID !== "function") {
                  Object.defineProperty(globalThis.crypto, "randomUUID", { value: fallbackUuid, configurable: true });
                }
              } catch (_) {
                globalThis.__renderRhRandomUUID = fallbackUuid;
              }
            })();
          `}
        </Script>
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <QueryProvider>
          <ThemeProvider>
            <ConfirmDialogProvider>{children}</ConfirmDialogProvider>
            <Toaster />
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}

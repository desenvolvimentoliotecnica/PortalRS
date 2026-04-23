"use client";

/**
 * Tela de administração do branding / white-label do tenant (Sessão 29).
 *
 * Permite ao admin ajustar os campos que a tela de login pré-login consome via
 * <c>/api/public/branding?tenant=...</c> — nome do portal, subtítulo, rodapé,
 * cores primária/secundária, URL do logo e versão exibida.
 *
 * UX: form à esquerda + preview ao vivo à direita, imitando o card real da
 * tela de login (para o admin ver exatamente o que o usuário verá).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Building2, Palette, RefreshCw, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  applyBrandingDefaults,
  getTenantBrandingAdmin,
  renderFooterText,
  resetTenantBranding,
  upsertTenantBranding,
  type TenantBrandingPublic,
} from "@/lib/tenant-branding";

/* ───────────────────────── limites ───────────────────────── */
// Espelham os constantes do TenantBrandingService.cs — o backend faz clamp
// mesmo que o front não obedeça, mas informar o limite melhora a UX.
const MAX = {
  nomePortal: 80,
  subtitulo: 160,
  rodapeTexto: 160,
  logoUrl: 512,
  versaoExibida: 32,
} as const;

/* ───────────────────────── helpers ───────────────────────── */

function isHex(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(value.trim());
}

function normalizeHexInput(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (!t.startsWith("#")) return `#${t}`.toUpperCase();
  return t.toUpperCase();
}

/* ───────────────────────── component ───────────────────────── */

export default function TenantBrandingScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Estado do form (strings vazias = "usar default"). Guardamos strings para os
  // inputs controlados funcionarem bem; só normalizamos no save.
  const [nomePortal, setNomePortal] = useState("");
  const [subtitulo, setSubtitulo] = useState("");
  const [rodapeTexto, setRodapeTexto] = useState("");
  const [corPrimariaHex, setCorPrimariaHex] = useState("");
  const [corSecundariaHex, setCorSecundariaHex] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [versaoExibida, setVersaoExibida] = useState("");

  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  /* ─── load ─── */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const dto = await getTenantBrandingAdmin();
      setNomePortal(dto.nomePortal ?? "");
      setSubtitulo(dto.subtitulo ?? "");
      setRodapeTexto(dto.rodapeTexto ?? "");
      setCorPrimariaHex(dto.corPrimariaHex ?? "");
      setCorSecundariaHex(dto.corSecundariaHex ?? "");
      setLogoUrl(dto.logoUrl ?? "");
      setVersaoExibida(dto.versaoExibida ?? "");
      setUpdatedAt(dto.updatedAtUtc);
    } catch (e) {
      toast.error(`Falha ao carregar branding: ${e instanceof Error ? e.message : "erro"}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /* ─── preview computado (mesma lógica da tela de login) ─── */
  const previewBranding: TenantBrandingPublic = useMemo(
    () => ({
      nomePortal: nomePortal.trim() || null,
      subtitulo: subtitulo.trim() || null,
      rodapeTexto: rodapeTexto.trim() || null,
      corPrimariaHex: isHex(corPrimariaHex) ? corPrimariaHex.toUpperCase() : null,
      corSecundariaHex: isHex(corSecundariaHex) ? corSecundariaHex.toUpperCase() : null,
      logoUrl: logoUrl.trim() || null,
      versaoExibida: versaoExibida.trim() || null,
    }),
    [nomePortal, subtitulo, rodapeTexto, corPrimariaHex, corSecundariaHex, logoUrl, versaoExibida],
  );
  const ui = useMemo(() => applyBrandingDefaults(previewBranding), [previewBranding]);
  const cardGradient = `linear-gradient(160deg, ${ui.corPrimariaHex} 0%, ${ui.corSecundariaHex} 100%)`;
  const logoGradient = `linear-gradient(to bottom right, ${ui.corPrimariaHex}, ${ui.corSecundariaHex})`;
  const footerText = renderFooterText(ui.rodapeTexto);

  /* ─── save ─── */
  async function save() {
    setSaving(true);
    try {
      const dto = await upsertTenantBranding({
        nomePortal: nomePortal.trim() || null,
        subtitulo: subtitulo.trim() || null,
        rodapeTexto: rodapeTexto.trim() || null,
        corPrimariaHex: corPrimariaHex.trim() || null,
        corSecundariaHex: corSecundariaHex.trim() || null,
        logoUrl: logoUrl.trim() || null,
        versaoExibida: versaoExibida.trim() || null,
      });
      // O backend pode ter normalizado (clamp, cor inválida → null, etc.) — recarrega do DTO.
      setNomePortal(dto.nomePortal ?? "");
      setSubtitulo(dto.subtitulo ?? "");
      setRodapeTexto(dto.rodapeTexto ?? "");
      setCorPrimariaHex(dto.corPrimariaHex ?? "");
      setCorSecundariaHex(dto.corSecundariaHex ?? "");
      setLogoUrl(dto.logoUrl ?? "");
      setVersaoExibida(dto.versaoExibida ?? "");
      setUpdatedAt(dto.updatedAtUtc);
      toast.success("Branding atualizado. A tela de login já reflete as mudanças.");
    } catch (e) {
      toast.error(`Falha ao salvar: ${e instanceof Error ? e.message : "erro"}`);
    } finally {
      setSaving(false);
    }
  }

  /* ─── reset ─── */
  async function resetAll() {
    if (!confirm("Zerar TODO o branding? A tela de login voltará a exibir os defaults da plataforma.")) {
      return;
    }
    setResetting(true);
    try {
      await resetTenantBranding();
      setNomePortal("");
      setSubtitulo("");
      setRodapeTexto("");
      setCorPrimariaHex("");
      setCorSecundariaHex("");
      setLogoUrl("");
      setVersaoExibida("");
      setUpdatedAt(null);
      toast.success("Branding zerado. Usando defaults da plataforma.");
    } catch (e) {
      toast.error(`Falha ao zerar: ${e instanceof Error ? e.message : "erro"}`);
    } finally {
      setResetting(false);
    }
  }

  /* ─── render ─── */
  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Palette className="size-5 text-muted-foreground" />
          Branding / White-Label
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Personalize como o portal aparece para os usuários deste tenant.
          Campos em branco = usar o default da plataforma.
        </p>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-t-transparent border-primary" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_440px]">
          {/* ── Form ── */}
          <div className="rounded-xl border border-border/40 bg-card p-6 space-y-5">
            <FormField
              label="Nome do portal"
              hint={`Aparece no cabeçalho da tela de login. Máx ${MAX.nomePortal} caracteres.`}
              maxLength={MAX.nomePortal}
              value={nomePortal}
              onChange={setNomePortal}
              placeholder="Portal de RH"
            />

            <FormField
              label="Subtítulo"
              hint={`Texto menor sob o nome. Máx ${MAX.subtitulo} caracteres.`}
              maxLength={MAX.subtitulo}
              value={subtitulo}
              onChange={setSubtitulo}
              placeholder="Gestão de pessoas e recrutamento"
            />

            <FormField
              label="Texto do rodapé"
              hint={`Use {ano} para o ano corrente. Máx ${MAX.rodapeTexto} caracteres.`}
              maxLength={MAX.rodapeTexto}
              value={rodapeTexto}
              onChange={setRodapeTexto}
              placeholder="© {ano} · Portal de RH"
            />

            <div className="grid grid-cols-2 gap-4">
              <ColorField
                label="Cor primária"
                value={corPrimariaHex}
                onChange={setCorPrimariaHex}
                placeholder="#0C3A64"
              />
              <ColorField
                label="Cor secundária"
                value={corSecundariaHex}
                onChange={setCorSecundariaHex}
                placeholder="#105291"
              />
            </div>

            <FormField
              label="URL do logo"
              hint={`PNG/SVG transparente idealmente quadrado. Máx ${MAX.logoUrl} caracteres.`}
              maxLength={MAX.logoUrl}
              value={logoUrl}
              onChange={setLogoUrl}
              placeholder="https://cdn.exemplo.com/logo.png"
              type="url"
            />

            <FormField
              label="Versão exibida"
              hint={`Mostrada no rodapé do card. Máx ${MAX.versaoExibida} caracteres.`}
              maxLength={MAX.versaoExibida}
              value={versaoExibida}
              onChange={setVersaoExibida}
              placeholder="v3.0"
            />

            {updatedAt ? (
              <p className="text-xs text-muted-foreground pt-2 border-t border-border/40">
                Última atualização: {new Date(updatedAt).toLocaleString("pt-BR")}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground pt-2 border-t border-border/40">
                Nenhuma personalização salva — usando defaults da plataforma.
              </p>
            )}

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => void load()} disabled={loading || saving}>
                <RefreshCw className="size-4 mr-1.5" />
                Recarregar
              </Button>
              <Button variant="outline" onClick={() => void resetAll()} disabled={resetting || saving}>
                <Trash2 className="size-4 mr-1.5" />
                {resetting ? "Zerando…" : "Zerar branding"}
              </Button>
              <Button onClick={() => void save()} disabled={saving}>
                <Save className="size-4 mr-1.5" />
                {saving ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </div>

          {/* ── Preview ao vivo ── */}
          <div className="space-y-2">
            <div className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
              Preview ao vivo
            </div>
            <div className="rounded-xl border border-border/40 bg-[#f0f2f5] p-6 space-y-4">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div
                  className="flex size-12 items-center justify-center rounded-xl shadow-lg overflow-hidden"
                  style={{ background: logoGradient }}
                >
                  {ui.logoUrl ? (
                    <Image
                      src={ui.logoUrl}
                      alt={ui.nomePortal}
                      width={48}
                      height={48}
                      unoptimized
                      className="size-full object-contain"
                    />
                  ) : (
                    <Building2 className="size-6 text-white" strokeWidth={2.25} />
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-slate-800">{ui.nomePortal}</h2>
                  <p className="text-[11px] text-slate-500">{ui.subtitulo}</p>
                </div>
              </div>
              {/* Card "Entrar" simulado */}
              <div
                className="rounded-xl p-4 shadow-2xl shadow-black/20 border border-white/10"
                style={{ background: cardGradient }}
              >
                <div className="text-sm font-bold text-white">Entrar</div>
                <div className="text-[11px] text-blue-100/60">
                  Acesse o portal de gestão de pessoas e recrutamento.
                </div>
                <div className="mt-3 space-y-2">
                  <div className="h-8 rounded-md border border-white/15 bg-white/10" />
                  <div className="h-8 rounded-md border border-white/15 bg-white/10" />
                </div>
                <div
                  className="mt-3 rounded-md bg-white px-3 py-1.5 text-center text-xs font-semibold"
                  style={{ color: ui.corPrimariaHex }}
                >
                  Avançar →
                </div>
                <div className="mt-3 flex justify-end border-t border-white/10 pt-2">
                  <span className="text-[9px] font-medium tracking-wider text-white/25 uppercase">
                    {ui.versaoExibida}
                  </span>
                </div>
              </div>
              {/* Rodapé */}
              <div className="text-center text-[10px] text-slate-500/70">{footerText}</div>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Cores inválidas (fora do formato <code>#RRGGBB</code>) são ignoradas pelo servidor e
              caem para o default. O preview aqui antecipa esse comportamento.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

/* ───────────────────────── sub-components ───────────────────────── */

function FormField({
  label,
  hint,
  maxLength,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  hint: string;
  maxLength: number;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: "text" | "url";
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {label}
        </label>
        <span className="text-[10px] text-muted-foreground/70">
          {value.length} / {maxLength}
        </span>
      </div>
      <input
        type={type}
        maxLength={maxLength}
        className="h-9 w-full rounded-md border border-input px-3 text-sm bg-background"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />
      <p className="text-[11px] text-muted-foreground leading-snug">{hint}</p>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const valid = !value || isHex(value);
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          className="h-9 w-12 rounded-md border border-input bg-background cursor-pointer"
          value={isHex(value) ? value : "#0C3A64"}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
        />
        <input
          type="text"
          maxLength={7}
          className={`h-9 flex-1 rounded-md border px-3 text-sm bg-background font-mono ${
            valid ? "border-input" : "border-red-400 text-red-700"
          }`}
          value={value}
          onChange={(e) => onChange(normalizeHexInput(e.target.value))}
          placeholder={placeholder}
          autoComplete="off"
        />
      </div>
      {!valid ? (
        <p className="text-[11px] text-red-600 leading-snug">Formato inválido — use #RRGGBB (6 dígitos hex).</p>
      ) : (
        <p className="text-[11px] text-muted-foreground leading-snug">Formato #RRGGBB.</p>
      )}
    </div>
  );
}

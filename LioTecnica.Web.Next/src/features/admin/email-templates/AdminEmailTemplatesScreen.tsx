"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Search, RefreshCw, Pencil, RotateCcw, Mail, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from "@/components/ui/table";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { EmailRichTextEditor } from "./EmailRichTextEditor";

interface TemplateListItem {
  id: string;
  name: string;
  displayName: string;
  description: string;
  subject: string | null;
  version?: number;
  isActive: boolean;
  isCustomized: boolean;
  tags: string[];
  lastModified: string | null;
}

interface FormData {
  name: string;
  displayName: string;
  description: string;
  subject: string;
  body: string;
  tags: string[];
  isCustomized: boolean;
}

const EMPTY_FORM: FormData = {
  name: "",
  displayName: "",
  description: "",
  subject: "",
  body: "",
  tags: [],
  isCustomized: false,
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(url, { cache: "no-store", ...init });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error((body as { detail?: string; error?: string; message?: string })?.detail
      || (body as { message?: string })?.message
      || (body as { error?: string })?.error
      || `HTTP ${res.status}`);
  }
  return res.json();
}

export default function AdminEmailTemplatesScreen() {
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchJson<any[]>(`/api/email-templates`);
      setTemplates(
        (Array.isArray(list) ? list : []).map((x) => ({
          id: String(x.id),
          name: String(x.name ?? ""),
          displayName: String(x.displayName ?? x.name ?? ""),
          description: String(x.description ?? ""),
          subject: x.subjectTemplate ?? null,
          version: typeof x.version === "number" ? x.version : undefined,
          isActive: Boolean(x.isActive),
          isCustomized: Boolean(x.isCustomized),
          tags: Array.isArray(x.tags) ? x.tags.map(String) : [],
          lastModified: String(x.updatedAtUtc ?? x.createdAtUtc ?? ""),
        })),
      );
    } catch {
      toast.error("Falha ao carregar templates.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadTemplates(); }, [loadTemplates]);

  const filtered = useMemo(() => {
    if (!q.trim()) return templates;
    const lower = q.toLowerCase();
    return templates.filter((t) =>
      t.name.toLowerCase().includes(lower)
      || t.displayName.toLowerCase().includes(lower)
      || (t.subject ?? "").toLowerCase().includes(lower));
  }, [templates, q]);

  async function startEdit(item: TemplateListItem) {
    try {
      const raw = item.id && item.id !== "00000000-0000-0000-0000-000000000000"
        ? await fetchJson<any>(`/api/email-templates/${item.id}`)
        : await fetchJson<any>(`/api/email-templates/by-code/${encodeURIComponent(item.name)}`);
      setEditId(raw?.id && raw.id !== "00000000-0000-0000-0000-000000000000" ? String(raw.id) : null);
      setForm({
        name: String(raw?.name ?? item.name),
        displayName: String(raw?.displayName ?? item.displayName),
        description: String(raw?.description ?? item.description),
        subject: String(raw?.subjectTemplate ?? ""),
        body: String(raw?.bodyHtml ?? ""),
        tags: Array.isArray(raw?.tags) ? raw.tags.map(String) : item.tags,
        isCustomized: Boolean(raw?.isCustomized),
      });
      setShowPreview(false);
      setShowForm(true);
    } catch {
      toast.error("Falha ao carregar template.");
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editId) {
        const saved = await fetchJson<any>(`/api/email-templates/${editId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subjectTemplate: form.subject, bodyHtml: form.body }),
        });
        setEditId(String(saved.id));
        toast.success("Template atualizado!");
      } else {
        const saved = await fetchJson<any>("/api/email-templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: form.name, subjectTemplate: form.subject, bodyHtml: form.body }),
        });
        setEditId(String(saved.id));
        toast.success("Template salvo!");
      }
      void loadTemplates();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!window.confirm("Isso substitui o assunto e o corpo atuais pelo texto padrão (com as tags). Continuar?")) {
      return;
    }
    try {
      const raw = editId
        ? await fetchJson<any>(`/api/email-templates/${editId}/reset`, { method: "POST" })
        : await fetchJson<any>(`/api/email-templates/by-code/${encodeURIComponent(form.name)}/reset`, { method: "POST" });
      setEditId(String(raw.id));
      setForm((prev) => ({
        ...prev,
        subject: String(raw.subjectTemplate ?? ""),
        body: String(raw.bodyHtml ?? ""),
        isCustomized: false,
      }));
      toast.success("Template restaurado ao padrão.");
      void loadTemplates();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao resetar.");
    }
  }

  function insertTag(tag: string) {
    const token = `{{${tag}}}`;
    setForm((prev) => {
      const injection = `<p>${token}</p>`;
      if (!prev.body.trim()) return { ...prev, body: `<div>${injection}</div>` };
      if (prev.body.includes("</div>")) {
        return { ...prev, body: prev.body.replace(/<\/div>\s*$/i, `${injection}</div>`), isCustomized: true };
      }
      return { ...prev, body: `${prev.body}${injection}`, isCustomized: true };
    });
  }

  const upd = (key: keyof FormData, val: string | boolean | string[]) => setForm((prev) => ({ ...prev, [key]: val }));

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-lg font-bold">Templates de e-mail ao candidato</h4>
          <div className="text-muted-foreground text-sm">
            Modelos rich-text com tags {"{{...}}"}. Cole do Word/Outlook e use Resetar se remover tags sem querer.
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadTemplates()} disabled={loading}>
          <RefreshCw className="size-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
          <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Catálogo</div>
          <div className="mt-1 text-2xl font-bold text-primary">{templates.length}</div>
        </div>
        <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
          <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Personalizados</div>
          <div className="mt-1 text-2xl font-bold text-amber-600">{templates.filter((t) => t.isCustomized).length}</div>
        </div>
        <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
          <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Padrão</div>
          <div className="mt-1 text-2xl font-bold text-emerald-600">{templates.filter((t) => !t.isCustomized).length}</div>
        </div>
      </div>

      {showForm && (
        <div className="card-soft space-y-3 rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="font-semibold">{form.displayName || form.name}</div>
              <div className="text-muted-foreground text-xs">{form.description}</div>
              <div className="mt-1 text-xs text-muted-foreground">Código: <code>{form.name}</code></div>
            </div>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${form.isCustomized ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
              {form.isCustomized ? "Personalizado" : "Padrão"}
            </span>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Assunto</label>
            <Input value={form.subject} onChange={(e) => upd("subject", e.target.value)} />
          </div>

          {form.tags.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">Inserir tag</div>
              <div className="flex flex-wrap gap-1.5">
                {form.tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-muted"
                    onClick={() => insertTag(tag)}
                  >
                    {`{{${tag}}}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Corpo (rich-text)</label>
            <EmailRichTextEditor value={form.body} onChange={(html) => upd("body", html)} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void handleSave()} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
            <Button variant="outline" onClick={() => void handleReset()}>
              <RotateCcw className="mr-1 size-4" />
              Resetar
            </Button>
            <Button variant="outline" onClick={() => setShowPreview((v) => !v)}>
              <Eye className="mr-1 size-4" />
              {showPreview ? "Ocultar preview" : "Preview"}
            </Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Fechar</Button>
          </div>

          {showPreview && (
            <div className="rounded-lg border border-border/50 bg-white p-4 text-sm text-zinc-900">
              <div className="mb-2 text-xs font-semibold text-zinc-500">Assunto: {form.subject}</div>
              <div dangerouslySetInnerHTML={{ __html: form.body }} />
            </div>
          )}
        </div>
      )}

      <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div className="font-semibold">Catálogo</div>
          <div className="relative">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="w-[220px] pl-8" placeholder="buscar..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Template</TableHead>
              <TableHead>Assunto</TableHead>
              <TableHead className="text-center">Estado</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} className="text-muted-foreground py-8 text-center">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-muted-foreground py-8 text-center">Nenhum template encontrado.</TableCell></TableRow>
            ) : (
              filtered.map((t) => (
                <TableRow key={t.name}>
                  <TableCell className="font-medium">
                    <div className="flex items-start gap-2">
                      <Mail className="mt-0.5 size-4 text-primary" />
                      <div>
                        <div>{t.displayName}</div>
                        <div className="text-muted-foreground text-xs">{t.name}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-[320px] truncate text-sm">{t.subject || "—"}</TableCell>
                  <TableCell className="text-center">
                    {t.isCustomized
                      ? <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Personalizado</span>
                      : <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">Padrão</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => void startEdit(t)} title="Editar">
                      <Pencil className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

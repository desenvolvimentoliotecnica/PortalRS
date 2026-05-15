"use client";

/* ── Types (JSON camelCase from API) ── */

export type CandidatoPortalPerfilCompleto = {
  perfilBasico?: PortalCandidateProfile | null;
  skillsPortfolio?: PortalSkillsPortfolio | null;
  education?: PortalEducation | null;
  preferences?: PortalPreferences | null;
  accessibility?: PortalAccessibility | null;
  agenda?: PortalAgenda | null;
  notifications?: PortalNotifications | null;
  portalDocuments?: PortalDocuments | null;
  lgpd?: PortalLgpd | null;
  references?: PortalReferences | null;
  experienceProjects?: PortalExperienceProjects | null;
};

type PortalCandidateProfile = {
  id?: string;
  nome?: string | null;
  email?: string | null;
  fone?: string | null;
  cidade?: string | null;
  uf?: string | null;
  linkedinUrl?: string | null;
  resumoProfissional?: string | null;
  avatarUrl?: string | null;
  curriculo?: { id?: string; nomeArquivo?: string | null; createdAtUtc?: string | null } | null;
  trabalhandoAtualmente?: boolean | null;
};

type PortalSkillsPortfolio = {
  skills?: PortalSkill[];
  certifications?: PortalCert[];
  links?: { linkedin?: string | null; github?: string | null; portfolio?: string | null; drive?: string | null } | null;
  preferences?: {
    workModel?: string | null;
    availability?: string | null;
    salary?: string | null;
    shift?: string | null;
    note?: string | null;
  } | null;
  tags?: string | null;
};

type PortalSkill = { id?: string; tipo?: string | null; nome?: string | null; nivel?: string | null; evidencia?: string | null };
type PortalCert = { id?: string; nome?: string | null; instituicao?: string | null; ano?: string | null; link?: string | null };

type PortalEducation = {
  summary?: Record<string, string | null | undefined> | null;
  items?: PortalEducationItem[] | null;
};

type PortalEducationItem = {
  id?: string;
  curso?: string | null;
  instituicao?: string | null;
  tipo?: string | null;
  status?: string | null;
  inicio?: string | null;
  fim?: string | null;
  observacoes?: string | null;
  link?: string | null;
};

type PortalPreferences = Record<string, string | number | boolean | null | undefined>;

type PortalAccessibility = Record<string, string | number | boolean | null | undefined>;

type PortalAgenda = {
  preferences?: Record<string, string | number | boolean | null | undefined> | null;
  blocks?: PortalAgendaBlock[] | null;
};

type PortalAgendaBlock = {
  id?: string;
  tipo?: string | null;
  titulo?: string | null;
  data?: string | null;
  horario?: string | null;
  observacoes?: string | null;
  updatedAtUtc?: string | null;
};

type PortalNotifications = Record<string, string | number | boolean | null | undefined>;

type PortalDocuments = { items?: PortalDocItem[] | null };
type PortalDocItem = {
  id?: string;
  tipo?: string | null;
  nome?: string | null;
  link?: string | null;
  data?: string | null;
  observacoes?: string | null;
  fileName?: string | null;
  createdAtUtc?: string | null;
};

type PortalLgpd = Record<string, string | number | boolean | null | undefined>;

type PortalReferences = { items?: PortalReferenceItem[] | null };
type PortalReferenceItem = {
  id?: string;
  nome?: string | null;
  relacao?: string | null;
  empresa?: string | null;
  cargo?: string | null;
  contato?: string | null;
  periodo?: string | null;
  linkedin?: string | null;
  observacoes?: string | null;
  podeContatar?: boolean | null;
  updatedAtUtc?: string | null;
};

type PortalExperienceProjects = {
  experiences?: PortalExperience[] | null;
  projects?: PortalProject[] | null;
};

type PortalExperience = {
  id?: string;
  empresa?: string | null;
  cargo?: string | null;
  inicio?: string | null;
  fim?: string | null;
  local?: string | null;
  atividades?: string | null;
};

type PortalProject = {
  id?: string;
  nome?: string | null;
  periodo?: string | null;
  descricao?: string | null;
  link?: string | null;
  stack?: string | null;
  destaques?: string | null;
};

/* ── Helpers ── */

function disp(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  const s = String(v).trim();
  return s || "—";
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="rounded-xl border border-border/50 bg-card/40 group">
      <summary className="cursor-pointer list-none font-semibold text-sm px-3 py-2.5 text-foreground hover:bg-muted/30 rounded-xl marker:content-none flex items-center justify-between gap-2">
        {title}
        <span className="text-muted-foreground text-xs font-normal group-open:hidden">Expandir</span>
        <span className="text-muted-foreground text-xs font-normal hidden group-open:inline">Recolher</span>
      </summary>
      <div className="px-3 pb-3 pt-0 text-sm border-t border-border/30 space-y-2">{children}</div>
    </details>
  );
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,160px)_1fr] gap-x-3 gap-y-0.5 py-1 border-b border-border/20 last:border-0">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="text-muted-foreground whitespace-pre-wrap break-words">{value}</div>
    </div>
  );
}

function PrefGrid({ data, keys }: { data: Record<string, unknown>; keys: [string, string][] }) {
  return (
    <div className="space-y-0">
      {keys.map(([jsonKey, ptLabel]) => (
        <KV key={jsonKey} label={ptLabel} value={disp(data[jsonKey])} />
      ))}
    </div>
  );
}

/* ── Component ── */

type Props = {
  data: CandidatoPortalPerfilCompleto | null;
  loading?: boolean;
  /** Quando o GET falhou (ex.: 404 API antiga); exibido em vez da mensagem genérica. */
  loadError?: string | null;
  className?: string;
};

export function CandidatoPortalPerfilReadonly({ data, loading, loadError, className = "" }: Props) {
  if (loading) {
    return <div className={`text-muted-foreground text-sm py-6 text-center ${className}`}>Carregando perfil do portal…</div>;
  }

  if (loadError) {
    return (
      <div className={`rounded-xl border border-destructive/30 bg-destructive/5 text-destructive text-sm p-4 whitespace-pre-wrap ${className}`}>
        <div className="font-semibold mb-1">Não foi possível carregar o perfil do portal</div>
        <div className="text-destructive/90 text-xs leading-relaxed">{loadError}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={`rounded-xl border border-border/50 bg-muted/20 text-muted-foreground text-sm p-4 ${className}`}>
        Não foi possível carregar o perfil completo do portal (sem permissão ou dados indisponíveis).
      </div>
    );
  }

  const p = data.perfilBasico;
  const su = data.education?.summary as Record<string, unknown> | undefined;

  return (
    <div className={`space-y-3 ${className}`}>
      {(p?.nome || p?.email) && (
        <div className="rounded-xl border border-border/50 bg-card/50 p-3 flex flex-wrap gap-3 items-start">
          {p?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.avatarUrl} alt="" className="size-14 rounded-xl object-cover border border-border/40 shrink-0" />
          ) : null}
          <div className="min-w-0 flex-1 space-y-1">
            <div className="font-semibold text-base">{disp(p?.nome)}</div>
            <div className="text-muted-foreground text-sm">{disp(p?.email)}</div>
            {p?.linkedinUrl ? (
              <a href={p.linkedinUrl} className="text-sm text-[rgb(var(--lt-primary))] hover:underline break-all" target="_blank" rel="noopener noreferrer">
                LinkedIn
              </a>
            ) : null}
            {p?.resumoProfissional ? (
              <p className="text-muted-foreground text-sm whitespace-pre-wrap mt-2">{p.resumoProfissional}</p>
            ) : null}
            {p?.curriculo?.nomeArquivo ? (
              <div className="text-xs text-muted-foreground">Currículo no portal: {p.curriculo.nomeArquivo}</div>
            ) : null}
          </div>
        </div>
      )}

      <Section title="Formação">
        {su && Object.keys(su).length > 0 ? (
          <PrefGrid
            data={su}
            keys={[
              ["nivel", "Nível"],
              ["areaPrincipal", "Área principal"],
              ["situacao", "Situação"],
              ["dataConclusao", "Conclusão"],
              ["destaques", "Destaques"],
            ]}
          />
        ) : (
          <div className="text-muted-foreground text-xs py-1">Sem resumo de formação.</div>
        )}
        {(data.education?.items?.length ?? 0) > 0 ? (
          <div className="mt-2 space-y-2">
            {data.education!.items!.map((it) => (
              <div key={String(it.id ?? it.curso)} className="rounded-lg border border-border/30 p-2">
                <div className="font-medium text-foreground text-sm">{disp(it.curso)}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {[it.instituicao, it.tipo, it.status].filter(Boolean).join(" · ") || "—"}
                </div>
                <div className="text-xs text-muted-foreground">
                  Período: {disp(it.inicio)} — {disp(it.fim)}
                </div>
                {it.observacoes ? <div className="text-xs mt-1 whitespace-pre-wrap">{it.observacoes}</div> : null}
                {it.link ? (
                  <a href={it.link} className="text-xs text-[rgb(var(--lt-primary))] hover:underline break-all" target="_blank" rel="noopener noreferrer">
                    Link
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          !su || Object.keys(su).length === 0 ? <div className="text-muted-foreground text-xs">Nenhum item de formação.</div> : null
        )}
      </Section>

      <Section title="Experiências e projetos">
        {(data.experienceProjects?.experiences?.length ?? 0) === 0 && (data.experienceProjects?.projects?.length ?? 0) === 0 ? (
          <div className="text-muted-foreground text-xs py-1">Nenhuma experiência ou projeto.</div>
        ) : (
          <div className="space-y-3">
            {(data.experienceProjects?.experiences?.length ?? 0) > 0 ? (
              <div>
                <div className="text-xs font-semibold text-foreground/80 mb-1">Experiências</div>
                {data.experienceProjects!.experiences!.map((ex) => (
                  <div key={String(ex.id ?? ex.cargo)} className="rounded-lg border border-border/30 p-2 mb-2">
                    <div className="font-medium text-sm">
                      {disp(ex.cargo)} — {disp(ex.empresa)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {disp(ex.inicio)} — {disp(ex.fim)} · {disp(ex.local)}
                    </div>
                    {ex.atividades ? <div className="text-xs mt-1 whitespace-pre-wrap">{ex.atividades}</div> : null}
                  </div>
                ))}
              </div>
            ) : null}
            {(data.experienceProjects?.projects?.length ?? 0) > 0 ? (
              <div>
                <div className="text-xs font-semibold text-foreground/80 mb-1">Projetos</div>
                {data.experienceProjects!.projects!.map((pr) => (
                  <div key={String(pr.id ?? pr.nome)} className="rounded-lg border border-border/30 p-2 mb-2">
                    <div className="font-medium text-sm">{disp(pr.nome)}</div>
                    <div className="text-xs text-muted-foreground">{disp(pr.periodo)}</div>
                    {pr.stack ? <div className="text-xs text-muted-foreground">Stack: {pr.stack}</div> : null}
                    {pr.descricao ? <div className="text-xs mt-1 whitespace-pre-wrap">{pr.descricao}</div> : null}
                    {pr.link ? (
                      <a href={pr.link} className="text-xs text-[rgb(var(--lt-primary))] hover:underline break-all" target="_blank" rel="noopener noreferrer">
                        Link
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </Section>

      <Section title="Skills e portfólio">
        {(data.skillsPortfolio?.skills?.length ?? 0) > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border/40">
                  <th className="py-1 pr-2">Nome</th>
                  <th className="py-1 pr-2">Tipo</th>
                  <th className="py-1 pr-2">Nível</th>
                  <th className="py-1">Evidência</th>
                </tr>
              </thead>
              <tbody>
                {data.skillsPortfolio!.skills!.map((s) => (
                  <tr key={String(s.id ?? s.nome)} className="border-b border-border/20">
                    <td className="py-1 pr-2">{disp(s.nome)}</td>
                    <td className="py-1 pr-2">{disp(s.tipo)}</td>
                    <td className="py-1 pr-2">{disp(s.nivel)}</td>
                    <td className="py-1 whitespace-pre-wrap">{disp(s.evidencia)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-muted-foreground text-xs">Nenhuma skill cadastrada.</div>
        )}
        {(data.skillsPortfolio?.certifications?.length ?? 0) > 0 ? (
          <div className="mt-2 space-y-1">
            <div className="text-xs font-semibold text-foreground/80">Certificações</div>
            {data.skillsPortfolio!.certifications!.map((c) => (
              <div key={String(c.id ?? c.nome)} className="text-xs rounded border border-border/25 px-2 py-1">
                <span className="font-medium">{disp(c.nome)}</span>
                {c.instituicao ? <span className="text-muted-foreground"> — {c.instituicao}</span> : null}
                {c.ano ? <span className="text-muted-foreground"> ({c.ano})</span> : null}
              </div>
            ))}
          </div>
        ) : null}
        {data.skillsPortfolio?.links ? (
          <div className="mt-2 text-xs space-y-0.5">
            <KV label="Links (portfolio)" value={disp([data.skillsPortfolio.links.linkedin, data.skillsPortfolio.links.github, data.skillsPortfolio.links.portfolio, data.skillsPortfolio.links.drive].filter(Boolean).join(" · "))} />
          </div>
        ) : null}
        {data.skillsPortfolio?.preferences ? (
          <PrefGrid
            data={data.skillsPortfolio.preferences as unknown as Record<string, unknown>}
            keys={[
              ["workModel", "Modelo de trabalho"],
              ["availability", "Disponibilidade"],
              ["salary", "Pretensão"],
              ["shift", "Turno"],
              ["note", "Observações"],
            ]}
          />
        ) : null}
        {data.skillsPortfolio?.tags ? <KV label="Tags" value={data.skillsPortfolio.tags} /> : null}
      </Section>

      <Section title="Preferências de carreira">
        {data.preferences ? (
          <PrefGrid
            data={data.preferences as unknown as Record<string, unknown>}
            keys={[
              ["cargoAlvo", "Cargo alvo"],
              ["senioridade", "Senioridade"],
              ["inicioDisponivel", "Início disponível"],
              ["resumo", "Resumo"],
              ["areasInteresse", "Áreas de interesse"],
              ["modeloTrabalho", "Modelo de trabalho"],
              ["jornada", "Jornada"],
              ["tipoContrato", "Tipo de contrato"],
              ["viagens", "Viagens"],
              ["mudanca", "Mudança"],
              ["cidadePreferida", "Cidade preferida"],
              ["distanciaMaxKm", "Distância máx. (km)"],
              ["obsDeslocamento", "Obs. deslocamento"],
              ["pretensaoSalarial", "Pretensão salarial"],
              ["pretensaoNegociavel", "Negociável"],
              ["beneficiosDesejados", "Benefícios desejados"],
              ["naoAbreMaoDe", "Não abre mão de"],
            ]}
          />
        ) : (
          <div className="text-muted-foreground text-xs">Sem preferências.</div>
        )}
      </Section>

      <Section title="Referências">
        {(data.references?.items?.length ?? 0) === 0 ? (
          <div className="text-muted-foreground text-xs">Nenhuma referência.</div>
        ) : (
          data.references!.items!.map((r) => (
            <div key={String(r.id ?? r.nome)} className="rounded-lg border border-border/30 p-2 mb-2">
              <div className="font-medium text-sm">{disp(r.nome)}</div>
              <div className="text-xs text-muted-foreground">
                {[r.relacao, r.empresa, r.cargo].filter(Boolean).join(" · ")}
              </div>
              {r.contato ? <div className="text-xs">{r.contato}</div> : null}
              {r.podeContatar != null ? <div className="text-xs">Pode contatar: {disp(r.podeContatar)}</div> : null}
              {r.observacoes ? <div className="text-xs mt-1 whitespace-pre-wrap">{r.observacoes}</div> : null}
            </div>
          ))
        )}
      </Section>

      <Section title="Acessibilidade e necessidades">
        {data.accessibility ? (
          <PrefGrid
            data={data.accessibility as unknown as Record<string, unknown>}
            keys={[
              ["idioma", "Idioma"],
              ["canal", "Canal preferido"],
              ["melhorHorario", "Melhor horário"],
              ["observacoesComunicacao", "Obs. comunicação"],
              ["precisaLegendas", "Precisa legendas"],
              ["precisaInterprete", "Precisa intérprete"],
              ["precisaLeitorTela", "Precisa leitor de tela"],
              ["precisaBaixaEstimulo", "Precisa baixo estímulo"],
              ["precisaMobilidade", "Precisa adaptação mobilidade"],
              ["precisaTempoExtra", "Precisa tempo estendido"],
              ["detalhesNecessidades", "Detalhes"],
              ["consentimentoPcd", "Consentimento PcD"],
              ["pcdIdentificacao", "PcD — identificação"],
              ["pcdTipo", "PcD — tipo"],
              ["pcdComprovacao", "PcD — comprovação"],
              ["pcdObservacoes", "PcD — observações"],
            ]}
          />
        ) : (
          <div className="text-muted-foreground text-xs">Sem dados.</div>
        )}
      </Section>

      <Section title="Agenda e disponibilidade">
        {data.agenda?.preferences ? (
          <PrefGrid
            data={data.agenda.preferences as unknown as Record<string, unknown>}
            keys={[
              ["formatoEntrevista", "Formato entrevista"],
              ["inicioDisponivel", "Início disponível"],
              ["avisoPrevio", "Aviso prévio"],
              ["observacoes", "Observações"],
              ["diaSeg", "Seg"],
              ["diaTer", "Ter"],
              ["diaQua", "Qua"],
              ["diaQui", "Qui"],
              ["diaSex", "Sex"],
              ["diaSab", "Sáb"],
              ["diaDom", "Dom"],
              ["periodoManha", "Manhã"],
              ["periodoTarde", "Tarde"],
              ["periodoNoite", "Noite"],
              ["horarioPreferido", "Horário preferido"],
              ["fusoHorario", "Fuso"],
            ]}
          />
        ) : null}
        {(data.agenda?.blocks?.length ?? 0) > 0 ? (
          <div className="mt-2 space-y-1">
            <div className="text-xs font-semibold">Bloqueios / indisponibilidade</div>
            {data.agenda!.blocks!.map((b) => (
              <div key={String(b.id ?? b.titulo)} className="text-xs rounded border border-border/25 px-2 py-1">
                <span className="font-medium">{disp(b.titulo)}</span> ({disp(b.tipo)}) — {disp(b.data)} {disp(b.horario)}
                {b.observacoes ? <div className="whitespace-pre-wrap mt-0.5">{b.observacoes}</div> : null}
              </div>
            ))}
          </div>
        ) : !data.agenda?.preferences ? (
          <div className="text-muted-foreground text-xs">Sem agenda.</div>
        ) : null}
      </Section>

      <Section title="LGPD">
        {data.lgpd ? (
          <PrefGrid
            data={data.lgpd as unknown as Record<string, unknown>}
            keys={[
              ["processarCandidatura", "Processar candidatura"],
              ["permitirContato", "Permitir contato"],
              ["bancoTalentos", "Banco de talentos"],
              ["retencaoMeses", "Retenção (meses)"],
              ["compartilhamento", "Compartilhamento"],
              ["dadosSensiveis", "Dados sensíveis"],
              ["comunicacoes", "Comunicações"],
              ["consentidoEmUtc", "Consentido em"],
              ["revogadoEmUtc", "Revogado em"],
              ["updatedAtUtc", "Atualizado em"],
            ]}
          />
        ) : (
          <div className="text-muted-foreground text-xs">Sem registro LGPD.</div>
        )}
      </Section>

      <Section title="Notificações">
        {data.notifications ? (
          <PrefGrid
            data={data.notifications as unknown as Record<string, unknown>}
            keys={[
              ["canalEmail", "E-mail"],
              ["canalWhatsapp", "WhatsApp"],
              ["canalSms", "SMS"],
              ["canalPush", "Push"],
              ["frequencia", "Frequência"],
              ["idioma", "Idioma"],
              ["email", "E-mail para contato"],
              ["telefone", "Telefone"],
              ["permiteContato", "Permite contato"],
              ["alertaNovasVagas", "Novas vagas"],
              ["alertaAtualizacoes", "Atualizações"],
              ["alertaEntrevistas", "Entrevistas"],
              ["alertaMensagens", "Mensagens"],
              ["alertaDocumentos", "Documentos"],
              ["alertaLembretes", "Lembretes"],
              ["silencioAtivo", "Silêncio ativo"],
              ["silencioInicio", "Silêncio início"],
              ["silencioFim", "Silêncio fim"],
              ["silencioPrioridade", "Prioridade silêncio"],
              ["assinatura", "Assinatura"],
            ]}
          />
        ) : (
          <div className="text-muted-foreground text-xs">Sem preferências de notificação.</div>
        )}
      </Section>

      <Section title="Documentos (portal)">
        {(data.portalDocuments?.items?.length ?? 0) === 0 ? (
          <div className="text-muted-foreground text-xs">Nenhum documento do portal.</div>
        ) : (
          <div className="space-y-1">
            {data.portalDocuments!.items!.map((doc) => (
              <div key={String(doc.id ?? doc.nome)} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-border/30 p-2 text-xs">
                <div>
                  <div className="font-medium text-foreground">{disp(doc.nome)}</div>
                  <div className="text-muted-foreground">{disp(doc.tipo)} · {disp(doc.data)}</div>
                  {doc.observacoes ? <div className="mt-0.5 whitespace-pre-wrap">{doc.observacoes}</div> : null}
                </div>
                {doc.link ? (
                  <a href={doc.link} className="text-[rgb(var(--lt-primary))] hover:underline shrink-0" target="_blank" rel="noopener noreferrer">
                    Abrir
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { UatReport } from "./utils/uat-report";

const tenantId = process.env.PORTALRH_E2E_TENANT ?? "liotecnica";
const portalVagasUrl = process.env.PORTALRH_E2E_PORTAL_VAGAS_URL ?? "http://10.0.0.80:3050";
const portalRhUrl = process.env.PORTALRH_E2E_BASE_URL ?? "http://10.0.0.80:3000";

const coordenadorEmail = process.env.PORTALRH_E2E_COORDENADOR_USER;
const coordenadorPassword = process.env.PORTALRH_E2E_COORDENADOR_PASSWORD;
const gestorEmail = process.env.PORTALRH_E2E_GESTOR_USER;
const gestorPassword = process.env.PORTALRH_E2E_GESTOR_PASSWORD;
const especialistaEmail = process.env.PORTALRH_E2E_RH_ESPECIALISTA_USER;
const especialistaPassword = process.env.PORTALRH_E2E_RH_ESPECIALISTA_PASSWORD;
const analistaEmail = process.env.PORTALRH_E2E_RH_ANALISTA_USER;
const analistaPassword = process.env.PORTALRH_E2E_RH_ANALISTA_PASSWORD;
const candidatoEmail = process.env.PORTALRH_E2E_CANDIDATO_USER;
const candidatoPassword = process.env.PORTALRH_E2E_CANDIDATO_PASSWORD;

test.setTimeout(1_500_000);

type AuthInfo = { accessToken: string; tenantId?: string };
type Solicitacao = { id: string; titulo?: string; status?: string; vagaId?: string | null; analistaRhResponsavelNome?: string | null };
type Vaga = { id: string; titulo?: string | null; status?: string | number; headcountPendente?: number };
type Candidate = { id: string; nome?: string | null; email?: string | null };
type KanbanResponse = { colunas: Array<{ etapa: string | number; itens: KanbanItem[] }> };
type KanbanItem = { id: string; candidatoId: string; candidatoNome: string; candidatoEmail?: string | null; etapaMacro: string | number };
type AgendaEvent = { id: string; title?: string | null; candidate?: string | null; startAtUtc: string; status?: string | null };
type PropostaVaga = {
  id: string;
  vagaId: string;
  vagaTitulo?: string | null;
  candidatoId: string;
  candidatoNome?: string | null;
  candidatoEmail?: string | null;
  status: string | number;
  accessToken?: string | null;
  salarioOferecido?: number | null;
};
type DocumentoSolicitado = { tipoDocumento: number | string; label?: string | null; obrigatorio: boolean };
type PreAdmissaoSetup = { id: string; cpf: string; publicUrl: string; vagaId: string; dados: Record<string, unknown>; documentosSolicitados: DocumentoSolicitado[] };

function portalPath(path: string) {
  return `${portalVagasUrl.replace(/\/$/, "")}${path}`;
}

function portalRhPath(path: string) {
  const base = portalRhUrl.replace(/\/$/, "");
  if (base.toLowerCase().endsWith("/app") && path.startsWith("/app/")) {
    return `${base}${path.slice("/app".length)}`;
  }
  return `${base}${path}`;
}

function gerarCpf(): string {
  const base = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  for (let i = 0; i < 2; i += 1) {
    const soma = base.reduce((acc, digit, index) => acc + (base.length + 1 - index) * digit, 0);
    const dv = (soma * 10) % 11;
    base.push(dv === 10 ? 0 : dv);
  }
  return base.join("");
}

function requiredCredentials() {
  const missing = [
    ["PORTALRH_E2E_COORDENADOR_USER", coordenadorEmail],
    ["PORTALRH_E2E_COORDENADOR_PASSWORD", coordenadorPassword],
    ["PORTALRH_E2E_GESTOR_USER", gestorEmail],
    ["PORTALRH_E2E_GESTOR_PASSWORD", gestorPassword],
    ["PORTALRH_E2E_RH_ESPECIALISTA_USER", especialistaEmail],
    ["PORTALRH_E2E_RH_ESPECIALISTA_PASSWORD", especialistaPassword],
    ["PORTALRH_E2E_RH_ANALISTA_USER", analistaEmail],
    ["PORTALRH_E2E_RH_ANALISTA_PASSWORD", analistaPassword],
    ["PORTALRH_E2E_CANDIDATO_USER", candidatoEmail],
    ["PORTALRH_E2E_CANDIDATO_PASSWORD", candidatoPassword],
  ].filter(([, value]) => !value);

  test.skip(missing.length > 0, `Variáveis ausentes: ${missing.map(([name]) => name).join(", ")}`);
}

async function loginUi(page: Page, email: string, password: string) {
  await page.goto("/app/login");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator("#loginSubmit").click();
  await page.waitForURL(/\/app\/dashboard/, { timeout: 20_000 });
}

async function loginCandidatoPortal(page: Page) {
  await page.goto(portalPath(`/app/PortalVagas/Acesso?tenantId=${encodeURIComponent(tenantId)}`));
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByText(/Acesse sua conta|Portal de Vagas - Acesso/i).first()).toBeVisible({ timeout: 20_000 });
  const emailInput = page.getByPlaceholder(/voce@empresa\.com|seu@email/i).first();
  if (await emailInput.count() > 0) {
    await emailInput.fill(candidatoEmail!);
  } else {
    await page.getByRole("textbox").nth(0).fill(candidatoEmail!);
  }
  const passwordInput = page.getByPlaceholder(/Mínimo 8 caracteres|••••••••/i).first();
  if (await passwordInput.count() > 0) {
    await passwordInput.fill(candidatoPassword!);
  } else {
    await page.getByRole("textbox").nth(1).fill(candidatoPassword!);
  }
  await page.getByRole("button", { name: /Entrar no portal/i }).click();
  await expect(page.getByText(/Vagas abertas|Minhas candidaturas|Meu perfil|Leonardo/i).first()).toBeVisible({ timeout: 20_000 });
}

async function loginApi(request: APIRequestContext, email: string, password: string): Promise<AuthInfo> {
  const res = await request.post("/api/auth/auto-login", {
    data: { email, password },
  });
  const text = await res.text();
  expect(res.ok(), `Login API falhou para ${email}: ${text}`).toBe(true);
  const body = JSON.parse(text) as AuthInfo;
  expect(body.accessToken, `Login API deve retornar token para ${email}`).toBeTruthy();
  return body;
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "X-Tenant-Id": tenantId,
  };
}

async function apiJson<T>(
  request: APIRequestContext,
  method: "get" | "post" | "patch" | "put",
  path: string,
  token: string | null,
  data?: unknown,
): Promise<T> {
  const res = await request[method](path, {
    headers: token ? authHeaders(token) : { "X-Tenant-Id": tenantId },
    data,
  });
  const text = await res.text();
  expect(res.ok(), `${method.toUpperCase()} ${path} falhou: ${text}`).toBe(true);
  return (text ? JSON.parse(text) : {}) as T;
}

async function selecionarPrimeiraOpcaoAutocomplete(page: Page, placeholder: RegExp) {
  const initialInput = page.getByPlaceholder(placeholder).first();
  if ((await initialInput.count()) === 0) return;
  await expect(initialInput).toBeVisible({ timeout: 20_000 });

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const input = page.getByPlaceholder(placeholder).first();
    if ((await input.count()) === 0) return;
    try {
      await input.click({ force: true, timeout: 5_000 });
      break;
    } catch (error) {
      if (attempt === 5) throw error;
      await page.waitForTimeout(500);
    }
  }

  const opcao = page.locator(".absolute.z-50 button").first();
  await expect(opcao).toBeVisible({ timeout: 20_000 });
  await opcao.click();
}

async function selecionarMotivoSemDesligamento(page: Page) {
  const motivoSelect = page.locator('[data-testid="select-motivo-requisicao"]');
  await expect(motivoSelect).toBeVisible({ timeout: 20_000 });
  await page.waitForFunction(() => {
    const select = document.querySelector<HTMLSelectElement>('[data-testid="select-motivo-requisicao"]');
    return !!select && select.options.length > 1;
  });

  const motivoValue = await motivoSelect.evaluate((el) => {
    const select = el as HTMLSelectElement;
    const option = Array.from(select.options).find((o) => {
      const text = o.textContent ?? "";
      return o.value && !/demiss|deslig/i.test(text);
    });
    return option?.value ?? "";
  });
  expect(motivoValue, "deve existir motivo de requisição sem desligamento").toBeTruthy();
  await motivoSelect.selectOption(motivoValue);
}

async function selecionarTurnoOuHorarioLegado(page: Page) {
  await page.getByRole("button", { name: /Horário/i }).click();
  const turnoInput = page.getByPlaceholder(/Buscar turno/i).first();
  await expect(turnoInput).toBeVisible({ timeout: 10_000 });
  await turnoInput.click();

  const primeiraOpcao = page.locator(".absolute.z-50 button").first();
  if (await primeiraOpcao.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await primeiraOpcao.click();
    return;
  }

  await page
    .getByPlaceholder(/Use apenas se ainda não existir turno/i)
    .fill("Segunda a sexta, 08:00 às 17:00, com 1h de intervalo.");
}

async function criarRequisicaoComoCoordenador(page: Page) {
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const justificativa = `UAT fluxo completo recrutamento ${stamp}`;

  await page.goto("/app/gestao/solicitacoes");
  await expect(page.locator('[data-testid="btn-nova-posicao"]')).toBeVisible({ timeout: 20_000 });
  await page.locator('[data-testid="btn-nova-posicao"]').click();
  await expect(page.getByRole("dialog", { name: /Requisição de Pessoal/i })).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1_000);

  await selecionarPrimeiraOpcaoAutocomplete(page, /Buscar empresa/i);
  await selecionarPrimeiraOpcaoAutocomplete(page, /Buscar filial/i);
  await selecionarPrimeiraOpcaoAutocomplete(page, /Buscar seção/i);
  await selecionarPrimeiraOpcaoAutocomplete(page, /Buscar função RM/i);

  const faixaSalarial = page.getByPlaceholder("R$ 0,00");
  await faixaSalarial.nth(0).fill("500000");
  await faixaSalarial.nth(1).fill("700000");

  await selecionarMotivoSemDesligamento(page);
  await page.locator('[data-testid="radio-decisao-provisoria"]').check();
  await page.locator('[data-testid="input-decisao-prazo-meses"]').fill("3");
  await page.getByPlaceholder(/Justifique a necessidade/i).fill(justificativa);
  await selecionarTurnoOuHorarioLegado(page);

  const createResponsePromise = page.waitForResponse((response) => (
    response.request().method() === "POST" && /\/api\/solicitacoes-vaga\/?$/.test(response.url())
  ), { timeout: 30_000 });

  await page.getByRole("button", { name: /Solicitar aprovação/i }).click();
  const createResponse = await createResponsePromise;
  const createText = await createResponse.text();
  expect(createResponse.ok(), `POST /api/solicitacoes-vaga falhou: ${createText}`).toBe(true);

  const created = JSON.parse(createText) as Solicitacao;
  expect(created.id, "API deve retornar o id da requisição").toBeTruthy();
  return { id: created.id, titulo: created.titulo ?? "Requisição UAT", justificativa };
}

async function aprovarRequisicaoComoGestor(page: Page, requisicaoId: string) {
  await page.goto("/app/gestao/aprovacoes");
  await expect(page.getByPlaceholder("Buscar...")).toBeVisible({ timeout: 20_000 });
  await page.getByPlaceholder("Buscar...").fill(requisicaoId);

  const row = page.locator("tbody tr").first();
  await expect(row).toBeVisible({ timeout: 20_000 });
  await row.click();
  await expect(page.getByRole("dialog", { name: /Detalhes da Solicitação de Contratação/i })).toBeVisible({ timeout: 20_000 });
  await page.getByPlaceholder(/Observação/i).fill("Aprovado pelo gestor direto no UAT automatizado.");

  const approvePromise = page.waitForResponse((response) => (
    response.request().method() === "POST" && response.url().includes(`/api/solicitacoes-vaga/${requisicaoId}/approve`)
  ), { timeout: 30_000 });
  await page.getByRole("button", { name: /^Aprovar$/i }).click();
  const approveResponse = await approvePromise;
  const approveText = await approveResponse.text();
  expect(approveResponse.ok(), `Aprovação do gestor falhou: ${approveText}`).toBe(true);
}

async function buscarAnalistaRh(request: APIRequestContext, token: string) {
  const users = await apiJson<Array<{ id: string; name: string; email: string }>>(
    request,
    "get",
    "/api/lookup/users-analistas-rh",
    token,
  );
  const byEmail = users.find((u) => u.email?.toLowerCase() === analistaEmail!.toLowerCase());
  expect(byEmail, `Analista RH ${analistaEmail} deve existir no lookup`).toBeTruthy();
  return byEmail!;
}

async function publicarVaga(request: APIRequestContext, token: string, vagaId: string) {
  const vaga = await apiJson<Vaga>(request, "patch", `/api/vagas/${vagaId}/status`, token, { status: 2 });
  const publicVaga = await apiJson<Vaga>(request, "get", `/api/public/vagas/${vagaId}?tenantId=${tenantId}`, null);
  return { vaga, publicVaga };
}

async function registrarCandidaturaPublica(request: APIRequestContext, vagaId: string, titulo: string) {
  const nome = `Leonardo Mendes UAT ${new Date().toISOString().slice(11, 19).replace(/\D/g, "")}`;
  const res = await request.post(`/api/public/candidaturas?tenantId=${tenantId}`, {
    multipart: {
      vagaId,
      nome,
      email: candidatoEmail!,
      fone: "11999999999",
      cidadeUf: "São Paulo, SP",
      cargoAtual: "Candidato UAT",
      anosExperiencia: "5",
      observacoes: `Candidatura UAT automatizada para ${titulo}`,
    },
  });
  const text = await res.text();
  expect(res.ok(), `Candidatura pública falhou: ${text}`).toBe(true);
  return JSON.parse(text) as Candidate;
}

async function abrirDetalhesDaVagaNoPortal(page: Page, vaga: Vaga) {
  const titulo = vaga.titulo ?? "";
  await page.goto(portalPath(`/?tenantId=${encodeURIComponent(tenantId)}`));
  await expect(page.getByText(/Vagas abertas|Portal de Vagas/i).first()).toBeVisible({ timeout: 20_000 });

  const searchInput = page.getByPlaceholder(/Cargo, área, tecnologia, cidade|Buscar por cargo, área ou cidade/i).first();
  if (titulo && await searchInput.count() > 0) {
    await searchInput.fill(titulo);
    await searchInput.press("Enter").catch(() => {});
    await page.getByRole("button", { name: /^Buscar$/i }).click().catch(() => {});
  }

  const card = page.locator("article, main button").filter({ hasText: titulo || vaga.id }).filter({ hasText: /Detalhes|Ver detalhes/i }).first();
  await expect(card).toBeVisible({ timeout: 20_000 });

  const detailsButton = card.getByRole("button", { name: /Detalhes|Ver detalhes/i }).first();
  if (await detailsButton.count() > 0) {
    await detailsButton.click({ force: true });
  } else {
    await card.click({ force: true });
  }

  await expect(page.locator(".modal-backdrop").last()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(".modal-backdrop").last().getByText(/DETALHES DA VAGA|CANDIDATURA RÁPIDA/i).first()).toBeVisible({ timeout: 20_000 });
  if (titulo) await expect(page.getByText(titulo).first()).toBeVisible({ timeout: 20_000 });
}

async function abrirFormularioCandidatura(page: Page) {
  const modal = page.locator(".modal-backdrop").last();
  await expect(modal.getByText(/CANDIDATURA RÁPIDA|Nome|Enviar candidatura/i).first()).toBeVisible({ timeout: 20_000 });
}

async function preencherCampoSeEditavel(locator: ReturnType<Page["locator"]>, valor: string) {
  if ((await locator.count()) === 0) return;
  const readOnly = await locator.first().evaluate((el) => el instanceof HTMLInputElement && el.readOnly);
  if (!readOnly) await locator.first().fill(valor);
}

async function preencherCandidaturaComCv(page: Page, cvPath: string) {
  const modal = page.locator(".modal-backdrop").last();
  await expect(modal.getByLabel(/^Nome$/i)).toHaveValue(/.+/);
  await expect(modal.getByLabel(/^E-mail$/i)).toHaveValue(candidatoEmail!);
  await preencherCampoSeEditavel(modal.getByLabel(/^Telefone$/i), "11999999999");
  await preencherCampoSeEditavel(modal.getByLabel(/Cidade \/ UF/i), "São Paulo, SP");
  await preencherCampoSeEditavel(modal.getByLabel(/Cargo atual/i), "Candidato UAT");
  await preencherCampoSeEditavel(modal.getByLabel(/Anos de experiência/i), "5");
  await preencherCampoSeEditavel(modal.getByLabel(/Observações/i), "Candidatura UAT automatizada com envio de CV pela UI.");
  await modal.locator('input[type="file"]').setInputFiles(cvPath);
}

async function enviarCandidaturaPelaUi(page: Page) {
  const candidaturaResponsePromise = page.waitForResponse((response) => (
    response.request().method() === "POST" && response.url().includes("/api/public/candidaturas")
  ), { timeout: 30_000 });

  await page.getByRole("button", { name: /Enviar candidatura/i }).click();

  const candidaturaResponse = await candidaturaResponsePromise;
  const candidaturaText = await candidaturaResponse.text();
  expect(candidaturaResponse.ok(), `Candidatura via UI falhou: ${candidaturaText}`).toBe(true);
  await expect(page.getByText(/Candidatura enviada/i)).toBeVisible({ timeout: 20_000 });
  return JSON.parse(candidaturaText) as Candidate;
}

async function buscarCandidaturaNoKanban(request: APIRequestContext, token: string, vagaId: string, candidatoId: string) {
  return await expect
    .poll(
      async () => {
        const kanban = await apiJson<KanbanResponse>(request, "get", `/api/candidaturas/kanban?vagaId=${vagaId}`, token);
        return kanban.colunas.flatMap((col) => col.itens).find((item) => item.candidatoId === candidatoId) ?? null;
      },
      { intervals: [1_000, 2_000, 3_000, 5_000], timeout: 20_000 },
    )
    .not.toBeNull()
    .then(async () => {
      const kanban = await apiJson<KanbanResponse>(request, "get", `/api/candidaturas/kanban?vagaId=${vagaId}`, token);
      const item = kanban.colunas.flatMap((col) => col.itens).find((candidate) => candidate.candidatoId === candidatoId);
      if (!item) throw new Error("Candidatura não encontrada após polling.");
      return item;
    });
}

async function avancarCandidatura(
  request: APIRequestContext,
  token: string,
  candidaturaId: string,
  etapa: string,
  entrevista?: {
    inicioUtc: string;
    duracaoMinutos: number;
    formato: "Presencial" | "Online";
    responsavel: string;
    participantesOpcionais?: string[];
    local?: string;
    observacao?: string;
  },
) {
  return await apiJson<KanbanItem>(request, "post", `/api/candidaturas/${candidaturaId}/avancar-etapa`, token, {
    novaEtapa: etapa,
    observacao: `UAT automatizado moveu para ${etapa}`,
    entrevista: entrevista ?? null,
  });
}

function proximoHorarioEntrevista() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(14, 0, 0, 0);
  return date.toISOString();
}

async function buscarEventoEntrevista(
  request: APIRequestContext,
  token: string,
  candidatoNome: string,
): Promise<AgendaEvent> {
  const start = new Date();
  start.setDate(start.getDate() - 1);
  const end = new Date();
  end.setDate(end.getDate() + 7);
  const qs = new URLSearchParams({
    start: start.toISOString(),
    end: end.toISOString(),
  });
  const events = await apiJson<AgendaEvent[]>(request, "get", `/api/agenda/events?${qs.toString()}`, token);
  const event = events.find((item) => {
    const title = `${item.title ?? ""} ${item.candidate ?? ""}`.toLowerCase();
    return title.includes(candidatoNome.toLowerCase());
  });
  expect(event, `Evento de entrevista deve existir para ${candidatoNome}`).toBeTruthy();
  return event!;
}

async function criarEEnviarProposta(
  request: APIRequestContext,
  token: string,
  vaga: Vaga,
  candidato: Candidate,
): Promise<PropostaVaga & { publicUrl: string }> {
  const criada = await apiJson<PropostaVaga>(request, "post", "/api/propostas-vaga", token, {
    vagaId: vaga.id,
    candidatoId: candidato.id,
    moeda: "BRL",
    salarioOferecido: 5000,
    descricaoBeneficios: "Vale transporte, refeição no local, assistência médica e benefícios conforme política interna.",
    dataPrevistaInicio: "2026-06-10",
    mensagemPersonalizada: "Parabéns! Esta proposta foi gerada pelo fluxo UAT automatizado.",
    observacaoInternaRh: "Proposta criada pelo UAT de recrutamento completo.",
  });

  const enviada = await apiJson<PropostaVaga>(request, "post", `/api/propostas-vaga/${criada.id}/enviar`, token, {
    prazoDiasResposta: 7,
  });
  expect(enviada.accessToken, "Proposta enviada deve retornar accessToken público").toBeTruthy();

  return {
    ...enviada,
    publicUrl: new URL(
      `/app/PortalVagas/Proposta?token=${encodeURIComponent(enviada.accessToken!)}&tenantId=${encodeURIComponent(tenantId)}`,
      portalRhUrl,
    ).toString(),
  };
}

async function visualizarPropostaEnviadaComoAnalista(page: Page, proposta: PropostaVaga) {
  await page.goto("/app/recrutamento/propostas-vaga");
  await expect(page.getByRole("heading", { name: /Propostas \/ Cartas de oferta/i })).toBeVisible({ timeout: 20_000 });
  await page.getByPlaceholder(/Buscar vaga, candidato, e-mail ou status/i).fill(proposta.candidatoNome ?? proposta.candidatoEmail ?? proposta.id);
  const row = page.locator("tbody tr").filter({ hasText: proposta.candidatoNome ?? proposta.candidatoEmail ?? proposta.id }).first();
  await expect(row).toBeVisible({ timeout: 20_000 });
  await expect(row.getByText(/Enviada|Visualizada/i).first()).toBeVisible({ timeout: 20_000 });
}

async function aceitarPropostaComoCandidato(page: Page, proposta: PropostaVaga & { publicUrl: string }) {
  await page.goto(proposta.publicUrl);
  await expect(page.getByText(/Carta de oferta|Valor da proposta/i).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Status: Enviada|Status: Visualizada/i).first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: /Aceitar proposta/i }).click();
  await expect(page.getByText(/Confirmar aceite da proposta/i)).toBeVisible({ timeout: 20_000 });
  const nameInput = page.getByPlaceholder(/Maria da Silva/i);
  if ((await nameInput.inputValue()).trim().length === 0) {
    await nameInput.fill(proposta.candidatoNome ?? "Candidato UAT");
  }
  await page.getByRole("button", { name: /Confirmar aceite/i }).click();
  await expect(page.getByText(/Proposta aceita|Você aceitou esta proposta|O RH foi notificado/i).first()).toBeVisible({ timeout: 30_000 });
}

async function iniciarPreAdmissao(request: APIRequestContext, token: string, candidato: Candidate, vagaId: string) {
  const cpf = gerarCpf();
  const dados = dadosAdmissaoUat(candidato.nome ?? "Candidato UAT", cpf, candidato.email ?? candidatoEmail ?? "candidato.uat@example.com");
  const pre = await apiJson<{ id: string; documentosSolicitados?: DocumentoSolicitado[] }>(request, "post", "/api/pre-admissao/aprovar-contratacao", token, {
    candidatoId: candidato.id,
    nome: candidato.nome ?? "Candidato UAT",
    cpf,
    email: candidato.email ?? candidatoEmail,
    celular: "11999999999",
    dataAdmissao: "2026-06-10",
    salario: 5000,
  });

  let documentosSolicitados = pre.documentosSolicitados ?? [];
  if (documentosSolicitados.length === 0) {
    const detalhe = await apiJson<{ documentosSolicitados?: DocumentoSolicitado[] }>(request, "get", `/api/pre-admissao/${pre.id}`, token);
    documentosSolicitados = detalhe.documentosSolicitados ?? [];
  }
  expect(documentosSolicitados.length, "pré-admissão deve solicitar os documentos padrão configurados").toBeGreaterThan(0);

  const link = await apiJson<{ publicUrl?: string }>(request, "post", `/api/pre-admissao/${pre.id}/gerar-link`, token, {
    cpf,
    enviarEmail: false,
    enviarWhatsapp: false,
  });

  const url = new URL(link.publicUrl ?? `/app/DocumentoAdmissao?tenantId=${tenantId}&preAdmissaoId=${pre.id}`, portalRhUrl);
  return { id: pre.id, cpf, publicUrl: url.toString(), vagaId, dados, documentosSolicitados };
}

function dadosAdmissaoUat(nome: string, cpf: string, email: string): Record<string, unknown> {
  return {
    nome,
    nomeAbreviado: "CANDIDATO UAT",
    cpf,
    rg: "123456789",
    rgOrgaoExpedidor: "SSP",
    rgUfExpedidor: "SP",
    rgDataExpedicao: "2015-01-10",
    regIdentidCivilNumero: "123456789",
    regIdentidCivilOrgEmiss: "SSP",
    regIdentidCivilUf: "SP",
    regIdentidCivilCidade: "Sao Paulo",
    regIdentidCivilDataExped: "2015-01-10",
    dataNascimento: "1990-05-15",
    sexo: 1,
    estadoCivil: 1,
    nacionalidade: "Brasileira",
    paisNacionalidade: "BRA",
    naturalCidade: "Sao Paulo",
    naturalUf: "SP",
    paisNascimento: "BRA",
    nomeMae: "Mae UAT",
    nomePai: "Pai UAT",
    grauInstrucao: 8,
    origemFuncionario: 1,
    cep: "01001000",
    logradouro: "Praca da Se",
    numero: "100",
    bairro: "Se",
    uf: "SP",
    cidade: "Sao Paulo",
    resideExterior: "N",
    email,
    celular: "11999999999",
    dddTelefone: 11,
    telefone: "33334444",
    dddTelContato: 11,
    contatoEmergenciaNome: "Contato UAT",
    contatoEmergenciaFone: "11988887777",
    bancoCodigo: "001",
    bancoNome: "Banco do Brasil S.A.",
    agencia: "1234",
    agenciaDigito: "5",
    conta: "123456",
    contaDigito: "7",
    tipoConta: 0,
    pisPasep: "12345678901",
    ctps: "1234567",
    ctpsSerie: "0010",
    ctpsUf: "SP",
    ctpsModelo: 3,
    tituloEleitorNumero: "123456789012",
    tituloEleitorZona: "001",
    tituloEleitorSecao: "0001",
    tituloEleitorUf: "SP",
    tituloEleitorCidade: "Sao Paulo",
    grupoSanguineo: 1,
    fatorRh: 1,
    possuiDeficiencia: "N",
    cutis: 1,
    cabelo: 1,
    olhos: 1,
  };
}

async function salvarDadosAdmissaoViaApi(request: APIRequestContext, setup: PreAdmissaoSetup) {
  const res = await request.put(`/api/public/admissao-portal/${setup.id}/dados`, {
    headers: {
      "Content-Type": "application/json",
      "X-Tenant-Id": tenantId,
      "X-Cpf": setup.cpf,
    },
    data: setup.dados,
  });
  const text = await res.text();
  expect(res.ok(), `Salvar dados admissionais falhou: ${text}`).toBe(true);
}

async function anexarDocumentosSolicitados(page: Page, documentoPath: string) {
  await page.getByRole("button", { name: /Começar|Próximo/i }).click();
  await expect(page.getByText(/Tire uma foto de cada documento|documento/i).first()).toBeVisible({ timeout: 20_000 });

  const inputs = page.locator('input[type="file"][accept="image/*"]');
  const total = await inputs.count();
  expect(total, "deve haver inputs de upload para os documentos solicitados").toBeGreaterThan(0);

  for (let index = 0; index < total; index += 1) {
    const uploadResponse = page.waitForResponse((response) => (
      response.request().method() === "POST" && response.url().includes("/api/public/admissao-portal/") && response.url().includes("/documentos")
    ), { timeout: 30_000 });
    await inputs.nth(index).setInputFiles(documentoPath);
    const response = await uploadResponse;
    const text = await response.text();
    expect(response.ok(), `Upload de documento ${index + 1} falhou: ${text}`).toBe(true);
  }

  await expect(page.getByText(/documento-uat\.png|Documento salvo|Reconhecido|Enviar outro/i).first()).toBeVisible({ timeout: 20_000 });
}

async function validarFormularioAdmissaoPreenchido(page: Page, request: APIRequestContext, setup: PreAdmissaoSetup) {
  await salvarDadosAdmissaoViaApi(request, setup);
  await page.reload();
  await expect(page.getByText(/Seus Dados|Revise os dados/i).first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: /Seus Dados Pessoais/i }).click().catch(() => {});
  await expect.poll(async () => (
    page.locator("input").evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value))
  ), { timeout: 20_000 }).toContain(String(setup.dados.nome));
  await expect.poll(async () => (
    page.locator("input").evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value))
  ), { timeout: 20_000 }).toContain("123456789");
}

async function finalizarFormularioAdmissao(page: Page) {
  await page.getByRole("button", { name: /Próximo/i }).click();
  await expect(page.getByText(/Voce tem dependentes/i)).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: /Nao tenho dependentes/i }).click();
  await page.getByRole("button", { name: /Próximo/i }).click();
  await expect(page.getByText(/Confira se seus dados|Enviar para o RH/i).first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: /Enviar para o RH/i }).click();
  await expect(page.getByText(/Dados Enviados|Seus documentos e dados foram enviados/i).first()).toBeVisible({ timeout: 30_000 });
}

test("fluxo completo de recrutamento até pré-admissão", async ({ page, request }, testInfo) => {
  requiredCredentials();

  const report = await UatReport.create("UAT - Fluxo completo de recrutamento", testInfo);
  await page.setViewportSize({ width: 1440, height: 950 });
  await report.installVisualCursor(page);

  let requisicao: { id: string; titulo: string; justificativa: string } | null = null;
  let solicitacaoAprovada: Solicitacao | null = null;
  let vaga: Vaga | null = null;
  let candidato: Candidate | null = null;
  let candidatura: KanbanItem | null = null;
  let entrevistaEvento: AgendaEvent | null = null;
  let proposta: (PropostaVaga & { publicUrl: string }) | null = null;
  let preAdmissao: PreAdmissaoSetup | null = null;
  const curriculoPath = testInfo.outputPath("curriculo-uat.pdf");
  const documentoPath = testInfo.outputPath("documento-uat.png");
  writeFileSync(
    curriculoPath,
    "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Count 0 >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n",
  );
  writeFileSync(
    documentoPath,
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAoAAAAHgCAIAAAC6s0uzAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAA4pJREFUeNrs1TEBAAAAwqD1T20JT6AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB4GmAAATNIAAE6AbyhAAAAAElFTkSuQmCC",
      "base64",
    ),
  );

  const especialistaAuth = await loginApi(request, especialistaEmail!, especialistaPassword!);
  const analistaAuth = await loginApi(request, analistaEmail!, analistaPassword!);

  await report.step(page, "Coordenador cria a requisição de vaga", async () => {
    await loginUi(page, coordenadorEmail!, coordenadorPassword!);
    requisicao = await criarRequisicaoComoCoordenador(page);
  });

  await report.step(page, "Gestor direto aprova a requisição", async () => {
    if (!requisicao) throw new Error("Requisição não criada.");
    await loginUi(page, gestorEmail!, gestorPassword!);
    await aprovarRequisicaoComoGestor(page, requisicao.id);
    solicitacaoAprovada = await apiJson<Solicitacao>(
      request,
      "get",
      `/api/solicitacoes-vaga/${requisicao.id}`,
      especialistaAuth.accessToken,
    );
    expect(solicitacaoAprovada.status).toBe("Aprovada");
    expect(solicitacaoAprovada.vagaId, "A aprovação deve criar/vincular uma vaga").toBeTruthy();
  });

  await report.step(page, "Especialista RH distribui para a analista RH", async () => {
    if (!requisicao) throw new Error("Requisição não criada.");
    const analista = await buscarAnalistaRh(request, especialistaAuth.accessToken);
    await loginUi(page, especialistaEmail!, especialistaPassword!);
    await page.goto("/app/gestao/solicitacoes");
    await expect(page.getByText(/Solicitações|Nova posição/i).first()).toBeVisible({ timeout: 20_000 });
    solicitacaoAprovada = await apiJson<Solicitacao>(
      request,
      "patch",
      `/api/solicitacoes-vaga/${requisicao.id}/analista-rh`,
      especialistaAuth.accessToken,
      { analistaRhResponsavelUserId: analista.id },
    );
    expect(solicitacaoAprovada.analistaRhResponsavelNome).toBeTruthy();
  });

  await report.step(page, "Analista RH publica a vaga no portal", async () => {
    if (!solicitacaoAprovada?.vagaId) throw new Error("Solicitação sem vaga vinculada.");
    await loginUi(page, analistaEmail!, analistaPassword!);
    await page.goto(`/app/vagas/hub?id=${solicitacaoAprovada.vagaId}`);
    await expect(page.getByText(/Publicações|Candidatos|Workflow|Posição/i).first()).toBeVisible({ timeout: 20_000 });
    const publish = await publicarVaga(request, analistaAuth.accessToken, solicitacaoAprovada.vagaId);
    vaga = publish.publicVaga;
    expect(vaga.id).toBe(solicitacaoAprovada.vagaId);
  });

  await report.step(page, "Candidato faz login no Portal de Vagas", async () => {
    await loginCandidatoPortal(page);
  });

  await report.step(page, "Candidato clica nos detalhes da vaga publicada", async () => {
    if (!vaga?.id) throw new Error("Vaga não publicada.");
    await abrirDetalhesDaVagaNoPortal(page, vaga);
  });

  await report.step(page, "Candidato abre formulário, preenche dados e anexa o CV", async () => {
    if (!vaga?.id) throw new Error("Vaga não publicada.");
    await abrirFormularioCandidatura(page);
    await preencherCandidaturaComCv(page, curriculoPath);
  });

  await report.step(page, "Candidato envia candidatura e visualiza sucesso", async () => {
    candidato = await enviarCandidaturaPelaUi(page);
    expect(candidato.id).toBeTruthy();
  });

  await report.step(page, "Analista RH abre o kanban e vê a candidatura aplicada", async () => {
    if (!vaga?.id || !candidato?.id) throw new Error("Vaga ou candidato ausente.");
    candidatura = await buscarCandidaturaNoKanban(request, analistaAuth.accessToken, vaga.id, candidato.id);
    await loginUi(page, analistaEmail!, analistaPassword!);
    await page.goto("/app/recrutamento/candidaturas");
    await expect(page.getByRole("heading", { name: /Kanban de candidaturas/i })).toBeVisible({ timeout: 20_000 });
    await page.locator("select").first().selectOption(vaga.id);
    await expect(page.getByText(candidatura.candidatoNome).first()).toBeVisible({ timeout: 20_000 });
  });

  await report.step(page, "Analista RH move candidatura para Em triagem", async () => {
    if (!candidatura) throw new Error("Candidatura ausente.");
    await avancarCandidatura(request, analistaAuth.accessToken, candidatura.id, "EmTriagem");
    await page.getByRole("button", { name: /Atualizar/i }).click();
    await expect(page.getByText(/Em triagem/i).first()).toBeVisible({ timeout: 20_000 });
  });

  await report.step(page, "Analista RH agenda entrevista ao mover candidatura para Entrevista", async () => {
    if (!candidatura) throw new Error("Candidatura ausente.");
    await avancarCandidatura(request, analistaAuth.accessToken, candidatura.id, "Entrevista", {
      inicioUtc: proximoHorarioEntrevista(),
      duracaoMinutos: 60,
      formato: "Online",
      responsavel: `Analista RH <${analistaEmail}>`,
      participantesOpcionais: [`Gestor direto <${gestorEmail}>`],
      local: "Teams - UAT automatizado",
      observacao: "Entrevista agendada pelo fluxo UAT automatizado.",
    });
    entrevistaEvento = await buscarEventoEntrevista(request, analistaAuth.accessToken, candidatura.candidatoNome);
    await page.getByRole("button", { name: /Atualizar/i }).click();
    await expect(page.getByText(/Entrevista/i).first()).toBeVisible({ timeout: 20_000 });
  });

  await report.step(page, "Analista RH confirma o evento na tela de Agenda", async () => {
    if (!candidatura || !entrevistaEvento) throw new Error("Evento de entrevista ausente.");
    await page.goto("/app/agendas");
    await expect(page.getByText(/^Agenda$/i)).toBeVisible({ timeout: 20_000 });
    await page.getByPlaceholder("Buscar…").fill(candidatura.candidatoNome);
    await expect(page.getByText(entrevistaEvento.title ?? candidatura.candidatoNome).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(candidatura.candidatoNome).first()).toBeVisible({ timeout: 20_000 });
  });

  await report.step(page, "Analista RH avança candidatura para Proposta", async () => {
    if (!candidatura || !vaga?.id) throw new Error("Candidatura ou vaga ausente.");
    await page.goto("/app/recrutamento/candidaturas");
    await expect(page.getByRole("heading", { name: /Kanban de candidaturas/i })).toBeVisible({ timeout: 20_000 });
    await page.locator("select").first().selectOption(vaga.id);
    await expect(page.getByText(candidatura.candidatoNome).first()).toBeVisible({ timeout: 20_000 });
    await avancarCandidatura(request, analistaAuth.accessToken, candidatura.id, "Proposta");
    await page.getByRole("button", { name: /Atualizar/i }).click();
    await expect(page.getByText(/Proposta/i).first()).toBeVisible({ timeout: 20_000 });
  });

  await report.step(page, "Analista RH cria e envia a proposta ao candidato", async () => {
    if (!vaga || !candidato) throw new Error("Vaga ou candidato ausente.");
    proposta = await criarEEnviarProposta(request, analistaAuth.accessToken, vaga, candidato);
    await visualizarPropostaEnviadaComoAnalista(page, proposta);
  });

  await report.step(page, "Candidato acessa e aceita a proposta recebida", async () => {
    if (!proposta) throw new Error("Proposta ausente.");
    await aceitarPropostaComoCandidato(page, proposta);
  });

  await report.step(page, "Analista RH inicia a pré-admissão do candidato", async () => {
    if (!candidato || !vaga?.id) throw new Error("Candidato ou vaga ausente.");
    preAdmissao = await iniciarPreAdmissao(request, analistaAuth.accessToken, candidato, vaga.id);
    expect(preAdmissao.id).toBeTruthy();
  });

  await report.step(page, "Candidato acessa o formulário de pré-admissão", async () => {
    if (!preAdmissao) throw new Error("Pré-admissão ausente.");
    await page.goto(preAdmissao.publicUrl);
    await expect(page.getByRole("heading", { name: /Portal de Admissao/i })).toBeVisible({ timeout: 20_000 });
    await page.getByPlaceholder("000.000.000-00").fill(preAdmissao.cpf);
    await page.getByRole("button", { name: /Acessar Portal/i }).click();
    await expect(page.getByText(/Bem-vindo|Documentos|Dados pessoais|Revisão/i).first()).toBeVisible({ timeout: 20_000 });
  });

  await report.step(page, "Candidato anexa os documentos solicitados pela analista RH", async () => {
    if (!preAdmissao) throw new Error("Pré-admissão ausente.");
    await anexarDocumentosSolicitados(page, documentoPath);
  });

  await report.step(page, "Candidato preenche e revisa os dados do formulário admissional", async () => {
    if (!preAdmissao) throw new Error("Pré-admissão ausente.");
    await page.getByRole("button", { name: /Próximo/i }).click();
    await validarFormularioAdmissaoPreenchido(page, request, preAdmissao);
  });

  await report.step(page, "Candidato envia formulário de admissão para revisão do RH", async () => {
    await finalizarFormularioAdmissao(page);
  });

  await report.attachVideo(page);
  await report.writeHtml();
});

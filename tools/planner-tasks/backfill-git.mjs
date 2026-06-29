#!/usr/bin/env node
/**
 * backfill-git.mjs — Gera/atualiza tasks.json a partir de grupos definidos e merges HML.
 * Uso: node backfill-git.mjs [--validate-only]
 */

import { spawnSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { calcularTotalHoras, expandirDiasTarefa, formatDuracao } from './calc-horas.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const TASKS_PATH = join(__dirname, 'tasks.json');

const META = {
  projeto: 'Portal RH (RenderRH)',
  responsavelPadrao: 'Lucas Muniz Machado',
  instrucao: 'totalHoras = tempo real entre horarios no mesmo dia; multi-dia = parcial + 8h/dia.',
  horasUteisPorDia: 8,
  minutosMinimos: 30,
  jornadaComercial: '08:00-18:00',
};

const BRANCH_DEV = 'portalRH-DEV';
const BRANCH_HML = 'portalRH-HML';
const DATA_INICIO_AO_VIVO = '2026-05-23';

/** Grupos históricos (backfill) — agrupados por entrega de negócio, não 1 commit = 1 tarefa */
const BACKFILL_GROUPS = [
  {
    id: 'TASK-2025-001',
    nome: '[Portal RH] Estrutura inicial do portal e layout MVC',
    descricaoAmigavel: 'Primeira versão do portal de RH com projeto MVC, layout compartilhado e telas base de candidatos.',
    commits: ['5aced09c', '75884c24'],
    hmlMerge: null,
    pedidoOriginal: 'Criar base do portal RH com layout e navegação inicial.',
    entregavel: 'Portal MVC funcional com layout, modais de candidatos e estilos consolidados.',
    bucket: 'Concluído',
    prioridade: 'Alta',
    ambiente: 'HML',
    observacoes: 'Backfill a partir de commits git (dez/2025).',
  },
  {
    id: 'TASK-2026-001',
    nome: '[Portal RH] Evolução do módulo de recrutamento e vagas',
    descricaoAmigavel: 'Melhorias no cadastro de vagas, funil de candidatos, kanban e integração com matching por IA.',
    commits: ['ccde5c0f', 'a7879aa3'],
    hmlMerge: null,
    pedidoOriginal: 'Evoluir recrutamento com kanban, match IA e gestão de vagas.',
    entregavel: 'Kanban de candidaturas, aba Match IA, embeddings Gemini e fluxo de vagas unificado.',
    bucket: 'Concluído',
    prioridade: 'Alta',
    ambiente: 'HML',
    observacoes: 'Backfill a partir de commits git (jan/2026).',
  },
  {
    id: 'TASK-2026-002',
    nome: '[Portal RH] Portal de vagas e experiência do candidato',
    descricaoAmigavel: 'Aprimoramentos no portal público de vagas: perfil, documentos, mensagens do RH e geocodificação.',
    commits: ['593e932d', 'e5bb3201'],
    hmlMerge: null,
    pedidoOriginal: 'Melhorar portal de vagas para candidatos externos.',
    entregavel: 'Upload de documentos, perfil do candidato, avisos por e-mail e localização de vagas.',
    bucket: 'Concluído',
    prioridade: 'Média',
    ambiente: 'HML',
    observacoes: 'Backfill a partir de commits git (fev/2026).',
  },
  {
    id: 'TASK-2026-003',
    nome: '[Portal RH] Integração RM e gestão de requisições',
    descricaoAmigavel: 'Conexão com TOTVS RM, importação de requisições, desligamentos e telas administrativas.',
    commits: ['ad4ed504', '9d698756'],
    hmlMerge: null,
    pedidoOriginal: 'Integrar portal com RM para requisições e desligamentos.',
    entregavel: 'Consulta RM, importação de requisições, sync de status e telas Owner/Integração.',
    bucket: 'Concluído',
    prioridade: 'Alta',
    ambiente: 'HML',
    observacoes: 'Backfill a partir de commits git (mar/2026).',
  },
  {
    id: 'TASK-2026-004',
    nome: '[Portal RH] Deploy, ambientes e estabilização HMG',
    descricaoAmigavel: 'Pipelines de deploy DEV/HMG, correções de infraestrutura e estabilização da API em homologação.',
    commits: ['f56f78d0', 'ae5035c5'],
    hmlMerge: null,
    pedidoOriginal: 'Configurar deploy automatizado e estabilizar ambiente HMG.',
    entregavel: 'Workflows GitHub Actions, compose HMG, health checks e correções de timeout.',
    bucket: 'Concluído',
    prioridade: 'Alta',
    ambiente: 'HML',
    observacoes: 'Backfill a partir de commits git (abr/2026).',
  },
  {
    id: 'TASK-2026-005',
    nome: '[Portal RH] Fluxo pós-match, propostas e UAT de recrutamento',
    descricaoAmigavel: 'Material de UAT pós-match, integração de propostas ao kanban e liberação de acesso para analista RH.',
    commits: ['316b7be1', '53c9cfe4'],
    hmlMerge: '06181f7d',
    pedidoOriginal: 'Conduzir candidato do match até proposta com governança de aprovação.',
    entregavel: 'Kanban com propostas, controle de aprovação, UAT documentado e acesso analista RH.',
    bucket: 'Concluído',
    prioridade: 'Alta',
    ambiente: 'HML',
    observacoes: 'Backfill a partir de commits git (mai/2026 até 22/05). Incluído no Merge PR #148 (22/05).',
  },
];

function git(args) {
  const result = spawnSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || `git ${args.join(' ')} failed`);
  }
  return result.stdout.trim();
}

function gitTime(hash) {
  const raw = git(['log', '-1', '--format=%ci', hash]);
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}):\d{2}\s+([+-]\d{4})$/);
  if (!m) throw new Error(`Formato de data inesperado para ${hash}: ${raw}`);
  return { data: m[1], hora: m[2], raw };
}

function commitExists(hash) {
  const result = spawnSync('git', ['cat-file', '-t', hash], { cwd: REPO_ROOT, encoding: 'utf8' });
  return result.status === 0;
}

function toBusinessName(msg) {
  const cleaned = msg
    .replace(/^(feat|fix|refactor|docs|style|chore|merge)\([^)]*\):\s*/i, '')
    .replace(/^merge\([^)]*\):\s*/i, '');
  const prefix = msg.includes('deploy') || msg.includes('infra') ? '[Infra]' :
    msg.includes('portal-vagas') || msg.includes('admissao') ? '[Portal]' : '[Portal RH]';
  const title = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return `${prefix} ${title}`;
}

function buildFromGroup(group) {
  const validCommits = group.commits.filter(c => commitExists(c));
  if (validCommits.length === 0) {
    console.warn(`⚠ Grupo ${group.id}: nenhum commit encontrado`);
    return null;
  }

  const first = gitTime(validCommits[0]);
  const last = gitTime(validCommits[validCommits.length - 1]);

  let conclusaoData = last.data;
  let conclusaoHora = last.hora;
  let prHml = group.hmlMerge ? `Merge commit ${group.hmlMerge}` : 'Backfill histórico (pré-registro ao vivo)';

  if (group.hmlMerge && commitExists(group.hmlMerge)) {
    const hml = gitTime(group.hmlMerge);
    conclusaoData = hml.data;
    conclusaoHora = hml.hora;
    const mergeMsg = git(['log', '-1', '--format=%s', group.hmlMerge]);
    const prMatch = mergeMsg.match(/#(\d+)/);
    prHml = prMatch ? `Merge PR #${prMatch[1]}` : mergeMsg;
  }

  const tarefa = {
    id: group.id,
    nome: group.nome,
    descricaoAmigavel: group.descricaoAmigavel,
    inicio: first.data,
    horarioInicio: first.hora,
    conclusao: conclusaoData,
    horarioConclusao: conclusaoHora,
    totalHoras: 0,
    bucket: group.bucket || 'Concluído',
    percentualConcluido: 100,
    prioridade: group.prioridade || 'Média',
    atribuidaA: META.responsavelPadrao,
    pedidoOriginal: group.pedidoOriginal,
    entregavel: group.entregavel,
    ambiente: group.ambiente || 'HML',
    referencias: {
      commits: validCommits,
      branch: BRANCH_HML,
      prHml,
    },
    observacoes: group.observacoes || 'Backfill a partir de commits git',
  };

  tarefa.totalHoras = calcularTotalHoras(tarefa);
  return tarefa;
}

function discoverHmlMerges() {
  const lines = git([
    'log', BRANCH_HML, '--merges', `--since=${DATA_INICIO_AO_VIVO}`, '--format=%H|%s',
  ]).split('\n').filter(Boolean).reverse();

  const tasks = [];
  let seq = 6;

  for (const line of lines) {
    const [hash, ...msgParts] = line.split('|');
    const msg = msgParts.join('|');

    let commits = [];
    try {
      const range = git(['log', `${hash}^1..${hash}^2`, '--no-merges', '--format=%H']);
      commits = range ? range.split('\n').filter(Boolean) : [];
    } catch {
      commits = [];
    }

    if (commits.length === 0) {
      try {
        commits = [git(['rev-parse', `${hash}^2`])];
      } catch {
        continue;
      }
    }

    const firstHash = commits[0];
    const lastHash = commits[commits.length - 1];
    if (!commitExists(firstHash)) continue;

    const first = gitTime(firstHash);
    const hml = gitTime(hash);
    const featMsg = git(['log', '-1', '--format=%s', lastHash]);
    const prMatch = msg.match(/#(\d+)/);
    const prHml = prMatch ? `Merge PR #${prMatch[1]}` : msg;

    const year = hml.data.slice(0, 4);
    const id = `TASK-${year}-${String(seq).padStart(3, '0')}`;
    seq++;

    const tarefa = {
      id,
      nome: toBusinessName(featMsg),
      descricaoAmigavel: `Entrega promovida para homologação: ${featMsg}`,
      inicio: first.data,
      horarioInicio: first.hora,
      conclusao: hml.data,
      horarioConclusao: hml.hora,
      totalHoras: 0,
      bucket: 'Concluído',
      percentualConcluido: 100,
      prioridade: featMsg.startsWith('fix') ? 'Alta' : 'Média',
      atribuidaA: META.responsavelPadrao,
      pedidoOriginal: featMsg,
      entregavel: `Funcionalidade disponível em HML após ${prHml}.`,
      ambiente: 'HML',
      referencias: {
        commits: commits.map(c => c.slice(0, 7)),
        branch: BRANCH_HML,
        prHml,
      },
      observacoes: commits.length > 1 ? `Backfill: ${commits.length} commits no grupo.` : '',
    };

    tarefa.totalHoras = calcularTotalHoras(tarefa);
    tasks.push(tarefa);
  }

  return tasks;
}

function testEdgeCases() {
  console.log('\n=== Casos edge (cálculo) ===');
  const cases = [
    {
      label: 'Término após 18:00 → 0h no último dia',
      t: { inicio: '2026-06-01', horarioInicio: '09:00', conclusao: '2026-06-02', horarioConclusao: '19:30' },
      expect: 8,
    },
    {
      label: 'Início 17:04 → 56min no 1º dia (multi-dia)',
      t: { inicio: '2026-06-01', horarioInicio: '17:04', conclusao: '2026-06-02', horarioConclusao: '10:00' },
      expect: 2.93,
    },
    {
      label: 'Mesmo dia < 30min → mínimo 0,5h',
      t: { inicio: '2026-06-01', horarioInicio: '10:00', conclusao: '2026-06-01', horarioConclusao: '10:15' },
      expect: 0.5,
    },
  ];

  for (const c of cases) {
    const got = calcularTotalHoras(c.t);
    const ok = Math.abs(got - c.expect) < 0.1;
    console.log(`  ${ok ? '✓' : '✗'} ${c.label}: ${got}h (esperado ~${c.expect}h)`);
  }
}

function validate(tarefas) {
  const errors = [];
  let somaJson = 0;
  let somaRecalc = 0;
  const subtotaisDia = new Map();

  for (const t of tarefas) {
    const recalc = calcularTotalHoras(t);
    somaJson += t.totalHoras;
    somaRecalc += recalc;

    if (Math.abs(t.totalHoras - recalc) > 0.01) {
      errors.push(`${t.id}: totalHoras JSON (${t.totalHoras}) ≠ recalculado (${recalc})`);
      t.totalHoras = recalc;
    }

    for (const dia of expandirDiasTarefa(t)) {
      const key = dia.data;
      subtotaisDia.set(key, (subtotaisDia.get(key) || 0) + dia.horas);
    }
  }

  const diff = Math.abs(somaJson - somaRecalc);
  console.log('\n=== Validação ===');
  console.log(`Tarefas: ${tarefas.length}`);
  console.log(`Soma totalHoras JSON: ${somaJson.toFixed(2)}h`);
  console.log(`Soma recalculada:     ${somaRecalc.toFixed(2)}h`);
  console.log(`Diferença:            ${diff.toFixed(4)}h`);

  if (errors.length) {
    console.log('\n⚠ Inconsistências corrigidas:');
    errors.forEach(e => console.log('  -', e));
  } else {
    console.log('✓ Todos os totalHoras coerentes.');
  }

  const topDays = [...subtotaisDia.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 8);

  console.log('\nSubtotais dos dias principais:');
  for (const [dia, horas] of topDays) {
    console.log(`  ${dia}: ${formatDuracao(horas)} (${horas.toFixed(2)}h)`);
  }

  return { errors, somaRecalc, subtotaisDia };
}

function main() {
  const validateOnly = process.argv.includes('--validate-only');

  let tarefas;
  if (validateOnly) {
    const raw = JSON.parse(readFileSync(TASKS_PATH, 'utf8'));
    tarefas = raw.tarefas;
  } else {
    tarefas = [];

    for (const group of BACKFILL_GROUPS) {
      const t = buildFromGroup(group);
      if (t) tarefas.push(t);
    }

    const live = discoverHmlMerges();
    tarefas.push(...live);

    const output = {
      meta: {
        ...META,
        atualizadoEm: new Date().toISOString().slice(0, 10),
        totalTarefas: tarefas.length,
      },
      tarefas,
    };

    writeFileSync(TASKS_PATH, JSON.stringify(output, null, 2) + '\n', 'utf8');
    console.log(`✓ tasks.json gerado com ${tarefas.length} tarefas.`);
  }

  const { somaRecalc, subtotaisDia } = validate(tarefas);
  testEdgeCases();

  if (!validateOnly) {
    const datas = tarefas.map(t => t.inicio).sort();
    console.log(`\nPeríodo: ${datas[0]} → ${tarefas.map(t => t.conclusao).sort().pop()}`);
    console.log(`Horas totais: ${formatDuracao(somaRecalc)} (${somaRecalc.toFixed(2)}h)`);
  }

  return tarefas;
}

main();

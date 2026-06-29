/**
 * Cálculo de horas úteis — lógica compartilhada (backfill-git.mjs e index.html).
 * Jornada 08:00–18:00, máx 8h/dia, mínimo 0,5h no mesmo dia quando intervalo < 30 min.
 */

export const JORNADA_INICIO = 8 * 60; // minutos desde meia-noite
export const JORNADA_FIM = 18 * 60;
export const MAX_HORAS_DIA = 8;
export const MIN_HORAS_DIA = 0.5;
export const MIN_MINUTOS = 30;

export function parseDate(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function parseTime(str) {
  if (!str) return null;
  const [h, m] = str.split(':').map(Number);
  return h * 60 + m;
}

export function formatDateISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function daysBetween(start, end) {
  const s = parseDate(start);
  const e = parseDate(end);
  const diff = Math.round((e - s) / 86400000);
  return diff;
}

/** Horas em um único dia dentro da jornada comercial */
export function horasNoDia(horarioInicio, horarioConclusao, isFirst, isLast, hasInicio, hasConclusao) {
  if (isFirst && isLast) {
    if (hasInicio && hasConclusao) {
      const ini = parseTime(horarioInicio);
      const fim = parseTime(horarioConclusao);
      if (ini === null || fim === null) return MAX_HORAS_DIA;
      const start = Math.max(ini, JORNADA_INICIO);
      const end = Math.min(fim, JORNADA_FIM);
      if (start >= JORNADA_FIM || end <= JORNADA_INICIO || end <= start) return 0;
      let mins = end - start;
      let horas = mins / 60;
      if (horas < MIN_HORAS_DIA && mins < MIN_MINUTOS) horas = MIN_HORAS_DIA;
      return Math.min(horas, MAX_HORAS_DIA);
    }
    if (!hasInicio && !hasConclusao) return MAX_HORAS_DIA;
    if (hasInicio && !hasConclusao) {
      const ini = parseTime(horarioInicio);
      if (ini === null || ini >= JORNADA_FIM) return 0;
      const start = Math.max(ini, JORNADA_INICIO);
      return Math.min((JORNADA_FIM - start) / 60, MAX_HORAS_DIA);
    }
    if (!hasInicio && hasConclusao) {
      const fim = parseTime(horarioConclusao);
      if (fim === null || fim <= JORNADA_INICIO) return 0;
      const end = Math.min(fim, JORNADA_FIM);
      return Math.min((end - JORNADA_INICIO) / 60, MAX_HORAS_DIA);
    }
    return MAX_HORAS_DIA;
  }

  if (isFirst) {
    if (!hasInicio) return MAX_HORAS_DIA;
    const ini = parseTime(horarioInicio);
    if (ini === null || ini >= JORNADA_FIM || ini < JORNADA_INICIO) return 0;
    const start = Math.max(ini, JORNADA_INICIO);
    return Math.min((JORNADA_FIM - start) / 60, MAX_HORAS_DIA);
  }

  if (isLast) {
    if (!hasConclusao) return MAX_HORAS_DIA;
    const fim = parseTime(horarioConclusao);
    if (fim === null || fim <= JORNADA_INICIO || fim > JORNADA_FIM) return 0;
    const end = Math.min(fim, JORNADA_FIM);
    return Math.min((end - JORNADA_INICIO) / 60, MAX_HORAS_DIA);
  }

  return MAX_HORAS_DIA;
}

export function calcularTotalHoras(tarefa) {
  const { inicio, conclusao, horarioInicio, horarioConclusao } = tarefa;
  if (!inicio) return 0;
  const fim = conclusao || inicio;
  const hasInicio = !!horarioInicio;
  const hasConclusao = !!horarioConclusao;
  const totalDias = daysBetween(inicio, fim) + 1;
  let total = 0;
  const startDate = parseDate(inicio);
  for (let i = 0; i < totalDias; i++) {
    const isFirst = i === 0;
    const isLast = i === totalDias - 1;
    total += horasNoDia(horarioInicio, horarioConclusao, isFirst, isLast, hasInicio, hasConclusao);
  }
  return Math.round(total * 100) / 100;
}

export function horasNoDiaTarefa(tarefa, dataISO) {
  const { inicio, conclusao, horarioInicio, horarioConclusao } = tarefa;
  if (!inicio) return 0;
  const fim = conclusao || inicio;
  if (dataISO < inicio || dataISO > fim) return 0;
  const totalDias = daysBetween(inicio, fim) + 1;
  const idx = daysBetween(inicio, dataISO);
  const isFirst = idx === 0;
  const isLast = idx === totalDias - 1;
  const hasInicio = !!horarioInicio;
  const hasConclusao = !!horarioConclusao;
  return horasNoDia(horarioInicio, horarioConclusao, isFirst, isLast, hasInicio, hasConclusao);
}

export function formatDuracao(horas) {
  if (!horas || horas <= 0) return '0min';
  const totalMin = Math.round(horas * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

export function expandirDiasTarefa(tarefa) {
  const { inicio, conclusao } = tarefa;
  if (!inicio) return [];
  const fim = conclusao || inicio;
  const totalDias = daysBetween(inicio, fim) + 1;
  const dias = [];
  let d = parseDate(inicio);
  for (let i = 0; i < totalDias; i++) {
    const iso = formatDateISO(d);
    const horas = horasNoDiaTarefa(tarefa, iso);
    dias.push({ data: iso, horas, diaIndex: i + 1, totalDias });
    d = addDays(d, 1);
  }
  return dias;
}

import React, { useState, useMemo } from 'react';
import AppLayout from '../../components/Layout/AppLayout';
import ActionBar from '../../components/Layout/ActionBar';
import SearchableSelect from '../../components/SearchableSelect';
import ExportModal, { ExportCol } from '../../components/ExportModal';
import {
    useGlobal, EquipInstalado, EstadoEquip, ModeloEquipamento, Cliente, OrdemTrabalho,
} from '../../contexts/GlobalContext';
import {
    Search, Plus, Edit2, X, AlertCircle, Check, MapPin,
    Eye, AlertTriangle, RefreshCw, Package, Printer, Download, Trash2,
} from 'lucide-react';
import { extractErrorMessage } from '../../utils/errorHandler';

const ESTADO_DOT: Record<EstadoEquip, string> = {
    ativo:         'dot-green',
    com_problema:  'dot-orange',
    inativo:       'dot-gray',
};
const ESTADO_LABEL: Record<EstadoEquip, string> = {
    ativo:        'Activo',
    com_problema: 'Com Problema',
    inativo:      'Inactivo',
};

const diffDays = (d?: string) => {
    if (!d) return null;
    return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
};
const isCorretivo = (ot: OrdemTrabalho) =>
    ot.naturezaIntervencao === 'Reparação de avaria';

const OT_ESTADO_COLOR: Record<string, string> = {
    'Registada': 'var(--text-secondary)',
    'Programada': 'var(--blue)',
    'Adiada': '#f97316',
    'Confirmada': '#7c3aed',
    'Em execução': '#eab308',
    'Finalizada': 'var(--green)',
};

/** Gera número de série único: AQ-{TYPE}-{YEAR}{HEX4} */
const genSerialNumber = (modelo?: ModeloEquipamento): string => {
    const type = modelo?.tipo === 'maquina' ? 'M' : 'F';
    const year  = new Date().getFullYear().toString().slice(2);
    const hex   = Math.random().toString(16).slice(2, 6).toUpperCase();
    return `AQ-${type}${year}-${hex}`;
};

const EQUIP_CSS = `
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
  body   { font-family: Arial, sans-serif; font-size: 12px; padding: 15mm 20mm; color: #1a1a1a; }
  h1     { font-size: 1rem; margin: 0; }
  .sub   { font-size: 0.7rem; color: #888; margin: 2px 0 16px; }
  .hrow  { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
  .badge { display: inline-block; padding: 3px 12px; border-radius: 12px; font-size: 0.7rem; font-weight: 700; border: 1.5px solid #555; color: #333; background: #f5f5f5; }
  .sec   { font-size: 0.82rem; font-weight: 700; color: #2B2B2B; border-bottom: 1.5px solid #2B2B2B; padding-bottom: 3px; margin: 16px 0 5px; }
  table  { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  thead tr { background: #2B2B2B; }
  th     { background: #2B2B2B; color: #fff; padding: 6px 9px; font-size: 0.72rem; font-weight: 700; border: 1px solid #444; text-align: left; }
  td     { padding: 5px 9px; border: 1px solid #ddd; font-size: 0.78rem; vertical-align: top; }
  .lbl   { width: 35%; background: #f5f5f5; font-weight: 600; color: #444; }
  tr:nth-child(even) td { background: #f9f9f9; }
  tr:nth-child(odd)  td { background: #fff; }
  td.lbl { background: #f5f5f5 !important; }
  .footer { margin-top: 20px; font-size: 0.65rem; color: #bbb; text-align: center; border-top: 1px solid #eee; padding-top: 6px; }
  @page { size: A4; margin: 0; }
`;

/* ── Equipment print helper ── */
function buildEquipHtml(
    eq: EquipInstalado,
    clientes: Cliente[],
    modelosEquipamento: ModeloEquipamento[],
): string {
    const cli = clientes.find(c => c.id === eq.clienteId);
    const mod = modelosEquipamento.find(m => m.id === eq.modeloId);

    return `<!DOCTYPE html>
<html lang="pt"><head><meta charset="UTF-8"><title>Ficha Equip. ${eq.id}</title>
<style>${EQUIP_CSS}</style></head><body>
<div class="hrow">
  <div>
    <h1>AQUATEX — Ficha de Equipamento</h1>
    <div class="sub">Nº: <strong>${eq.id}</strong> &nbsp;|&nbsp; Impresso em ${new Date().toLocaleString('pt-PT')}</div>
  </div>
  <span class="badge">${eq.estado === 'ativo' ? 'Activo' : eq.estado === 'com_problema' ? 'Com Problema' : 'Inactivo'}</span>
</div>

<div class="sec">Identificação</div>
<table>
  <tr><td class="lbl">Equipamento ID</td><td>${eq.id}</td><td class="lbl">Nº de Série</td><td><span style="font-family:monospace">${eq.nrSerie}</span></td></tr>
  <tr><td class="lbl">Modelo</td><td>${mod?.nome ?? '—'}</td><td class="lbl">Marca</td><td>${mod?.marca ?? '—'}</td></tr>
  <tr><td class="lbl">Tipo</td><td>${mod?.tipo === 'maquina' ? 'Máquina' : 'Filtro'}</td><td class="lbl">Cliente</td><td>${cli?.nome ?? '—'}</td></tr>
  <tr><td class="lbl">Localização</td><td colspan="3">${eq.localizacao ?? '—'}</td></tr>
</table>

<div class="sec">Datas de Manutenção</div>
<table>
  <tr><td class="lbl">Data de Instalação</td><td>${eq.dataInstalacao ? new Date(eq.dataInstalacao).toLocaleDateString('pt-PT') : '—'}</td></tr>
  <tr><td class="lbl">Última Manutenção</td><td>${eq.dataUltimaManutencao ? new Date(eq.dataUltimaManutencao).toLocaleDateString('pt-PT') : '—'}</td></tr>
  <tr><td class="lbl">Próxima Manutenção</td><td>${eq.dataProximaManutencao ? new Date(eq.dataProximaManutencao).toLocaleDateString('pt-PT') : '—'}</td></tr>
</table>

<div class="footer">AQUATEX, LDA &nbsp;&bull;&nbsp; Sistema de Gestão de Intervenções</div>
</body></html>`;
}

function printEquip(
    eq: EquipInstalado,
    clientes: Cliente[],
    modelosEquipamento: ModeloEquipamento[],
) {
    const html = buildEquipHtml(eq, clientes, modelosEquipamento);
    const w = window.open('', '_blank', 'width=820,height=900');
    if (!w) return;
    w.document.write(html.replace('</body></html>', '<script>window.onload=()=>window.print();<\/script></body></html>'));
    w.document.close();
    w.focus();
}

const PRINT_CSS = `
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
  body   { font-family: Arial, sans-serif; font-size: 11px; padding: 12mm 18mm; color: #1a1a1a; }
  h1     { font-size: 1rem; margin: 0; }
  h2     { font-size: 0.88rem; margin: 0; }
  .sub   { font-size: 0.68rem; color: #888; margin: 2px 0 14px; }
  .hrow  { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 0.68rem; font-weight: 700; border: 1.5px solid #555; color: #333; background: #f5f5f5; }
  .sec   { font-size: 0.8rem; font-weight: 700; color: #2B2B2B; border-bottom: 1.5px solid #2B2B2B; padding-bottom: 3px; margin: 14px 0 5px; }
  table  { width: 100%; border-collapse: collapse; margin-bottom: 4px; page-break-inside: auto; }
  thead  { display: table-header-group; }
  thead tr { background: #2B2B2B; }
  th     { background: #2B2B2B; color: #fff; padding: 5px 8px; font-size: 0.7rem; font-weight: 700; border: 1px solid #444; text-align: left; }
  td     { padding: 4px 8px; border: 1px solid #ddd; font-size: 0.75rem; vertical-align: top; }
  tr:nth-child(even) td { background: #f9f9f9; }
  tr:nth-child(odd)  td { background: #fff; }
  .lbl   { background: #f5f5f5 !important; font-weight: 600; color: #444; white-space: nowrap; }
  .corr  { color: #f97316; font-weight: 700; }
  .footer { margin-top: 18px; font-size: 0.62rem; color: #bbb; text-align: center; border-top: 1px solid #eee; padding-top: 5px; }
  .eq-group { margin-bottom: 18px; page-break-inside: avoid; }
  @page { size: A4 landscape; margin: 0; }
`;

function fD(d?: string) { return d ? new Date(d).toLocaleDateString('pt-PT') : '—'; }

function buildHistoricoEquipHtml(
    eq: EquipInstalado,
    ots: OrdemTrabalho[],
    cli: Cliente | undefined,
    mod: ModeloEquipamento | undefined,
    empresa: string,
): string {
    const rows = [...ots].sort((a, b) => (b.dataAgendada || '').localeCompare(a.dataAgendada || ''))
        .map(o => `<tr>
            <td style="font-family:monospace">${o.id}</td>
            <td>${o.tipo === 'pontual' ? 'Pontual' : 'Programada'}</td>
            <td>${o.naturezaIntervencao ?? "—"}${isCorretivo(o) ? ' <span class="corr">●</span>' : ''}</td>
            <td style="color:${o.estado === 'Finalizada' ? '#16a34a' : o.estado === 'Em execução' ? '#eab308' : o.estado === 'Adiada' ? '#f97316' : o.estado === 'Confirmada' ? '#7c3aed' : o.estado === 'Registada' ? '#6b7280' : '#2563eb'};font-weight:600">${o.estado}</td>
            <td>${fD(o.dataAgendada)}</td>
            <td>${fD(o.dataFim)}</td>
            <td>${o.descricao || '—'}</td>
        </tr>`).join('');

    return `<!DOCTYPE html>
<html lang="pt"><head><meta charset="UTF-8"><title>Histórico — Equip. ${eq.id}</title>
<style>${PRINT_CSS}</style></head><body>
<div class="hrow">
  <div>
    <h1>${empresa} — Histórico de Intervenções</h1>
    <div class="sub">Equipamento: <strong>${eq.id}</strong> &nbsp;|&nbsp; ${mod?.nome ?? '—'} &nbsp;|&nbsp; Cliente: ${cli?.nome ?? '—'} &nbsp;|&nbsp; Série: ${eq.nrSerie} &nbsp;|&nbsp; Impresso em ${new Date().toLocaleString('pt-PT')}</div>
  </div>
  <span class="badge">Loc: ${eq.localizacao || '—'}</span>
</div>
<table>
  <thead><tr><th>ID</th><th>Tipo OT</th><th>Tipo Trabalho</th><th>Estado</th><th>Data Prog.</th><th>Data Fim</th><th>Descrição</th></tr></thead>
  <tbody>${rows || '<tr><td colspan="7" style="text-align:center;color:#999">Sem intervenções registadas</td></tr>'}</tbody>
</table>
<div class="footer">${empresa} &nbsp;&bull;&nbsp; Total: ${ots.length} intervenção(ões)</div>
</body></html>`;
}

function printHistoricoEquip(
    eq: EquipInstalado,
    ots: OrdemTrabalho[],
    cli: Cliente | undefined,
    mod: ModeloEquipamento | undefined,
    empresa: string,
) {
    const html = buildHistoricoEquipHtml(eq, ots, cli, mod, empresa);
    const w = window.open('', '_blank', 'width=1100,height=900');
    if (!w) return;
    w.document.write(html.replace('</body></html>', '<script>window.onload=()=>window.print();<\/script></body></html>'));
    w.document.close(); w.focus();
}

function buildHistoricoGeralHtml(
    ots: OrdemTrabalho[],
    equipInstalados: EquipInstalado[],
    clientes: Cliente[],
    modelosEquipamento: ModeloEquipamento[],
    dateFrom: string,
    dateTo: string,
    equipId: string,
    empresa: string,
): string {
    const refDate = (o: OrdemTrabalho) => o.dataAgendada || '';
    const filtrado = ots
        .filter(o => {
            const d = refDate(o);
            const equipMatch = !equipId || String(o.equipInstaladoId) === String(equipId);
            return equipMatch && (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo);
        })
        .sort((a, b) => refDate(a).localeCompare(refDate(b)));

    // Group by equipment
    const grupos = new Map<string, OrdemTrabalho[]>();
    for (const o of filtrado as OrdemTrabalho[]) {
        const key = String(o.equipInstaladoId);
        if (!grupos.has(key)) grupos.set(key, []);
        grupos.get(key)!.push(o);
    }

    let body = '';
    for (const [eqId, eqOts] of Array.from(grupos.entries())) {
        const eq = equipInstalados.find(e => String(e.id) === eqId);
        const cli = clientes.find(c => String(c.id) === String(eq?.clienteId));
        const mod = modelosEquipamento.find(m => String(m.id) === String(eq?.modeloId));
        const rows = eqOts.map(o => `<tr>
            <td style="font-family:monospace">${o.id}</td>
            <td>${o.tipo === 'pontual' ? 'Pontual' : 'Programada'}</td>
            <td>${o.naturezaIntervencao ?? "—"}${isCorretivo(o) ? ' <span class="corr">●</span>' : ''}</td>
            <td style="color:${o.estado === 'Finalizada' ? '#16a34a' : o.estado === 'Em execução' ? '#eab308' : o.estado === 'Adiada' ? '#f97316' : o.estado === 'Confirmada' ? '#7c3aed' : o.estado === 'Registada' ? '#6b7280' : '#2563eb'};font-weight:600">${o.estado}</td>
            <td>${fD(refDate(o))}</td>
            <td>${fD(o.dataFim)}</td>
            <td>${o.descricao || '—'}</td>
        </tr>`).join('');
        body += `<div class="eq-group">
  <div class="sec">Equip. ${eqId} — ${mod?.nome ?? '—'} &nbsp;|&nbsp; Cliente: ${cli?.nome ?? '—'} &nbsp;|&nbsp; Série: ${eq?.nrSerie ?? '—'}</div>
  <table>
    <thead><tr><th>ID OT</th><th>Tipo OT</th><th>Tipo Trabalho</th><th>Estado</th><th>Data Prog.</th><th>Data Fim</th><th>Descrição</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</div>`;
    }

    const periodo = dateFrom || dateTo
        ? `Período: ${dateFrom ? fD(dateFrom) : '—'} a ${dateTo ? fD(dateTo) : '—'}`
        : 'Todos os períodos';

    return `<!DOCTYPE html>
<html lang="pt"><head><meta charset="UTF-8"><title>Relatório de Intervenções</title>
<style>${PRINT_CSS}</style></head><body>
<div class="hrow">
  <div>
    <h1>${empresa} — Relatório de Intervenções</h1>
    <div class="sub">${periodo} &nbsp;|&nbsp; Impresso em ${new Date().toLocaleString('pt-PT')}</div>
  </div>
  <span class="badge">${filtrado.length} intervenção(ões)</span>
</div>
${body || '<p style="color:#999;text-align:center">Nenhuma intervenção encontrada no período seleccionado.</p>'}
<div class="footer">${empresa} &nbsp;&bull;&nbsp; Sistema de Gestão de Intervenções</div>
</body></html>`;
}

function printHistoricoGeral(
    ots: OrdemTrabalho[],
    equipInstalados: EquipInstalado[],
    clientes: Cliente[],
    modelosEquipamento: ModeloEquipamento[],
    dateFrom: string,
    dateTo: string,
    equipId: string,
    empresa: string,
) {
    const html = buildHistoricoGeralHtml(ots, equipInstalados, clientes, modelosEquipamento, dateFrom, dateTo, equipId, empresa);
    const w = window.open('', '_blank', 'width=1100,height=900');
    if (!w) return;
    w.document.write(html.replace('</body></html>', '<script>window.onload=()=>window.print();<\/script></body></html>'));
    w.document.close(); w.focus();
}

/* ── Estado do Parque print ── */
interface EstadoSeccoes { ativos: boolean; manutencoes: boolean; problemas: boolean; }

function buildEstadoParqueHtml(
    equipInstalados: EquipInstalado[],
    ordens: OrdemTrabalho[],
    clientes: Cliente[],
    modelosEquipamento: ModeloEquipamento[],
    empresa: string,
    seccoes: EstadoSeccoes,
): string {
    const now = Date.now();
    const isCorr = (o: OrdemTrabalho) =>
        o.naturezaIntervencao === 'Reparação de avaria';

    const stats = equipInstalados.map(eq => {
        const eqOts  = ordens.filter(o => String(o.equipInstaladoId) === String(eq.id));
        const open   = eqOts.filter(o => o.estado !== 'Finalizada');
        const closed = eqOts.filter(o => o.estado === 'Finalizada');
        const finDates  = closed.map(o => o.dataFim).filter(Boolean) as string[];
        const openDates = open.map(o => o.dataAgendada).filter(Boolean) as string[];
        const ultimaMt  = finDates.length  > 0 ? [...finDates].sort().at(-1)  : undefined;
        const proximaMt = openDates.length > 0 ? [...openDates].sort()[0]     : undefined;
        const hasCorr   = open.some(isCorr);
        const effective: EstadoEquip = eq.estado === 'inativo' ? 'inativo' : hasCorr ? 'com_problema' : eq.estado;
        const diasProx  = proximaMt ? Math.ceil((new Date(proximaMt).getTime() - now) / 86400000) : null;
        const corretivas = open.filter(isCorr);
        return { eq, ultimaMt, proximaMt, effective, diasProx, corretivas };
    });

    const getCli = (eq: EquipInstalado) => clientes.find(c => String(c.id) === String(eq.clienteId))?.nome ?? '—';
    const getMod = (eq: EquipInstalado) => modelosEquipamento.find(m => String(m.id) === String(eq.modeloId))?.nome ?? '—';

    const nAtivos    = stats.filter(s => s.effective === 'ativo').length;
    const nProblema  = stats.filter(s => s.effective === 'com_problema').length;
    const nInativos  = stats.filter(s => s.effective === 'inativo').length;
    const nUrgentes  = stats.filter(s => s.diasProx !== null && s.diasProx! <= 7).length;
    const nProximos  = stats.filter(s => s.diasProx !== null && s.diasProx! > 7 && s.diasProx! <= 30).length;

    const comProblema = stats.filter(s => s.effective === 'com_problema');
    const previstas   = stats
        .filter(s => s.proximaMt && s.effective !== 'inativo')
        .sort((a, b) => (a.proximaMt || '').localeCompare(b.proximaMt || ''));
    const semManutencao = stats.filter(s => s.effective === 'ativo' && !s.proximaMt);

    const trOT = (s: typeof stats[0]) =>
        s.corretivas.map(o => `<span style="font-size:0.68rem;color:#f97316">OT ${o.id} — ${o.naturezaIntervencao ?? "—"} (${o.estado})</span>`).join('<br>');

    const diasCor = (d: number | null) =>
        d === null ? '—' : d < 0 ? `<span style="color:#dc2626;font-weight:700">Atrasada ${Math.abs(d)}d</span>`
        : d <= 7   ? `<span style="color:#dc2626;font-weight:700">+${d}d</span>`
        : d <= 30  ? `<span style="color:#f97316;font-weight:700">+${d}d</span>`
        :            `+${d}d`;

    return `<!DOCTYPE html>
<html lang="pt"><head><meta charset="UTF-8"><title>Estado do Parque</title>
<style>
${PRINT_CSS}
.kpi-row { display:flex; gap:14px; margin-bottom:14px; flex-wrap:wrap; }
.kpi { flex:1; min-width:110px; border:1.5px solid #ddd; border-radius:4px; padding:8px 12px; text-align:center; }
.kpi .val { font-size:1.6rem; font-weight:700; line-height:1.1; }
.kpi .lbl { font-size:0.65rem; color:#888; margin-top:2px; }
.green  { color:#16a34a; } .orange { color:#f97316; } .red { color:#dc2626; } .gray { color:#6b7280; }
@page { size: A4; margin: 0; }
</style></head><body>
<div class="hrow">
  <div>
    <h1>${empresa} — Relatório de Estado do Parque</h1>
    <div class="sub">Impresso em ${new Date().toLocaleString('pt-PT')} &nbsp;|&nbsp; Total: ${equipInstalados.length} equipamentos</div>
  </div>
</div>

<div class="kpi-row">
  <div class="kpi"><div class="val green">${nAtivos}</div><div class="lbl">Activos</div></div>
  <div class="kpi"><div class="val orange">${nProblema}</div><div class="lbl">Com Problema</div></div>
  <div class="kpi"><div class="val gray">${nInativos}</div><div class="lbl">Inactivos</div></div>
  <div class="kpi"><div class="val red">${nUrgentes}</div><div class="lbl">Manutenção Urgente (≤7d)</div></div>
  <div class="kpi"><div class="val orange">${nProximos}</div><div class="lbl">Manutenção Próxima (≤30d)</div></div>
</div>

${seccoes.problemas && nProblema > 0 ? `
<div class="sec">⚠ Equipamentos com Problema (${nProblema})</div>
<table>
  <thead><tr><th>ID</th><th>Modelo</th><th>Cliente</th><th>Série</th><th>Localização</th><th>OTs Corretivas em Aberto</th></tr></thead>
  <tbody>${comProblema.map(s => `<tr>
    <td style="font-family:monospace">${s.eq.id}</td>
    <td>${getMod(s.eq)}</td>
    <td>${getCli(s.eq)}</td>
    <td style="font-family:monospace">${s.eq.nrSerie}</td>
    <td>${s.eq.localizacao || '—'}</td>
    <td>${trOT(s) || '—'}</td>
  </tr>`).join('')}</tbody>
</table>` : seccoes.problemas ? '<div class="sec">⚠ Equipamentos com Problema (0)</div><p style="color:#999;font-size:0.78rem">Nenhum equipamento com problema.</p>' : ''}

${seccoes.manutencoes ? `
<div class="sec">Manutenções Previstas (${previstas.length})</div>
${previstas.length > 0 ? `<table>
  <thead><tr><th>ID</th><th>Modelo</th><th>Cliente</th><th>Série</th><th>Localização</th><th>Última Manutenção</th><th>Próxima Manutenção</th><th>Prazo</th></tr></thead>
  <tbody>${previstas.map(s => `<tr>
    <td style="font-family:monospace">${s.eq.id}</td>
    <td>${getMod(s.eq)}</td>
    <td>${getCli(s.eq)}</td>
    <td style="font-family:monospace">${s.eq.nrSerie}</td>
    <td>${s.eq.localizacao || '—'}</td>
    <td>${fD(s.ultimaMt)}</td>
    <td>${fD(s.proximaMt)}</td>
    <td>${diasCor(s.diasProx)}</td>
  </tr>`).join('')}</tbody>
</table>` : '<p style="color:#999;font-size:0.78rem">Nenhuma manutenção programada.</p>'}` : ''}

${seccoes.ativos ? `
<div class="sec">Equipamentos Activos — Todos (${stats.filter(s => s.effective !== 'inativo').length})</div>
<table>
  <thead><tr><th>ID</th><th>Modelo</th><th>Tipo</th><th>Cliente</th><th>Série</th><th>Localização</th><th>Instalação</th><th>Última Manut.</th><th>Próxima Manut.</th><th>Estado</th></tr></thead>
  <tbody>${stats.filter(s => s.effective !== 'inativo').sort((a,b) => a.eq.id.toString().localeCompare(b.eq.id.toString(), undefined, {numeric:true})).map(s => {
    const tipo = modelosEquipamento.find(m => String(m.id) === String(s.eq.modeloId))?.tipo ?? '';
    return `<tr>
    <td style="font-family:monospace">${s.eq.id}</td>
    <td>${getMod(s.eq)}</td>
    <td>${tipo === 'maquina' ? 'Máquina' : 'Filtro'}</td>
    <td>${getCli(s.eq)}</td>
    <td style="font-family:monospace">${s.eq.nrSerie}</td>
    <td>${s.eq.localizacao || '—'}</td>
    <td>${fD(s.eq.dataInstalacao)}</td>
    <td>${fD(s.ultimaMt)}</td>
    <td>${fD(s.proximaMt)}</td>
    <td style="color:${s.effective === 'com_problema' ? '#f97316' : '#16a34a'};font-weight:600">${s.effective === 'com_problema' ? 'Com Problema' : 'Activo'}</td>
  </tr>`;}).join('')}</tbody>
</table>
${semManutencao.length > 0 ? `<p style="font-size:0.72rem;color:#f97316;margin-top:6px">⚠ ${semManutencao.length} equipamento(s) activo(s) sem manutenção programada.</p>` : ''}` : ''}

<div class="footer">${empresa} &nbsp;&bull;&nbsp; Sistema de Gestão de Intervenções</div>
</body></html>`;
}

function printEstadoParque(
    equipInstalados: EquipInstalado[],
    ordens: OrdemTrabalho[],
    clientes: Cliente[],
    modelosEquipamento: ModeloEquipamento[],
    empresa: string,
    seccoes: EstadoSeccoes,
) {
    const html = buildEstadoParqueHtml(equipInstalados, ordens, clientes, modelosEquipamento, empresa, seccoes);
    const w = window.open('', '_blank', 'width=1000,height=900');
    if (!w) return;
    w.document.write(html.replace('</body></html>', '<script>window.onload=()=>window.print();<\/script></body></html>'));
    w.document.close(); w.focus();
}

/* ══ Relatório Estado Modal ══════════════════════════════ */
const RelatorioEstadoModal: React.FC<{ onClose: () => void; onPrint: (s: EstadoSeccoes) => void; onPreview: (s: EstadoSeccoes) => void }> = ({ onClose, onPrint, onPreview }) => {
    const [ativos,      setAtivos]      = useState(true);
    const [manutencoes, setManutencoes] = useState(true);
    const [problemas,   setProblemas]   = useState(true);
    const nenhum = !ativos && !manutencoes && !problemas;

    const ChkRow: React.FC<{ label: string; sub: string; checked: boolean; onChange: () => void }> = ({ label, sub, checked, onChange }) => (
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)', background: checked ? 'rgba(37,99,235,0.04)' : undefined }}>
            <input type="checkbox" checked={checked} onChange={onChange} style={{ accentColor: 'var(--blue)', marginTop: 2, flexShrink: 0 }} />
            <div>
                <div style={{ fontSize: '0.83rem', fontWeight: 600 }}>{label}</div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>
            </div>
        </label>
    );

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" style={{ maxWidth: 440 }}>
                <div className="modal-header">
                    <h3 className="modal-title">Relatório de Estado do Parque</h3>
                    <button className="modal-close" type="button" onClick={onClose}><X size={13} /></button>
                </div>
                <div className="modal-body" style={{ padding: 0 }}>
                    <div style={{ padding: '12px 16px 8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Seleccione as secções a incluir no relatório impresso:
                    </div>
                    <div style={{ border: '1px solid var(--border)', borderRadius: 3, margin: '0 16px 16px' }}>
                        <ChkRow
                            label="Equipamentos Activos"
                            sub="Lista completa dos equipamentos activos com datas de manutenção"
                            checked={ativos} onChange={() => setAtivos(v => !v)}
                        />
                        <ChkRow
                            label="Manutenções Previstas"
                            sub="Equipamentos com OTs programadas, ordenados por proximidade da data"
                            checked={manutencoes} onChange={() => setManutencoes(v => !v)}
                        />
                        <ChkRow
                            label="Equipamentos com Problema"
                            sub="Equipamentos com OTs corretivas pontualmente abertas"
                            checked={problemas} onChange={() => setProblemas(v => !v)}
                        />
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="abtn abtn-secondary" type="button" onClick={onClose}>Cancelar</button>
                    <button className="abtn abtn-secondary" type="button" disabled={nenhum}
                        onClick={() => onPreview({ ativos, manutencoes, problemas })}>
                        <Eye size={12} /> Pré-visualizar
                    </button>
                    <button className="abtn abtn-primary" type="button" disabled={nenhum}
                        onClick={() => { onPrint({ ativos, manutencoes, problemas }); onClose(); }}>
                        <Printer size={12} /> Imprimir Relatório
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ══ Modelo Modal ════════════════════════════════════════ */
interface ModeloModalProps {
    modelo?: ModeloEquipamento;
    onClose: () => void;
    onSave: (m: Omit<ModeloEquipamento, 'id'>) => void;
}
const ModeloModal: React.FC<ModeloModalProps> = ({ modelo, onClose, onSave }) => {
    const [nome, setNome]   = useState(modelo?.nome  ?? '');
    const [marca, setMarca] = useState(modelo?.marca ?? '');
    const [tipo, setTipo]   = useState<'maquina' | 'filtro'>(modelo?.tipo ?? 'maquina');
    const [errors, setErrors] = useState<Record<string, string>>({});

    const validate = () => {
        const e: Record<string, string> = {};
        if (!nome.trim())  e.nome  = 'Obrigatório';
        if (!marca.trim()) e.marca = 'Obrigatório';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSave = (ev: React.FormEvent) => {
        ev.preventDefault();
        if (!validate()) return;
        onSave({ nome, marca, tipo });
    };

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" style={{ maxWidth: 460 }}>
                <div className="modal-header">
                    <h3 className="modal-title">{modelo ? 'Editar Modelo' : 'Novo Modelo de Equipamento'}</h3>
                    <button className="modal-close" type="button" onClick={onClose}><X size={13} /></button>
                </div>
                <form onSubmit={handleSave} noValidate>
                    <div className="modal-body">
                        <div className="form-group">
                            <label className="form-label req">Nome / Designação</label>
                            <input className={`form-input${errors.nome ? ' err' : ''}`} value={nome}
                                onChange={e => setNome(e.target.value)} placeholder="Ex: Osmose Inversa Industrial 500L/h" />
                            {errors.nome && <span className="form-error"><AlertCircle size={11} /> {errors.nome}</span>}
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label req">Marca / Fabricante</label>
                                <input className={`form-input${errors.marca ? ' err' : ''}`} value={marca}
                                    onChange={e => setMarca(e.target.value)} placeholder="Ex: Aquatex" />
                                {errors.marca && <span className="form-error"><AlertCircle size={11} /> {errors.marca}</span>}
                            </div>
                            <div className="form-group">
                                <label className="form-label">Tipo</label>
                                <select className="form-select" value={tipo} onChange={e => setTipo(e.target.value as 'maquina' | 'filtro')}>
                                    <option value="maquina">Máquina</option>
                                    <option value="filtro">Filtro</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="abtn abtn-secondary" onClick={onClose}>Cancelar</button>
                        <button type="submit" className="abtn abtn-primary"><Check size={12} /> Guardar</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

/* ══ Register Modal ══════════════════════════════════════ */
interface RegisterModalProps {
    equip?: EquipInstalado;
    onClose: () => void;
    onSave: (e: Omit<EquipInstalado, 'id'>) => void;
}
const RegisterModal: React.FC<RegisterModalProps> = ({ equip, onClose, onSave }) => {
    const { clientes, modelosEquipamento } = useGlobal();

    const [clienteId, setClienteId]     = useState(equip?.clienteId ?? '');
    const [modeloId, setModeloId]       = useState(equip?.modeloId  ?? '');
    const [nrSerie, setNrSerie]         = useState(equip?.nrSerie   ?? '');
    const [localizacao, setLocalizacao] = useState(equip?.localizacao ?? '');
    const [dataInst, setDataInst]       = useState(equip?.dataInstalacao ?? '');
    const [estado, setEstado]           = useState<EstadoEquip>(equip?.estado ?? 'ativo');
    const [errors, setErrors]           = useState<Record<string, string>>({});

    const clienteOpts = clientes.filter(c => c.ativo !== false).map(c => ({ value: c.id, label: c.nome, sub: `NIF: ${c.nif}` }));
    const modeloOpts  = modelosEquipamento.map(m => ({ value: m.id, label: m.nome, sub: `${m.marca} · ${m.tipo === 'maquina' ? 'Máquina' : 'Filtro'}` }));

    const handleGerarSerie = () => {
        const mod = modelosEquipamento.find(m => m.id === modeloId);
        setNrSerie(genSerialNumber(mod));
    };

    const validate = () => {
        const e: Record<string, string> = {};
        if (!clienteId) e.cliente = 'Obrigatório';
        if (!modeloId)  e.modelo  = 'Obrigatório';
        if (!nrSerie.trim()) e.serie = 'Obrigatório';
        if (!dataInst)  e.data   = 'Obrigatório';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSave = (ev: React.FormEvent) => {
        ev.preventDefault();
        if (!validate()) return;
        onSave({ clienteId, modeloId, nrSerie, localizacao, dataInstalacao: dataInst, estado });
    };

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" style={{ maxWidth: 540 }}>
                <div className="modal-header">
                    <h3 className="modal-title">{equip ? 'Editar Equipamento' : 'Registar Equipamento'}</h3>
                    <button className="modal-close" type="button" onClick={onClose}><X size={13} /></button>
                </div>
                <form onSubmit={handleSave} noValidate>
                    <div className="modal-body">
                        <div className="form-group">
                            <label className="form-label req">Cliente</label>
                            {clienteOpts.length === 0 ? (
                                <div style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 4, fontSize: '0.8rem', color: 'var(--text-muted)', background: 'var(--bg-subtle,#f8f9fa)' }}>
                                    <AlertCircle size={11} style={{ marginRight: 5, color: '#f97316' }} />
                                    Nenhum cliente registado.{' '}
                                    <a href="/clientes" style={{ color: 'var(--blue)', textDecoration: 'underline' }}>Criar em Entidades &gt; Clientes</a>
                                </div>
                            ) : (
                                <SearchableSelect options={clienteOpts} value={clienteId} onChange={setClienteId}
                                    placeholder="Seleccionar cliente..." />
                            )}
                            {errors.cliente && <span className="form-error"><AlertCircle size={11} /> {errors.cliente}</span>}
                        </div>
                        <div className="form-group">
                            <label className="form-label req">Modelo do Equipamento</label>
                            <SearchableSelect options={modeloOpts} value={modeloId} onChange={setModeloId}
                                placeholder="Seleccionar modelo..." />
                            {errors.modelo && <span className="form-error"><AlertCircle size={11} /> {errors.modelo}</span>}
                        </div>
                        <div className="form-row">
                            <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label req">Nº de Série</label>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <input className={`form-input${errors.serie ? ' err' : ''}`} value={nrSerie}
                                        onChange={e => setNrSerie(e.target.value)} placeholder="Ex: AQ-M26-A3F2"
                                        style={{ fontFamily: 'monospace', flex: 1 }} />
                                    <button type="button" className="abtn abtn-secondary" title="Gerar número de série automático"
                                        onClick={handleGerarSerie} style={{ flexShrink: 0, padding: '0 10px' }}>
                                        <RefreshCw size={12} />
                                    </button>
                                </div>
                                {errors.serie && <span className="form-error"><AlertCircle size={11} /> {errors.serie}</span>}
                            </div>
                            <div className="form-group">
                                <label className="form-label req">Data de Instalação</label>
                                <input type="date" className={`form-input${errors.data ? ' err' : ''}`} value={dataInst}
                                    onChange={e => setDataInst(e.target.value)} />
                                {errors.data && <span className="form-error"><AlertCircle size={11} /> {errors.data}</span>}
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Localização</label>
                                <input className="form-input" value={localizacao}
                                    onChange={e => setLocalizacao(e.target.value)} placeholder="Ex: Cozinha Industrial" />
                            </div>
                            {equip && (
                                <div className="form-group">
                                    <label className="form-label">Estado</label>
                                    <select className="form-select" value={estado} onChange={e => setEstado(e.target.value as EstadoEquip)}>
                                        <option value="ativo">Activo</option>
                                        <option value="com_problema">Com Problema</option>
                                        <option value="inativo">Inactivo</option>
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="abtn abtn-secondary" onClick={onClose}>Cancelar</button>
                        <button type="submit" className="abtn abtn-primary"><Check size={12} /> {equip ? 'Actualizar' : 'Registar'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

/* ══ Detalhe Modal ═══════════════════════════════════════ */
interface DetalheProps { equipId: string; onClose: () => void; onEdit: () => void; }
const EquipDetalhe: React.FC<DetalheProps> = ({ equipId, onClose, onEdit }) => {
    const { equipInstalados, clientes, modelosEquipamento, planos, ordens, fmtDate, empresaConfig } = useGlobal();
    const [tab, setTab] = useState<'info' | 'historico'>('info');
    const [previewHtml, setPreviewHtml] = useState('');

    const eq   = equipInstalados.find(e => e.id === equipId)!;
    const cli  = clientes.find(c => c.id === eq.clienteId);
    const mod  = modelosEquipamento.find(m => m.id === eq.modeloId);
    const ots  = ordens.filter(o => String(o.equipInstaladoId) === String(equipId))
        .sort((a, b) => {
            const da = a.dataAgendada || '';
            const db = b.dataAgendada || '';
            return db.localeCompare(da);
        });
    const pls  = planos.filter(p => String(p.equipInstaladoId) === String(equipId));

    // Computed maintenance dates from OTs
    const finDates = ots
        .filter(o => o.estado === 'Finalizada')
        .map(o => o.dataFim)
        .filter(Boolean) as string[];
    const ultimaManutencao = finDates.length > 0 ? [...finDates].sort().at(-1) : undefined;

    const openDates = ots
        .filter(o => o.estado !== 'Finalizada')
        .map(o => o.dataAgendada)
        .filter(Boolean) as string[];
    const proximaManutencao = openDates.length > 0 ? [...openDates].sort()[0] : undefined;

    const openCorretivos = ots.filter(o => isCorretivo(o) && (o.estado !== 'Finalizada'));
    const effectiveEstado: EstadoEquip = eq.estado === 'inativo' ? 'inativo'
        : openCorretivos.length > 0 ? 'com_problema'
        : eq.estado;

    const dias = diffDays(proximaManutencao);

    const InfoRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
        <div className="form-group">
            <label className="form-label">{label}</label>
            <div style={{ padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 3, fontSize: '0.82rem' }}>{value}</div>
        </div>
    );

    const tabBtn = (t: 'info' | 'historico', label: string, count?: number) => (
        <button onClick={() => setTab(t)} style={{
            padding: '6px 14px', fontSize: '0.8rem', fontWeight: tab === t ? 700 : 400,
            borderBottom: tab === t ? '2px solid var(--blue)' : '2px solid transparent',
            color: tab === t ? 'var(--blue)' : 'var(--text-secondary)',
            background: 'none', border: 'none', cursor: 'pointer',
            borderBottomWidth: 2, borderBottomStyle: 'solid',
            borderBottomColor: tab === t ? 'var(--blue)' : 'transparent',
        }}>
            {label}{count !== undefined ? ` (${count})` : ''}
        </button>
    );

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" style={{ maxWidth: 680 }}>
                <div className="modal-header">
                    <div>
                        <h3 className="modal-title">{eq.id} — {mod?.nome}</h3>
                        <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center' }}>
                            <span className={`dot ${ESTADO_DOT[effectiveEstado]}`} />
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{ESTADO_LABEL[effectiveEstado]}</span>
                            <span className="tbadge tbadge-admin" style={{ marginLeft: 4 }}>{mod?.tipo === 'maquina' ? 'Máquina' : 'Filtro'}</span>
                            {openCorretivos.length > 0 && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.72rem', color: '#f97316', fontWeight: 700 }}>
                                    <AlertCircle size={11} /> {openCorretivos.length} OT corretiva em aberto
                                </span>
                            )}
                        </div>
                    </div>
                    <button className="modal-close" type="button" onClick={onClose}><X size={13} /></button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', paddingLeft: 16 }}>
                    {tabBtn('info', 'Informação')}
                    {tabBtn('historico', 'Histórico de Intervenções', ots.length)}
                </div>

                <div className="modal-body" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
                    {tab === 'info' && (
                        <>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                                <InfoRow label="Cliente" value={cli?.nome ?? '—'} />
                                <InfoRow label="Nº de Série" value={<span style={{ fontFamily: 'monospace' }}>{eq.nrSerie}</span>} />
                                <InfoRow label="Data de Instalação" value={fmtDate(eq.dataInstalacao)} />
                                <InfoRow label="Localização" value={eq.localizacao || '—'} />
                                <InfoRow label="Última Manutenção" value={fmtDate(ultimaManutencao)} />
                                <InfoRow label="Próxima Manutenção" value={
                                    <span style={{ color: dias !== null && dias <= 7 ? 'var(--red)' : dias !== null && dias <= 14 ? 'var(--orange)' : undefined }}>
                                        {fmtDate(proximaManutencao)}
                                        {dias !== null && <span style={{ marginLeft: 6, fontSize: '0.74rem' }}>({dias >= 0 ? `em ${dias} dias` : `atrasada ${Math.abs(dias)} dias`})</span>}
                                    </span>
                                } />
                            </div>

                            {pls.length > 0 && (
                                <div style={{ marginTop: 14 }}>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                                        Planos de Manutenção ({pls.length})
                                    </div>
                                    {pls.map(p => (
                                        <div key={p.id} style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 3, marginBottom: 4, fontSize: '0.79rem', display: 'flex', justifyContent: 'space-between' }}>
                                            <span><strong>{p.id}</strong> — {p.descricao}</span>
                                            <span style={{ color: 'var(--text-muted)' }}>{p.periodicidade}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {tab === 'historico' && (
                        <div>
                            {ots.length === 0 ? (
                                <div className="empty-state" style={{ padding: '32px 0' }}>
                                    <AlertCircle size={24} /><br />Nenhuma intervenção registada.
                                </div>
                            ) : (
                                <table className="data-table" style={{ marginTop: 4 }}>
                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>Tipo OT</th>
                                            <th>Tipo Trabalho</th>
                                            <th>Estado</th>
                                            <th>Data Prog.</th>
                                            <th>Data Fim</th>
                                            <th>Descrição</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {ots.map(o => {
                                            const corretivo = isCorretivo(o);
                                            const aberta = o.estado !== 'Finalizada';
                                            return (
                                                <tr key={o.id} style={{ background: corretivo && aberta ? 'rgba(249,115,22,0.04)' : undefined }}>
                                                    <td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{o.id}</td>
                                                    <td>
                                                        <span className={o.tipo === 'pontual' ? 'tbadge tbadge-suporte' : 'tbadge tbadge-admin'} style={{ fontSize: '0.68rem' }}>
                                                            {o.tipo === 'pontual' ? 'Pontual' : 'Programada'}
                                                        </span>
                                                    </td>
                                                    <td style={{ fontSize: '0.78rem' }}>
                                                        {o.naturezaIntervencao}
                                                        {corretivo && (
                                                            <span style={{ marginLeft: 4, fontSize: '0.68rem', color: '#f97316', fontWeight: 700 }}>●</span>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: OT_ESTADO_COLOR[o.estado] ?? 'var(--text-secondary)' }}>
                                                            {o.estado}
                                                        </span>
                                                    </td>
                                                    <td style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{fmtDate(o.dataAgendada)}</td>
                                                    <td style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{fmtDate(o.dataFim)}</td>
                                                    <td style={{ fontSize: '0.76rem', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={o.descricao}>{o.descricao}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="abtn abtn-secondary" type="button" onClick={onClose}>Fechar</button>
                    {tab === 'historico' ? (<>
                        <button className="abtn abtn-secondary" type="button"
                            onClick={() => setPreviewHtml(buildHistoricoEquipHtml(eq, ots, cli, mod, empresaConfig?.nome || 'AQUATEX'))}>
                            <Eye size={12} /> Pré-visualizar
                        </button>
                        <button className="abtn abtn-secondary" type="button"
                            onClick={() => printHistoricoEquip(eq, ots, cli, mod, empresaConfig?.nome || 'AQUATEX')}>
                            <Printer size={12} /> Imprimir Histórico
                        </button>
                    </>) : (<>
                        <button className="abtn abtn-secondary" type="button"
                            onClick={() => setPreviewHtml(buildEquipHtml(eq, clientes, modelosEquipamento))}>
                            <Eye size={12} /> Pré-visualizar
                        </button>
                        <button className="abtn abtn-secondary" type="button" onClick={() => printEquip(eq, clientes, modelosEquipamento)}>
                            <Printer size={12} /> Imprimir Ficha
                        </button>
                    </>)}
                    <button className="abtn abtn-secondary" type="button" onClick={onEdit}><Edit2 size={12} /> Editar</button>
                </div>
            </div>
            {previewHtml && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 10000, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ flex: 1, fontWeight: 700, fontSize: '0.85rem' }}>Pré-visualização</span>
                        <button type="button" className="abtn abtn-primary" onClick={() => { if (tab === 'historico') printHistoricoEquip(eq, ots, cli, mod, empresaConfig?.nome || 'AQUATEX'); else printEquip(eq, clientes, modelosEquipamento); }} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Printer size={13} /> Imprimir
                        </button>
                        <button type="button" className="abtn abtn-secondary" onClick={() => setPreviewHtml('')}>
                            <X size={13} /> Fechar
                        </button>
                    </div>
                    <iframe srcDoc={previewHtml} title="Pré-visualização" style={{ flex: 1, border: 'none', background: '#fff' }} />
                </div>
            )}
        </div>
    );
};

/* ══ Page ════════════════════════════════════════════════ */
type PageView = 'equipamentos' | 'modelos';

const ParquePage: React.FC = () => {
    const {
        equipInstalados, addEquipInstalado, updateEquipInstalado, removeEquipInstalado,
        modelosEquipamento, addModelo, updateModelo, removeModelo,
        clientes, addOrdem, ordens, fmtDate, empresaConfig,
    } = useGlobal();

    // Computed stats per equipment from OTs
    const equipStats = useMemo(() => {
        const map = new Map<string, { ultimaManutencao?: string; proximaManutencao?: string; hasOpenCorretivo: boolean; effectiveEstado: EstadoEquip }>();
        for (const eq of equipInstalados) {
            const eqOts = ordens.filter(o => String(o.equipInstaladoId) === String(eq.id));
            const finished = eqOts.filter(o => o.estado === 'Finalizada');
            const open = eqOts.filter(o => o.estado !== 'Finalizada');
            const finDates = finished.map(o => o.dataFim).filter(Boolean) as string[];
            const openDates = open.map(o => o.dataAgendada).filter(Boolean) as string[];
            const hasOpenCorretivo = open.some(isCorretivo);
            const effectiveEstado: EstadoEquip = eq.estado === 'inativo' ? 'inativo'
                : hasOpenCorretivo ? 'com_problema'
                : eq.estado;
            map.set(eq.id, {
                ultimaManutencao: finDates.length > 0 ? [...finDates].sort().at(-1) : undefined,
                proximaManutencao: openDates.length > 0 ? [...openDates].sort()[0] : undefined,
                hasOpenCorretivo,
                effectiveEstado,
            });
        }
        return map;
    }, [equipInstalados, ordens]);

    const [view, setView]         = useState<PageView>('equipamentos');

    // Equipamentos state
    const [search, setSearch]             = useState('');
    const [filterEstado, setFilterEstado] = useState('');
    const [modal, setModal]               = useState<'new' | 'edit' | null>(null);
    const [detalheId, setDetalheId]       = useState<string | null>(null);
    const [editId, setEditId]             = useState<string | null>(null);

    // Modelos state
    const [mSearch, setMSearch]     = useState('');
    const [mModal, setMModal]       = useState<'new' | string | null>(null);

    const [showExport,    setShowExport]    = useState(false);
    const [showRelatorio, setShowRelatorio] = useState(false);
    const [previewHtml,   setPreviewHtml]   = useState('');
    const [toast, setToast] = useState('');
    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };
    const [toastErr, setToastErr] = useState('');
    const showErr = (msg: string) => { setToastErr(msg); setTimeout(() => setToastErr(''), 5000); };

    const getCliente = (id: string) => clientes.find(c => c.id === id)?.nome ?? '—';
    const getModelo  = (id: string) => modelosEquipamento.find(m => m.id === id);

    /* ── Equipamentos ── */
    const filtered = equipInstalados.filter(e => {
        const q  = search.toLowerCase();
        const cl = getCliente(e.clienteId).toLowerCase();
        const mo = getModelo(e.modeloId)?.nome.toLowerCase() ?? '';
        const effective = equipStats.get(e.id)?.effectiveEstado ?? e.estado;
        return (!q || cl.includes(q) || mo.includes(q) || e.nrSerie.toLowerCase().includes(q))
            && (!filterEstado || effective === filterEstado);
    });

    const ativos    = equipInstalados.filter(e => equipStats.get(e.id)?.effectiveEstado === 'ativo').length;
    const problemas = equipInstalados.filter(e => equipStats.get(e.id)?.effectiveEstado === 'com_problema').length;
    const urgentes  = equipInstalados.filter(e => { const d = diffDays(equipStats.get(e.id)?.proximaManutencao); return d !== null && d <= 7; }).length;

    const handleSaveEquip = (data: Omit<EquipInstalado, 'id'>) => {
        if (modal === 'edit' && editId) {
            updateEquipInstalado(editId, data);
            showToast('Equipamento actualizado.');
        } else {
            const eq = addEquipInstalado(data);
            const mod = modelosEquipamento.find(m => m.id === data.modeloId);
            addOrdem({
                id: '', tipo: 'pontual', equipInstaladoId: eq.id, clienteId: data.clienteId,
                descricao: `Montagem e comissionamento — ${mod?.nome ?? 'equipamento'}`,
                previsaoTempo: 4, naturezaIntervencao: 'Montagem / Instalação', responsavel: '—',
                maosDeObra: [], artigos: [],
                dataAgendada: data.dataInstalacao,
                estado: 'Registada',
            } as any).catch(e => console.error('Erro ao criar OT de Montagem', e));
            showToast(`${eq.id} registado. OT de Montagem criada automaticamente.`);
        }
        setModal(null); setEditId(null);
    };

    const handleDeleteEquip = async (id: string, nrSerie: string) => {
        if (!window.confirm(`Eliminar o equipamento "${nrSerie}"? Esta acção não pode ser desfeita.`)) return;
        try {
            await removeEquipInstalado(id);
            showToast(`Equipamento "${nrSerie}" eliminado.`);
        } catch (e) {
            showErr(extractErrorMessage(e));
        }
    };

    /* ── Modelos ── */
    const filteredModelos = modelosEquipamento.filter(m => {
        const q = mSearch.toLowerCase();
        return !q || m.nome.toLowerCase().includes(q) || m.marca.toLowerCase().includes(q);
    });

    const editModelo = typeof mModal === 'string' && mModal !== 'new'
        ? modelosEquipamento.find(m => m.id === mModal)
        : undefined;

    /* ── Export ── */
    const COLS_EQUIP: ExportCol[] = [
        { key: 'id',          label: 'ID'               },
        { key: 'clienteNome', label: 'Cliente'          },
        { key: 'modeloNome',  label: 'Modelo'           },
        { key: 'tipo',        label: 'Tipo'             },
        { key: 'nrSerie',     label: 'Nº Série'        },
        { key: 'dataInst',    label: 'Data Instalação'  },
        { key: 'proxManut',   label: 'Próx. Manutenção' },
        { key: 'estado',      label: 'Estado'           },
    ];
    const COLS_MODELOS: ExportCol[] = [
        { key: 'id',    label: 'ID'           },
        { key: 'nome',  label: 'Nome'         },
        { key: 'marca', label: 'Marca'        },
        { key: 'tipo',  label: 'Tipo'         },
        { key: 'count', label: 'Equipamentos' },
    ];
    const exportDataEquip = filtered.map(e => ({
        id:          e.id,
        clienteNome: getCliente(e.clienteId),
        modeloNome:  getModelo(e.modeloId)?.nome ?? '—',
        tipo:        getModelo(e.modeloId)?.tipo === 'maquina' ? 'Máquina' : 'Filtro',
        nrSerie:     e.nrSerie,
        dataInst:    e.dataInstalacao ?? '—',
        proxManut:   e.dataProximaManutencao ?? '—',
        estado:      ESTADO_LABEL[e.estado],
    }));
    const exportDataModelos = filteredModelos.map(m => ({
        id:    m.id,
        nome:  m.nome,
        marca: m.marca,
        tipo:  m.tipo === 'maquina' ? 'Máquina' : 'Filtro',
        count: equipInstalados.filter(e => e.modeloId === m.id).length,
    }));

    const handleSaveModelo = (data: Omit<ModeloEquipamento, 'id'>) => {
        if (typeof mModal === 'string' && mModal !== 'new') {
            updateModelo(mModal, data);
            showToast('Modelo actualizado.');
        } else {
            const m = addModelo(data);
            showToast(`Modelo ${m.id} criado.`);
        }
        setMModal(null);
    };

    const handleDeleteModelo = async (id: string, nome: string) => {
        if (!window.confirm(`Eliminar o modelo "${nome}"? Esta acção não pode ser desfeita.`)) return;
        try {
            await removeModelo(id);
            showToast(`Modelo "${nome}" eliminado.`);
        } catch (e) {
            showErr(extractErrorMessage(e));
        }
    };

    const editEquip = equipInstalados.find(e => e.id === editId);

    /* ── View Tabs ── */
    const tabStyle = (active: boolean): React.CSSProperties => ({
        padding: '6px 16px', fontSize: '0.82rem', fontWeight: active ? 700 : 400,
        borderBottom: active ? '2px solid var(--blue)' : '2px solid transparent',
        color: active ? 'var(--blue)' : 'var(--text-secondary)',
        background: 'none', border: 'none', cursor: 'pointer',
        borderBottomWidth: 2, borderBottomStyle: 'solid',
        borderBottomColor: active ? 'var(--blue)' : 'transparent',
    });

    return (
        <AppLayout>
            <ActionBar title="Parque de Equipamentos" breadcrumb="AQUATEX SGI · Parque">
                <div className="actionbar-spacer" />
                {view === 'equipamentos' && (
                    <button className="abtn abtn-secondary" type="button"
                        onClick={() => setShowRelatorio(true)}>
                        <Printer size={13} /> Relatório de Estado
                    </button>
                )}
                <button className="abtn abtn-secondary" type="button" onClick={() => setShowExport(true)}>
                    <Download size={13} /> Exportar
                </button>
                {view === 'equipamentos' ? (
                    <button className="abtn abtn-primary" type="button" onClick={() => setModal('new')}>
                        <Plus size={13} /> Registar Equipamento
                    </button>
                ) : (
                    <button className="abtn abtn-primary" type="button" onClick={() => setMModal('new')}>
                        <Plus size={13} /> Novo Modelo
                    </button>
                )}
            </ActionBar>

            <div className="page-content">
                {/* View toggle */}
                <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
                    <button style={tabStyle(view === 'equipamentos')} onClick={() => setView('equipamentos')}>
                        <MapPin size={12} style={{ marginRight: 5, verticalAlign: 'middle' }} />
                        Equipamentos Instalados
                    </button>
                    <button style={tabStyle(view === 'modelos')} onClick={() => setView('modelos')}>
                        <Package size={12} style={{ marginRight: 5, verticalAlign: 'middle' }} />
                        Modelos de Equipamento
                    </button>
                </div>

                {/* ── Equipamentos View ── */}
                {view === 'equipamentos' && (
                    <>
                        <div className="stats-row">
                            {[
                                { label: 'Activos',           value: ativos,                 cls: 'green'  },
                                { label: 'Com Problema',       value: problemas,              cls: 'orange' },
                                { label: 'Total',              value: equipInstalados.length, cls: ''       },
                                { label: 'Manutenção Urgente', value: urgentes,               cls: urgentes > 0 ? 'red' : '' },
                            ].map(s => (
                                <div key={s.label} className="stat-card">
                                    <span className="stat-label">{s.label}</span>
                                    <span className={`stat-value ${s.cls}`}>{s.value}</span>
                                </div>
                            ))}
                        </div>

                        <div className="filters-bar">
                            <div className="search-wrap">
                                <Search className="search-icon" />
                                <input className="search-input" placeholder="Pesquisar por cliente, modelo ou nº série..."
                                    value={search} onChange={e => setSearch(e.target.value)} />
                            </div>
                            <select className="filter-select" value={filterEstado} onChange={e => setFilterEstado(e.target.value)}>
                                <option value="">Todos os estados</option>
                                <option value="ativo">Activo</option>
                                <option value="com_problema">Com Problema</option>
                                <option value="inativo">Inactivo</option>
                            </select>
                        </div>

                        <div className="table-container">
                            <div className="table-scroll">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: 20 }} />
                                            <th>ID</th>
                                            <th>Cliente</th>
                                            <th>Modelo</th>
                                            <th>Tipo</th>
                                            <th>Nº Série</th>
                                            <th>Localização</th>
                                            <th>Inst.</th>
                                            <th>Próx. Manutenção</th>
                                            <th style={{ width: 70 }} />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.length === 0 && (
                                            <tr><td colSpan={10}><div className="empty-state"><MapPin size={28} /><br />Nenhum equipamento encontrado.</div></td></tr>
                                        )}
                                        {filtered.map(e => {
                                            const mod  = getModelo(e.modeloId);
                                            const stats = equipStats.get(e.id);
                                            const effective = stats?.effectiveEstado ?? e.estado;
                                            const proxManut = stats?.proximaManutencao;
                                            const dias = diffDays(proxManut);
                                            const urgente = dias !== null && dias <= 7;
                                            const proximo = dias !== null && dias > 7 && dias <= 14;
                                            return (
                                                <tr key={e.id}>
                                                    <td style={{ paddingLeft: 10 }}><span className={`dot ${ESTADO_DOT[effective]}`} /></td>
                                                    <td><span className="td-link" onClick={() => setDetalheId(e.id)}>{e.id}</span></td>
                                                    <td style={{ fontWeight: 600, fontSize: '0.82rem' }}>{getCliente(e.clienteId)}</td>
                                                    <td style={{ fontSize: '0.8rem' }}>{mod?.nome ?? '—'}</td>
                                                    <td><span className={mod?.tipo === 'maquina' ? 'tbadge tbadge-admin' : 'tbadge tbadge-suporte'}>{mod?.tipo === 'maquina' ? 'Máquina' : 'Filtro'}</span></td>
                                                    <td style={{ fontSize: '0.78rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{e.nrSerie}</td>
                                                    <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{e.localizacao || '—'}</td>
                                                    <td style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{fmtDate(e.dataInstalacao)}</td>
                                                    <td style={{ fontSize: '0.76rem' }}>
                                                        {proxManut ? (
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: urgente ? 'var(--red)' : proximo ? 'var(--orange)' : undefined }}>
                                                                {urgente && <AlertTriangle size={11} />}
                                                                {fmtDate(proxManut)}
                                                                {dias !== null && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>({dias >= 0 ? `+${dias}d` : `${dias}d`})</span>}
                                                            </span>
                                                        ) : '—'}
                                                    </td>
                                                    <td>
                                                        <div className="row-actions">
                                                            <button className="icon-btn" title="Detalhe" onClick={() => setDetalheId(e.id)}><Eye size={12} /></button>
                                                            <button className="icon-btn" title="Editar" onClick={() => { setEditId(e.id); setModal('edit'); }}><Edit2 size={12} /></button>
                                                            {(() => {
                                                                const temOts = ordens.some(o => String(o.equipInstaladoId) === String(e.id));
                                                                return (
                                                                    <button className="icon-btn" disabled={temOts}
                                                                        title={temOts ? 'Não é possível eliminar: tem OTs associadas' : 'Eliminar'}
                                                                        onClick={() => handleDeleteEquip(e.id, e.nrSerie)}>
                                                                        <Trash2 size={12} style={{ color: temOts ? undefined : 'var(--red)' }} />
                                                                    </button>
                                                                );
                                                            })()}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div className="table-count">{filtered.length} equipamentos</div>
                        </div>
                    </>
                )}

                {/* ── Modelos View ── */}
                {view === 'modelos' && (
                    <>
                        <div className="filters-bar">
                            <div className="search-wrap">
                                <Search className="search-icon" />
                                <input className="search-input" placeholder="Pesquisar por nome ou marca..."
                                    value={mSearch} onChange={e => setMSearch(e.target.value)} />
                            </div>
                        </div>

                        <div className="table-container">
                            <div className="table-scroll">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>Nome / Designação</th>
                                            <th>Marca</th>
                                            <th>Tipo</th>
                                            <th>Equipamentos</th>
                                            <th style={{ width: 60 }} />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredModelos.length === 0 && (
                                            <tr><td colSpan={6}><div className="empty-state"><Package size={28} /><br />Nenhum modelo registado.</div></td></tr>
                                        )}
                                        {filteredModelos.map(m => {
                                            const count = equipInstalados.filter(e => e.modeloId === m.id).length;
                                            return (
                                                <tr key={m.id}>
                                                    <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{m.id}</td>
                                                    <td style={{ fontWeight: 600, fontSize: '0.83rem' }}>{m.nome}</td>
                                                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{m.marca}</td>
                                                    <td>
                                                        <span className={m.tipo === 'maquina' ? 'tbadge tbadge-admin' : 'tbadge tbadge-suporte'}>
                                                            {m.tipo === 'maquina' ? 'Máquina' : 'Filtro'}
                                                        </span>
                                                    </td>
                                                    <td style={{ fontSize: '0.8rem', color: count > 0 ? 'var(--blue)' : 'var(--text-muted)', fontWeight: count > 0 ? 700 : 400 }}>{count}</td>
                                                    <td>
                                                        <div className="row-actions">
                                                            <button className="icon-btn" title="Editar" onClick={() => setMModal(m.id)}><Edit2 size={12} /></button>
                                                            <button className="icon-btn" disabled={count > 0}
                                                                title={count > 0 ? 'Não é possível eliminar: tem equipamentos associados' : 'Eliminar'}
                                                                onClick={() => handleDeleteModelo(m.id, m.nome)}>
                                                                <Trash2 size={12} style={{ color: count > 0 ? undefined : 'var(--red)' }} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div className="table-count">{filteredModelos.length} modelos</div>
                        </div>
                    </>
                )}
            </div>

            {showRelatorio && (
                <RelatorioEstadoModal
                    onClose={() => setShowRelatorio(false)}
                    onPrint={seccoes => printEstadoParque(equipInstalados, ordens, clientes, modelosEquipamento, empresaConfig?.nome || 'AQUATEX', seccoes)}
                    onPreview={seccoes => { setPreviewHtml(buildEstadoParqueHtml(equipInstalados, ordens, clientes, modelosEquipamento, empresaConfig?.nome || 'AQUATEX', seccoes)); setShowRelatorio(false); }}
                />
            )}

            {/* Equip modals */}
            {(modal === 'new' || modal === 'edit') && (
                <RegisterModal
                    equip={modal === 'edit' ? editEquip : undefined}
                    onClose={() => { setModal(null); setEditId(null); }}
                    onSave={handleSaveEquip}
                />
            )}
            {detalheId && (
                <EquipDetalhe
                    equipId={detalheId}
                    onClose={() => setDetalheId(null)}
                    onEdit={() => { setEditId(detalheId); setModal('edit'); setDetalheId(null); }}
                />
            )}

            {/* Modelo modals */}
            {mModal !== null && (
                <ModeloModal
                    modelo={editModelo}
                    onClose={() => setMModal(null)}
                    onSave={handleSaveModelo}
                />
            )}

            {showExport && (
                <ExportModal
                    title={view === 'equipamentos' ? 'Equipamentos Instalados' : 'Modelos de Equipamento'}
                    columns={view === 'equipamentos' ? COLS_EQUIP : COLS_MODELOS}
                    data={view === 'equipamentos' ? exportDataEquip : exportDataModelos}
                    filename={view === 'equipamentos' ? 'parque_equipamentos' : 'parque_modelos'}
                    onClose={() => setShowExport(false)}
                />
            )}

            {toast && (
                <div className="toast" role="status">
                    <Check size={14} strokeWidth={2.5} style={{ color: 'var(--green)' }} />
                    <span>{toast}</span>
                </div>
            )}

            {toastErr && (
                <div className="toast" role="alert" style={{ borderColor: 'var(--red)' }}>
                    <AlertCircle size={14} strokeWidth={2.5} style={{ color: 'var(--red)' }} />
                    <span>{toastErr}</span>
                </div>
            )}

            {previewHtml && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 10000, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ flex: 1, fontWeight: 700, fontSize: '0.85rem' }}>Pré-visualização</span>
                        <button type="button" className="abtn abtn-secondary" onClick={() => setPreviewHtml('')}>
                            <X size={13} /> Fechar
                        </button>
                    </div>
                    <iframe srcDoc={previewHtml} title="Pré-visualização" style={{ flex: 1, border: 'none', background: '#fff' }} />
                </div>
            )}
        </AppLayout>
    );
};

export default ParquePage;

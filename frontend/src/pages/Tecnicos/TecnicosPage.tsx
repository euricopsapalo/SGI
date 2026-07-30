import React, { useState } from 'react';
import AppLayout from '../../components/Layout/AppLayout';
import ActionBar from '../../components/Layout/ActionBar';
import ExportModal, { ExportCol } from '../../components/ExportModal';
import { useGlobal, Tecnico, FuncaoTecnico, OrdemTrabalho, EmpresaConfig, Cliente, EquipInstalado, ModeloEquipamento } from '../../contexts/GlobalContext';
import { showToast } from '../../utils/errorHandler';
import { Search, Plus, Edit2, Eye, X, AlertCircle, Check, Download, Trash2, UserCog, MapPin, Printer } from 'lucide-react';

/* ══ Print CSS + Helpers ═════════════════════════════════════ */
const RT_CSS = `
  body{font-family:Arial,sans-serif;font-size:11px;color:#111;margin:0;padding:16px}
  h1{font-size:15px;margin:0 0 2px}h2{font-size:12px;margin:10px 0 4px;border-bottom:1px solid #ccc;padding-bottom:2px}
  h3{font-size:11px;margin:8px 0 3px;color:#1d4ed8}
  table{width:100%;border-collapse:collapse;margin-bottom:10px}
  th{background:#f3f4f6;font-size:10px;text-transform:uppercase;padding:4px 6px;text-align:left;border:1px solid #d1d5db}
  td{padding:4px 6px;border:1px solid #e5e7eb;font-size:10px;vertical-align:top}
  .hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;border-bottom:2px solid #1d4ed8;padding-bottom:8px}
  .hdr-left h1{color:#1d4ed8}.sub{font-size:9px;color:#666;margin-top:1px}
  .badge{display:inline-block;padding:1px 7px;border-radius:8px;font-size:9px;font-weight:700}
  .badge-green{background:#d1fae5;color:#065f46}.badge-red{background:#fee2e2;color:#991b1b}
  .badge-blue{background:#dbeafe;color:#1e40af}.badge-orange{background:#ffedd5;color:#9a3412}
  .badge-gray{background:#f3f4f6;color:#6b7280}
  .bar-wrap{background:#e5e7eb;border-radius:3px;height:10px;overflow:hidden;display:inline-block;width:100px;vertical-align:middle}
  .bar-fill{height:100%;background:#1d4ed8;border-radius:3px}
  .kv{margin-bottom:3px}.kv span:first-child{font-weight:600;min-width:130px;display:inline-block;color:#374151}
  .section{margin-bottom:14px}
  @media print{body{padding:0}button{display:none}}
`;

const fRT = (d?: string) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('pt-AO'); } catch { return d; }
};

const openPrintT = (html: string, title: string) => {
    const w = window.open('', '_blank', 'width=960,height=700');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>${RT_CSS}</style></head><body>${html}<script>window.onload=()=>window.print();</script></body></html>`);
    w.document.close();
};

const hdrT = (title: string, sub: string, empresa?: EmpresaConfig | null) => `
    <div class="hdr">
        <div class="hdr-left"><h1>${empresa?.nome || 'SGI'}</h1><div class="sub">${empresa?.morada || ''} · NIF: ${empresa?.nif || ''}</div></div>
        <div style="text-align:right"><h1>${title}</h1><div class="sub">${sub} · Emitido em ${fRT(new Date().toISOString())}</div></div>
    </div>`;

// Calc diff in hours between two ISO date strings
const diffHours = (start?: string, end?: string): number | null => {
    if (!start || !end) return null;
    const ms = new Date(end).getTime() - new Date(start).getTime();
    return ms > 0 ? Math.round(ms / 3600000 * 10) / 10 : null;
};

// OT estado badge class
const otBadgeClass = (e: string) =>
    e === 'Finalizada' ? 'badge-green'
    : e === 'Em execução' ? 'badge-orange'
    : e === 'Programada' || e === 'Confirmada' ? 'badge-blue' : 'badge-gray';

/* ══ Print Functions ═════════════════════════════════════════ */
function buildOTPorTecnicoHtml(tecnicos: Tecnico[], ordens: OrdemTrabalho[], funcoes: FuncaoTecnico[], periodo: string, empresa?: EmpresaConfig | null): string {
    const now = new Date();
    let fromDate: Date | null = null;
    if (periodo === 'semana') { fromDate = new Date(now); fromDate.setDate(now.getDate() - 7); }
    else if (periodo === 'mes') { fromDate = new Date(now.getFullYear(), now.getMonth(), 1); }
    else if (periodo === 'trimestre') { fromDate = new Date(now); fromDate.setMonth(now.getMonth() - 3); }
    else if (periodo === 'ano') { fromDate = new Date(now.getFullYear(), 0, 1); }
    const filtOT = fromDate ? ordens.filter(o => o.dataAgendada && new Date(o.dataAgendada) >= fromDate!) : ordens;
    const periodoLabel: Record<string, string> = { semana: 'Última Semana', mes: 'Mês Actual', trimestre: 'Último Trimestre', ano: 'Ano Actual', total: 'Todo o Período' };
    const rows = tecnicos.filter(t => t.ativo).map(t => {
        const tOTs = filtOT.filter(o => o.responsavel === t.nome);
        const prog = tOTs.filter(o => o.estado === 'Programada' || o.estado === 'Registada' || o.estado === 'Adiada' || o.estado === 'Confirmada').length;
        const emCurso = tOTs.filter(o => o.estado === 'Em execução').length;
        const term = tOTs.filter(o => o.estado === 'Finalizada').length;
        const enc = 0;
        const funcao = funcoes.find(f => String(f.id) === String(t.funcaoId))?.descricao ?? '—';
        return `<tr><td style="font-weight:600">${t.nome}</td><td>${funcao}</td>
            <td style="text-align:center;font-weight:700;color:#1d4ed8">${tOTs.length}</td>
            <td style="text-align:center">${prog}</td><td style="text-align:center">${emCurso}</td>
            <td style="text-align:center">${term}</td><td style="text-align:center">${enc}</td></tr>`;
    }).join('');
    return hdrT('OT por Técnico', periodoLabel[periodo] ?? periodo, empresa) + `
        <table><thead><tr><th>Nome</th><th>Função</th><th>Total OT</th><th>Programado</th><th>Em Curso</th><th>Terminado</th><th>Encerrado</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="7" style="text-align:center;color:#999">Sem dados</td></tr>'}</tbody></table>`;
}
function printOTPorTecnico(tecnicos: Tecnico[], ordens: OrdemTrabalho[], funcoes: FuncaoTecnico[], periodo: string, empresa?: EmpresaConfig | null) {
    openPrintT(buildOTPorTecnicoHtml(tecnicos, ordens, funcoes, periodo, empresa), 'OT por Técnico');
}

function buildTempoResolucaoHtml(tecnicos: Tecnico[], ordens: OrdemTrabalho[], funcoes: FuncaoTecnico[], empresa?: EmpresaConfig | null): string {
    const rows = tecnicos.filter(t => t.ativo).map(t => {
        const concluidas = ordens.filter(o => o.estado === 'Finalizada' && o.responsavel === t.nome && o.dataFim);
        const diffs = concluidas.map(o => diffHours(o.dataInicio, o.dataFim)).filter((v): v is number => v !== null);
        const media = diffs.length > 0 ? (diffs.reduce((s, v) => s + v, 0) / diffs.length).toFixed(1) : '—';
        const minVal = diffs.length > 0 ? Math.min(...diffs).toFixed(1) : '—';
        const maxVal = diffs.length > 0 ? Math.max(...diffs).toFixed(1) : '—';
        const funcao = funcoes.find(f => String(f.id) === String(t.funcaoId))?.descricao ?? '—';
        return `<tr><td style="font-weight:600">${t.nome}</td><td>${funcao}</td>
            <td style="text-align:center">${concluidas.length}</td>
            <td style="text-align:center;font-weight:700;color:#1d4ed8">${media}h</td>
            <td style="text-align:center">${minVal}h</td><td style="text-align:center">${maxVal}h</td></tr>`;
    }).join('');
    return hdrT('Tempo Médio de Resolução', 'OT com trabalho concluído (dataInicio → dataFim)', empresa) + `
        <table><thead><tr><th>Técnico</th><th>Função</th><th>OT Concluídas</th><th>Média (h)</th><th>Mín (h)</th><th>Máx (h)</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="6" style="text-align:center;color:#999">Sem dados</td></tr>'}</tbody></table>`;
}
function printTempoResolucao(tecnicos: Tecnico[], ordens: OrdemTrabalho[], funcoes: FuncaoTecnico[], empresa?: EmpresaConfig | null) {
    openPrintT(buildTempoResolucaoHtml(tecnicos, ordens, funcoes, empresa), 'Tempo Médio de Resolução');
}

function buildTaxaConclusaoHtml(tecnicos: Tecnico[], ordens: OrdemTrabalho[], funcoes: FuncaoTecnico[], empresa?: EmpresaConfig | null): string {
    const rows = tecnicos.filter(t => t.ativo).map(t => {
        const tOTs = ordens.filter(o => o.responsavel === t.nome);
        const concluidas = tOTs.filter(o => o.estado === 'Finalizada').length;
        const taxa = tOTs.length > 0 ? Math.round((concluidas / tOTs.length) * 100) : 0;
        const funcao = funcoes.find(f => String(f.id) === String(t.funcaoId))?.descricao ?? '—';
        const taxaColor = taxa >= 80 ? '#065f46' : taxa >= 50 ? '#9a3412' : '#991b1b';
        return `<tr><td style="font-weight:600">${t.nome}</td><td>${funcao}</td>
            <td style="text-align:center">${tOTs.length}</td>
            <td style="text-align:center">${concluidas}</td>
            <td style="text-align:center">${tOTs.length - concluidas}</td>
            <td style="text-align:center;font-weight:700;color:${taxaColor}">${taxa}%
                <span class="bar-wrap"><span class="bar-fill" style="width:${taxa}%;background:${taxaColor}"></span></span>
            </td></tr>`;
    }).join('');
    return hdrT('Taxa de Conclusão', 'OT Terminadas vs. Atribuídas', empresa) + `
        <table><thead><tr><th>Técnico</th><th>Função</th><th>Total OT</th><th>Concluídas</th><th>Pendentes</th><th>Taxa</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="6" style="text-align:center;color:#999">Sem dados</td></tr>'}</tbody></table>`;
}
function printTaxaConclusao(tecnicos: Tecnico[], ordens: OrdemTrabalho[], funcoes: FuncaoTecnico[], empresa?: EmpresaConfig | null) {
    openPrintT(buildTaxaConclusaoHtml(tecnicos, ordens, funcoes, empresa), 'Taxa de Conclusão');
}

function buildOTAtrasoHtml(tecnicos: Tecnico[], ordens: OrdemTrabalho[], funcoes: FuncaoTecnico[], empresa?: EmpresaConfig | null): string {
    const today = new Date(); today.setHours(0,0,0,0);
    const atrasadas = ordens.filter(o =>
        o.estado !== 'Finalizada' &&
        o.dataAgendada && new Date(o.dataAgendada) < today
    );
    const sections = tecnicos.filter(t => t.ativo).map(t => {
        const tOTs = atrasadas.filter(o => o.responsavel === t.nome);
        if (tOTs.length === 0) return '';
        const funcao = funcoes.find(f => String(f.id) === String(t.funcaoId))?.descricao ?? '—';
        const rows = tOTs.map(o => {
            const diasAtraso = o.dataAgendada ? Math.ceil((today.getTime() - new Date(o.dataAgendada).getTime()) / 86400000) : 0;
            return `<tr><td>${o.id}</td><td>${o.descricao?.substring(0,50) ?? '—'}</td>
                <td>${o.naturezaIntervencao || '—'}</td><td>${fRT(o.dataAgendada)}</td>
                <td style="text-align:center;font-weight:700;color:#991b1b">${diasAtraso}d</td>
                <td><span class="badge ${otBadgeClass(o.estado)}">${o.estado}</span></td></tr>`;
        }).join('');
        return `<h3>${t.nome} — ${funcao} (${tOTs.length} OT em atraso)</h3>
            <table><thead><tr><th>ID</th><th>Descrição</th><th>Tipo</th><th>Data Agendada</th><th>Atraso</th><th>Estado</th></tr></thead>
            <tbody>${rows}</tbody></table>`;
    }).filter(Boolean).join('');
    return hdrT('OT em Atraso por Técnico', `Total: ${atrasadas.length} OT atrasadas`, empresa) +
        (sections || '<p style="color:#999;text-align:center">Sem OT atrasadas.</p>');
}
function printOTAtraso(tecnicos: Tecnico[], ordens: OrdemTrabalho[], funcoes: FuncaoTecnico[], empresa?: EmpresaConfig | null) {
    openPrintT(buildOTAtrasoHtml(tecnicos, ordens, funcoes, empresa), 'OT em Atraso por Técnico');
}

function buildAgendaHtml(
    tecnico: Tecnico, ordens: OrdemTrabalho[], funcoes: FuncaoTecnico[],
    clientes: Cliente[], equipInstalados: EquipInstalado[], modelos: ModeloEquipamento[],
    dateFrom: string, dateTo: string, estados: string[], empresa?: EmpresaConfig | null
): string {
    const from = dateFrom ? new Date(dateFrom) : null;
    const to   = dateTo   ? new Date(dateTo + 'T23:59:59') : null;

    const tOTs = ordens
        .filter(o => {
            if (o.responsavel !== tecnico.nome) return false;
            if (estados.length > 0 && !estados.includes(o.estado)) return false;
            if (from || to) {
                const oData = o.dataAgendada ? new Date(o.dataAgendada) : null;
                if (from && oData && oData < from) return false;
                if (to   && oData && oData > to  ) return false;
            }
            return true;
        })
        .sort((a, b) => (a.dataAgendada ?? '').localeCompare(b.dataAgendada ?? ''));

    const funcao = funcoes.find(f => String(f.id) === String(tecnico.funcaoId))?.descricao ?? '—';
    const periodStr = (from || to)
        ? `${from ? fRT(dateFrom) : '—'} a ${to ? fRT(dateTo) : '—'}`
        : 'Todo o período';
    const estadosStr = estados.length > 0 ? estados.join(', ') : 'Todos os estados';

    const rows = tOTs.map(o => {
        const equip = equipInstalados.find(e => String(e.id) === String(o.equipInstaladoId));
        const modelo = equip ? modelos.find(m => String(m.id) === String(equip.modeloId)) : null;
        const equipStr = modelo ? `${modelo.marca} ${modelo.nome}<br><small style="color:#666">Série: ${equip?.nrSerie ?? '—'}</small>` : '—';
        const cliente = clientes.find(c => String(c.id) === String(o.clienteId));
        const clienteStr = cliente?.nome ?? '—';
        const enderecoStr = cliente ? [cliente.morada, cliente.municipio, cliente.provincia].filter(Boolean).join(', ') || '—' : '—';
        const tipoLabel = o.tipo === 'periodica' ? 'Periódica' : 'Pontual';
        return `<tr>
            <td>${o.id}</td>
            <td>${equipStr}</td>
            <td style="font-weight:600">${clienteStr}</td>
            <td style="font-size:9px;color:#555">${enderecoStr}</td>
            <td style="text-align:center">${fRT(o.dataAgendada)}</td>
            <td>${tipoLabel}<br><small style="color:#666">${o.naturezaIntervencao || '—'}</small></td>
            <td style="text-align:center"><span class="badge ${otBadgeClass(o.estado)}">${o.estado}</span></td>
        </tr>`;
    }).join('');

    const table = `<table>
        <thead><tr>
            <th>ID</th><th>Equipamento</th><th>Cliente</th><th>Endereço</th>
            <th>Data Agendada</th><th>Tipo OT</th><th>Estado</th>
        </tr></thead>
        <tbody>${rows || '<tr><td colspan="7" style="text-align:center;color:#999">Sem OT para o período seleccionado.</td></tr>'}</tbody>
    </table>`;

    return hdrT(`Agenda — ${tecnico.nome}`, `${funcao} · Período: ${periodStr} · ${estadosStr} · ${tOTs.length} OT`, empresa) + table;
}

function printAgendaTecnico(
    tecnico: Tecnico, ordens: OrdemTrabalho[], funcoes: FuncaoTecnico[],
    clientes: Cliente[], equipInstalados: EquipInstalado[], modelos: ModeloEquipamento[],
    dateFrom: string, dateTo: string, estados: string[], empresa?: EmpresaConfig | null
) {
    const html = buildAgendaHtml(tecnico, ordens, funcoes, clientes, equipInstalados, modelos, dateFrom, dateTo, estados, empresa);
    openPrintT(html, `Agenda - ${tecnico.nome}`);
}

function buildDistribuicaoCargaHtml(tecnicos: Tecnico[], ordens: OrdemTrabalho[], funcoes: FuncaoTecnico[], empresa?: EmpresaConfig | null): string {
    const data = tecnicos.filter(t => t.ativo).map(t => {
        const tOTs = ordens.filter(o => o.responsavel === t.nome);
        const abertas = tOTs.filter(o => o.estado !== 'Finalizada').length;
        const funcao = funcoes.find(f => String(f.id) === String(t.funcaoId))?.descricao ?? '—';
        return { nome: t.nome, funcao, total: tOTs.length, abertas, prog: tOTs.filter(o => o.estado === 'Programada' || o.estado === 'Registada' || o.estado === 'Adiada' || o.estado === 'Confirmada').length, emCurso: tOTs.filter(o => o.estado === 'Em execução').length };
    }).sort((a, b) => b.abertas - a.abertas);
    const maxAbertas = Math.max(...data.map(d => d.abertas), 1);
    const rows = data.map(d => {
        const pct = Math.round((d.abertas / maxAbertas) * 100);
        const barColor = d.abertas === 0 ? '#9ca3af' : d.abertas >= maxAbertas * 0.8 ? '#991b1b' : d.abertas >= maxAbertas * 0.5 ? '#9a3412' : '#1d4ed8';
        return `<tr><td style="font-weight:600">${d.nome}</td><td>${d.funcao}</td>
            <td style="text-align:center">${d.total}</td>
            <td style="text-align:center">${d.prog}</td><td style="text-align:center">${d.emCurso}</td>
            <td style="text-align:center;font-weight:700;color:${barColor}">${d.abertas}
                <span class="bar-wrap"><span class="bar-fill" style="width:${pct}%;background:${barColor}"></span></span>
            </td></tr>`;
    }).join('');
    return hdrT('Distribuição de Carga de Trabalho', 'Técnicos Activos — OT em Aberto', empresa) + `
        <table><thead><tr><th>Técnico</th><th>Função</th><th>Total OT</th><th>Programado</th><th>Em Curso</th><th>Em Aberto ▾</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="6" style="text-align:center;color:#999">Sem dados</td></tr>'}</tbody></table>`;
}
function printDistribuicaoCarga(tecnicos: Tecnico[], ordens: OrdemTrabalho[], funcoes: FuncaoTecnico[], empresa?: EmpresaConfig | null) {
    openPrintT(buildDistribuicaoCargaHtml(tecnicos, ordens, funcoes, empresa), 'Distribuição de Carga');
}

function buildDisponibilidadeHtml(tecnicos: Tecnico[], ordens: OrdemTrabalho[], funcoes: FuncaoTecnico[], dateFrom: string, dateTo: string, empresa?: EmpresaConfig | null): string {
    const from = dateFrom ? new Date(dateFrom) : null;
    const to   = dateTo   ? new Date(dateTo + 'T23:59:59') : null;
    const periodStr = (from || to) ? `${from ? fRT(from.toISOString()) : '—'} a ${to ? fRT(to.toISOString()) : '—'}` : 'Todo o período';
    const data = tecnicos.filter(t => t.ativo).map(t => {
        const tOTs = ordens.filter(o => {
            if (o.responsavel !== t.nome) return false;
            if (o.estado === 'Finalizada') return false;
            const oData = o.dataAgendada ? new Date(o.dataAgendada) : null;
            if (from && oData && oData < from) return false;
            if (to   && oData && oData > to  ) return false;
            return true;
        });
        const funcao = funcoes.find(f => String(f.id) === String(t.funcaoId))?.descricao ?? '—';
        return { nome: t.nome, funcao, ocupado: tOTs.length > 0, nOTs: tOTs.length };
    }).sort((a, b) => Number(b.ocupado) - Number(a.ocupado) || b.nOTs - a.nOTs);
    const livres   = data.filter(d => !d.ocupado).length;
    const ocupados = data.filter(d =>  d.ocupado).length;
    const rows = data.map(d => `<tr>
        <td style="font-weight:600">${d.nome}</td><td>${d.funcao}</td>
        <td style="text-align:center"><span class="badge ${d.ocupado ? 'badge-orange' : 'badge-green'}">${d.ocupado ? 'Ocupado' : 'Livre'}</span></td>
        <td style="text-align:center">${d.nOTs || '—'}</td></tr>`).join('');
    return hdrT('Disponibilidade de Técnicos', `Período: ${periodStr} · Livres: ${livres} · Ocupados: ${ocupados}`, empresa) + `
        <table><thead><tr><th>Técnico</th><th>Função</th><th>Disponibilidade</th><th>OT no Período</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4" style="text-align:center;color:#999">Sem dados</td></tr>'}</tbody></table>`;
}
function printDisponibilidade(tecnicos: Tecnico[], ordens: OrdemTrabalho[], funcoes: FuncaoTecnico[], dateFrom: string, dateTo: string, empresa?: EmpresaConfig | null) {
    openPrintT(buildDisponibilidadeHtml(tecnicos, ordens, funcoes, dateFrom, dateTo, empresa), 'Disponibilidade de Técnicos');
}

/* ══ Relatórios Modal ════════════════════════════════════════ */
type RelTecTipo = 'ot_tecnico' | 'tempo_resolucao' | 'taxa_conclusao' | 'ot_atraso' | 'agenda' | 'carga' | 'disponibilidade';

interface RelatoriosTecnicoModalProps {
    tecnicos: Tecnico[];
    ordens: OrdemTrabalho[];
    funcoes: FuncaoTecnico[];
    clientes: Cliente[];
    equipInstalados: EquipInstalado[];
    modelos: ModeloEquipamento[];
    empresaConfig?: EmpresaConfig | null;
    onClose: () => void;
}

const RelatoriosTecnicoModal: React.FC<RelatoriosTecnicoModalProps> = ({ tecnicos, ordens, funcoes, clientes, equipInstalados, modelos, empresaConfig, onClose }) => {
    const [tipo, setTipo] = useState<RelTecTipo>('ot_tecnico');
    const [periodo, setPeriodo] = useState('mes');
    const [tecnicoId, setTecnicoId] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [agendaDateFrom, setAgendaDateFrom] = useState('');
    const [agendaDateTo, setAgendaDateTo] = useState('');
    const [agendaEstados, setAgendaEstados] = useState<string[]>([]);
    const [previewHtml, setPreviewHtml] = useState('');

    const toggleEstado = (e: string) =>
        setAgendaEstados(prev => prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e]);

    const getAgendaTecnico = () => tecnicos.find(x => x.id === tecnicoId);

    const buildHtml = (): string | null => {
        if (tipo === 'ot_tecnico')       return buildOTPorTecnicoHtml(tecnicos, ordens, funcoes, periodo, empresaConfig);
        if (tipo === 'tempo_resolucao')  return buildTempoResolucaoHtml(tecnicos, ordens, funcoes, empresaConfig);
        if (tipo === 'taxa_conclusao')   return buildTaxaConclusaoHtml(tecnicos, ordens, funcoes, empresaConfig);
        if (tipo === 'ot_atraso')        return buildOTAtrasoHtml(tecnicos, ordens, funcoes, empresaConfig);
        if (tipo === 'carga')            return buildDistribuicaoCargaHtml(tecnicos, ordens, funcoes, empresaConfig);
        if (tipo === 'disponibilidade')  return buildDisponibilidadeHtml(tecnicos, ordens, funcoes, dateFrom, dateTo, empresaConfig);
        if (tipo === 'agenda') {
            const t = getAgendaTecnico();
            if (!t) { alert('Seleccione um técnico.'); return null; }
            return buildAgendaHtml(t, ordens, funcoes, clientes, equipInstalados, modelos, agendaDateFrom, agendaDateTo, agendaEstados, empresaConfig);
        }
        return null;
    };

    const handlePreview = () => {
        const body = buildHtml();
        if (!body) return;
        setPreviewHtml(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>${RT_CSS}</style></head><body>${body}</body></html>`);
    };

    const handlePrint = () => {
        if (tipo === 'ot_tecnico') {
            printOTPorTecnico(tecnicos, ordens, funcoes, periodo, empresaConfig);
        } else if (tipo === 'tempo_resolucao') {
            printTempoResolucao(tecnicos, ordens, funcoes, empresaConfig);
        } else if (tipo === 'taxa_conclusao') {
            printTaxaConclusao(tecnicos, ordens, funcoes, empresaConfig);
        } else if (tipo === 'ot_atraso') {
            printOTAtraso(tecnicos, ordens, funcoes, empresaConfig);
        } else if (tipo === 'agenda') {
            const t = getAgendaTecnico();
            if (!t) { alert('Seleccione um técnico.'); return; }
            printAgendaTecnico(t, ordens, funcoes, clientes, equipInstalados, modelos, agendaDateFrom, agendaDateTo, agendaEstados, empresaConfig);
        } else if (tipo === 'carga') {
            printDistribuicaoCarga(tecnicos, ordens, funcoes, empresaConfig);
        } else {
            printDisponibilidade(tecnicos, ordens, funcoes, dateFrom, dateTo, empresaConfig);
        }
    };

    const GRUPOS = [
        {
            label: 'Produtividade',
            items: [
                { value: 'ot_tecnico',      label: 'OT por Técnico',             desc: 'Nº de ordens realizadas por período' },
                { value: 'tempo_resolucao', label: 'Tempo Médio de Resolução',   desc: 'Média de horas entre início e fim por técnico' },
                { value: 'taxa_conclusao',  label: 'Taxa de Conclusão',          desc: '% de OT terminadas vs. atribuídas' },
                { value: 'ot_atraso',       label: 'OT em Atraso por Técnico',   desc: 'Ordens que ultrapassaram a data programada de fim' },
            ],
        },
        {
            label: 'Agenda e Carga de Trabalho',
            items: [
                { value: 'agenda',          label: 'Agenda do Técnico',          desc: 'OT programadas, em curso e pendentes por técnico' },
                { value: 'carga',           label: 'Distribuição de Carga',      desc: 'Comparativo entre técnicos (mais/menos trabalho)' },
                { value: 'disponibilidade', label: 'Disponibilidade',            desc: 'Técnicos livres vs. ocupados num período' },
            ],
        },
    ] as const;

    const TIPO_LABELS: Record<RelTecTipo, string> = {
        ot_tecnico: 'OT por Técnico', tempo_resolucao: 'Tempo Médio de Resolução',
        taxa_conclusao: 'Taxa de Conclusão', ot_atraso: 'OT em Atraso por Técnico',
        agenda: 'Agenda do Técnico', carga: 'Distribuição de Carga', disponibilidade: 'Disponibilidade',
    };
    const tipoLabel = TIPO_LABELS[tipo];

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" style={{ maxWidth: 540 }}>
                <div className="modal-header">
                    <h3 className="modal-title">Relatórios de Técnicos</h3>
                    <button className="modal-close" type="button" onClick={onClose}><X size={13} /></button>
                </div>
                <div className="modal-body" style={{ paddingBottom: 8 }}>
                    {/* ── Selector de relatório ── */}
                    {GRUPOS.map((g, gi) => (
                        <div key={g.label} style={{ marginBottom: gi < GRUPOS.length - 1 ? 8 : 0 }}>
                            <div style={{ fontSize: '0.67rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 3 }}>{g.label}</div>
                            {g.items.map(item => (
                                <label key={item.value} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', borderRadius: 6, cursor: 'pointer', background: tipo === item.value ? 'var(--blue-light,#eff6ff)' : 'transparent', marginBottom: 1 }}>
                                    <input type="radio" name="rel-tec" value={item.value} checked={tipo === item.value} onChange={() => setTipo(item.value as RelTecTipo)} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <span style={{ fontSize: '0.82rem', fontWeight: tipo === item.value ? 700 : 500, color: tipo === item.value ? 'var(--blue,#1d4ed8)' : 'var(--text-primary)' }}>{item.label}</span>
                                        {tipo === item.value && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 1 }}>{item.desc}</div>}
                                    </div>
                                </label>
                            ))}
                        </div>
                    ))}

                    {/* ── Parâmetros do relatório seleccionado ── */}
                    {(tipo === 'ot_tecnico' || tipo === 'agenda' || tipo === 'disponibilidade') && (
                        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                            {tipo === 'ot_tecnico' && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <label className="form-label" style={{ margin: 0, whiteSpace: 'nowrap' }}>Período</label>
                                    <select className="form-select" style={{ flex: 1 }} value={periodo} onChange={e => setPeriodo(e.target.value)}>
                                        <option value="semana">Última Semana</option>
                                        <option value="mes">Mês Actual</option>
                                        <option value="trimestre">Último Trimestre</option>
                                        <option value="ano">Ano Actual</option>
                                        <option value="total">Todo o Período</option>
                                    </select>
                                </div>
                            )}

                            {tipo === 'agenda' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                        <label className="form-label" style={{ margin: 0, whiteSpace: 'nowrap', minWidth: 52 }}>Técnico <span style={{ color: 'var(--red)' }}>*</span></label>
                                        <select className="form-select" style={{ flex: 1 }} value={tecnicoId} onChange={e => setTecnicoId(e.target.value)}>
                                            <option value="">Seleccionar...</option>
                                            {tecnicos.filter(t => t.ativo).map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                                        </select>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                        <label className="form-label" style={{ margin: 0, whiteSpace: 'nowrap', minWidth: 52 }}>Período</label>
                                        <input type="date" className="form-input" style={{ flex: 1 }} value={agendaDateFrom} onChange={e => setAgendaDateFrom(e.target.value)} />
                                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', flexShrink: 0 }}>até</span>
                                        <input type="date" className="form-input" style={{ flex: 1 }} value={agendaDateTo} onChange={e => setAgendaDateTo(e.target.value)} />
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                        <label className="form-label" style={{ margin: 0, whiteSpace: 'nowrap', minWidth: 52 }}>Estado</label>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
                                            {(['Registada', 'Programada', 'Adiada', 'Confirmada', 'Em execução', 'Finalizada'] as const).map(e => (
                                                <label key={e} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.79rem', cursor: 'pointer' }}>
                                                    <input type="checkbox" checked={agendaEstados.includes(e)} onChange={() => toggleEstado(e)} />
                                                    {e}
                                                </label>
                                            ))}
                                        </div>
                                        {agendaEstados.length === 0 && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>todos</span>}
                                    </div>
                                </div>
                            )}

                            {tipo === 'disponibilidade' && (
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <label className="form-label" style={{ margin: 0, whiteSpace: 'nowrap', minWidth: 52 }}>Período</label>
                                    <input type="date" className="form-input" style={{ flex: 1 }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', flexShrink: 0 }}>até</span>
                                    <input type="date" className="form-input" style={{ flex: 1 }} value={dateTo} onChange={e => setDateTo(e.target.value)} />
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <div className="modal-footer">
                    <button type="button" className="abtn abtn-secondary" onClick={onClose}>Cancelar</button>
                    <button type="button" className="abtn abtn-secondary" onClick={handlePreview}><Eye size={13} /> Pré-visualizar</button>
                    <button type="button" className="abtn abtn-primary" onClick={handlePrint}><Printer size={13} /> Imprimir</button>
                </div>
            </div>

            {/* Overlay de pré-visualização */}
            {previewHtml && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 10000, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ flex: 1, fontWeight: 700, fontSize: '0.85rem' }}>Pré-visualização — {tipoLabel}</span>
                        <button type="button" className="abtn abtn-primary" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
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

/* ══ View Modal ══════════════════════════════════════════════ */
interface TecnicoViewModalProps {
    tecnico: Tecnico;
    funcaoNome: string;
    provinciaNome: string;
    municipioNome: string;
    simboloMoeda: string;
    onClose: () => void;
    onEdit: () => void;
}
const TecnicoViewModal: React.FC<TecnicoViewModalProps> = ({ tecnico: t, funcaoNome, provinciaNome, municipioNome, simboloMoeda, onClose, onEdit }) => (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="modal" style={{ maxWidth: 500 }}>
            <div className="modal-header">
                <h3 className="modal-title">Técnico</h3>
                <button className="modal-close" type="button" onClick={onClose}><X size={13} /></button>
            </div>
            <div className="modal-body">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--blue-light,#eff6ff)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <UserCog size={18} style={{ color: 'var(--blue)' }} />
                    </div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{t.nome}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{funcaoNome || '—'}</div>
                    </div>
                    <span style={{ marginLeft: 'auto', fontSize: '0.72rem', padding: '2px 8px', borderRadius: 10, background: t.ativo ? 'var(--green-light,#f0fdf4)' : 'var(--bg-secondary)', color: t.ativo ? 'var(--green)' : 'var(--text-muted)', fontWeight: 600 }}>
                        {t.ativo ? 'Activo' : 'Inactivo'}
                    </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
                    {[
                        { label: 'Telefone',   value: t.telefone || '—' },
                        { label: 'Email',      value: t.email || '—'    },
                        { label: `Custo/Hora (${simboloMoeda})`, value: t.custoHora.toLocaleString('pt-PT') },
                        { label: 'Província',  value: provinciaNome || '—' },
                        { label: 'Município',  value: municipioNome || '—' },
                    ].map(row => (
                        <div key={row.label}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{row.label}</div>
                            <div style={{ fontSize: '0.83rem', color: 'var(--text-primary)', wordBreak: 'break-word' }}>{row.value}</div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="modal-footer">
                <button type="button" className="abtn abtn-secondary" onClick={onClose}>Fechar</button>
                <button type="button" className="abtn abtn-primary" onClick={onEdit}><Edit2 size={12} /> Editar</button>
            </div>
        </div>
    </div>
);

/* ══ Edit/Create Modal ══════════════════════════════════════ */
interface TecnicoModalProps {
    tecnico?: Tecnico;
    funcoes: FuncaoTecnico[];
    onClose: () => void;
    onSave: (t: Omit<Tecnico, 'id'> & { password?: string; passwordConfirm?: string }) => void;
}
const TecnicoModal: React.FC<TecnicoModalProps> = ({ tecnico, funcoes, onClose, onSave }) => {
    const { simboloMoeda, provincias, municipios } = useGlobal();
    const isNew = !tecnico;
    const [nome, setNome]           = useState(tecnico?.nome       ?? '');
    const [telefone, setTelefone]   = useState(tecnico?.telefone   ?? '');
    const [email, setEmail]         = useState(tecnico?.email      ?? '');
    const [funcaoId, setFuncaoId]   = useState(tecnico?.funcaoId   ?? '');
    const [custoHora, setCustoHora] = useState(String(tecnico?.custoHora ?? ''));
    const [ativo, setAtivo]         = useState(tecnico?.ativo      ?? true);
    const [provinciaId, setProvId]  = useState(tecnico?.provinciaId ? String(tecnico.provinciaId) : '');
    const [municipioId, setMunId]   = useState(tecnico?.municipioId ? String(tecnico.municipioId) : '');
    // Issue #68 — credenciais do User criado automaticamente
    const [password, setPassword]               = useState('');
    const [passwordConfirm, setPasswordConfirm] = useState('');
    const [errors, setErrors]       = useState<Record<string, string>>({});

    const munsFiltrados = municipios.filter(m => m.provinciaId === provinciaId);

    const validate = () => {
        const e: Record<string, string> = {};
        if (!nome.trim())    e.nome    = 'Obrigatório';
        if (!funcaoId)       e.funcao  = 'Obrigatório';
        if (!custoHora || isNaN(Number(custoHora))) e.custo = 'Valor inválido';
        // Issue #68: na criação, email + password são obrigatórios (vão gerar User)
        if (isNew) {
            if (!email.trim())                e.email = 'Obrigatório — será o login do utilizador';
            if (!password || password.length < 6) e.password = 'Mínimo 6 caracteres';
            if (password !== passwordConfirm) e.passwordConfirm = 'As passwords não coincidem';
        }
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSave = (ev: React.FormEvent) => {
        ev.preventDefault();
        if (!validate()) return;
        onSave({
            nome, telefone, email, funcaoId, custoHora: Number(custoHora), ativo,
            provinciaId: provinciaId || undefined, municipioId: municipioId || undefined,
            ...(isNew ? { password, passwordConfirm } : {}),
        });
    };

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" style={{ maxWidth: 520 }}>
                <div className="modal-header">
                    <h3 className="modal-title">{tecnico ? 'Editar Técnico' : 'Novo Técnico'}</h3>
                    <button className="modal-close" type="button" onClick={onClose}><X size={13} /></button>
                </div>
                <form onSubmit={handleSave} noValidate>
                    <div className="modal-body">
                        <div className="form-group">
                            <label className="form-label req">Nome</label>
                            <input className={`form-input${errors.nome ? ' err' : ''}`} value={nome}
                                onChange={e => setNome(e.target.value)} placeholder="Nome completo" />
                            {errors.nome && <span className="form-error"><AlertCircle size={11} /> {errors.nome}</span>}
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Telefone</label>
                                <input className="form-input" value={telefone}
                                    onChange={e => setTelefone(e.target.value)} placeholder="9XX XXX XXX" />
                            </div>
                            <div className="form-group">
                                <label className={`form-label${isNew ? ' req' : ''}`}>Email</label>
                                <input type="email" className={`form-input${errors.email ? ' err' : ''}`} value={email}
                                    onChange={e => setEmail(e.target.value)} placeholder="nome@aquatex.ao" />
                                {errors.email && <span className="form-error"><AlertCircle size={11} /> {errors.email}</span>}
                            </div>
                        </div>
                        {/* Issue #68 — credenciais de acesso (criação automática do User) */}
                        {isNew && (
                            <div style={{ padding: '8px 12px', background: '#eff6ff', border: '1px solid #BFDBFE', borderRadius: 4, marginBottom: 8 }}>
                                <div style={{ fontSize: '0.75rem', color: '#1d4ed8', marginBottom: 6 }}>
                                    Será criado automaticamente um utilizador com perfil <strong>Técnico Campo</strong>.
                                    O email acima será o login.
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label req">Password</label>
                                        <input type="password" className={`form-input${errors.password ? ' err' : ''}`}
                                            value={password} onChange={e => setPassword(e.target.value)}
                                            placeholder="Mínimo 6 caracteres" autoComplete="new-password" />
                                        {errors.password && <span className="form-error"><AlertCircle size={11} /> {errors.password}</span>}
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label req">Confirmar password</label>
                                        <input type="password" className={`form-input${errors.passwordConfirm ? ' err' : ''}`}
                                            value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)}
                                            autoComplete="new-password" />
                                        {errors.passwordConfirm && <span className="form-error"><AlertCircle size={11} /> {errors.passwordConfirm}</span>}
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="form-group">
                            <label className="form-label req">Função</label>
                            <select className={`form-select${errors.funcao ? ' err' : ''}`} value={funcaoId}
                                onChange={e => {
                                    setFuncaoId(e.target.value);
                                    const f = funcoes.find(x => x.id === e.target.value);
                                    if (f) setCustoHora(String(f.custo));
                                }}>
                                <option value="">Seleccionar...</option>
                                {funcoes.map(f => <option key={f.id} value={f.id}>{f.descricao}</option>)}
                            </select>
                            {errors.funcao && <span className="form-error"><AlertCircle size={11} /> {errors.funcao}</span>}
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label req">Custo/Hora ({simboloMoeda})</label>
                                <input type="number" min={0} className={`form-input${errors.custo ? ' err' : ''}`}
                                    value={custoHora} onChange={e => setCustoHora(e.target.value)} />
                                {errors.custo && <span className="form-error"><AlertCircle size={11} /> {errors.custo}</span>}
                            </div>
                            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 20 }}>
                                <input type="checkbox" id="tec-ativo" checked={ativo} onChange={e => setAtivo(e.target.checked)} style={{ width: 14, height: 14 }} />
                                <label htmlFor="tec-ativo" style={{ fontSize: '0.82rem', color: 'var(--text-primary)', cursor: 'pointer' }}>Técnico activo</label>
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label"><MapPin size={11} style={{ verticalAlign: 'middle' }} /> Província</label>
                                <select className="form-select" value={provinciaId}
                                    onChange={e => { setProvId(e.target.value); setMunId(''); }}>
                                    <option value="">Seleccionar...</option>
                                    {provincias.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Município</label>
                                <select className="form-select" value={municipioId}
                                    onChange={e => setMunId(e.target.value)} disabled={!provinciaId}>
                                    <option value="">Seleccionar...</option>
                                    {munsFiltrados.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
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

/* ══ Page ════════════════════════════════════════════════ */
const TecnicosPage: React.FC = () => {
    const { tecnicos, addTecnico, updateTecnico, removeTecnico, funcoesTecnico, simboloMoeda, provincias, municipios, ordens, empresaConfig, clientes, equipInstalados, modelosEquipamento } = useGlobal();

    const [search, setSearch]     = useState('');
    const [modal, setModal]       = useState<'new' | string | null>(null);
    const [viewId, setViewId]     = useState<string | null>(null);
    const [showExport, setShowExport] = useState(false);
    const [showRelatorios, setShowRelatorios] = useState(false);

    const handleRemove = async (id: string, nome: string) => {
        if (!window.confirm(`Eliminar o técnico "${nome}"? Esta acção não pode ser desfeita.`)) return;
        try {
            await removeTecnico(id);
            showToast(`Técnico "${nome}" eliminado.`, 'success');
        } catch {
            /* erro já apresentado pelo interceptor global (api.ts) */
        }
    };

    const getFuncaoLabel   = (id: string) => funcoesTecnico.find(f => String(f.id) === String(id))?.descricao ?? id;
    const getProvinciaNome = (id?: string) => provincias.find(p => String(p.id) === String(id))?.nome ?? '';
    const getMunicipioNome = (id?: string) => municipios.find(m => String(m.id) === String(id))?.nome ?? '';

    const filtered = tecnicos.filter(t => {
        const q = search.toLowerCase();
        return !q || t.nome.toLowerCase().includes(q) || t.email.toLowerCase().includes(q);
    });

    const exportData = filtered.map(t => ({
        nome:      t.nome,
        funcao:    funcoesTecnico.find(f => f.id === t.funcaoId)?.descricao ?? t.funcaoId,
        telefone:  t.telefone,
        email:     t.email,
        custoHora: t.custoHora,
        provincia: getProvinciaNome(t.provinciaId),
        municipio: getMunicipioNome(t.municipioId),
        estado:    t.ativo ? 'Activo' : 'Inactivo',
    }));

    const ativos   = tecnicos.filter(t => t.ativo).length;
    const inativos = tecnicos.filter(t => !t.ativo).length;

    const editTarget = typeof modal === 'string' && modal !== 'new' ? tecnicos.find(t => t.id === modal) : undefined;
    const viewTarget = viewId ? tecnicos.find(t => t.id === viewId) : undefined;

    const handleSave = async (data: Omit<Tecnico, 'id'> & { password?: string; passwordConfirm?: string }) => {
        try {
            if (typeof modal === 'string' && modal !== 'new') {
                await updateTecnico(modal, data);
                showToast('Técnico actualizado.', 'success');
            } else {
                const t = await addTecnico(data);
                showToast(`Técnico ${t.id} registado.`, 'success');
            }
            setModal(null);
        } catch {
            /* erro já apresentado pelo interceptor global (api.ts) */
        }
    };

    const EXPORT_COLS: ExportCol[] = [
        { key: 'nome',      label: 'Nome'      },
        { key: 'funcao',    label: 'Função'    },
        { key: 'telefone',  label: 'Telefone'  },
        { key: 'email',     label: 'Email'     },
        { key: 'custoHora', label: `Custo/h (${simboloMoeda})` },
        { key: 'provincia', label: 'Província' },
        { key: 'municipio', label: 'Município' },
        { key: 'estado',    label: 'Estado'    },
    ];

    return (
        <AppLayout>
            <ActionBar title="Técnicos" breadcrumb="AQUATEX SGI · Técnicos">
                <div className="actionbar-spacer" />
                <button className="abtn abtn-secondary" type="button" onClick={() => setShowRelatorios(true)}>
                    <Printer size={13} /> Relatórios
                </button>
                <button className="abtn abtn-secondary" type="button" onClick={() => setShowExport(true)}>
                    <Download size={13} /> Exportar
                </button>
                <button className="abtn abtn-primary" type="button" onClick={() => setModal('new')}>
                    <Plus size={13} /> Novo Técnico
                </button>
            </ActionBar>

            <div className="page-content">
                <div className="stats-row">
                    {[
                        { label: 'Total',    value: tecnicos.length, cls: ''      },
                        { label: 'Activos',  value: ativos,          cls: 'green' },
                        { label: 'Inativos', value: inativos,        cls: 'muted' },
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
                        <input className="search-input" placeholder="Pesquisar por nome ou email..."
                            value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                </div>

                <div className="table-container">
                    <div className="table-scroll">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 20 }} />
                                    <th>Nome</th>
                                    <th>Função</th>
                                    <th>Telefone</th>
                                    <th>Email</th>
                                    <th>Município</th>
                                    <th>Custo/h</th>
                                    <th>Estado</th>
                                    <th style={{ width: 80 }} />
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 && (
                                    <tr><td colSpan={9}><div className="empty-state">Nenhum técnico encontrado.</div></td></tr>
                                )}
                                {filtered.map(t => (
                                    <tr key={t.id} style={{ opacity: t.ativo ? 1 : 0.5 }}>
                                        <td style={{ paddingLeft: 10 }}>
                                            <span className={`dot ${t.ativo ? 'dot-green' : 'dot-gray'}`} />
                                        </td>
                                        <td style={{ fontWeight: 600, fontSize: '0.83rem' }}>{t.nome}</td>
                                        <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{getFuncaoLabel(t.funcaoId)}</td>
                                        <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t.telefone || '—'}</td>
                                        <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t.email || '—'}</td>
                                        <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{getMunicipioNome(t.municipioId) || '—'}</td>
                                        <td style={{ fontSize: '0.78rem' }}>{t.custoHora.toLocaleString('pt-PT')} {simboloMoeda}</td>
                                        <td>
                                            <span style={{ fontSize: '0.75rem', color: t.ativo ? 'var(--green)' : 'var(--text-muted)' }}>
                                                {t.ativo ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="row-actions">
                                                <button className="icon-btn" title="Pré-visualizar" onClick={() => setViewId(t.id)}>
                                                    <Eye size={12} />
                                                </button>
                                                <button className="icon-btn" title="Editar" onClick={() => setModal(t.id)}>
                                                    <Edit2 size={12} />
                                                </button>
                                                <button className="icon-btn icon-btn-danger" title="Eliminar" onClick={() => handleRemove(t.id, t.nome)}>
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="table-count">{filtered.length} técnicos</div>
                </div>
            </div>

            {viewTarget && (
                <TecnicoViewModal
                    tecnico={viewTarget}
                    funcaoNome={getFuncaoLabel(viewTarget.funcaoId)}
                    provinciaNome={getProvinciaNome(viewTarget.provinciaId)}
                    municipioNome={getMunicipioNome(viewTarget.municipioId)}
                    simboloMoeda={simboloMoeda}
                    onClose={() => setViewId(null)}
                    onEdit={() => { setModal(viewTarget.id); setViewId(null); }}
                />
            )}

            {modal !== null && (
                <TecnicoModal
                    tecnico={editTarget}
                    funcoes={funcoesTecnico}
                    onClose={() => setModal(null)}
                    onSave={handleSave}
                />
            )}

            {showRelatorios && (
                <RelatoriosTecnicoModal
                    tecnicos={tecnicos}
                    ordens={ordens}
                    funcoes={funcoesTecnico}
                    clientes={clientes}
                    equipInstalados={equipInstalados}
                    modelos={modelosEquipamento}
                    empresaConfig={empresaConfig}
                    onClose={() => setShowRelatorios(false)}
                />
            )}

            {showExport && (
                <ExportModal
                    title="Técnicos"
                    columns={EXPORT_COLS}
                    data={exportData}
                    filename="tecnicos"
                    onClose={() => setShowExport(false)}
                />
            )}
        </AppLayout>
    );
};

export default TecnicosPage;

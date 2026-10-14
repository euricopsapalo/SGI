import React, { useEffect, useMemo, useState } from 'react';
import { useGlobal } from '../../contexts/GlobalContext';
import { ExportCol } from '../../components/ExportModal';
import { RelatorioVendas, vendasApi } from '../../services/vendas';
import { extractErrorMessage } from '../../utils/errorHandler';

/**
 * #170 — Relatórios de Vendas (v11 fase 7): faturação por período, IVA por
 * taxa, faturação por cliente e por OT (documentos emitidos no intervalo) e
 * contas a receber por antiguidade (pendentes à data de hoje). As NC abatem.
 */

export type VistaVendas = 'periodo' | 'iva' | 'clientes' | 'ots' | 'receber';

const VISTAS: { id: VistaVendas; label: string }[] = [
    { id: 'periodo',  label: 'Por Período'      },
    { id: 'iva',      label: 'IVA por Taxa'     },
    { id: 'clientes', label: 'Por Cliente'      },
    { id: 'ots',      label: 'Por OT'           },
    { id: 'receber',  label: 'Contas a Receber' },
];

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const nomeMes = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1] ?? mes.slice(5, 7)} ${mes.slice(0, 4)}`;

const ACUMULADO: ExportCol[] = [
    { key: 'documentos', label: 'Documentos' },
    { key: 'faturado',   label: 'Faturado (Kz)' },
    { key: 'creditos',   label: 'Notas de Crédito (Kz)' },
    { key: 'iva',        label: 'IVA (Kz)' },
    { key: 'liquido',    label: 'Líquido (Kz)' },
];

/** Colunas de exportação de cada vista (o ExportModal da página usa-as). */
export const COLS_VENDAS: Record<VistaVendas, ExportCol[]> = {
    periodo:  [{ key: 'mesLabel', label: 'Mês' }, ...ACUMULADO],
    iva:      [{ key: 'codigoIva', label: 'Código' }, { key: 'taxa', label: 'Taxa (%)' }, { key: 'incidencia', label: 'Incidência (Kz)' }, { key: 'valor', label: 'IVA (Kz)' }],
    clientes: [{ key: 'nome', label: 'Cliente' }, { key: 'nif', label: 'NIF' }, ...ACUMULADO],
    ots:      [{ key: 'otNumero', label: 'OT' }, { key: 'clienteNome', label: 'Cliente' }, { key: 'documentosLabel', label: 'Documentos' }, ...ACUMULADO.slice(1)],
    receber:  [
        { key: 'nome', label: 'Cliente' }, { key: 'nif', label: 'NIF' }, { key: 'documentos', label: 'Docs.' },
        { key: 'naoVencido', label: 'Não vencido' }, { key: 'ate30', label: '1–30 dias' }, { key: 'ate60', label: '31–60 dias' },
        { key: 'ate90', label: '61–90 dias' }, { key: 'mais90', label: '> 90 dias' }, { key: 'saldoFavor', label: 'Saldo a favor' },
        { key: 'total', label: 'Total (Kz)' },
    ],
};

/** Linhas da vista, no formato das colunas de exportação. */
export function linhasVista(r: RelatorioVendas | null, vista: VistaVendas): Record<string, any>[] {
    if (!r) return [];
    switch (vista) {
        case 'periodo':  return r.porPeriodo.map((p) => ({ ...p, mesLabel: nomeMes(p.mes) }));
        case 'iva':      return r.iva.map((i) => ({ ...i, codigoIva: i.codigoIva ?? '—' }));
        case 'clientes': return r.porCliente;
        case 'ots':      return r.porOt.map((o) => ({ ...o, documentosLabel: o.numeros.join(', ') }));
        case 'receber':  return r.contasReceber.linhas;
    }
}

const numCell: React.CSSProperties = { textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };

const hoje = () => new Date().toLocaleDateString('en-CA');

interface Props {
    /** Avisa a página do que exportar (vista activa e respectivas linhas). */
    onExportavel: (e: { titulo: string; colunas: ExportCol[]; linhas: Record<string, any>[] }) => void;
}

const VendasRelatorioTab: React.FC<Props> = ({ onExportavel }) => {
    const { fmtMoney } = useGlobal();
    const [de, setDe] = useState(() => `${hoje().slice(0, 4)}-01-01`);
    const [ate, setAte] = useState(hoje);
    const [vista, setVista] = useState<VistaVendas>('periodo');
    const [dados, setDados] = useState<RelatorioVendas | null>(null);
    const [erro, setErro] = useState<string | null>(null);
    const [aCarregar, setACarregar] = useState(false);

    useEffect(() => {
        if (!de || !ate) return;
        let activo = true;
        setACarregar(true);
        vendasApi.relatorios({ de, ate })
            .then((r) => { if (activo) { setDados(r); setErro(null); } })
            .catch((e) => { if (activo) setErro(extractErrorMessage(e)); })
            .finally(() => { if (activo) setACarregar(false); });
        return () => { activo = false; };
    }, [de, ate]);

    const linhas = useMemo(() => linhasVista(dados, vista), [dados, vista]);
    const tituloVista = VISTAS.find((v) => v.id === vista)!.label;
    useEffect(() => {
        onExportavel({ titulo: `Vendas — ${tituloVista}`, colunas: COLS_VENDAS[vista], linhas });
    }, [linhas, vista, tituloVista, onExportavel]);

    const t = dados?.totais;
    const kz = (v: number) => fmtMoney(v);
    const vazio = (cols: number, texto: string) => (
        <tr><td colSpan={cols}><div className="empty-state">{texto}</div></td></tr>
    );
    const celulasAcumulado = (a: { documentos: number; faturado: number; creditos: number; iva: number; liquido: number }, comDocs = true) => (
        <>
            {comDocs && <td style={numCell}>{a.documentos}</td>}
            <td style={numCell}>{kz(a.faturado)}</td>
            <td style={{ ...numCell, color: a.creditos ? 'var(--red)' : undefined }}>{a.creditos ? `−${kz(a.creditos)}` : kz(0)}</td>
            <td style={numCell}>{kz(a.iva)}</td>
            <td style={{ ...numCell, fontWeight: 700 }}>{kz(a.liquido)}</td>
        </>
    );
    const cabecalhoAcumulado = (comDocs = true) => (
        <>
            {comDocs && <th style={numCell}>Docs.</th>}
            <th style={numCell}>Faturado</th><th style={numCell}>Notas de Crédito</th><th style={numCell}>IVA</th><th style={numCell}>Líquido</th>
        </>
    );

    return (
        <>
            <div className="filters-bar" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem' }}>
                    De <input type="date" className="filter-select" value={de} max={ate} onChange={(e) => setDe(e.target.value)} aria-label="Data inicial" />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem' }}>
                    Até <input type="date" className="filter-select" value={ate} min={de} onChange={(e) => setAte(e.target.value)} aria-label="Data final" />
                </label>
                <select className="filter-select" value={vista} onChange={(e) => setVista(e.target.value as VistaVendas)} aria-label="Relatório">
                    {VISTAS.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
                </select>
                {aCarregar && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>A carregar…</span>}
            </div>

            {erro && <div role="alert" style={{ color: 'var(--red, #dc2626)', marginBottom: 12 }}>{erro}</div>}

            <div className="stats-row" style={{ marginBottom: 16 }}>
                {[
                    { label: 'Documentos emitidos', value: String(t?.documentos ?? 0) },
                    { label: 'Faturado', value: kz(t?.faturado ?? 0) },
                    { label: 'Notas de Crédito', value: kz(t?.creditos ?? 0), cls: 'muted' },
                    { label: 'Líquido do período', value: kz(t?.liquido ?? 0), cls: 'blue' },
                    { label: 'A receber (hoje)', value: kz(dados?.contasReceber.totais.total ?? 0), cls: 'orange' },
                ].map((s) => (
                    <div key={s.label} className="stat-card">
                        <span className="stat-label">{s.label}</span>
                        <span className={`stat-value ${s.cls ?? ''}`}>{s.value}</span>
                    </div>
                ))}
            </div>

            <div className="table-container">
                <table className="data-table">
                    {vista === 'periodo' && (<>
                        <thead><tr><th>Mês</th>{cabecalhoAcumulado()}</tr></thead>
                        <tbody>
                            {linhas.length === 0 && vazio(6, 'Sem documentos emitidos no período.')}
                            {dados?.porPeriodo.map((p) => <tr key={p.mes}><td>{nomeMes(p.mes)}</td>{celulasAcumulado(p)}</tr>)}
                        </tbody>
                    </>)}

                    {vista === 'iva' && (<>
                        <thead><tr><th>Código</th><th style={numCell}>Taxa</th><th style={numCell}>Incidência</th><th style={numCell}>IVA</th></tr></thead>
                        <tbody>
                            {linhas.length === 0 && vazio(4, 'Sem documentos emitidos no período.')}
                            {dados?.iva.map((i) => (
                                <tr key={`${i.codigoIva}|${i.taxa}`}>
                                    <td style={{ fontFamily: 'monospace' }}>{i.codigoIva ?? '—'}</td>
                                    <td style={numCell}>{i.taxa.toFixed(2)} %</td>
                                    <td style={numCell}>{kz(i.incidencia)}</td>
                                    <td style={{ ...numCell, fontWeight: 700 }}>{kz(i.valor)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </>)}

                    {vista === 'clientes' && (<>
                        <thead><tr><th>Cliente</th><th>NIF</th>{cabecalhoAcumulado()}</tr></thead>
                        <tbody>
                            {linhas.length === 0 && vazio(7, 'Sem documentos emitidos no período.')}
                            {dados?.porCliente.map((c) => (
                                <tr key={c.clienteId}><td>{c.nome}</td><td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{c.nif ?? '—'}</td>{celulasAcumulado(c)}</tr>
                            ))}
                        </tbody>
                    </>)}

                    {vista === 'ots' && (<>
                        <thead><tr><th>OT</th><th>Cliente</th><th>Documentos</th>{cabecalhoAcumulado(false)}</tr></thead>
                        <tbody>
                            {linhas.length === 0 && vazio(7, 'Sem documentos emitidos no período.')}
                            {dados?.porOt.map((o) => (
                                <tr key={o.otId}>
                                    <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{o.otNumero ?? '—'}</td>
                                    <td>{o.clienteNome}</td>
                                    <td style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>{o.numeros.join(', ')}</td>
                                    {celulasAcumulado(o, false)}
                                </tr>
                            ))}
                        </tbody>
                    </>)}

                    {vista === 'receber' && (<>
                        <thead><tr>
                            <th>Cliente</th><th style={numCell}>Docs.</th><th style={numCell}>Não vencido</th><th style={numCell}>1–30 dias</th>
                            <th style={numCell}>31–60 dias</th><th style={numCell}>61–90 dias</th><th style={numCell}>&gt; 90 dias</th>
                            <th style={numCell}>Saldo a favor</th><th style={numCell}>Total</th>
                        </tr></thead>
                        <tbody>
                            {linhas.length === 0 && vazio(9, 'Sem valores pendentes.')}
                            {dados?.contasReceber.linhas.map((c) => (
                                <tr key={c.clienteId}>
                                    <td>{c.nome}</td><td style={numCell}>{c.documentos}</td>
                                    <td style={numCell}>{kz(c.naoVencido)}</td><td style={numCell}>{kz(c.ate30)}</td>
                                    <td style={numCell}>{kz(c.ate60)}</td><td style={numCell}>{kz(c.ate90)}</td>
                                    <td style={{ ...numCell, color: c.mais90 ? 'var(--red)' : undefined }}>{kz(c.mais90)}</td>
                                    <td style={numCell}>{c.saldoFavor ? `−${kz(c.saldoFavor)}` : kz(0)}</td>
                                    <td style={{ ...numCell, fontWeight: 700 }}>{kz(c.total)}</td>
                                </tr>
                            ))}
                            {dados && linhas.length > 0 && (() => {
                                const s = dados.contasReceber.totais;
                                return (
                                    <tr style={{ fontWeight: 700, borderTop: '2px solid var(--panel-border)' }}>
                                        <td>Total</td><td style={numCell}>{s.documentos}</td>
                                        <td style={numCell}>{kz(s.naoVencido)}</td><td style={numCell}>{kz(s.ate30)}</td>
                                        <td style={numCell}>{kz(s.ate60)}</td><td style={numCell}>{kz(s.ate90)}</td>
                                        <td style={numCell}>{kz(s.mais90)}</td><td style={numCell}>{s.saldoFavor ? `−${kz(s.saldoFavor)}` : kz(0)}</td>
                                        <td style={numCell}>{kz(s.total)}</td>
                                    </tr>
                                );
                            })()}
                        </tbody>
                    </>)}
                </table>
                <div className="table-count">
                    {vista === 'receber'
                        ? `${linhas.length} clientes · antiguidade à data de ${dados?.hoje ?? hoje()}`
                        : `${linhas.length} linhas · ${de} a ${ate}`}
                </div>
            </div>
        </>
    );
};

export default VendasRelatorioTab;

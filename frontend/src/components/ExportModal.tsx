import React, { useState } from 'react';
import { X, Download, FileText, Braces, Printer } from 'lucide-react';

export interface ExportCol { key: string; label: string; }

interface Props {
    title: string;
    columns: ExportCol[];
    data: Record<string, any>[];
    filename: string;
    onClose: () => void;
}

type Format = 'csv' | 'json' | 'pdf';

/* ── helpers ── */
function triggerDownload(content: string, filename: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function buildCSV(cols: ExportCol[], rows: Record<string, any>[]): string {
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = cols.map(c => esc(c.label)).join(',');
    const body   = rows.map(r => cols.map(c => esc(r[c.key])).join(','));
    return [header, ...body].join('\r\n');
}

function buildJSON(cols: ExportCol[], rows: Record<string, any>[]): string {
    const filtered = rows.map(r =>
        Object.fromEntries(cols.map(c => [c.key, r[c.key] ?? '']))
    );
    return JSON.stringify(filtered, null, 2);
}

function printPDF(title: string, cols: ExportCol[], rows: Record<string, any>[]) {
    const th = cols.map(c => `<th>${c.label}</th>`).join('');
    const tbody = rows.map(r =>
        `<tr>${cols.map(c => `<td>${r[c.key] ?? ''}</td>`).join('')}</tr>`
    ).join('');

    const html = `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8"/>
<title>${title}</title>
<style>
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
  body  { font-family: Arial, sans-serif; font-size: 11px; margin: 0; padding: 15mm 20mm; color: #111; }
  h2    { font-size: 14px; margin: 0 0 3px; font-weight: 700; }
  p.sub { color: #666; font-size: 10px; margin: 0 0 18px; }
  table { border-collapse: collapse; width: 100%; border: 1px solid #ccc; }
  thead { background: #2B2B2B; }
  th    { background: #2B2B2B; color: #fff; padding: 7px 10px; text-align: left; font-size: 10px; font-weight: 700; letter-spacing: .05em; border: 1px solid #444; }
  td    { padding: 6px 10px; border: 1px solid #ddd; font-size: 10.5px; vertical-align: top; }
  tr:nth-child(even) td { background: #f4f4f4; }
  tr:nth-child(odd)  td { background: #ffffff; }
  .footer { margin-top: 18px; font-size: 9px; color: #999; border-top: 1px solid #e0e0e0; padding-top: 6px; }
  @page { size: A4; margin: 0; }
</style>
</head>
<body>
<h2>${title}</h2>
<p class="sub">Gerado em ${new Date().toLocaleDateString('pt-PT')} ${new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })} · AQUATEX SGI</p>
<table>
  <thead><tr>${th}</tr></thead>
  <tbody>${tbody}</tbody>
</table>
<div class="footer">${rows.length} registos exportados · ${cols.length} colunas</div>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 300);
}

/* ── Component ── */
const FORMAT_OPTIONS: { id: Format; label: string; icon: React.ReactNode; desc: string }[] = [
    { id: 'csv',  label: 'CSV',  icon: <FileText size={14} />, desc: 'Excel / Google Sheets' },
    { id: 'json', label: 'JSON', icon: <Braces   size={14} />, desc: 'Integração / API'       },
    { id: 'pdf',  label: 'PDF',  icon: <Printer  size={14} />, desc: 'Impressão / partilha'   },
];

const ExportModal: React.FC<Props> = ({ title, columns, data, filename, onClose }) => {
    const [format, setFormat]       = useState<Format>('csv');
    const [selected, setSelected]   = useState<Set<string>>(new Set(columns.map(c => c.key)));

    const allChecked = selected.size === columns.length;

    const toggleCol = (key: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    };

    const toggleAll = () =>
        setSelected(allChecked ? new Set() : new Set(columns.map(c => c.key)));

    const activeCols = columns.filter(c => selected.has(c.key));

    const handleExport = () => {
        if (activeCols.length === 0) return;
        const ts = new Date().toISOString().slice(0, 10);
        const base = `${filename}_${ts}`;
        if (format === 'csv') {
            triggerDownload(buildCSV(activeCols, data), `${base}.csv`, 'text/csv;charset=utf-8;');
        } else if (format === 'json') {
            triggerDownload(buildJSON(activeCols, data), `${base}.json`, 'application/json');
        } else {
            printPDF(title, activeCols, data);
        }
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ width: 480, maxWidth: '96vw' }} onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="modal-header">
                    <span className="modal-title"><Download size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Exportar — {title}</span>
                    <button className="modal-close" onClick={onClose}><X size={14} /></button>
                </div>

                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                    {/* Format */}
                    <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                            Formato do ficheiro
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {FORMAT_OPTIONS.map(f => (
                                <button
                                    key={f.id}
                                    type="button"
                                    onClick={() => setFormat(f.id)}
                                    style={{
                                        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                                        gap: 4, padding: '10px 8px', borderRadius: 6, cursor: 'pointer',
                                        border: format === f.id ? '2px solid var(--blue)' : '1px solid var(--border)',
                                        background: format === f.id ? 'var(--blue-light, #EFF6FF)' : 'var(--panel-bg)',
                                        color: format === f.id ? 'var(--blue)' : 'var(--text-secondary)',
                                        transition: 'all 120ms',
                                    }}
                                >
                                    {f.icon}
                                    <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{f.label}</span>
                                    <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>{f.desc}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Columns */}
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Colunas a exportar
                            </span>
                            <button
                                type="button"
                                onClick={toggleAll}
                                style={{ fontSize: '0.72rem', color: 'var(--blue)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                            >
                                {allChecked ? 'Desmarcar todas' : 'Seleccionar todas'}
                            </button>
                        </div>
                        <div style={{
                            display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px 12px',
                            background: 'var(--bg-secondary)', borderRadius: 6, padding: 12,
                            border: '1px solid var(--border)',
                        }}>
                            {columns.map(col => (
                                <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                                    <input
                                        type="checkbox"
                                        checked={selected.has(col.key)}
                                        onChange={() => toggleCol(col.key)}
                                        style={{ accentColor: 'var(--blue)', width: 14, height: 14, flexShrink: 0 }}
                                    />
                                    {col.label}
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Summary */}
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: 5, padding: '7px 12px', border: '1px solid var(--border)' }}>
                        {activeCols.length === 0
                            ? <span style={{ color: 'var(--red)' }}>Seleccione pelo menos uma coluna.</span>
                            : <><strong style={{ color: 'var(--text-primary)' }}>{data.length}</strong> linhas · <strong style={{ color: 'var(--text-primary)' }}>{activeCols.length}</strong> colunas seleccionadas</>
                        }
                    </div>
                </div>

                {/* Footer */}
                <div className="modal-footer">
                    <button className="abtn abtn-ghost" type="button" onClick={onClose}>Cancelar</button>
                    <button
                        className="abtn abtn-primary"
                        type="button"
                        onClick={handleExport}
                        disabled={activeCols.length === 0}
                    >
                        <Download size={13} /> Exportar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExportModal;

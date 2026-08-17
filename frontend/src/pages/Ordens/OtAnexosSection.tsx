import React, { useEffect, useRef, useState, useCallback } from 'react';
import SignaturePad from 'signature_pad';
import { Camera, Trash2, PenLine, RotateCcw, Check } from 'lucide-react';
import api from '../../services/api';

/**
 * #47 — Fotos da intervenção + assinatura digital do cliente numa OT.
 * Auto-contido: busca a lista, faz upload (multipart), captura a assinatura com
 * signature_pad e permite apagar. As imagens estão atrás do JWT, por isso são
 * buscadas como blob autenticado (object URL) em vez de `<img src>` direto.
 */
export interface OtAnexo {
    id: number;
    tipo: 'foto' | 'assinatura';
    path: string;
    nomeOriginal: string | null;
    mime: string;
    tamanho: number;
    createdAt: string;
}

const OtAnexosSection: React.FC<{ otId: number | string }> = ({ otId }) => {
    const [anexos, setAnexos] = useState<OtAnexo[]>([]);
    const [urls, setUrls] = useState<Record<number, string>>({});
    const [busy, setBusy] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const padRef = useRef<SignaturePad | null>(null);
    const urlsRef = useRef<Record<number, string>>({});

    const fotos = anexos.filter(a => a.tipo === 'foto');
    const assinatura = anexos.find(a => a.tipo === 'assinatura');

    /** Busca a lista e resolve cada ficheiro como object URL autenticado. */
    const carregar = useCallback(async () => {
        try {
            const { data } = await api.get<OtAnexo[]>(`/ordens/${otId}/anexos`);
            setAnexos(data);
            const novos: Record<number, string> = {};
            await Promise.all(data.map(async (a) => {
                const resp = await api.get(`/ordens/${otId}/anexos/${a.id}/ficheiro`, { responseType: 'blob' });
                novos[a.id] = URL.createObjectURL(resp.data);
            }));
            // Revoga URLs antigos antes de trocar.
            Object.values(urlsRef.current).forEach(URL.revokeObjectURL);
            urlsRef.current = novos;
            setUrls(novos);
        } catch {
            /* erro já apresentado pelo interceptor global */
        }
    }, [otId]);

    useEffect(() => { carregar(); }, [carregar]);

    // Revoga object URLs ao desmontar.
    useEffect(() => () => { Object.values(urlsRef.current).forEach(URL.revokeObjectURL); }, []);

    // Inicializa o signature_pad quando não há assinatura guardada.
    useEffect(() => {
        if (assinatura || !canvasRef.current) return;
        const canvas = canvasRef.current;
        // Ajusta a resolução do canvas à largura real (nitidez).
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        canvas.getContext('2d')?.scale(ratio, ratio);
        padRef.current = new SignaturePad(canvas, { backgroundColor: 'rgb(255,255,255)' });
        return () => { padRef.current?.off(); padRef.current = null; };
    }, [assinatura]);

    const uploadFotos = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const form = new FormData();
        Array.from(files).forEach(f => form.append('fotos', f));
        setBusy(true);
        try {
            await api.post(`/ordens/${otId}/anexos/fotos`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
            await carregar();
        } catch { /* toast global */ } finally { setBusy(false); }
    };

    const guardarAssinatura = async () => {
        if (!padRef.current || padRef.current.isEmpty()) return;
        const dataUrl = padRef.current.toDataURL('image/png');
        setBusy(true);
        try {
            await api.post(`/ordens/${otId}/anexos/assinatura`, { dataUrl });
            await carregar();
        } catch { /* toast global */ } finally { setBusy(false); }
    };

    const remover = async (anexo: OtAnexo) => {
        // NOTA: usa window.confirm para manter o #47 independente do #46
        // (ConfirmDialog/useConfirm). Migrar para useConfirm após o #46 aterrar no master.
        const msg = anexo.tipo === 'foto'
            ? 'Remover esta foto da intervenção?'
            : 'Remover a assinatura do cliente? Poderá capturar uma nova.';
        if (!window.confirm(msg)) return;
        setBusy(true);
        try {
            await api.delete(`/ordens/${otId}/anexos/${anexo.id}`);
            await carregar();
        } catch { /* toast global */ } finally { setBusy(false); }
    };

    const secHeader = (titulo: string, extra?: React.ReactNode) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid var(--border)' }}>
            <h4 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>{titulo}</h4>
            {extra}
        </div>
    );

    return (
        <>
            {/* — Fotos — */}
            <div style={{ marginBottom: 18 }}>
                {secHeader('Fotos da Intervenção', (
                    <label className="abtn abtn-secondary" style={{ fontSize: '0.75rem', padding: '3px 8px', cursor: busy ? 'default' : 'pointer', margin: 0 }}>
                        <Camera size={11} /> Adicionar
                        <input type="file" accept="image/*" multiple hidden disabled={busy}
                            onChange={e => { uploadFotos(e.target.files); e.target.value = ''; }} />
                    </label>
                ))}
                {fotos.length === 0 ? (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Sem fotos.</div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 8 }}>
                        {fotos.map(f => (
                            <div key={f.id} style={{ position: 'relative', aspectRatio: '1', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden', background: 'var(--bg-secondary)' }}>
                                {urls[f.id] && <img src={urls[f.id]} alt={f.nomeOriginal ?? 'foto'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                                <button type="button" className="icon-btn" title="Remover"
                                    style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(255,255,255,0.9)', color: 'var(--red)' }}
                                    onClick={() => remover(f)}><Trash2 size={12} /></button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* — Assinatura — */}
            <div>
                {secHeader('Assinatura do Cliente')}
                {assinatura ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ border: '1px solid var(--border)', borderRadius: 4, background: '#fff', maxWidth: 360 }}>
                            {urls[assinatura.id] && <img src={urls[assinatura.id]} alt="Assinatura do cliente" style={{ width: '100%', display: 'block' }} />}
                        </div>
                        <button type="button" className="abtn abtn-secondary" style={{ alignSelf: 'flex-start', fontSize: '0.75rem' }}
                            onClick={() => remover(assinatura)} disabled={busy}>
                            <RotateCcw size={11} /> Substituir assinatura
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <PenLine size={12} /> Assine no quadro abaixo (rato ou toque no tablet).
                        </div>
                        <canvas ref={canvasRef} style={{ width: '100%', maxWidth: 360, height: 140, border: '1px solid var(--border)', borderRadius: 4, background: '#fff', touchAction: 'none' }} />
                        <div style={{ display: 'flex', gap: 6 }}>
                            <button type="button" className="abtn abtn-secondary" style={{ fontSize: '0.75rem' }}
                                onClick={() => padRef.current?.clear()} disabled={busy}>
                                <RotateCcw size={11} /> Limpar
                            </button>
                            <button type="button" className="abtn abtn-primary" style={{ fontSize: '0.75rem' }}
                                onClick={guardarAssinatura} disabled={busy}>
                                <Check size={11} /> Guardar assinatura
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default OtAnexosSection;

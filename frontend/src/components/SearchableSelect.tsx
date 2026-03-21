import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SearchableOption {
    value: string;
    label: string;
    sub?: string;
}

interface SearchableSelectProps {
    options: SearchableOption[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
    options, value, onChange, placeholder = 'Selecionar...', disabled = false,
}) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
    const ref = useRef<HTMLDivElement>(null);
    const btnRef = useRef<HTMLButtonElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
                setSearch('');
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => {
        if (open) setTimeout(() => inputRef.current?.focus(), 30);
    }, [open]);

    const handleToggle = () => {
        if (disabled) return;
        if (!open && btnRef.current) {
            const r = btnRef.current.getBoundingClientRect();
            setDropPos({ top: r.bottom + 2, left: r.left, width: r.width });
        }
        setOpen(o => !o);
    };

    const filtered = options.filter(o =>
        o.label.toLowerCase().includes(search.toLowerCase()) ||
        (o.sub && o.sub.toLowerCase().includes(search.toLowerCase()))
    );

    const selected = options.find(o => o.value === value);

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button
                ref={btnRef}
                type="button"
                disabled={disabled}
                onClick={handleToggle}
                style={{
                    width: '100%', textAlign: 'left',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '6px 10px', border: '1px solid var(--border)',
                    borderRadius: 4, background: disabled ? 'var(--bg-subtle,#f8f9fa)' : 'var(--panel-bg,#fff)',
                    cursor: disabled ? 'default' : 'pointer',
                    fontSize: '0.82rem', fontFamily: 'inherit',
                    color: selected ? 'var(--text-primary)' : 'var(--text-muted)',
                    outline: 'none',
                    boxSizing: 'border-box',
                }}
            >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {selected?.label || placeholder}
                </span>
                <ChevronDown size={12} style={{ flexShrink: 0, marginLeft: 6, color: 'var(--text-muted)' }} />
            </button>

            {open && (
                <div style={{
                    position: 'fixed', top: dropPos.top, left: dropPos.left, width: dropPos.width,
                    zIndex: 1200, background: 'var(--panel-bg,#fff)',
                    border: '1px solid var(--border)', borderRadius: 4,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.13)',
                }}>
                    <div style={{ padding: '6px', borderBottom: '1px solid var(--border)' }}>
                        <input
                            ref={inputRef}
                            style={{
                                width: '100%', padding: '5px 8px', border: '1px solid var(--border)',
                                borderRadius: 3, fontSize: '0.8rem', fontFamily: 'inherit',
                                outline: 'none', background: 'var(--bg-subtle,#f8f9fa)',
                                boxSizing: 'border-box',
                            }}
                            placeholder="Pesquisar..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            onClick={e => e.stopPropagation()}
                        />
                    </div>
                    <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                        {filtered.length === 0 ? (
                            <div style={{ padding: '8px 10px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                Sem resultados
                            </div>
                        ) : filtered.map(o => (
                            <div
                                key={o.value}
                                role="option"
                                onClick={() => { onChange(o.value); setOpen(false); setSearch(''); }}
                                style={{
                                    padding: '7px 10px', cursor: 'pointer',
                                    background: o.value === value ? 'var(--blue-light,#eff6ff)' : 'transparent',
                                    borderLeft: `2px solid ${o.value === value ? 'var(--blue)' : 'transparent'}`,
                                }}
                                onMouseEnter={e => { if (o.value !== value) (e.currentTarget as HTMLElement).style.background = 'var(--bg-subtle,#f8f9fa)'; }}
                                onMouseLeave={e => { if (o.value !== value) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                            >
                                <div style={{ fontSize: '0.82rem', fontWeight: o.value === value ? 600 : 400 }}>{o.label}</div>
                                {o.sub && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 1 }}>{o.sub}</div>}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;

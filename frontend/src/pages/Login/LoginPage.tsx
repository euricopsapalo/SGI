import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';
import logo from '../../assets/aquatex-logo.png';

const LoginPage: React.FC = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!email || !password) { setError('Por favor preencha todos os campos.'); return; }
        setLoading(true);
        // Simulate auth (replace with real API call)
        await new Promise(r => setTimeout(r, 900));
        if (email === 'admin@aquatex.ao' && password === 'admin123') {
            navigate('/dashboard');
        } else {
            setError('Email ou password incorretos.');
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: '#F0F2F5',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
        }}>

            {/* Card */}
            <div style={{
                background: '#fff',
                border: '1px solid #D4D7DC',
                borderRadius: 6,
                width: '100%',
                maxWidth: 400,
                boxShadow: '0 2px 12px rgba(0,0,0,0.10)',
                overflow: 'hidden',
            }}>

                {/* Header */}
                <div style={{
                    background: '#2B2B2B',
                    padding: '28px 32px 24px',
                    textAlign: 'center',
                }}>
                    <img
                        src={logo}
                        alt="AQUATEX"
                        style={{
                            height: 42, width: 'auto', objectFit: 'contain',
                            filter: 'brightness(0) invert(1)',
                            opacity: 0.92,
                            display: 'block',
                            margin: '0 auto 10px',
                        }}
                    />
                    <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>
                        Sistema de Gestão Integrado
                    </p>
                </div>

                {/* Form */}
                <div style={{ padding: '28px 32px' }}>
                    <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#1C1C1C', marginBottom: 20 }}>
                        Iniciar Sessão
                    </h2>

                    <form onSubmit={handleSubmit} noValidate>
                        {/* Error */}
                        {error && (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                background: '#FFEBEE', border: '1px solid #FFCDD2',
                                borderRadius: 4, padding: '8px 12px', marginBottom: 16,
                                fontSize: '0.8rem', color: '#C62828',
                            }}>
                                <AlertCircle size={14} />
                                {error}
                            </div>
                        )}

                        {/* Email */}
                        <div style={{ marginBottom: 14 }}>
                            <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#555', marginBottom: 4, letterSpacing: '0.02em' }}>
                                Email
                            </label>
                            <input
                                type="email"
                                autoComplete="username"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="utilizador@aquatex.ao"
                                style={{
                                    height: 36, width: '100%', padding: '0 12px',
                                    border: '1px solid #D4D7DC', borderRadius: 4,
                                    fontSize: '0.85rem', fontFamily: 'inherit',
                                    color: '#1C1C1C', background: '#fff', outline: 'none',
                                    boxSizing: 'border-box',
                                }}
                                onFocus={e => (e.target.style.borderColor = '#0D6EBF')}
                                onBlur={e => (e.target.style.borderColor = '#D4D7DC')}
                            />
                        </div>

                        {/* Password */}
                        <div style={{ marginBottom: 20 }}>
                            <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#555', marginBottom: 4, letterSpacing: '0.02em' }}>
                                Password
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showPw ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    style={{
                                        height: 36, width: '100%', padding: '0 36px 0 12px',
                                        border: '1px solid #D4D7DC', borderRadius: 4,
                                        fontSize: '0.85rem', fontFamily: 'inherit',
                                        color: '#1C1C1C', background: '#fff', outline: 'none',
                                        boxSizing: 'border-box',
                                    }}
                                    onFocus={e => (e.target.style.borderColor = '#0D6EBF')}
                                    onBlur={e => (e.target.style.borderColor = '#D4D7DC')}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPw(p => !p)}
                                    style={{
                                        position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                                        background: 'none', border: 'none', cursor: 'pointer',
                                        color: '#888', padding: 0, lineHeight: 1,
                                    }}
                                >
                                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                            </div>
                            <div style={{ textAlign: 'right', marginTop: 6 }}>
                                <a href="#" style={{ fontSize: '0.75rem', color: '#0D6EBF' }}>Esqueceu a password?</a>
                            </div>
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                width: '100%', height: 38,
                                background: loading ? '#76b5e0' : '#0D6EBF',
                                border: 'none', borderRadius: 4,
                                color: '#fff', fontSize: '0.88rem', fontWeight: 700,
                                fontFamily: 'inherit', cursor: loading ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                transition: 'background 150ms',
                            }}
                        >
                            {loading ? (
                                <>
                                    <span style={{
                                        width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)',
                                        borderTopColor: '#fff', borderRadius: '50%',
                                        display: 'inline-block', animation: 'spin 0.7s linear infinite',
                                    }} />
                                    A autenticar...
                                </>
                            ) : (
                                <><LogIn size={14} /> Entrar</>
                            )}
                        </button>
                    </form>

                    {/* Hint */}
                    <p style={{ marginTop: 20, textAlign: 'center', fontSize: '0.72rem', color: '#aaa' }}>
                        Demo: admin@aquatex.ao / admin123
                    </p>
                </div>
            </div>

            {/* Footer */}
            <p style={{ marginTop: 20, fontSize: '0.72rem', color: '#aaa' }}>
                © 2026 AQUATEX, LDA — Sistema de Gestão de Serviços Técnicos
            </p>

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

export default LoginPage;

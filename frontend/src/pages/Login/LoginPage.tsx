import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import AquatexLogo from '../../components/AquatexLogo';
import { useGlobal } from '../../contexts/GlobalContext';
import api from '../../services/api';
const ROLE_MAP: Record<string, string> = {
    admin: 'Administrador', suporte: 'Suporte',
    campo: 'Técnico de Campo', vendedor: 'Vendedor',
};
type View = 'login' | 'forgot' | 'reset';

const LoginPage: React.FC = () => {
    const navigate = useNavigate();
    const { setCurrentUser, addLog } = useGlobal();
    const [view, setView]               = useState<View>('login');
    const [email, setEmail]             = useState('');
    const [password, setPassword]       = useState('');
    const [showPw, setShowPw]           = useState(false);
    const [loading, setLoading]         = useState(false);
    const [error, setError]             = useState('');
    const [success, setSuccess]         = useState('');
    const [forgotEmail, setForgotEmail] = useState('');
    const [resetToken, setResetToken]   = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [showNewPw, setShowNewPw]     = useState(false);

    const go = (v: View) => { setView(v); setError(''); setSuccess(''); };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault(); setError('');
        if (!email || !password) { setError('Por favor preencha todos os campos.'); return; }
        setLoading(true);
        try {
            const { data } = await api.post('/auth/login', { email, password });
            const user = { nome: data.user.nome, email: data.user.email, role: ROLE_MAP[data.user.role] || data.user.role };
            setCurrentUser(user);
            localStorage.setItem('sgi_token', data.access_token);
            addLog({ usuario: user.email, modulo: 'Autenticação', acao: 'Login', detalhes: `Utilizador: ${user.nome} (${user.role})`, tipo: 'info' });
            navigate('/dashboard');
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Email ou password incorretos.');
            setLoading(false);
        }
    };

    const handleForgot = async (e: React.FormEvent) => {
        e.preventDefault(); setError(''); setSuccess('');
        if (!forgotEmail) { setError('Introduza o seu email.'); return; }
        setLoading(true);
        try {
            await api.post('/auth/forgot-password', { email: forgotEmail });
            setSuccess('Se o email existir, receberá um código de recuperação. Verifique a sua caixa de entrada.');
            setTimeout(() => go('reset'), 3500);
        } catch { setError('Erro ao processar o pedido. Tente novamente.'); }
        finally { setLoading(false); }
    };

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault(); setError(''); setSuccess('');
        if (!resetToken || !newPassword) { setError('Preencha o token e a nova password.'); return; }
        if (newPassword.length < 6) { setError('A password deve ter pelo menos 6 caracteres.'); return; }
        setLoading(true);
        try {
            await api.post('/auth/reset-password', { token: resetToken, newPassword });
            setSuccess('Password alterada com sucesso! Redirecionando...');
            setTimeout(() => go('login'), 2500);
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Token inválido ou expirado.');
        } finally { setLoading(false); }
    };

    const iSt: React.CSSProperties = { height: 36, width: '100%', padding: '0 12px', border: '1px solid #D4D7DC', borderRadius: 4, fontSize: '0.85rem', fontFamily: 'inherit', color: '#1C1C1C', background: '#fff', outline: 'none', boxSizing: 'border-box' };
    const lSt: React.CSSProperties = { display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#555', marginBottom: 4 };
    const hFocus = (e: React.FocusEvent<HTMLInputElement>) => (e.target.style.borderColor = '#0D6EBF');
    const hBlur  = (e: React.FocusEvent<HTMLInputElement>) => (e.target.style.borderColor = '#D4D7DC');

    return (
        <div style={{ minHeight: '100vh', background: '#F0F2F5', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div style={{ background: '#fff', border: '1px solid #D4D7DC', borderRadius: 6, width: '100%', maxWidth: 400, boxShadow: '0 2px 12px rgba(0,0,0,0.10)', overflow: 'hidden' }}>
                <div style={{ background: '#2B2B2B', padding: '28px 32px 24px', textAlign: 'center' }}>
                    <AquatexLogo height={48} style={{ margin: '0 auto 10px' }} />
                    <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>Sistema de Gestão de Intervenções</p>
                </div>
                <div style={{ padding: '28px 32px' }}>

                    {view === 'login' && (
                        <>
                            <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#1C1C1C', marginBottom: 20 }}>Iniciar Sessão</h2>
                            <form onSubmit={handleLogin} noValidate>
                                {error && <Msg type="error" text={error} />}
                                <div style={{ marginBottom: 14 }}>
                                    <label style={lSt}>Email</label>
                                    <input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} placeholder="utilizador@aquatex.ao" style={iSt} onFocus={hFocus} onBlur={hBlur} />
                                </div>
                                <div style={{ marginBottom: 20 }}>
                                    <label style={lSt}>Password</label>
                                    <div style={{ position: 'relative' }}>
                                        <input type={showPw ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={{ ...iSt, padding: '0 36px 0 12px' }} onFocus={hFocus} onBlur={hBlur} />
                                        <button type="button" onClick={() => setShowPw(p => !p)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#888', padding: 0 }}>{showPw ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                                    </div>
                                    <div style={{ textAlign: 'right', marginTop: 6 }}>
                                        <button type="button" onClick={() => go('forgot')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: '#0D6EBF', padding: 0 }}>Esqueceu a password?</button>
                                    </div>
                                </div>
                                <Btn loading={loading} label="Entrar" icon={<LogIn size={14} />} />
                            </form>
                        </>
                    )}

                    {view === 'forgot' && (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                                <button type="button" onClick={() => go('login')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 0, display: 'flex' }}><ArrowLeft size={16} /></button>
                                <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#1C1C1C', margin: 0 }}>Recuperar Password</h2>
                            </div>
                            <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: 18 }}>Introduza o seu email para receber um token de recuperação.</p>
                            <form onSubmit={handleForgot} noValidate>
                                {error && <Msg type="error" text={error} />}
                                {success && <Msg type="success" text={success} />}
                                <div style={{ marginBottom: 20 }}>
                                    <label style={lSt}>Email</label>
                                    <input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} placeholder="utilizador@aquatex.ao" style={iSt} onFocus={hFocus} onBlur={hBlur} />
                                </div>
                                <Btn loading={loading} label="Gerar Token de Recuperação" />
                                <div style={{ textAlign: 'center', marginTop: 12 }}>
                                    <button type="button" onClick={() => go('reset')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: '#0D6EBF' }}>Já tenho um token</button>
                                </div>
                            </form>
                        </>
                    )}

                    {view === 'reset' && (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                                <button type="button" onClick={() => go('forgot')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 0, display: 'flex' }}><ArrowLeft size={16} /></button>
                                <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#1C1C1C', margin: 0 }}>Nova Password</h2>
                            </div>
                            <form onSubmit={handleReset} noValidate>
                                {error && <Msg type="error" text={error} />}
                                {success && <Msg type="success" text={success} />}
                                <div style={{ marginBottom: 14 }}>
                                    <label style={lSt}>Token de Recuperação</label>
                                    <input type="text" value={resetToken} onChange={e => setResetToken(e.target.value.toUpperCase())} placeholder="Ex: A3B9F2KX" style={{ ...iSt, fontFamily: 'monospace', letterSpacing: '0.1em' }} onFocus={hFocus} onBlur={hBlur} />
                                </div>
                                <div style={{ marginBottom: 20 }}>
                                    <label style={lSt}>Nova Password</label>
                                    <div style={{ position: 'relative' }}>
                                        <input type={showNewPw ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" style={{ ...iSt, padding: '0 36px 0 12px' }} onFocus={hFocus} onBlur={hBlur} />
                                        <button type="button" onClick={() => setShowNewPw(p => !p)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#888', padding: 0 }}>{showNewPw ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                                    </div>
                                </div>
                                <Btn loading={loading} label="Alterar Password" />
                            </form>
                        </>
                    )}

                </div>
            </div>
            <p style={{ marginTop: 20, fontSize: '0.72rem', color: '#aaa' }}>© 2026 AQUATEX, LDA — Sistema de Gestão de Intervenções</p>
            <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
        </div>
    );
};

const Msg: React.FC<{ type: 'error' | 'success'; text: string }> = ({ type, text }) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: type === 'error' ? '#FFEBEE' : '#E8F5E9', border: `1px solid ${type === 'error' ? '#FFCDD2' : '#C8E6C9'}`, borderRadius: 4, padding: '8px 12px', marginBottom: 16, fontSize: '0.8rem', color: type === 'error' ? '#C62828' : '#2E7D32' }}>
        {type === 'error' ? <AlertCircle size={14} style={{ marginTop: 1, flexShrink: 0 }} /> : <CheckCircle size={14} style={{ marginTop: 1, flexShrink: 0 }} />}
        <span>{text}</span>
    </div>
);

const Btn: React.FC<{ loading: boolean; label: string; icon?: React.ReactNode }> = ({ loading, label, icon }) => (
    <button type="submit" disabled={loading} style={{ width: '100%', height: 38, background: loading ? '#76b5e0' : '#0D6EBF', border: 'none', borderRadius: 4, color: '#fff', fontSize: '0.88rem', fontWeight: 700, fontFamily: 'inherit', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background 150ms' }}>
        {loading ? <><span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />A processar...</> : <>{icon}{label}</>}
    </button>
);

export default LoginPage;

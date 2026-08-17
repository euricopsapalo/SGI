import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';
import { GlobalProvider, useGlobal } from './contexts/GlobalContext';
import GlobalToast from './components/GlobalToast';
import RouteFallback from './components/RouteFallback';

/* Pages — carregadas por rota via React.lazy (#42) para dividir o bundle.
   Cada página vira um chunk separado, pedido só quando a rota é visitada. */
const LoginPage = lazy(() => import('./pages/Login/LoginPage'));
const DashboardPage = lazy(() => import('./pages/Dashboard/DashboardPage'));
const ClientesPage = lazy(() => import('./pages/Clientes/ClientesPage'));
const TecnicosPage = lazy(() => import('./pages/Tecnicos/TecnicosPage'));
const FornecedoresPage = lazy(() => import('./pages/Fornecedores/FornecedoresPage'));
const ParquePage = lazy(() => import('./pages/Parque/ParquePage'));
const PlanosPage = lazy(() => import('./pages/Planos/PlanosPage'));
const OrdensPage = lazy(() => import('./pages/Ordens/OrdensPage'));
const AgendaPage = lazy(() => import('./pages/Agenda/AgendaPage'));
const EncomendaPage = lazy(() => import('./pages/Encomendas/EncomendaPage'));
const StockPage = lazy(() => import('./pages/Stock/StockPage'));
const FaturacaoPage = lazy(() => import('./pages/Faturacao/FaturacaoPage'));
const UtilizadoresPage = lazy(() => import('./pages/Utilizadores/UtilizadoresPage'));
const RelatoriosPage = lazy(() => import('./pages/Relatorios/RelatoriosPage'));
const ConfiguracoesPage = lazy(() => import('./pages/Configuracoes/ConfiguracoesPage'));
const LogsPage = lazy(() => import('./pages/Logs/LogsPage'));

/* Requires authentication — redirects to /login if no user */
function AuthGuard({ children }: { children: React.ReactElement }) {
  const { currentUser } = useGlobal();
  const token = localStorage.getItem('sgi_token');
  if (!token && !currentUser) return <Navigate to="/login" replace />;
  return children;
}

/* Blocks routes for Técnico de Campo — redirects to /ordens */
function TecnicoGuard({ children }: { children: React.ReactElement }) {
  const { currentUser } = useGlobal();
  return currentUser?.role === 'Técnico de Campo'
    ? <Navigate to="/ordens" replace />
    : children;
}

function App() {
  return (
    <GlobalProvider>
      <GlobalToast />
      <BrowserRouter>
        <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/"         element={<Navigate to="/login" replace />} />

          <Route path="/dashboard"    element={<AuthGuard><DashboardPage /></AuthGuard>} />
          <Route path="/clientes"     element={<AuthGuard><TecnicoGuard><ClientesPage /></TecnicoGuard></AuthGuard>} />
          <Route path="/tecnicos"     element={<AuthGuard><TecnicoGuard><TecnicosPage /></TecnicoGuard></AuthGuard>} />
          <Route path="/fornecedores" element={<AuthGuard><TecnicoGuard><FornecedoresPage /></TecnicoGuard></AuthGuard>} />
          <Route path="/parque"       element={<AuthGuard><TecnicoGuard><ParquePage /></TecnicoGuard></AuthGuard>} />
          <Route path="/planos"       element={<AuthGuard><TecnicoGuard><PlanosPage /></TecnicoGuard></AuthGuard>} />
          <Route path="/ordens"       element={<AuthGuard><OrdensPage /></AuthGuard>} />
          <Route path="/agenda"       element={<AuthGuard><AgendaPage /></AuthGuard>} />
          <Route path="/compras"      element={<AuthGuard><TecnicoGuard><EncomendaPage /></TecnicoGuard></AuthGuard>} />
          <Route path="/stock"        element={<AuthGuard><TecnicoGuard><StockPage /></TecnicoGuard></AuthGuard>} />
          <Route path="/faturacao"    element={<AuthGuard><TecnicoGuard><FaturacaoPage /></TecnicoGuard></AuthGuard>} />
          <Route path="/utilizadores" element={<AuthGuard><TecnicoGuard><UtilizadoresPage /></TecnicoGuard></AuthGuard>} />
          <Route path="/relatorios"   element={<AuthGuard><TecnicoGuard><RelatoriosPage /></TecnicoGuard></AuthGuard>} />
          <Route path="/logs"         element={<AuthGuard><TecnicoGuard><LogsPage /></TecnicoGuard></AuthGuard>} />
          <Route path="/configuracoes" element={<AuthGuard><TecnicoGuard><ConfiguracoesPage /></TecnicoGuard></AuthGuard>} />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </GlobalProvider>
  );
}

export default App;

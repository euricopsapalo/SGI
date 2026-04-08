import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';
import { GlobalProvider, useGlobal } from './contexts/GlobalContext';

/* Pages */
import LoginPage from './pages/Login/LoginPage';
import DashboardPage from './pages/Dashboard/DashboardPage';
import ClientesPage from './pages/Clientes/ClientesPage';
import TecnicosPage from './pages/Tecnicos/TecnicosPage';
import FornecedoresPage from './pages/Fornecedores/FornecedoresPage';
import ParquePage from './pages/Parque/ParquePage';
import PlanosPage from './pages/Planos/PlanosPage';
import OrdensPage from './pages/Ordens/OrdensPage';
import AgendaPage from './pages/Agenda/AgendaPage';
import EncomendaPage from './pages/Encomendas/EncomendaPage';
import StockPage from './pages/Stock/StockPage';
import FaturacaoPage from './pages/Faturacao/FaturacaoPage';
import UtilizadoresPage from './pages/Utilizadores/UtilizadoresPage';
import RelatoriosPage from './pages/Relatorios/RelatoriosPage';
import ConfiguracoesPage from './pages/Configuracoes/ConfiguracoesPage';
import LogsPage from './pages/Logs/LogsPage';

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
      <BrowserRouter>
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
      </BrowserRouter>
    </GlobalProvider>
  );
}

export default App;

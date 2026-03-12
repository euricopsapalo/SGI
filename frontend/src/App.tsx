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

          <Route path="/dashboard"    element={<DashboardPage />} />
          <Route path="/clientes"     element={<TecnicoGuard><ClientesPage /></TecnicoGuard>} />
          <Route path="/tecnicos"     element={<TecnicoGuard><TecnicosPage /></TecnicoGuard>} />
          <Route path="/fornecedores" element={<TecnicoGuard><FornecedoresPage /></TecnicoGuard>} />
          <Route path="/parque"       element={<TecnicoGuard><ParquePage /></TecnicoGuard>} />
          <Route path="/planos"       element={<TecnicoGuard><PlanosPage /></TecnicoGuard>} />
          <Route path="/ordens"       element={<OrdensPage />} />
          <Route path="/agenda"       element={<AgendaPage />} />
          <Route path="/encomendas"   element={<TecnicoGuard><EncomendaPage /></TecnicoGuard>} />
          <Route path="/stock"        element={<TecnicoGuard><StockPage /></TecnicoGuard>} />
          <Route path="/faturacao"    element={<TecnicoGuard><FaturacaoPage /></TecnicoGuard>} />
          <Route path="/utilizadores" element={<TecnicoGuard><UtilizadoresPage /></TecnicoGuard>} />
          <Route path="/relatorios"   element={<TecnicoGuard><RelatoriosPage /></TecnicoGuard>} />
          <Route path="/logs"         element={<TecnicoGuard><LogsPage /></TecnicoGuard>} />
          <Route path="/configuracoes" element={<TecnicoGuard><ConfiguracoesPage /></TecnicoGuard>} />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </GlobalProvider>
  );
}

export default App;

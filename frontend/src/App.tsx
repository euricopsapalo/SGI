import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';

/* Pages */
import LoginPage from './pages/Login/LoginPage';
import DashboardPage from './pages/Dashboard/DashboardPage';
import ClientesPage from './pages/Clientes/ClientesPage';
import OrdensPage from './pages/Ordens/OrdensPage';
import StockPage from './pages/Stock/StockPage';
import AgendaPage from './pages/Agenda/AgendaPage';
import FaturacaoPage from './pages/Faturacao/FaturacaoPage';
import RelatoriosPage from './pages/Relatorios/RelatoriosPage';
import UtilizadoresPage from './pages/Utilizadores/UtilizadoresPage';
import ConfiguracoesPage from './pages/Configuracoes/ConfiguracoesPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth */}
        <Route path="/login" element={<LoginPage />} />

        {/* Redirect root → login */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* App modules */}
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/clientes" element={<ClientesPage />} />
        <Route path="/ordens" element={<OrdensPage />} />
        <Route path="/stock" element={<StockPage />} />
        <Route path="/agenda" element={<AgendaPage />} />
        <Route path="/faturacao" element={<FaturacaoPage />} />
        <Route path="/relatorios" element={<RelatoriosPage />} />

        {/* Admin modules */}
        <Route path="/utilizadores" element={<UtilizadoresPage />} />
        <Route path="/configuracoes" element={<ConfiguracoesPage />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { PwaPrompt } from './components/PwaPrompt';
import { initOneSignal, loginOneSignal } from './lib/onesignal';

import Login from './pages/Login';
import Reservar from './pages/socio/Reservar';
import MisTurnos from './pages/socio/MisTurnos';
import Agenda from './pages/socio/Agenda';
import PagoExitoso from './pages/socio/PagoExitoso';
import ReservasAdmin from './pages/admin/ReservasAdmin';
import SociosAdmin from './pages/admin/SociosAdmin';
import ReportesAdmin from './pages/admin/ReportesAdmin';
import NoticiasAdmin from './pages/admin/NoticiasAdmin';

const ProtectedRoute = ({ children, requiredRole }: { children: JSX.Element, requiredRole?: 'socio' | 'admin' }) => {
  const { user, socio, loading } = useAuth();

  if (loading) return <div className="p-10 text-center">Cargando...</div>;
  
  if (!user || !socio) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && socio.rol !== requiredRole) {
    return <Navigate to={socio.rol === 'admin' ? '/admin/reservas' : '/reservar'} replace />;
  }

  return children;
};


const AppRoutes = () => {
  const { socio } = useAuth();
  
  useEffect(() => {
    if (socio) {
      // Esperamos que init termine antes de vincular el usuario
      initOneSignal().then(() => loginOneSignal(String(socio.dni)));
    }
  }, [socio]);

  return (
    <Routes>
      <Route path="/" element={<Navigate to={socio ? (socio.rol === 'admin' ? '/admin/reservas' : '/reservar') : '/login'} replace />} />
      <Route path="/login" element={<Login />} />
      
      {/* Socio Routes */}
      <Route path="/reservar" element={
        <ProtectedRoute requiredRole="socio"><Layout><Reservar /></Layout></ProtectedRoute>
      } />
      <Route path="/mis-turnos" element={
        <ProtectedRoute requiredRole="socio"><Layout><MisTurnos /></Layout></ProtectedRoute>
      } />
      <Route path="/agenda" element={
        <ProtectedRoute requiredRole="socio"><Layout><Agenda /></Layout></ProtectedRoute>
      } />
      <Route path="/pago-exitoso" element={
        <ProtectedRoute requiredRole="socio"><Layout><PagoExitoso /></Layout></ProtectedRoute>
      } />

      {/* Admin Routes */}
      <Route path="/admin/reservas" element={
        <ProtectedRoute requiredRole="admin"><Layout><ReservasAdmin /></Layout></ProtectedRoute>
      } />
      <Route path="/admin/socios" element={
        <ProtectedRoute requiredRole="admin"><Layout><SociosAdmin /></Layout></ProtectedRoute>
      } />
      <Route path="/admin/reportes" element={
        <ProtectedRoute requiredRole="admin"><Layout><ReportesAdmin /></Layout></ProtectedRoute>
      } />
      <Route path="/admin/noticias" element={
        <ProtectedRoute requiredRole="admin"><Layout><NoticiasAdmin /></Layout></ProtectedRoute>
      } />
    </Routes>
  );
};

export default function App() {
  useEffect(() => {
    initOneSignal();
  }, []);

  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
        <PwaPrompt />
      </Router>
    </AuthProvider>
  );
}

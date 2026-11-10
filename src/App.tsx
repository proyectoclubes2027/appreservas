import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { PwaPrompt } from './components/PwaPrompt';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initOneSignal, loginOneSignal } from './lib/onesignal';

import Login from './pages/Login';
import Reservar from './pages/socio/Reservar';
import MisTurnos from './pages/socio/MisTurnos';
import Agenda from './pages/socio/Agenda';
import PagoExitoso from './pages/socio/PagoExitoso';
import MiCuenta from './pages/socio/MiCuenta';
import ReservasAdmin from './pages/admin/ReservasAdmin';
import SociosAdmin from './pages/admin/SociosAdmin';
import GestionAdmin from './pages/admin/GestionAdmin';
import NoticiasAdmin from './pages/admin/NoticiasAdmin';
import ValidarTurnoDirecto from './pages/socio/ValidarTurnoDirecto';

const ProtectedRoute = ({ children, allowedRoles }: { children: JSX.Element, allowedRoles?: Array<'socio' | 'admin' | 'profesor'> }) => {
  const { user, socio, loading } = useAuth();

  if (loading) return <div className="p-10 text-center">Cargando...</div>;
  
  if (!user || !socio) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(socio.rol)) {
    return <Navigate to={socio.rol === 'admin' || socio.rol === 'profesor' ? '/admin/reservas' : '/reservar'} replace />;
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
      <Route path="/" element={<Navigate to={socio ? (socio.rol === 'admin' || socio.rol === 'profesor' ? '/admin/reservas' : '/reservar') : '/login'} replace />} />
      <Route path="/login" element={<Login />} />
      
      {/* Ruta directa para escanear QR con la cámara de fotos (iPhone y Android) */}
      <Route path="/validar" element={<ValidarTurnoDirecto />} />

      {/* Socio Routes */}
      <Route path="/reservar" element={
        <ProtectedRoute allowedRoles={['socio']}><Layout><Reservar /></Layout></ProtectedRoute>
      } />
      <Route path="/mis-turnos" element={
        <ProtectedRoute allowedRoles={['socio']}><Layout><MisTurnos /></Layout></ProtectedRoute>
      } />
      <Route path="/agenda" element={
        <ProtectedRoute allowedRoles={['socio']}><Layout><Agenda /></Layout></ProtectedRoute>
      } />
      <Route path="/mi-cuenta" element={
        <ProtectedRoute allowedRoles={['socio', 'profesor']}><Layout><MiCuenta /></Layout></ProtectedRoute>
      } />
      <Route path="/pago-exitoso" element={
        <ProtectedRoute allowedRoles={['socio']}><Layout><PagoExitoso /></Layout></ProtectedRoute>
      } />

      {/* Admin / Profesor Routes */}
      <Route path="/admin/reservas" element={
        <ProtectedRoute allowedRoles={['admin', 'profesor']}><Layout><ReservasAdmin /></Layout></ProtectedRoute>
      } />
      <Route path="/admin/socios" element={
        <ProtectedRoute allowedRoles={['admin']}><Layout><SociosAdmin /></Layout></ProtectedRoute>
      } />
      <Route path="/admin/gestion" element={
        <ProtectedRoute allowedRoles={['admin']}><Layout><GestionAdmin /></Layout></ProtectedRoute>
      } />
      <Route path="/admin/reportes" element={<Navigate to="/admin/gestion" replace />} />
      <Route path="/admin/noticias" element={
        <ProtectedRoute allowedRoles={['admin', 'profesor']}><Layout><NoticiasAdmin /></Layout></ProtectedRoute>
      } />
    </Routes>
  );
};

export default function App() {
  useEffect(() => {
    initOneSignal();
  }, []);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <AppRoutes />
          <PwaPrompt />
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Calendar, User, LogOut, Users, BarChart, Bell } from 'lucide-react';
import { NotificationBanner } from './NotificationBanner';
import { NewsPopup } from './NewsPopup';
import { ProfileCompletionModal } from './ProfileCompletionModal';
import { QRAnnouncementBanner } from './QRAnnouncementBanner';

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const { socio, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const isSocio = socio?.rol === 'socio';
  const isAdmin = socio?.rol === 'admin';
  
  // Condición para bloquear si falta confirmar los datos o si están vacíos (solo aplica a socios)
  const isProfileIncomplete = isSocio && !socio.datos_confirmados;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="bg-primary text-[#0d0d0d] p-4 flex items-center justify-between shadow-md">
        <div className="flex items-center">
          <img src="/empalme-central-logo.png" alt="CAEC Tenis" className="h-10 sm:h-12 object-contain rounded-md" />
        </div>
        {socio && (
          <button onClick={handleSignOut} className="p-2 bg-[#0d0d0d] text-primary rounded-full hover:bg-surface transition-colors" title="Cerrar sesión">
            <LogOut size={20} />
          </button>
        )}
      </header>

      {/* Pop-up de completamiento de perfil obligatorio */}
      {isProfileIncomplete && <ProfileCompletionModal />}

      {/* Pop-up de noticias para socios (solo si el perfil está completo) */}
      {isSocio && !isProfileIncomplete && <NewsPopup />}

      {/* Banner de notificaciones (solo si el perfil está completo) */}
      {isSocio && !isProfileIncomplete && <NotificationBanner />}

      {/* Banner informativo de Validación QR */}
      {isSocio && !isProfileIncomplete && <QRAnnouncementBanner />}

      {/* Main Content */}
      <main className={`flex-1 overflow-y-auto pb-20 p-4 ${isProfileIncomplete ? 'pointer-events-none blur-sm' : ''}`}>
        {children}
      </main>

      {/* Bottom Navigation */}
      {socio && (
        <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border flex justify-around p-3 pb-safe">
          {isSocio && (
            <>
              <NavItem icon={<Calendar />} label="Reservar" path="/reservar" current={location.pathname} onClick={() => navigate('/reservar')} />
              <NavItem icon={<User />} label="Mis turnos" path="/mis-turnos" current={location.pathname} onClick={() => navigate('/mis-turnos')} />
              <NavItem icon={<Users />} label="Agenda" path="/agenda" current={location.pathname} onClick={() => navigate('/agenda')} />
            </>
          )}
          {isAdmin && (
            <>
              <NavItem icon={<Calendar />} label="Reservas" path="/admin/reservas" current={location.pathname} onClick={() => navigate('/admin/reservas')} />
              <NavItem icon={<Users />} label="Socios" path="/admin/socios" current={location.pathname} onClick={() => navigate('/admin/socios')} />
              <NavItem icon={<BarChart />} label="Reportes" path="/admin/reportes" current={location.pathname} onClick={() => navigate('/admin/reportes')} />
              <NavItem icon={<Bell />} label="Noticias" path="/admin/noticias" current={location.pathname} onClick={() => navigate('/admin/noticias')} />
            </>
          )}
        </nav>
      )}
    </div>
  );
};

const NavItem = ({ icon, label, path, current, onClick }: { icon: React.ReactNode, label: string, path: string, current: string, onClick: () => void }) => {
  const active = current.startsWith(path);
  return (
    <button 
      onClick={onClick} 
      className={`flex flex-col items-center gap-1 p-2 w-full transition-colors ${active ? 'text-primary' : 'text-textSec hover:text-textPri'}`}
    >
      <div className={active ? 'text-primary' : ''}>
        {React.cloneElement(icon as React.ReactElement, { size: 24 })}
      </div>
      <span className="text-[10px] uppercase font-semibold">{label}</span>
    </button>
  );
};

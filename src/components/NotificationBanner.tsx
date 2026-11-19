import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { getNotificationPermission, isPushNotificationsSupported, requestNotificationPermission, loginOneSignal } from '../lib/onesignal';
import { useAuth } from '../context/AuthContext';

export const NotificationBanner = () => {
  const [show, setShow] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const { socio } = useAuth();

  useEffect(() => {
    // Solo mostramos el banner si el navegador soporta notificaciones Y aún no dio permiso
    const check = async () => {
      if (localStorage.getItem('hide_notification_banner') === 'true') return;
      if (!isPushNotificationsSupported()) return;
      
      const granted = await getNotificationPermission();
      if (!granted && Notification.permission !== 'denied') {
        setShow(true);
      }
    };
    // Esperamos 2 segundos para no molestar al usuario apenas entra
    const timer = setTimeout(check, 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleActivate = async () => {
    setRequesting(true);

    try {
      // 1. Pedir permiso a través de OneSignal y activar la suscripción push
      const granted = await requestNotificationPermission();

      // 2. Si hay un socio con sesión iniciada, vincular su DNI
      if (socio?.dni) {
        await loginOneSignal(String(socio.dni));
      }

      // 3. Ocultar el banner si se otorgó el permiso o si ya no es default
      if (granted || (typeof Notification !== 'undefined' && Notification.permission !== 'default')) {
        setShow(false);
        localStorage.setItem('hide_notification_banner', 'true');
      }
    } catch(e) {
      console.error('[NotificationBanner] Error:', e);
      setShow(false);
    } finally {
      setRequesting(false);
    }
  };

  if (!show) return null;

  return (
    <div className="mx-4 mt-3 bg-gradient-to-r from-[#DC2626]/20 to-[#DC2626]/5 border border-[#DC2626]/40 rounded-xl p-4 flex items-center gap-3 shadow-lg animate-[fadeIn_0.5s_ease-out]">
      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
        <Bell size={20} className="text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-textPri">Activar notificaciones</p>
        <p className="text-xs text-textSec mt-0.5">Te avisamos cuando se libere un turno</p>
      </div>
      <button 
        onClick={() => {
          localStorage.setItem('hide_notification_banner', 'true');
          setShow(false);
        }}
        className="p-1 text-textSec hover:text-textPri transition-colors"
        title="Ocultar"
      >
        ✕
      </button>
      <button
        onClick={handleActivate}
        disabled={requesting}
        className="flex-shrink-0 w-[84px] flex justify-center items-center bg-primary text-[#0d0d0d] text-xs font-bold py-2 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {requesting ? (
            <span className="flex items-center justify-center gap-0.5">
              <span className="w-1 h-1 bg-slate-100 rounded-full animate-bounce"></span>
              <span className="w-1 h-1 bg-slate-100 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
              <span className="w-1 h-1 bg-slate-100 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
            </span>
          ) : 'Activar'}
      </button>
    </div>
  );
};

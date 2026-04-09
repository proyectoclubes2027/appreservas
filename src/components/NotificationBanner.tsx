import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { getNotificationPermission, isPushNotificationsSupported, initOneSignal } from '../lib/onesignal';

export const NotificationBanner = () => {
  const [show, setShow] = useState(false);
  const [requesting, setRequesting] = useState(false);

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
      // 1. Forzamos la inicialización de OneSignal por las dudas
      await initOneSignal();

      // 2. Pedimos el permiso directamente al navegador (Nativo).
      // Esto evita que el SDK remoto de OneSignal se quede "colgado" o trabado.
      const permission = await window.Notification.requestPermission();
      
      // 3. Si el usuario ya eligió (Permitir o Bloquear), se oculta instantáneamente
      if (permission !== 'default') {
        setShow(false);
      }
    } catch(e) {
      console.error(e);
    } finally {
      setRequesting(false);
      // Fallback: si por alguna razón ya no es default, lo ocultamos
      if (window.Notification.permission !== 'default') {
        setShow(false);
      }
    }
  };

  if (!show) return null;

  return (
    <div className="mx-4 mt-3 bg-gradient-to-r from-[#F5C200]/20 to-[#F5C200]/5 border border-[#F5C200]/40 rounded-xl p-4 flex items-center gap-3 shadow-lg animate-[fadeIn_0.5s_ease-out]">
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
              <span className="w-1 h-1 bg-[#0d0d0d] rounded-full animate-bounce"></span>
              <span className="w-1 h-1 bg-[#0d0d0d] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
              <span className="w-1 h-1 bg-[#0d0d0d] rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
            </span>
          ) : 'Activar'}
      </button>
    </div>
  );
};

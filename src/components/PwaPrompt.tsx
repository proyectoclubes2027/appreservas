import { useState, useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from './ui/Button';

export const PwaPrompt = () => {
  const {
    offlineReady: [, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered() {
      // console.log('SW Registered');
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  const [installPromptEvent, setInstallPromptEvent] = useState<any>(null);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Detectar si ya es modo standalone
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && (navigator as any).standalone === true);
    if (isStandalone) return; // Ya está instalada

    // Escuchar el evento de instalación en Android / Chrome
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setInstallPromptEvent(e);
      if (localStorage.getItem('hide_pwa_prompt') !== 'true') {
        setShowPrompt(true);
      }
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Detectar iOS Safari para mostrar un prompt manual
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    if (isIos && localStorage.getItem('hide_pwa_prompt') !== 'true') {
      setShowIOSPrompt(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstall = async () => {
    if (!installPromptEvent) return;
    installPromptEvent.prompt();
    const { outcome } = await installPromptEvent.userChoice;
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setInstallPromptEvent(null);
  };

  const handleDismiss = () => {
    localStorage.setItem('hide_pwa_prompt', 'true');
    setShowPrompt(false);
    setShowIOSPrompt(false);
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  if (needRefresh) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-[100] bg-primary text-[#0d0d0d] p-4 rounded-xl shadow-2xl animate-[fadeIn_0.3s_ease-out]">
        <div className="flex flex-col gap-3">
           <div className="flex justify-between items-start">
             <div>
               <p className="font-bold">¡Nueva actualización disponible!</p>
               <p className="text-xs mt-1">Refresca para ver los cambios.</p>
             </div>
           </div>
           <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={handleDismiss}>Descartar</Button>
              <Button variant="primary" className="flex-1 font-bold border-2 border-[#0d0d0d]" onClick={() => updateServiceWorker(true)}>Actualizar</Button>
           </div>
        </div>
      </div>
    );
  }

  if (showPrompt && installPromptEvent) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-[100] bg-surface border border-primary/50 text-textPri p-4 rounded-xl shadow-2xl animate-[fadeIn_0.3s_ease-out]">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
             <img src="/logo.png" alt="Icon" className="w-10 h-10 rounded-lg" />
             <div>
               <p className="font-bold text-primary">Instalar App de Reservas</p>
               <p className="text-xs text-textSec mt-0.5">Añadí la app al inicio para acceso rápido.</p>
             </div>
          </div>
          <button onClick={handleDismiss} className="text-textSec hover:text-textPri">✕</button>
        </div>
        <Button variant="primary" fullWidth className="mt-4" onClick={handleInstall}>Instalar Aplicación</Button>
      </div>
    );
  }

  if (showIOSPrompt) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-[100] bg-surface border border-primary/50 text-textPri p-4 rounded-xl shadow-2xl animate-[fadeIn_0.3s_ease-out]">
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-3">
             <img src="/logo.png" alt="Icon" className="w-10 h-10 rounded-lg" />
             <div>
               <p className="font-bold text-primary">Instalar CARP Tenis</p>
               <p className="text-[10px] text-textSec mt-0.5 leading-tight">Agregá la App a tu iPhone para habilitar las notificaciones push.</p>
             </div>
          </div>
          <button onClick={handleDismiss} className="text-textSec hover:text-textPri">✕</button>
        </div>
        <div className="bg-slate-100 rounded-lg p-3 text-xs flex items-center justify-center gap-2 border border-slate-200">
          Toca el icono <span className="text-primary text-xl pb-1">⍗</span> Compartir<br/> y luego "Agregar a Inicio" <span className="px-1 py-0.5 border border-textSec rounded text-[10px]">+</span>
        </div>
      </div>
    );
  }

  return null;
};

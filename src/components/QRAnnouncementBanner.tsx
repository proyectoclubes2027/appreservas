import React, { useState, useEffect } from 'react';
import { QrCode, Sparkles, RefreshCw, X, ShieldAlert } from 'lucide-react';
import { Button } from './ui/Button';

export const QRAnnouncementBanner: React.FC = () => {
  const [show, setShow] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    // Si el socio ya cerró el banner hoy, no se lo volvemos a mostrar inmediatamente
    const dismissedUntil = localStorage.getItem('dismissed_qr_banner_date');
    const today = new Date().toISOString().slice(0, 10);
    if (dismissedUntil !== today) {
      setShow(true);
    }
  }, []);

  const handleDismiss = () => {
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem('dismissed_qr_banner_date', today);
    setShow(false);
  };

  const handleForceUpdate = async () => {
    setIsUpdating(true);
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.update();
        }
      }
      // Limpiar caches del navegador para forzar descarga limpia
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch (e) {
      console.warn('Error al limpiar cache:', e);
    }
    // Recargar la app
    window.location.reload();
  };

  if (!show) return null;

  return (
    <div className="mx-4 mt-3 mb-2 bg-gradient-to-r from-surface via-[#1f1a05] to-surface border border-primary/40 rounded-xl p-4 shadow-lg relative overflow-hidden animate-[fadeIn_0.3s_ease-out]">
      {/* Detalle decorativo */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-2xl pointer-events-none" />

      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 text-textSec hover:text-textPri p-1 rounded-md"
        title="Cerrar aviso"
      >
        <X size={18} />
      </button>

      <div className="flex items-start gap-3">
        <div className="p-2.5 bg-primary/20 text-primary rounded-xl border border-primary/30 shrink-0">
          <QrCode size={24} />
        </div>
        <div className="flex-1 pr-4">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1">
              <Sparkles size={13} /> Novedad Importante
            </span>
            <span className="text-[10px] bg-primary/20 text-primary font-bold px-1.5 py-0.5 rounded">
              Desde Noviembre
            </span>
          </div>

          <h4 className="text-sm font-bold text-textPri leading-snug">
            Validación obligatoria de turnos con QR
          </h4>

          <p className="text-xs text-textSec mt-1.5 leading-relaxed">
            Para garantizar que todas las reservas se cumplan, deberás escanear el código QR ubicado en tu cancha al momento de jugar.
          </p>

          <div className="mt-2 text-xs flex items-center gap-1 text-amber-400 font-medium">
            <ShieldAlert size={14} className="shrink-0" />
            <span>Turno no validado = 2 semanas sin poder reservar.</span>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <Button
              variant="primary"
              className="text-xs font-bold py-1.5 px-3 flex items-center gap-1.5 border border-[#0d0d0d]"
              onClick={handleForceUpdate}
              disabled={isUpdating}
            >
              <RefreshCw size={13} className={isUpdating ? 'animate-spin' : ''} />
              {isUpdating ? 'Actualizando...' : 'Actualizar App para habilitar QR'}
            </Button>
            <button
              onClick={handleDismiss}
              className="text-xs text-textSec underline hover:text-textPri px-2 py-1"
            >
              Entendido
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

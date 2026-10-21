import React, { useState } from 'react';
import { QrCode, Sparkles, RefreshCw, X, ShieldAlert } from 'lucide-react';

export const QRAnnouncementBanner: React.FC = () => {
  const [show, setShow] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleDismiss = () => {
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
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch (e) {
      console.warn('Error al limpiar cache:', e);
    }
    window.location.reload();
  };

  if (!show) return null;

  return (
    <div className="mx-4 mt-3 mb-3 bg-[#141414] border border-primary/30 rounded-2xl p-4 shadow-xl relative overflow-hidden animate-[fadeIn_0.3s_ease-out]">
      {/* Botón cerrar sutil arriba a la derecha */}
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 text-textSec hover:text-textPri p-1.5 rounded-full hover:bg-white/10 transition-colors z-10"
        title="Cerrar aviso"
      >
        <X size={16} />
      </button>

      {/* Encabezado: Badges alineados */}
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary bg-primary/15 border border-primary/30 px-2.5 py-1 rounded-full">
          <Sparkles size={12} /> Novedad
        </span>
        <span className="text-[11px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-full">
          Desde Noviembre
        </span>
      </div>

      {/* Título principal con ícono */}
      <div className="flex items-start gap-3 mb-2.5">
        <div className="p-2 bg-primary/10 text-primary rounded-xl border border-primary/20 shrink-0 mt-0.5">
          <QrCode size={20} />
        </div>
        <h4 className="text-sm font-bold text-textPri leading-tight pr-6">
          Validación obligatoria de turnos con código QR
        </h4>
      </div>

      {/* Descripción clara */}
      <p className="text-xs text-textSec leading-relaxed mb-3 pl-1">
        Para asegurar el cumplimiento de las reservas, deberás validar tu presencia escaneando el QR ubicado en la cancha al momento de jugar.
      </p>

      {/* Tarjeta de penalización estilizada */}
      <div className="bg-[#0a0a0a] border border-amber-500/30 rounded-xl p-2.5 mb-4 flex items-center gap-2 text-xs text-amber-300/95 font-medium">
        <ShieldAlert size={16} className="text-amber-400 shrink-0" />
        <span>Si no se valida el turno, se aplicará una sanción de <strong>2 semanas</strong> sin poder reservar.</span>
      </div>

      {/* Botones de acción limpios y equilibrados */}
      <div className="flex items-center gap-2.5 pt-1">
        <button
          onClick={handleForceUpdate}
          disabled={isUpdating}
          className="flex-1 bg-primary hover:bg-primary/90 text-[#0d0d0d] font-bold text-xs py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md shadow-primary/10"
        >
          <RefreshCw size={13} className={isUpdating ? 'animate-spin' : ''} />
          {isUpdating ? 'Actualizando...' : 'Actualizar App'}
        </button>

        <button
          onClick={handleDismiss}
          className="px-4 py-2.5 text-xs text-textSec hover:text-textPri font-medium rounded-xl hover:bg-white/5 transition-colors"
        >
          Entendido
        </button>
      </div>
    </div>
  );
};

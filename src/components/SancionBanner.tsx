import React, { useState, useEffect } from 'react';
import { ShieldAlert, CalendarX, Info, X, ChevronRight, Lock } from 'lucide-react';
import { useSocioSancion } from '../lib/useSocioSancion';
import { useAuth } from '../context/AuthContext';
import { format, parseISO, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from './ui/Button';

export const SancionBanner: React.FC = () => {
  const { socio } = useAuth();
  const { sancion, isSancionado, loading } = useSocioSancion();
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (sancion) {
      // Si el socio aún no vio el pop-up en esta sesión del navegador, se lo abrimos al entrar
      const seenKey = `sancion_modal_seen_${sancion.id}`;
      const alreadySeen = sessionStorage.getItem(seenKey);
      if (!alreadySeen) {
        setIsModalOpen(true);
      }
    }
  }, [sancion]);

  if (loading || !isSancionado || !sancion) return null;

  const fechaFinDate = parseISO(sancion.fecha_fin);
  const fechaFinFormatted = format(fechaFinDate, "dd 'de' MMMM 'de' yyyy", { locale: es });
  const fechaFinCorta = format(fechaFinDate, 'dd/MM/yyyy');
  const diasRestantes = Math.max(0, differenceInDays(fechaFinDate, new Date()) + 1);

  const handleCloseModal = () => {
    sessionStorage.setItem(`sancion_modal_seen_${sancion.id}`, 'true');
    setIsModalOpen(false);
  };

  return (
    <>
      {/* 1. BANNER PERSISTENTE EN CABECERA DE LA APP */}
      <div 
        onClick={() => setIsModalOpen(true)}
        className="mx-4 mt-3 mb-3 bg-gradient-to-r from-red-950/80 via-red-900/40 to-[#1a0a0a] border border-red-500/50 rounded-2xl p-4 shadow-xl relative overflow-hidden cursor-pointer hover:border-red-400 transition-all group animate-[fadeIn_0.3s_ease-out]"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center flex-shrink-0 mt-0.5 text-red-400 group-hover:scale-105 transition-transform">
            <ShieldAlert size={22} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-red-200 bg-red-500/30 border border-red-500/40 px-2 py-0.5 rounded-full">
                <Lock size={10} /> Cuenta Inhabilitada
              </span>
              <span className="text-[11px] font-bold text-red-300">
                Hasta el {fechaFinCorta} {diasRestantes > 0 ? `(${diasRestantes} días)` : ''}
              </span>
            </div>

            <p className="text-xs text-red-100/90 leading-snug line-clamp-2">
              Tenés una sanción activa y no podés crear reservas ni participar de turnos.
            </p>

            <div className="mt-2 flex items-center gap-1 text-[11px] font-bold text-red-300 group-hover:text-red-200 transition-colors">
              <span>Ver motivo y detalle completo</span>
              <ChevronRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </div>
      </div>

      {/* 2. POP-UP MODAL AL ENTRAR O AL TOCAR EL BANNER */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#0d0d0d]/90 z-[100] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#141414] border border-red-500/50 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-200">
            {/* Cabecera Roja de Alerta */}
            <div className="bg-gradient-to-r from-red-600 to-red-800 p-4 text-white flex justify-between items-center shadow-md">
              <div className="flex items-center gap-2.5">
                <ShieldAlert size={24} className="text-white drop-shadow" />
                <div>
                  <h3 className="font-black uppercase tracking-tight text-base leading-none">
                    Cuenta Sancionada
                  </h3>
                  <span className="text-[11px] text-red-100 font-medium">Inhabilitación temporal para reservas</span>
                </div>
              </div>
              <button
                onClick={handleCloseModal}
                className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
                title="Cerrar"
              >
                <X size={20} />
              </button>
            </div>

            {/* Contenido del Modal */}
            <div className="p-5 space-y-4">
              <div>
                <p className="text-sm text-textPri">
                  Hola <strong className="text-white">{socio?.nombre} {socio?.apellido}</strong>, tu cuenta tiene una sanción vigente impuesta por la Subcomisión:
                </p>
              </div>

              {/* Tarjeta de Vigencia */}
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3.5 flex items-center gap-3">
                <CalendarX size={24} className="text-red-400 shrink-0" />
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-red-300 block">
                    Inhabilitado hasta
                  </span>
                  <span className="text-sm font-bold text-white block">
                    {fechaFinFormatted}
                  </span>
                  <span className="text-[11px] text-red-300/80">
                    {diasRestantes > 1 
                      ? `Restan ${diasRestantes} días de sanción`
                      : diasRestantes === 1 
                        ? 'Resta 1 día de sanción' 
                        : 'Finaliza hoy a medianoche'}
                  </span>
                </div>
              </div>

              {/* Motivo de la Sanción */}
              <div className="bg-[#1c1c1c] border border-border rounded-xl p-3.5">
                <div className="flex items-center gap-1.5 text-textSec text-[11px] uppercase font-bold tracking-wider mb-1.5">
                  <Info size={13} />
                  <span>Motivo registrado</span>
                </div>
                <p className="text-xs text-textPri leading-relaxed font-medium bg-[#141414] p-2.5 rounded-lg border border-white/5">
                  "{sancion.motivo}"
                </p>
              </div>

              {/* Reglas de la Inhabilitación */}
              <div className="bg-[#181818] rounded-xl p-3 border border-white/5 text-xs text-textSec space-y-1.5">
                <p className="font-bold text-textPri text-[11px] uppercase tracking-wider">
                  Impacto de la sanción:
                </p>
                <div className="flex items-start gap-2">
                  <span className="text-red-400 font-bold">•</span>
                  <span>No podés reservar turnos desde la aplicación ni telefónicamente.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-red-400 font-bold">•</span>
                  <span>Otros socios no podrán agregarte como participante o acompañante.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-green-400 font-bold">•</span>
                  <span>Al finalizar el período, tu cuenta se reactivará automáticamente.</span>
                </div>
              </div>

              {/* Botón de cierre */}
              <div className="pt-2">
                <Button 
                  variant="primary" 
                  fullWidth 
                  onClick={handleCloseModal}
                  className="bg-red-600 hover:bg-red-500 text-white font-bold py-3 text-sm shadow-lg shadow-red-950"
                >
                  Entendido
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

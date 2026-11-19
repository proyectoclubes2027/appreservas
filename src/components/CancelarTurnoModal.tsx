import React, { useState } from 'react';
import { X, AlertTriangle, CheckCircle2, CloudRain, Clock, Calendar, ShieldAlert } from 'lucide-react';
import { Button } from './ui/Button';
import { ClubConfig } from '../lib/config';
import { evaluarCancelacion, ejecutarCancelacion, InfoCancelacion } from '../lib/cancelaciones';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface CancelarTurnoModalProps {
  isOpen: boolean;
  onClose: () => void;
  turno: any;
  socioDni: string;
  config: ClubConfig;
  onSuccess: (mensaje: string) => void;
}

export const CancelarTurnoModal: React.FC<CancelarTurnoModalProps> = ({
  isOpen,
  onClose,
  turno,
  socioDni,
  config,
  onSuccess,
}) => {
  const [cancelling, setCancelling] = useState(false);

  if (!isOpen || !turno) return null;

  const evaluacion: InfoCancelacion = evaluarCancelacion(turno, config);

  const dateObj = turno.fecha ? parseISO(turno.fecha) : new Date();
  const formattedDate = !isNaN(dateObj.getTime())
    ? format(dateObj, "EEEE d 'de' MMMM", { locale: es })
    : turno.fecha;

  const horaInicio = (turno.hora_inicio || '').slice(0, 5);
  const horaFin = (turno.hora_fin || '').slice(0, 5);
  const canchaNombre = turno.canchas?.nombre || `Cancha ${turno.cancha_id}`;

  const handleConfirm = async () => {
    setCancelling(true);
    const res = await ejecutarCancelacion(turno, socioDni, config);
    setCancelling(false);

    if (res.success) {
      onSuccess(res.mensaje);
      onClose();
    } else {
      alert(res.mensaje);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md p-5 sm:p-6 relative shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[85vh]">
        {/* Header */}
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg ${
              evaluacion.categoria === 'clima'
                ? 'bg-sky-500/20 text-sky-400'
                : evaluacion.categoria === 'normal'
                ? 'bg-emerald-500/20 text-emerald-400'
                : evaluacion.categoria === 'tardia'
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-red-500/20 text-red-400'
            }`}>
              {evaluacion.categoria === 'clima' ? (
                <CloudRain size={20} />
              ) : evaluacion.categoria === 'normal' ? (
                <CheckCircle2 size={20} />
              ) : evaluacion.categoria === 'tardia' ? (
                <AlertTriangle size={20} />
              ) : (
                <ShieldAlert size={20} />
              )}
            </div>
            <div>
              <h3 className="text-base font-bold text-textPri">Cancelar Reserva</h3>
              <p className="text-xs text-textSec">Control de anticipación de turnos</p>
            </div>
          </div>
          <button onClick={onClose} disabled={cancelling} className="text-textSec hover:text-textPri p-1 rounded-md">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3.5 text-sm min-h-0">
          {/* Card con datos del turno */}
          <div className="bg-slate-100 p-3.5 rounded-xl border border-slate-200 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-textPri text-sm capitalize flex items-center gap-1.5">
                <Calendar size={14} className="text-primary" />
                {formattedDate}
              </span>
              <span className="font-mono font-bold text-primary text-xs bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">
                {horaInicio} - {horaFin} hs
              </span>
            </div>
            <p className="text-xs text-textSec flex items-center gap-1.5">
              <span>{canchaNombre}</span>
              {turno.acompanante && <span>• Acompañante: {turno.acompanante}</span>}
            </p>
          </div>

          {/* Gráfico Semáforo de Cancelación */}
          <div className="bg-slate-100 p-3 rounded-xl border border-slate-200 flex flex-col gap-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-textSec uppercase tracking-wider">
              <span>Semáforo de Cancelación</span>
              {evaluacion.categoria !== 'clima' && (
                <span className="flex items-center gap-1 text-primary lowercase font-normal">
                  <Clock size={12} /> faltan {evaluacion.minutosFaltantes} min
                </span>
              )}
            </div>

            {evaluacion.categoria === 'clima' ? (
              <div className="p-3 bg-sky-950/40 border border-sky-500/40 rounded-lg flex items-center gap-2.5 text-sky-200">
                <CloudRain size={20} className="text-sky-400 shrink-0" />
                <div className="text-xs">
                  <p className="font-bold text-sky-300">Modo Clima Inestable Activo</p>
                  <p className="text-[11px] text-sky-200/80">Hoy las cancelaciones y ausencias no generan penalidad.</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
                {/* Zona Verde */}
                <div className={`p-2 rounded-lg border transition-all ${
                  evaluacion.categoria === 'normal'
                    ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300 font-bold ring-1 ring-emerald-500/50'
                    : 'bg-slate-50 border-slate-200 text-textSec/60'
                }`}>
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 mx-auto mb-1" />
                  <span>+2 Horas</span>
                  <div className="text-[9px] mt-0.5">Sin sanción</div>
                </div>

                {/* Zona Amarilla */}
                <div className={`p-2 rounded-lg border transition-all ${
                  evaluacion.categoria === 'tardia'
                    ? 'bg-amber-950/60 border-amber-500 text-amber-300 font-bold ring-1 ring-amber-500/50'
                    : 'bg-slate-50 border-slate-200 text-textSec/60'
                }`}>
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400 mx-auto mb-1" />
                  <span>30 min a 2 hs</span>
                  <div className="text-[9px] mt-0.5">Solidaria</div>
                </div>

                {/* Zona Roja */}
                <div className={`p-2 rounded-lg border transition-all ${
                  evaluacion.categoria === 'inmediata'
                    ? 'bg-red-950/60 border-red-500 text-red-300 font-bold ring-1 ring-red-500/50'
                    : 'bg-slate-50 border-slate-200 text-textSec/60'
                }`}>
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400 mx-auto mb-1" />
                  <span>-30 Minutos</span>
                  <div className="text-[9px] mt-0.5">Sanción</div>
                </div>
              </div>
            )}
          </div>

          {/* Caja explicativa de consecuencias */}
          {evaluacion.categoria === 'normal' && (
            <div className="p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <CheckCircle2 size={15} /> Cancelación a tiempo (Normal)
              </p>
              <p className="text-emerald-200/90 leading-relaxed text-[11px]">
                Al cancelar con más de 2 horas de anticipación, la cancha queda libre con tiempo suficiente para que otro socio la reserve. <strong>No recibirás ninguna penalidad.</strong>
              </p>
            </div>
          )}

          {evaluacion.categoria === 'tardia' && (
            <div className="p-3 bg-amber-950/30 border border-amber-500/40 rounded-xl text-xs text-amber-200 space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-amber-300">
                <AlertTriangle size={15} className="shrink-0" />
                <span>Cancelación Solidaria (Sobre la hora)</span>
              </div>
              <ul className="text-[11px] text-amber-200/90 space-y-1 list-disc list-inside leading-relaxed">
                <li>Tu cancha quedará liberada <strong>de inmediato</strong> en el sistema para que otros socios puedan verla.</li>
                <li><strong>Si otro socio reserva tu turno antes de las {horaInicio}hs:</strong> Quedás <strong>exento de sanción</strong>.</li>
                <li><strong>Si nadie la reserva antes del inicio:</strong> Se aplicará una sanción de <strong>{evaluacion.diasSancion} días</strong> sin poder reservar por liberar sobre la hora.</li>
              </ul>
              <div className="pt-1.5 border-t border-amber-500/20 text-[10px] text-amber-300/80 italic">
                💡 Consejo: Si avisás en los grupos de tenis del club para que un compañero aproveche la cancha, ¡evitás la sanción!
              </div>
            </div>
          )}

          {evaluacion.categoria === 'inmediata' && (
            <div className="p-3 bg-red-950/30 border border-red-500/40 rounded-xl text-xs text-red-200 space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-red-300">
                <ShieldAlert size={15} className="shrink-0" />
                <span>Cancelación Inmediata (Falta Directa)</span>
              </div>
              <p className="text-[11px] text-red-200/90 leading-relaxed">
                Faltan menos de 30 minutos para el turno. A tan poco tiempo, los demás socios no tienen margen para trasladarse al club y la cancha quedará vacía.
              </p>
              <div className="p-2 bg-red-900/30 border border-red-500/30 rounded-lg text-[11px] font-semibold text-red-300">
                ⚠️ Al confirmar la cancelación, se te aplicará una sanción de <strong>{evaluacion.diasSancion} días</strong> sin poder reservar turnos.
              </div>
            </div>
          )}

          {evaluacion.categoria === 'clima' && (
            <div className="p-3 bg-sky-950/30 border border-sky-500/40 rounded-xl text-xs text-sky-200 space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-sky-300">
                <CloudRain size={15} /> Modo Clima Inestable Activo
              </p>
              <p className="text-sky-200/90 text-[11px] leading-relaxed">
                Debido a las condiciones climáticas del día de hoy, podés cancelar tu turno en cualquier momento sin ninguna sanción.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3.5 border-t border-border flex gap-2.5 shrink-0">
          <Button
            variant="secondary"
            fullWidth
            onClick={onClose}
            disabled={cancelling}
            className="text-xs font-semibold"
          >
            Mantener Turno
          </Button>

          <Button
            variant={evaluacion.categoria === 'inmediata' ? 'danger' : 'primary'}
            fullWidth
            onClick={handleConfirm}
            disabled={cancelling}
            className={`text-xs font-bold flex items-center justify-center gap-1.5 ${
              evaluacion.categoria === 'tardia'
                ? 'bg-amber-500 hover:bg-amber-400 text-black border-none'
                : evaluacion.categoria === 'clima'
                ? 'bg-sky-500 hover:bg-sky-400 text-black border-none'
                : ''
            }`}
          >
            {cancelling ? (
              'Cancelando...'
            ) : evaluacion.categoria === 'inmediata' ? (
              'Cancelar y Aceptar Sanción'
            ) : evaluacion.categoria === 'tardia' ? (
              'Liberar Cancha'
            ) : (
              'Confirmar Cancelación'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

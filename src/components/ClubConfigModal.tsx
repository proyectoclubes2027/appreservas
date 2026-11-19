import React, { useState, useEffect } from 'react';
import { Settings, QrCode, Calendar, Clock, Check, X, ShieldAlert, Megaphone, CloudRain } from 'lucide-react';
import { Button } from './ui/Button';
import { ClubConfig } from '../lib/config';

interface ClubConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ClubConfig;
  onSave: (newConfig: Partial<ClubConfig>) => Promise<{ success: boolean; error?: string }>;
  onOpenPenalizaciones?: () => void;
}

export const ClubConfigModal: React.FC<ClubConfigModalProps> = ({
  isOpen,
  onClose,
  config,
  onSave,
  onOpenPenalizaciones,
}) => {
  const [climaInestable, setClimaInestable] = useState(Boolean(config.clima_inestable));
  const [qrActivo, setQrActivo] = useState(Boolean(config.validacion_qr_activa));
  const [mostrarAvisoQr, setMostrarAvisoQr] = useState(Boolean(config.mostrar_aviso_qr));
  const [diasAnticipacion, setDiasAnticipacion] = useState(config.dias_anticipacion || 2);
  const [tolerancia, setTolerancia] = useState(config.tolerancia_minutos || 20);
  const [penalizacionDias, setPenalizacionDias] = useState(config.penalizacion_dias || 7);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Sincronizar siempre con la configuración real cuando se abre el modal o cambia la config
  useEffect(() => {
    if (isOpen) {
      setClimaInestable(Boolean(config.clima_inestable));
      setQrActivo(Boolean(config.validacion_qr_activa));
      setMostrarAvisoQr(Boolean(config.mostrar_aviso_qr));
      setDiasAnticipacion(config.dias_anticipacion || 2);
      setTolerancia(config.tolerancia_minutos || 20);
      setPenalizacionDias(config.penalizacion_dias || 7);
    }
  }, [isOpen, config]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    const res = await onSave({
      clima_inestable: climaInestable,
      validacion_qr_activa: qrActivo,
      mostrar_aviso_qr: mostrarAvisoQr,
      dias_anticipacion: Number(diasAnticipacion),
      tolerancia_minutos: Number(tolerancia),
      penalizacion_dias: Number(penalizacionDias),
    });
    setIsSaving(false);

    if (res.success) {
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 900);
    } else {
      alert('Error al guardar configuración: ' + res.error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md p-5 sm:p-6 relative shadow-2xl flex flex-col max-h-[90dvh] sm:max-h-[85vh]">
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/20 text-primary rounded-lg">
              <Settings size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-textPri">Reglas del Club</h3>
              <p className="text-xs text-textSec">Ajustes de reservas, clima y validación QR</p>
            </div>
          </div>
          <button onClick={onClose} className="text-textSec hover:text-textPri p-1 rounded-md">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-4 text-sm min-h-0">
          {/* Switch Clima Inestable (Opción B) */}
          <div className={`p-3.5 rounded-xl border flex flex-col gap-2 transition-colors ${
            climaInestable 
              ? 'bg-sky-950/40 border-sky-500/40 text-sky-200' 
              : 'bg-slate-100 border-slate-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CloudRain size={18} className={climaInestable ? 'text-sky-400' : 'text-textSec'} />
                <span className="font-bold text-textPri">🌧️ Día con Clima Inestable</span>
              </div>
              <button
                type="button"
                onClick={() => setClimaInestable(!climaInestable)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  climaInestable ? 'bg-sky-500' : 'bg-[#333]'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    climaInestable ? 'translate-x-5 !bg-black' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <p className="text-xs text-textSec">
              {climaInestable
                ? '🌧️ ACTIVO: Se suspenden las exigencias de QR y las sanciones. Las cancelaciones y ausencias no generan penalidad.'
                : 'Inactivo: Rige el sistema habitual de validación y sanciones por ausencia o cancelación tardía.'}
            </p>
          </div>

          {/* Switch Validación QR */}
          <div className="p-3.5 bg-slate-100 rounded-xl border border-slate-200 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QrCode size={18} className="text-primary" />
                <span className="font-bold text-textPri">Validación QR en Cancha</span>
              </div>
              <button
                type="button"
                onClick={() => setQrActivo(!qrActivo)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  qrActivo ? 'bg-primary' : 'bg-[#333]'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    qrActivo ? 'translate-x-5 !bg-black' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <p className="text-xs text-textSec">
              {qrActivo
                ? 'Activo: Todos los jugadores del turno deben validar en la cancha. Si alguno no valida, se sanciona a los participantes del turno.'
                : 'Desactivado (Prueba): Los socios pueden escanear para probar la cámara, pero NO se sanciona.'}
            </p>
          </div>

          {/* Switch Comunicado / Mensaje Informativo QR */}
          <div className="p-3.5 bg-slate-100 rounded-xl border border-slate-200 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Megaphone size={18} className="text-amber-400" />
                <span className="font-bold text-textPri">Aviso informativo a Socios</span>
              </div>
              <button
                type="button"
                onClick={() => setMostrarAvisoQr(!mostrarAvisoQr)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  mostrarAvisoQr ? 'bg-primary' : 'bg-[#333]'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    mostrarAvisoQr ? 'translate-x-5 !bg-black' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <p className="text-xs text-textSec">
              {mostrarAvisoQr
                ? 'Visible: Muestra el cartel explicativo sobre la novedad de validación QR a todos los socios.'
                : 'Oculto: No se muestra el cartel informativo en la pantalla de inicio.'}
            </p>
          </div>

          {/* Días de anticipación para reservar */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase text-textSec flex items-center gap-1.5">
              <Calendar size={14} className="text-primary" />
              Días habilitados para reservar (Socios)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { val: 1, label: 'Solo hoy (1 día)' },
                { val: 2, label: 'Hoy y mañana (2 días)' },
                { val: 7, label: 'Semana (7 días)' },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setDiasAnticipacion(opt.val)}
                  className={`p-2.5 rounded-lg border text-xs font-semibold transition-all ${
                    diasAnticipacion === opt.val
                      ? 'bg-primary text-[#0d0d0d] border-primary font-bold shadow'
                      : 'bg-slate-100 text-textPri border-slate-200 hover:border-textSec'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-textSec mt-0.5">
              Limita la cantidad de días futuros que un socio puede ver y reservar.
            </p>
          </div>

          {/* Margen de tolerancia */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase text-textSec flex items-center gap-1.5">
              <Clock size={14} className="text-primary" />
              Margen para validar QR
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="5"
                max="60"
                value={tolerancia}
                onChange={(e) => setTolerancia(Number(e.target.value))}
                className="w-24 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-textPri font-bold text-center focus:border-primary outline-none"
              />
              <span className="text-xs text-textSec">
                minutos antes y después del inicio del turno.
              </span>
            </div>
          </div>

          {/* Sanción por no validar */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase text-textSec flex items-center gap-1.5">
              <ShieldAlert size={14} className="text-amber-400" />
              Días de sanción por incumplimiento
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                max="90"
                value={penalizacionDias}
                onChange={(e) => setPenalizacionDias(Number(e.target.value))}
                className="w-24 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-textPri font-bold text-center focus:border-primary outline-none"
              />
              <span className="text-xs text-textSec">
                días sin poder reservar ({penalizacionDias === 7 ? '1 semana' : `${penalizacionDias} días`}).
              </span>
            </div>
          </div>

          {onOpenPenalizaciones && (
            <div className="pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={onOpenPenalizaciones}
                className="w-full py-2.5 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <ShieldAlert size={15} />
                Ver y Levantar Sanciones a Socios Inhabilitados
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-4 border-t border-border flex gap-3 shrink-0">
          <Button variant="secondary" fullWidth onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            fullWidth
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center justify-center gap-2 font-bold"
          >
            {savedSuccess ? (
              <>
                <Check size={16} /> ¡Guardado!
              </>
            ) : isSaving ? (
              'Guardando...'
            ) : (
              'Guardar Cambios'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

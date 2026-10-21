import React, { useState } from 'react';
import { Settings, QrCode, Calendar, Clock, Check, X, ShieldAlert } from 'lucide-react';
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
  const [qrActivo, setQrActivo] = useState(config.validacion_qr_activa);
  const [diasAnticipacion, setDiasAnticipacion] = useState(config.dias_anticipacion || 2);
  const [tolerancia, setTolerancia] = useState(config.tolerancia_minutos || 20);
  const [penalizacionDias, setPenalizacionDias] = useState(config.penalizacion_dias || 14);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    const res = await onSave({
      validacion_qr_activa: qrActivo,
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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md p-6 relative shadow-2xl">
        <div className="flex justify-between items-center mb-5 pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/20 text-primary rounded-lg">
              <Settings size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-textPri">Reglas del Club</h3>
              <p className="text-xs text-textSec">Ajustes de reservas y validación QR</p>
            </div>
          </div>
          <button onClick={onClose} className="text-textSec hover:text-textPri p-1 rounded-md">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-5 text-sm">
          {/* Switch Validación QR */}
          <div className="p-3.5 bg-[#0d0d0d] rounded-xl border border-[#2a2a2a] flex flex-col gap-2">
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
                ? 'Activo: La app exige validar el turno en la cancha y penaliza las ausencias.'
                : 'Desactivado (Prueba): Los socios pueden escanear para probar la cámara, pero NO se sanciona.'}
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
                      : 'bg-[#0d0d0d] text-textPri border-[#2a2a2a] hover:border-textSec'
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
                className="w-24 bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3 py-2 text-textPri font-bold text-center focus:border-primary outline-none"
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
                className="w-24 bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3 py-2 text-textPri font-bold text-center focus:border-primary outline-none"
              />
              <span className="text-xs text-textSec">
                días sin poder reservar ({penalizacionDias === 14 ? '2 semanas' : `${penalizacionDias} días`}).
              </span>
            </div>
          </div>

          {onOpenPenalizaciones && (
            <div className="pt-2 border-t border-[#2a2a2a]">
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
        <div className="mt-6 pt-4 border-t border-border flex gap-3">
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

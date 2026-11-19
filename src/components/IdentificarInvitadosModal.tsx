import React, { useState, useEffect } from 'react';
import { User, CreditCard, X, UserPlus } from 'lucide-react';
import { Button } from './ui/Button';
import { supabase } from '../lib/supabase';
import { InvitadoDato, getInvitadosFrecuentes, guardarInvitadoFrecuente } from '../lib/invitadosStorage';

interface IdentificarInvitadosModalProps {
  isOpen: boolean;
  onClose: () => void;
  turno: any;
  onSaved: () => Promise<void> | void;
}

export const IdentificarInvitadosModal: React.FC<IdentificarInvitadosModalProps> = ({
  isOpen,
  onClose,
  turno,
  onSaved,
}) => {
  const [invitadosList, setInvitadosList] = useState<InvitadoDato[]>([]);
  const [frecuentes, setFrecuentes] = useState<InvitadoDato[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen || !turno) return;

    setFrecuentes(getInvitadosFrecuentes());

    // Cuántos invitados especiales tiene este turno
    const parts: string[] = turno.participantes_dnis || [];
    const countInvitados = parts.filter(d => d === '123987456').length || 1;

    // Datos actuales de invitados en el turno
    const currentData: InvitadoDato[] = Array.isArray(turno.invitados_datos)
      ? [...turno.invitados_datos]
      : [];

    const inicial: InvitadoDato[] = [];
    for (let i = 0; i < countInvitados; i++) {
      inicial.push({
        nombre: currentData[i]?.nombre || '',
        dni: currentData[i]?.dni || '',
      });
    }
    setInvitadosList(inicial);
  }, [isOpen, turno]);

  if (!isOpen || !turno) return null;

  const handleUpdateField = (index: number, field: 'nombre' | 'dni', value: string) => {
    setInvitadosList(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleSelectFrecuente = (index: number, frecuente: InvitadoDato) => {
    setInvitadosList(prev => {
      const copy = [...prev];
      copy[index] = { nombre: frecuente.nombre, dni: frecuente.dni };
      return copy;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Filtrar y limpiar
      const cleaned = invitadosList.map(inv => ({
        nombre: (inv.nombre || '').trim(),
        dni: (inv.dni || '').trim(),
      }));

      // Guardar en el storage de frecuentes
      cleaned.forEach(inv => {
        if (inv.nombre || inv.dni) {
          guardarInvitadoFrecuente(inv);
        }
      });

      const { error } = await supabase.from('turnos').update({ invitados_datos: cleaned }).eq('id', turno.id);

      if (error) {
        alert('Error al guardar datos de invitados: ' + error.message);
      } else {
        await onSaved();
        onClose();
      }
    } catch (e: any) {
      console.error('Error guardando invitados:', e);
      alert('Ocurrió un error al guardar los invitados.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-[110] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-surface border border-border rounded-xl p-5 w-full max-w-md my-auto shadow-2xl relative">
        <div className="flex justify-between items-start border-b border-border pb-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <UserPlus size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-textPri">Identificar Invitado(s)</h3>
              <p className="text-xs text-textSec">
                Turno: {turno.fecha} ({turno.hora_inicio?.slice(0, 5)}hs) · {turno.canchas?.nombre}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-textSec hover:text-textPri hover:bg-white/10"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-textSec mb-4 bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800">
          💡 La carga es <strong>opcional</strong>. Podés ingresar el Nombre y DNI de tus invitados para que consten en el registro del club y portería.
        </p>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {invitadosList.map((inv, idx) => (
            <div key={idx} className="p-3 bg-slate-100 rounded-lg border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-primary uppercase">
                  Invitado {invitadosList.length > 1 ? `#${idx + 1}` : ''}
                </span>

                {frecuentes.length > 0 && (
                  <select
                    className="text-[11px] bg-surface text-textSec border border-border rounded px-2 py-1 focus:outline-none focus:border-primary max-w-[180px] truncate"
                    defaultValue=""
                    onChange={(e) => {
                      const sel = frecuentes[Number(e.target.value)];
                      if (sel) handleSelectFrecuente(idx, sel);
                      e.target.value = "";
                    }}
                  >
                    <option value="" disabled>Elegir frecuente...</option>
                    {frecuentes.map((f, fIdx) => (
                      <option key={fIdx} value={fIdx}>
                        {f.nombre} ({f.dni})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-textSec font-medium flex items-center gap-1">
                  <User size={12} className="text-primary" /> Nombre y Apellido
                </label>
                <input
                  type="text"
                  placeholder="Ej: Carlos Gómez"
                  value={inv.nombre}
                  onChange={(e) => handleUpdateField(idx, 'nombre', e.target.value)}
                  className="w-full text-xs p-2 rounded bg-surface border border-border text-textPri focus:outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-textSec font-medium flex items-center gap-1">
                  <CreditCard size={12} className="text-primary" /> DNI
                </label>
                <input
                  type="text"
                  placeholder="Ej: 35123456"
                  value={inv.dni}
                  onChange={(e) => handleUpdateField(idx, 'dni', e.target.value)}
                  className="w-full text-xs p-2 rounded bg-surface border border-border text-textPri font-mono focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2.5 mt-5 pt-3 border-t border-border">
          <Button variant="secondary" fullWidth onClick={onClose} disabled={saving} className="text-xs">
            Cancelar
          </Button>
          <Button variant="primary" fullWidth onClick={handleSave} disabled={saving} className="text-xs font-bold">
            {saving ? 'Guardando...' : 'Guardar Invitados'}
          </Button>
        </div>
      </div>
    </div>
  );
};

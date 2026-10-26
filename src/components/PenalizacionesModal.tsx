import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ShieldCheck, Trash2, X, AlertCircle } from 'lucide-react';
import { Button } from './ui/Button';
import { format, parseISO } from 'date-fns';

import { useClubConfig } from '../lib/useClubConfig';
import { resolverTurnosSinValidar } from '../lib/cancelaciones';

interface PenalizacionesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PenalizacionesModal: React.FC<PenalizacionesModalProps> = ({ isOpen, onClose }) => {
  const { config } = useClubConfig();
  const [penalizaciones, setPenalizaciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchPenalizaciones();
    }
  }, [isOpen]);

  const fetchPenalizaciones = async () => {
    setLoading(true);
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      // Obtenemos penalizaciones activas con los datos del socio
      const { data, error } = await supabase
        .from('penalizaciones')
        .select('*, turnos(fecha, hora_inicio, canchas(nombre))')
        .eq('activa', true)
        .gte('fecha_fin', todayStr)
        .order('fecha_fin', { ascending: true });

      if (!error && data) {
        // También traer nombres de los socios
        const dnis = Array.from(new Set(data.map((p: any) => p.socio_dni)));
        if (dnis.length > 0) {
          const { data: sociosData } = await supabase
            .from('socios')
            .select('dni, nombre, apellido')
            .in('dni', dnis);
          const socioMap = new Map((sociosData || []).map((s: any) => [s.dni, `${s.apellido}, ${s.nombre}`]));
          const enriched = data.map((p: any) => ({
            ...p,
            socioNombre: socioMap.get(p.socio_dni) || 'Socio',
          }));
          setPenalizaciones(enriched);
        } else {
          setPenalizaciones([]);
        }
      } else {
        setPenalizaciones([]);
      }
    } catch (err) {
      console.error('Error al cargar penalizaciones:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoverSancion = async (penalizacion: any) => {
    const confirmacion = window.confirm(
      `¿Deseas levantar la sanción al socio ${penalizacion.socioNombre || penalizacion.socio_dni}?\n\nMotivo justificado: Lluvia, enfermedad u otra excepción.`
    );
    if (!confirmacion) return;

    setRemovingId(penalizacion.id);
    try {
      const { error } = await supabase
        .from('penalizaciones')
        .update({ activa: false })
        .eq('id', penalizacion.id);

      if (error) {
        alert('Error al levantar sanción: ' + error.message);
      } else {
        // Refrescar lista local
        setPenalizaciones((prev) => prev.filter((p) => p.id !== penalizacion.id));
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setRemovingId(null);
    }
  };

  const handleCheckNow = async () => {
    setIsChecking(true);
    const count = await resolverTurnosSinValidar(config);
    if (count > 0) {
      alert(`Control de QR ejecutado: se aplicaron ${count} nuevas sanciones a participantes de turnos vencidos sin validación.`);
    } else {
      alert('Control de QR ejecutado: no se encontraron nuevos turnos vencidos pendientes de sanción.');
    }
    await fetchPenalizaciones();
    setIsChecking(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-lg p-6 relative shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold text-textPri">Socios Sancionados</h3>
              <p className="text-xs text-textSec">Levantar inhabilitaciones por lluvia, enfermedad o excepción</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              className="text-xs px-2.5 py-1.5 flex items-center gap-1 text-amber-300 hover:text-amber-200 border border-amber-500/30 bg-amber-950/20"
              onClick={handleCheckNow}
              disabled={isChecking}
            >
              {isChecking ? 'Verificando...' : '⚡ Controlar QR ahora'}
            </Button>
            <button onClick={onClose} className="text-textSec hover:text-textPri p-1 rounded-md">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pr-1">
          {loading ? (
            <p className="text-center py-10 text-textSec text-sm">Cargando sanciones...</p>
          ) : penalizaciones.length === 0 ? (
            <div className="text-center py-12 px-4 bg-[#0d0d0d] rounded-xl border border-[#2a2a2a]">
              <ShieldCheck size={36} className="mx-auto text-emerald-400 mb-2 opacity-80" />
              <p className="font-bold text-sm text-textPri">No hay socios sancionados</p>
              <p className="text-xs text-textSec mt-1">Todos los socios están habilitados para reservar normalmente.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {penalizaciones.map((p) => (
                <div
                  key={p.id}
                  className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-xl p-3.5 flex items-center justify-between gap-3 hover:border-amber-500/40 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-textPri truncate">
                      {p.socioNombre}
                    </p>
                    <p className="text-[11px] text-textSec">
                      DNI: {p.socio_dni} • Hasta el: <strong className="text-amber-400">{format(parseISO(p.fecha_fin), 'dd/MM/yyyy')}</strong>
                    </p>
                    <p className="text-[10px] text-textSec/80 mt-1 italic line-clamp-1">
                      {p.motivo}
                    </p>
                  </div>

                  <Button
                    variant="secondary"
                    className="shrink-0 text-xs py-1.5 px-3 font-semibold text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40 border border-emerald-500/30 flex items-center gap-1.5"
                    onClick={() => handleRemoverSancion(p)}
                    disabled={removingId === p.id}
                  >
                    <Trash2 size={13} />
                    {removingId === p.id ? 'Levantando...' : 'Habilitar'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-border flex justify-between items-center">
          <span className="text-xs text-textSec flex items-center gap-1">
            <AlertCircle size={13} /> Al hacer clic en <strong>Habilitar</strong>, el socio podrá volver a reservar al instante.
          </span>
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
};

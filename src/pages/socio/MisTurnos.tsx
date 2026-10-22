import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '../../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { QrCode, CheckCircle2 } from 'lucide-react';
import { QRScannerModal } from '../../components/QRScannerModal';
import { useClubConfig } from '../../lib/useClubConfig';

const isValidUuid = (value: any): boolean => {
  if (typeof value !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
};

export default function MisTurnos() {
  const { socio } = useAuth();
  const navigate = useNavigate();
  const { config } = useClubConfig();
  const [turnos, setTurnos] = useState<any[]>([]);
  const [loadingLocal, setLoadingLocal] = useState(true);

  // Estados para modal de escaneo QR
  const [scannerTurno, setScannerTurno] = useState<any>(null);

  useEffect(() => {
    fetchMisTurnos();
  }, [socio]);

  const fetchMisTurnos = async () => {
    if (!socio) return;
    setLoadingLocal(true);
    const { data, error } = await supabase
      .from('turnos')
      .select('*, canchas(nombre)')
      .eq('socio_dni', socio.dni)
      .order('fecha', { ascending: false })
      .order('hora_inicio', { ascending: false });

    if (!error && data) {
      setTurnos(data);
    }
    setLoadingLocal(false);
  };

  const cancelTurno = async (turno: any) => {
    if (!confirm('¿Estás seguro de cancelar este turno?')) return;
    
    const id = typeof turno === 'string' ? turno : turno?.id;
    
    let query = supabase
      .from('turnos')
      .update({ 
        estado: 'libre', 
        socio_dni: null, 
        acompanante: null,
        validado: false,
        validado_at: null
      });

    if (id && isValidUuid(id)) {
      query = query.eq('id', id);
    } else if (typeof turno === 'object' && turno !== null) {
      query = query
        .eq('cancha_id', turno.cancha_id)
        .eq('fecha', turno.fecha)
        .eq('hora_inicio', turno.hora_inicio);
    } else {
      alert("Error: No se pudo identificar el turno a cancelar.");
      return;
    }
      
    const { error } = await query;
      
    if (error) {
      alert("Error al cancelar: " + error.message);
    } else {
      let finalId = id;
      if ((!finalId || !isValidUuid(finalId)) && typeof turno === 'object' && turno !== null) {
        const { data: updatedTurno } = await supabase
          .from('turnos')
          .select('id')
          .eq('cancha_id', turno.cancha_id)
          .eq('fecha', turno.fecha)
          .eq('hora_inicio', turno.hora_inicio)
          .single();
        if (updatedTurno && isValidUuid(updatedTurno.id)) {
          finalId = updatedTurno.id;
        }
      }

      if (finalId && isValidUuid(finalId)) {
        supabase.functions.invoke('notify-waitlist', {
          body: { turno_id: finalId }
        }).catch(err => console.error("Error al notificar lista de espera", err));
      }
      fetchMisTurnos();
    }
  };

  /**
   * Determina si el turno se encuentra dentro de la ventana de validación
   * (tolerancia: 20 min antes y 20 min después del horario de inicio)
   */
  const canValidateTurno = (turno: any): boolean => {
    if (turno.validado) return false;
    if (turno.estado !== 'ocupado') return false;

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    if (turno.fecha !== todayStr) return false;
    if (!turno.hora_inicio) return false;

    // Calcular minutos desde medianoche para el inicio y la hora actual
    const [startH, startM] = turno.hora_inicio.slice(0, 5).split(':').map(Number);
    const startMinutes = startH * 60 + startM;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const tolerancia = config.tolerancia_minutos || 20;
    const windowStart = startMinutes - tolerancia;
    const windowEnd = startMinutes + tolerancia;

    return currentMinutes >= windowStart && currentMinutes <= windowEnd;
  };

  const handleTurnoValidated = async () => {
    if (!scannerTurno) return;

    try {
      let query = supabase
        .from('turnos')
        .update({
          validado: true,
          validado_at: new Date().toISOString()
        });

      if (scannerTurno.id && isValidUuid(scannerTurno.id)) {
        query = query.eq('id', scannerTurno.id);
      } else {
        query = query
          .eq('cancha_id', scannerTurno.cancha_id)
          .eq('fecha', scannerTurno.fecha)
          .eq('hora_inicio', scannerTurno.hora_inicio);
      }

      const { error } = await query;
      if (error) {
        alert('Error al guardar la validación: ' + error.message);
      } else {
        await fetchMisTurnos();
      }
    } catch (e: any) {
      console.error('Error al validar turno:', e);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-bold uppercase tracking-wide text-textSec">Mis Turnos</h2>
      
      {loadingLocal ? (
        <p className="text-center text-textSec py-10">Cargando...</p>
      ) : turnos.length === 0 ? (
        <div className="text-center py-20 text-textSec bg-surface rounded-lg border border-border">
          <p>No tienes turnos registrados.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {turnos.map(turno => {
            const dateObj = turno.fecha ? parseISO(turno.fecha) : new Date();
            const dateStr = turno.fecha || '';
            const todayStr = format(new Date(), 'yyyy-MM-dd');
            const nowHour = format(new Date(), 'HH:mm');
            const isFuture = dateStr > todayStr || (dateStr === todayStr && (turno.hora_inicio || '') > nowHour);
            const isValidable = canValidateTurno(turno);
            const formattedDate = !isNaN(dateObj.getTime())
              ? format(dateObj, "EEEE d 'de' MMMM", { locale: es })
              : dateStr;

            return (
              <div 
                key={turno.id} 
                className={`bg-surface border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isValidable ? 'border-primary ring-1 ring-primary/40' : 'border-border'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs text-textSec font-bold uppercase">
                      {formattedDate}
                    </p>
                    {turno.validado ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-500/40">
                        <CheckCircle2 size={12} /> Validado en Cancha
                      </span>
                    ) : isValidable ? (
                      <span className="animate-pulse inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        Validación Disponible
                      </span>
                    ) : null}
                  </div>

                  <p className="text-lg font-bold text-textPri mb-1">
                    {(turno.hora_inicio || '').slice(0, 5)} - {(turno.hora_fin || '').slice(0, 5)}
                  </p>
                  <p className="text-sm font-medium text-textPri">
                    {turno.canchas?.nombre}
                  </p>
                  {turno.acompanante && (
                    <p className="text-xs text-textSec mt-1">Acompañante: {turno.acompanante}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  {/* Botón para escanear QR si está en el rango de horario */}
                  {isValidable && (
                    <Button
                      variant="primary"
                      className="text-xs px-3 py-2 font-bold flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-black border-none shadow-lg animate-bounce"
                      onClick={() => setScannerTurno(turno)}
                    >
                      <QrCode size={16} />
                      Validar QR
                    </Button>
                  )}

                  {isFuture && turno.estado === 'ocupado' ? (
                    <>
                      <Button 
                        variant="secondary" 
                        className="text-xs px-3 py-2" 
                        onClick={() => navigate('/reservar', { state: { editTurno: turno } })}
                      >
                        Editar
                      </Button>
                      <Button 
                        variant="danger" 
                        className="text-xs px-3 py-2" 
                        onClick={() => cancelTurno(turno)}
                      >
                        Cancelar
                      </Button>
                    </>
                  ) : !turno.validado ? (
                    <span className="text-xs text-textSec px-2 py-1 bg-[#0d0d0d] rounded border border-[#2a2a2a] uppercase font-bold">
                      Completado
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Lector QR */}
      {scannerTurno && (
        <QRScannerModal
          isOpen={!!scannerTurno}
          onClose={() => setScannerTurno(null)}
          expectedCanchaId={scannerTurno.cancha_id}
          canchaNombre={scannerTurno.canchas?.nombre || `Cancha ${scannerTurno.cancha_id}`}
          onSuccess={handleTurnoValidated}
        />
      )}
    </div>
  );
}

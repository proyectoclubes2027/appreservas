import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '../../components/ui/Button';
import { useNavigate } from 'react-router-dom';

const isValidUuid = (value: any): boolean => {
  if (typeof value !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
};

export default function MisTurnos() {
  const { socio } = useAuth();
  const navigate = useNavigate();
  const [turnos, setTurnos] = useState<any[]>([]);
  const [loadingLocal, setLoadingLocal] = useState(true);

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
        acompanante: null 
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
            const dateObj = parseISO(turno.fecha);
            const dateStr = turno.fecha; // yyyy-MM-dd
            const todayStr = format(new Date(), 'yyyy-MM-dd');
            const nowHour = format(new Date(), 'HH:mm');
            const isFuture = dateStr > todayStr || (dateStr === todayStr && turno.hora_inicio > nowHour);

            return (
              <div key={turno.id} className="bg-surface border border-border rounded-lg p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-textSec font-bold uppercase mb-1">
                    {format(dateObj, "EEEE d 'de' MMMM", { locale: es })}
                  </p>
                  <p className="text-lg font-bold text-textPri mb-1">
                    {turno.hora_inicio.slice(0,5)} - {turno.hora_fin.slice(0,5)}
                  </p>
                  <p className="text-sm font-medium">
                    {turno.canchas.nombre}
                  </p>
                  {turno.acompanante && <p className="text-xs text-textSec mt-1">Acompañante: {turno.acompanante}</p>}
                </div>
                
                {isFuture && turno.estado === 'ocupado' ? (
                  <div className="flex flex-col gap-2">
                    <Button variant="secondary" className="text-xs px-4 py-2" onClick={() => navigate('/reservar', { state: { editTurno: turno } })}>
                      Editar
                    </Button>
                    <Button variant="danger" className="text-xs px-4 py-2" onClick={() => cancelTurno(turno)}>
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <span className="text-xs text-textSec px-2 py-1 bg-[#0d0d0d] rounded border border-[#2a2a2a] uppercase font-bold">
                    Completado
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

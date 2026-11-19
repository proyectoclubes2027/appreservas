import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Agenda() {
  const [turnos, setTurnos] = useState<any[]>([]);
  const [loadingLocal, setLoadingLocal] = useState(true);

  useEffect(() => {
    fetchAgenda();
  }, []);

  const fetchAgenda = async () => {
    setLoadingLocal(true);
    const today = format(new Date(), 'yyyy-MM-dd');
    const endDate = format(addDays(new Date(), 6), 'yyyy-MM-dd');

    const { data, error } = await supabase
      .from('turnos')
      .select('*, canchas(nombre), socios(nombre, apellido)')
      .gte('fecha', today)
      .lte('fecha', endDate)
      .eq('estado', 'ocupado')
      .order('fecha', { ascending: true })
      .order('hora_inicio', { ascending: true });

    if (!error && data) {
      setTurnos(data);
    }
    setLoadingLocal(false);
  };

  // Group turnos by fecha
  const turnosByDate = turnos.reduce((acc, turno) => {
    if (!acc[turno.fecha]) acc[turno.fecha] = [];
    acc[turno.fecha].push(turno);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl font-bold uppercase tracking-wide text-textSec">Agenda del Club</h2>
      <p className="text-sm text-textSec">Turnos reservados para los próximos 7 días.</p>
      
      {loadingLocal ? (
        <p className="text-center text-textSec py-10">Cargando...</p>
      ) : turnos.length === 0 ? (
        <div className="text-center py-20 text-textSec bg-surface rounded-lg border border-border">
          <p>La agenda está vacía.</p>
        </div>
      ) : (
        Object.keys(turnosByDate).map(fecha => (
          <div key={fecha} className="flex flex-col gap-2">
            <h3 className="text-sm font-bold bg-primary text-[#0d0d0d] px-3 py-1 inline-block self-start rounded-md">
              {format(new Date(fecha + 'T00:00:00'), "EEEE d 'de' MMMM", { locale: es })}
            </h3>
            
            <div className="flex flex-col gap-2">
              {turnosByDate[fecha].map((turno: any) => (
                <div key={turno.id} className="bg-surface border border-border rounded-lg p-3 flex justify-between items-start gap-3">
                  <div className="flex flex-col gap-1 w-full">
                    <p className="text-primary font-bold text-base">
                      {turno.hora_inicio.slice(0,5)} - {turno.hora_fin.slice(0,5)}
                    </p>
                    <div className="flex flex-col gap-1 bg-slate-100 p-2 mt-1 rounded-md border border-slate-200">
                      <p className="text-sm text-textPri font-bold">
                        👤 {turno.socios?.apellido}, {turno.socios?.nombre}
                      </p>
                      {turno.acompanante && (
                        <p className="text-sm text-textPri font-bold">
                          🤝 {turno.acompanante}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs bg-slate-100 text-primary px-2 border border-primary font-bold rounded mt-1 whitespace-nowrap hidden sm:block">
                    {turno.canchas.nombre}
                  </span>
                  <span className="text-[10px] bg-primary text-[#0d0d0d] px-1 font-bold rounded mt-1 whitespace-nowrap block sm:hidden">
                    {turno.canchas.nombre.replace('Cancha ', 'C')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

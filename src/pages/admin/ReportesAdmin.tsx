import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function ReportesAdmin() {
  const [stats, setStats] = useState<any>(null);
  const [loadingLocal, setLoadingLocal] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoadingLocal(true);
    
    try {
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

      // Todos los socios y canchas
      const [sociosRes, canchasRes, turnosRes] = await Promise.all([
        supabase.from('socios').select('dni, nombre, apellido'),
        supabase.from('canchas').select('id, nombre'),
        supabase.from('turnos').select('cancha_id, hora_inicio, socio_dni, fecha').eq('estado', 'ocupado')
      ]);

      const socios = sociosRes.data;
      const canchas = canchasRes.data;
      const turnos = turnosRes.data;
      
      if (!turnos || !socios || !canchas) return;

      const totalReservas = turnos.length;
      const turnosMes = turnos.filter(t => t.fecha >= firstDayOfMonth);
      
      // Estadísticas por cancha dinámicas (filtrando cancha 3 temporalmente)
      const canchasStats = canchas
        .filter(c => c.id !== 3)
        .map(c => ({
          id: c.id,
          nombre: c.nombre,
          count: turnos.filter(t => t.cancha_id === c.id).length
        }));

      // Horarios top
      const hsCount = turnos.reduce((acc: any, t) => {
        acc[t.hora_inicio] = (acc[t.hora_inicio] || 0) + 1;
        return acc;
      }, {});
      const topHora = Object.entries(hsCount).sort((a: any, b: any) => b[1] - a[1])[0];

      // Ranking de socios (reservas en el mes)
      const rankingSocios = socios.map(s => {
        const reservasMes = turnosMes.filter(t => t.socio_dni === s.dni).length;
        const reservasTotales = turnos.filter(t => t.socio_dni === s.dni).length;
        return { ...s, reservasMes, reservasTotales };
      }).filter(s => s.reservasTotales > 0).sort((a, b) => b.reservasMes - a.reservasMes);

      // Ranking de Invitado (anual)
      const currentYearStr = new Date().getFullYear().toString();
      const startOfYear = `${currentYearStr}-01-01`;
      const endOfYear = `${currentYearStr}-12-31`;
      
      const { data: turnosInvitado } = await supabase
        .from('turnos')
        .select('socio_dni')
        .gte('fecha', startOfYear)
        .lte('fecha', endOfYear)
        .ilike('acompanante', '%Especial, I.%')
        .neq('estado', 'libre');

      const rankingInvitado = socios.map(s => {
        const cant = (turnosInvitado || []).filter(t => t.socio_dni === s.dni).length;
        return { ...s, reservasInvitado: cant };
      }).filter(s => s.reservasInvitado > 0).sort((a, b) => b.reservasInvitado - a.reservasInvitado);

      setStats({
        totalReservas,
        canchasStats,
        topHora: topHora ? topHora[0] : 'N/A',
        rankingSocios,
        rankingInvitado
      });
    } catch (err) {
      console.error(err);
    }
    setLoadingLocal(false);
  };

  if (loadingLocal || !stats) return <div className="p-4 text-center">Cargando reportes...</div>;

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl font-bold uppercase tracking-wide text-textSec">Reportes</h2>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-surface border border-border p-4 rounded-xl flex flex-col items-center justify-center">
          <p className="text-primary text-4xl font-bold">{stats.totalReservas}</p>
          <p className="text-textSec text-xs font-semibold uppercase mt-1">Reservas Historicas</p>
        </div>
        <div className="bg-surface border border-border p-4 rounded-xl flex flex-col items-center justify-center">
          <p className="text-primary text-4xl font-bold">{stats.topHora.slice(0,5)} hs</p>
          <p className="text-textSec text-xs font-semibold uppercase mt-1">Horario más usado</p>
        </div>
        
        {stats.canchasStats.map((c: any) => (
          <div key={c.id} className="bg-surface border border-border p-4 rounded-xl flex flex-col items-center justify-center">
            <p className="text-textPri text-2xl font-bold">{c.count}</p>
            <p className="text-textSec text-xs font-semibold uppercase mt-1">Reservas {c.nombre}</p>
          </div>
        ))}
      </div>
      
      <div className="bg-surface border border-border rounded-xl p-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-textSec mb-4 px-1">Uso por Socios (Este Mes)</h3>
        
        <div className="flex flex-col gap-2">
          {stats.rankingSocios.length === 0 ? (
            <p className="text-center py-4 text-textSec text-sm">No hay reservas registradas este mes.</p>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden bg-[#0d0d0d]">
              <div className="flex items-center justify-between p-3 bg-white/5 border-b border-border text-[10px] font-bold uppercase text-textSec">
                <span>Socio</span>
                <div className="flex gap-6">
                  <span className="w-16 text-center">Mes</span>
                  <span className="w-16 text-center">Total</span>
                </div>
              </div>
              
              {stats.rankingSocios.map((s: any, idx: number) => (
                <div 
                  key={s.dni} 
                  className={`flex flex-row items-center justify-between p-3 ${idx !== 0 ? 'border-t border-border' : ''} hover:bg-white/5 transition-colors`}
                >
                  <p className="font-medium text-sm text-textPri truncate">
                    {s.apellido}, {s.nombre}
                  </p>
                  <div className="flex gap-6">
                     <p className="w-16 text-center font-bold text-primary">{s.reservasMes}</p>
                     <p className="w-16 text-center text-textSec text-xs">{s.reservasTotales}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl p-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-textSec mb-4 px-1">Uso de Invitado por Socio (Este Año)</h3>
        
        <div className="flex flex-col gap-2">
          {stats.rankingInvitado.length === 0 ? (
            <p className="text-center py-4 text-textSec text-sm">Nadie ha reservado con el invitado este año.</p>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden bg-[#0d0d0d]">
              <div className="flex items-center justify-between p-3 bg-white/5 border-b border-border text-[10px] font-bold uppercase text-textSec">
                <span>Socio</span>
                <span className="w-24 text-center">Cant. Reservas</span>
              </div>
              
              {stats.rankingInvitado.map((s: any, idx: number) => (
                <div 
                  key={s.dni} 
                  className={`flex flex-row items-center justify-between p-3 ${idx !== 0 ? 'border-t border-border' : ''} hover:bg-white/5 transition-colors`}
                >
                  <p className="font-medium text-sm text-textPri truncate">
                    {s.apellido}, {s.nombre}
                  </p>
                  <div className="flex justify-center w-24">
                     <p className={`font-bold ${s.reservasInvitado > 4 ? 'text-amber-400' : 'text-primary'}`}>
                       {s.reservasInvitado} {s.reservasInvitado > 4 && <span className="text-[10px] text-amber-500 font-normal">($ extra)</span>}
                     </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-primary/10 border border-primary p-4 rounded-lg">
        <p className="text-sm font-medium text-primary text-center">
          Estadísticas actualizadas al dia de hoy.
        </p>
      </div>
    </div>
  );
}

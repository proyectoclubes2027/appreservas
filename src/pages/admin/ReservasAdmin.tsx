import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { format, addDays, startOfDay } from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import { es } from 'date-fns/locale';
import { Button } from '../../components/ui/Button';
import { SHIFTS } from '../../lib/constants';
import { Settings } from 'lucide-react';
import { useClubConfig } from '../../lib/useClubConfig';
import { ClubConfigModal } from '../../components/ClubConfigModal';

const isValidUuid = (value: any): boolean => {
  if (typeof value !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
};

export default function ReservasAdmin() {
  const { socio } = useAuth();
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
  const [turnosData, setTurnosData] = useState<any[]>([]);
  const [canchasList, setCanchasList] = useState<any[]>([]);
  const [loadingLocal, setLoadingLocal] = useState(true);

  // States for blocking modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<any>(null);
  const [modalCanchaId, setModalCanchaId] = useState<number>(1);
  const [motivoBloqueo, setMotivoBloqueo] = useState('');
  const [tipoBloqueo, setTipoBloqueo] = useState<'mantenimiento' | 'clases'>('mantenimiento');

  // States for Mass Blocking
  const [isMassBlockModalOpen, setIsMassBlockModalOpen] = useState(false);
  const [massBlockStartHour, setMassBlockStartHour] = useState('10:00');
  const [massBlockMotivo, setMassBlockMotivo] = useState('Lluvia');
  const [massBlockLoading, setMassBlockLoading] = useState(false);

  // States for detail modal
  const [infoTurno, setInfoTurno] = useState<any>(null);

  // States for Club Config
  const { config, updateConfig } = useClubConfig();
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  const today = startOfDay(new Date());
  let dates = Array.from({ length: 7 }).map((_, i) => addDays(today, i));
  
  // Ensure selectedDate is in the visible list
  if (!dates.some(d => d.getTime() === selectedDate.getTime())) {
    dates.push(selectedDate);
    dates.sort((a, b) => a.getTime() - b.getTime());
  }

  useEffect(() => {
    const initPage = async () => {
      setLoadingLocal(true);
      await Promise.all([fetchTurnos(), fetchCanchas()]);
      setLoadingLocal(false);
    };
    initPage();
  }, [selectedDate]);

  const confirmMassBlock = async () => {
    setMassBlockLoading(true);
    let inserts: any[] = [];
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    let affectedTurnos: any[] = [];

    canchasList.forEach(cancha => {
      SHIFTS.forEach(shift => {
        if (shift.start >= massBlockStartHour) {
          inserts.push({
            cancha_id: cancha.id,
            fecha: dateStr,
            hora_inicio: shift.start,
            hora_fin: shift.end,
            estado: 'bloqueado',
            motivo_bloqueo: massBlockMotivo || 'Clima / Mantenimiento',
            socio_dni: socio?.dni,
            acompanante: null
          });

          const existingTurno = turnosData.find((t: any) => t.hora_inicio.startsWith(shift.start) && t.cancha_id === cancha.id);
          if (existingTurno && existingTurno.estado === 'ocupado') {
            affectedTurnos.push(existingTurno);
          }
        }
      });
    });

    const { error } = await supabase.from('turnos').upsert(inserts, { onConflict: 'cancha_id,fecha,hora_inicio' });

    if (error) {
      alert("Error en bloqueo masivo: " + error.message);
    } else {
      affectedTurnos.forEach(turno => {
        if (turno.socio_dni) {
          supabase.functions.invoke('notify-cancellation', {
            body: { 
              socio_dni: turno.socio_dni,
              fecha: format(new Date(turno.fecha), 'dd/MM/yyyy'),
              hora: turno.hora_inicio.substring(0, 5),
              motivo: `Cancelación Masiva: ${massBlockMotivo}`
            }
          }).catch(err => console.error("Error al notificar masivamente", err));
        }
      });
      
      alert(`Bloqueo masivo aplicado. Se cancelaron ${affectedTurnos.length} turnos ocupados y se bloquearon las canchas a partir de las ${massBlockStartHour}hs.`);
      fetchTurnos();
      setIsMassBlockModalOpen(false);
      setMassBlockMotivo('Lluvia');
      setMassBlockStartHour('10:00');
    }
    setMassBlockLoading(false);
  };

  const handleUnblockSundays = async () => {
    if (!confirm("¿Estás seguro de que quieres desbloquear TODOS los turnos bloqueados que caen en días Domingo de acá en adelante?")) return;
    
    setLoadingLocal(true);
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    
    // Obtener turnos bloqueados desde hoy
    const { data: turnos, error: fetchError } = await supabase
      .from('turnos')
      .select('id, fecha')
      .eq('estado', 'bloqueado')
      .gte('fecha', todayStr);

    if (fetchError) {
      alert("Error al obtener turnos: " + fetchError.message);
      setLoadingLocal(false);
      return;
    }

    const turnosDomingo = turnos.filter(turno => {
      const [y, m, d] = turno.fecha.split('-');
      const date = new Date(Number(y), Number(m) - 1, Number(d));
      return date.getDay() === 0;
    });

    if (turnosDomingo.length === 0) {
      alert("No se encontraron domingos bloqueados.");
      setLoadingLocal(false);
      return;
    }

    const idsToDelete = turnosDomingo.map(t => t.id);
    const { error: deleteError } = await supabase
      .from('turnos')
      .delete()
      .in('id', idsToDelete);

    if (deleteError) {
      alert("Error al eliminar: " + deleteError.message);
    } else {
      alert(`¡Se han desbloqueado ${idsToDelete.length} turnos exitosamente!`);
      fetchTurnos();
    }
    setLoadingLocal(false);
  };

  const handleUnblockSaturdays = async () => {
    if (!confirm("¿Estás seguro de que quieres desbloquear TODOS los turnos bloqueados que caen en días Sábado de acá en adelante?")) return;
    
    setLoadingLocal(true);
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    
    // Obtener turnos bloqueados desde hoy
    const { data: turnos, error: fetchError } = await supabase
      .from('turnos')
      .select('id, fecha')
      .eq('estado', 'bloqueado')
      .gte('fecha', todayStr);

    if (fetchError) {
      alert("Error al obtener turnos: " + fetchError.message);
      setLoadingLocal(false);
      return;
    }

    const turnosSabado = turnos.filter(turno => {
      const [y, m, d] = turno.fecha.split('-');
      const date = new Date(Number(y), Number(m) - 1, Number(d));
      return date.getDay() === 6; // Sábado
    });

    if (turnosSabado.length === 0) {
      alert("No se encontraron sábados bloqueados.");
      setLoadingLocal(false);
      return;
    }

    const idsToDelete = turnosSabado.map(t => t.id);
    const { error: deleteError } = await supabase
      .from('turnos')
      .delete()
      .in('id', idsToDelete);

    if (deleteError) {
      alert("Error al eliminar: " + deleteError.message);
    } else {
      alert(`¡Se han desbloqueado ${idsToDelete.length} turnos exitosamente!`);
      fetchTurnos();
    }
    setLoadingLocal(false);
  };

  const fetchTurnos = async () => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const { data, error } = await supabase
      .from('turnos')
      .select('*, socios(nombre, apellido)')
      .eq('fecha', dateStr);

    if (!error && data) {
      setTurnosData(data);
    }
  };

  const fetchCanchas = async () => {
    const { data } = await supabase.from('canchas').select('*').order('id', { ascending: true });
    if (data) {
      // Ocultamos la cancha 3 temporalmente
      setCanchasList(data.filter(c => c.id !== 3));
    }
  };

  const handleBlockClick = (shift: any, canchaId: number) => {
    setSelectedShift(shift);
    setModalCanchaId(canchaId);
    setIsModalOpen(true);
  };

  const confirmBlock = async () => {
    let inserts = [];
    const weeks = tipoBloqueo === 'clases' ? 24 : 1; // 24 semanas para permanente

    for (let i = 0; i < weeks; i++) {
        const d = addDays(selectedDate, i * 7);
        const dateStr = format(d, 'yyyy-MM-dd');
        inserts.push({
            cancha_id: modalCanchaId,
            fecha: dateStr,
            hora_inicio: selectedShift.start,
            hora_fin: selectedShift.end,
            estado: 'bloqueado',
            motivo_bloqueo: motivoBloqueo || (tipoBloqueo === 'clases' ? 'Clases' : 'Mantenimiento'),
            socio_dni: socio?.dni
        });
    }

    const { error } = await supabase.from('turnos').upsert(inserts, { onConflict: 'cancha_id,fecha,hora_inicio' });

    if (error) alert("Error: " + error.message);
    else fetchTurnos();

    setIsModalOpen(false);
    setMotivoBloqueo('');
    setTipoBloqueo('mantenimiento');
  };

  const unlockOrCancel = async (turno: any) => {
    const isOcupado = turno.estado === 'ocupado';
    const message = isOcupado 
      ? '¿Seguro que deseas CANCELAR la reserva del socio? Se le enviará una notificación automática.' 
      : '¿Seguro que deseas eliminar este bloqueo?';
      
    if (!confirm(message)) return;
    
    setLoadingLocal(true);
    const id = typeof turno === 'string' ? turno : turno?.id;

    let query;
    if (isOcupado) {
      // Si está ocupado, lo actualizamos a libre para que se pueda notificar a la lista de espera
      query = supabase
        .from('turnos')
        .update({ 
          estado: 'libre', 
          socio_dni: null, 
          acompanante: null 
        });
    } else {
      // De lo contrario (bloqueado), eliminamos la fila
      query = supabase
        .from('turnos')
        .delete();
    }

    if (id && isValidUuid(id)) {
      query = query.eq('id', id);
    } else if (typeof turno === 'object' && turno !== null) {
      query = query
        .eq('cancha_id', turno.cancha_id)
        .eq('fecha', turno.fecha)
        .eq('hora_inicio', turno.hora_inicio);
    } else {
      alert("Error: No se pudo identificar el turno.");
      setLoadingLocal(false);
      return;
    }

    const { error } = await query;
    if (!error) {
      if (isOcupado) {
        // Notificar al socio cancelado
        if (turno.socio_dni) {
          supabase.functions.invoke('notify-cancellation', {
            body: { 
              socio_dni: turno.socio_dni,
              fecha: format(new Date(turno.fecha), 'dd/MM/yyyy'),
              hora: turno.hora_inicio.substring(0, 5),
              motivo: 'Cancelación por administración / Clima'
            }
          }).catch(err => console.error("Error al notificar cancelación", err));
        }

        // Notificar a la lista de espera
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
      }
      fetchTurnos();
      setInfoTurno(null);
    } else {
      alert("Error: " + error.message);
    }
    setLoadingLocal(false);
  };

  const renderBotonCancha = (shift: any, canchaId: number) => {
    const turnoDb = turnosData.find(t => t.hora_inicio.startsWith(shift.start) && t.cancha_id === canchaId);
    
    // Check if vencido
    const now = new Date();
    const isToday = selectedDate.getTime() === startOfDay(now).getTime();
    const currentHour = format(now, 'HH:mm');
    const isVencido = selectedDate.getTime() < startOfDay(now).getTime() || (isToday && shift.start < currentHour);

    const isLibre = !turnoDb || turnoDb.estado === 'libre';
    const isBloqueado = turnoDb?.estado === 'bloqueado';
    const isOcupado = turnoDb?.estado === 'ocupado';

    let bgClass = "bg-surface border-available text-available hover:bg-available/10";
    if (isVencido) {
      bgClass = "bg-surface border-[#2a2a2a] text-[#555] opacity-50 cursor-not-allowed";
    } else if (isBloqueado) {
      bgClass = "bg-surface border-blocked text-blocked opacity-80 cursor-pointer";
    } else if (isOcupado) {
      bgClass = "bg-[#1d4ed8] border-[#1d4ed8] text-white cursor-pointer"; // Reservado
    } else {
      bgClass = "bg-[#93c5fd] border-[#93c5fd] text-blue-900 cursor-pointer"; // Libre
    }

    const handleClick = () => {
      if (isVencido) return;
      if (isLibre) {
        handleBlockClick(shift, canchaId);
      } else {
        setInfoTurno({ ...turnoDb, shift }); // Admin view details
      }
    };

    const isShort = shift.start === '19:00';
    return (
      <button 
        key={shift.start} 
        onClick={handleClick} 
        className={`flex flex-col items-center justify-center ${isShort ? 'h-10' : 'h-14'} rounded-lg text-sm font-bold border transition-colors shadow-sm ${bgClass}`}
        title={isLibre ? "Bloquear" : "Ver Detalle"}
      >
        <span>{shift.start}</span>
        {isShort && <span className="text-[10px] font-bold leading-none mt-0.5">(1 Hora)</span>}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center bg-surface p-4 rounded-xl border border-border mt-2">
        <h2 className="text-xl font-bold uppercase tracking-wide text-textSec m-0">Gestión de Reservas</h2>
        <div className="flex gap-2 flex-wrap justify-end">
          <Button variant="secondary" onClick={handleUnblockSaturdays} className="flex items-center gap-2 shadow-sm text-xs sm:text-sm">
            <span className="hidden sm:inline">Desbloquear Sábados</span>
            <span className="inline sm:hidden">Desbloq. Sáb.</span>
          </Button>
          <Button variant="secondary" onClick={handleUnblockSundays} className="flex items-center gap-2 shadow-sm text-xs sm:text-sm">
            <span className="hidden sm:inline">Desbloquear Domingos</span>
            <span className="inline sm:hidden">Desbloq. Dom.</span>
          </Button>
          <Button variant="danger" onClick={() => setIsMassBlockModalOpen(true)} className="flex items-center gap-2 shadow-sm text-xs sm:text-sm shadow-danger/20">
            <span className="hidden sm:inline">⛈️ Bloqueo Masivo</span>
            <span className="inline sm:hidden">⛈️ Bloquear Día</span>
          </Button>
          <Button variant="primary" onClick={() => setIsConfigModalOpen(true)} className="flex items-center gap-1.5 shadow-sm text-xs sm:text-sm font-bold">
            <Settings size={16} />
            <span className="hidden sm:inline">Reglas & QR</span>
            <span className="inline sm:hidden">Reglas</span>
          </Button>
        </div>
      </div>

      {/* Date Selector */}
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {dates.map((d, idx) => {
          const isSelected = d.getTime() === selectedDate.getTime();
          return (
            <button
              key={idx}
              onClick={() => setSelectedDate(d)}
              className={`flex-shrink-0 flex flex-col items-center justify-center w-16 h-20 rounded-xl border-2 transition-colors shadow-sm ${
                isSelected ? 'bg-primary border-primary text-[#0d0d0d]' : 'bg-[#161616] border-[#2a2a2a] text-textPri'
              }`}
            >
              <span className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isSelected ? 'text-[#0d0d0d]' : 'text-textSec'}`}>
                {format(d, 'EEE', { locale: es })}
              </span>
              <span className="text-xl font-bold leading-none">{format(d, 'dd')}</span>
            </button>
          );
        })}
        
        {/* Date Picker Arbitrario */}
        <div className="flex-shrink-0 flex flex-col items-center justify-center w-16 h-20 rounded-xl border-2 border-[#2a2a2a] bg-[#161616] relative overflow-hidden transition-colors hover:border-primary/50 group">
          <input 
            type="date" 
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            onChange={(e) => {
              if (e.target.value) {
                const [y, m, d] = e.target.value.split('-');
                setSelectedDate(new Date(Number(y), Number(m) - 1, Number(d)));
              }
            }}
          />
          <div className="flex flex-col items-center justify-center pointer-events-none text-textPri group-hover:text-primary transition-colors">
            <span className="text-[10px] font-bold uppercase tracking-wider mb-1 text-textSec group-hover:text-primary">
              MÁS
            </span>
            <span className="text-xl">📅</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-8">
        {loadingLocal ? (
          <p className="text-center py-10">Cargando...</p>
        ) : (
          <>
            {canchasList.map(cancha => (
              <div key={cancha.id}>
                <div className="flex justify-between items-center mb-4 border-b border-[#2a2a2a] pb-2">
                  <h3 className="text-lg font-bold text-textPri">{cancha.nombre}</h3>
                  <span className="text-xs text-textSec">Click en Libre para Bloquear</span>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                  {SHIFTS.map(shift => renderBotonCancha(shift, cancha.id))}
                </div>
              </div>
            ))}

            {/* Referencias (Legend) */}
            <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium items-center justify-start mt-6 border-t border-border pt-6 text-textPri">
              <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-md bg-[#93c5fd]"></div> Libre</div>
              <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-md bg-[#1d4ed8]"></div> Ocupado</div>
              <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-md border border-blocked bg-[#161616]"></div> Bloqueado</div>
              <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-md border border-[#2a2a2a] bg-[#161616]"></div> Vencido</div>
            </div>
          </>
        )}
      </div>

      {/* Modal Bloqueo */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#0d0d0d]/80 z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">Bloquear Cancha {modalCanchaId}</h3>
            <p className="text-sm mb-4 text-textSec">{selectedShift?.start} - {selectedShift?.end}</p>
            
            <div className="flex gap-4 mb-4">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="radio" value="mantenimiento" checked={tipoBloqueo === 'mantenimiento'} onChange={() => { setTipoBloqueo('mantenimiento'); setMotivoBloqueo(''); }} className="text-primary accent-primary" />
                Mantenimiento Puntual
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="radio" value="clases" checked={tipoBloqueo === 'clases'} onChange={() => { setTipoBloqueo('clases'); setMotivoBloqueo('Clases - Profe'); }} className="text-primary accent-primary" />
                Clases (Permanente)
              </label>
            </div>
            
            <textarea
              className="w-full bg-[#0d0d0d] border border-border rounded-md p-3 text-textPri outline-none focus:border-primary mb-6 resize-none"
              placeholder={tipoBloqueo === 'clases' ? "Clases" : "Motivo del bloqueo (ej: Mantenimiento)"}
              value={motivoBloqueo}
              onChange={e => setMotivoBloqueo(e.target.value)}
              rows={2}
            />

            <div className="flex gap-3">
              <Button variant="secondary" fullWidth onClick={() => setIsModalOpen(false)}>Atrás</Button>
              <Button variant="primary" fullWidth onClick={confirmBlock}>Confirmar Bloqueo</Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Bloqueo Masivo */}
      {isMassBlockModalOpen && (
        <div className="fixed inset-0 bg-[#0d0d0d]/80 z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-danger/50 shadow-[0_0_15px_rgba(239,68,68,0.15)] rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-xl font-black mb-1 text-danger uppercase tracking-tighter">⛈️ Bloqueo Masivo</h3>
            <p className="text-sm mb-6 text-textSec">Día: {format(selectedDate, 'dd/MM/yyyy')}</p>
            
            <div className="flex flex-col gap-4 mb-6">
              <div>
                <label className="text-xs font-bold text-textSec uppercase mb-1 block">A partir del horario:</label>
                <select 
                  className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-md p-3 text-textPri outline-none focus:border-primary"
                  value={massBlockStartHour}
                  onChange={e => setMassBlockStartHour(e.target.value)}
                >
                  {SHIFTS.map(s => (
                    <option key={s.start} value={s.start}>{s.start} hs</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-textSec uppercase mb-1 block">Motivo (Visible para socios):</label>
                <input
                  type="text"
                  className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-md p-3 text-textPri outline-none focus:border-danger"
                  placeholder="Ej: Lluvia / Cierre temporal"
                  value={massBlockMotivo}
                  onChange={e => setMassBlockMotivo(e.target.value)}
                />
              </div>
            </div>

            <div className="bg-danger/10 text-danger text-xs font-bold p-3 rounded-lg border border-danger/20 mb-6 text-center leading-relaxed">
              ⚠️ Al confirmar, <b>TODOS</b> los turnos a partir de este horario quedarán bloqueados, y las reservas vigentes serán CANCELADAS devolviendo el cupo al socio.
            </div>

            <div className="flex gap-3">
              <Button variant="secondary" fullWidth onClick={() => setIsMassBlockModalOpen(false)}>Cancelar</Button>
              <Button variant="danger" fullWidth onClick={confirmMassBlock} disabled={massBlockLoading}>
                {massBlockLoading ? 'Procesando...' : 'Aplicar'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalle (Turno Ocupado/Bloqueado Admin) */}
      {infoTurno && (
        <div className="fixed inset-0 bg-[#0d0d0d]/80 z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-sm text-center">
            <h3 className="text-lg font-bold mb-2 text-primary">Gestión del Turno</h3>
            <p className="text-textSec mb-6 border-b border-border pb-4">{infoTurno.shift.start} a {infoTurno.shift.end}hs - Cancha {infoTurno.cancha_id}</p>
            
            {infoTurno.estado === 'bloqueado' ? (
              <p className="text-blocked text-lg font-semibold bg-blocked/10 p-4 rounded-lg mb-6">{infoTurno.motivo_bloqueo || 'Bloqueado por Mantenimiento'}</p>
            ) : (
              <div className="bg-[#0d0d0d] rounded-lg p-4 border border-[#2a2a2a] text-left mb-6">
                <p className="text-xs font-bold text-textSec mb-1 uppercase">Titular de la Reserva</p>
                <p className="text-lg text-primary">{infoTurno.socios.apellido}, {infoTurno.socios.nombre}</p>
                <p className="text-[10px] text-textSec mt-1 leading-tight">DNI: {infoTurno.socio_dni}</p>

                <div className="mt-2.5">
                  {infoTurno.validado ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-md bg-emerald-950 text-emerald-400 border border-emerald-500/40">
                      ✓ Turno Validado con QR
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-md bg-zinc-900 text-zinc-400 border border-zinc-700">
                      Pendiente / Sin Validar
                    </span>
                  )}
                </div>
                
                {infoTurno.acompanante && (
                  <div className="mt-4 pt-4 border-t border-[#2a2a2a]">
                    <p className="text-xs font-bold text-textSec mb-1 uppercase">Jugadores adicionales</p>
                    <p className="text-sm text-textPri">{infoTurno.acompanante}</p>
                  </div>
                )}
              </div>
            )}
            
            <div className="flex gap-3">
              <Button variant="secondary" fullWidth onClick={() => setInfoTurno(null)}>Cerrar</Button>
              <Button variant="danger" fullWidth onClick={() => unlockOrCancel(infoTurno)}>
                {infoTurno.estado === 'bloqueado' ? 'Desbloquear' : 'Cancelar Turno'}
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Modal Ajustes y Reglas del Club */}
      <ClubConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        config={config}
        onSave={updateConfig}
      />
    </div>
  );
}

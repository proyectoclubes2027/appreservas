import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { SHIFTS } from '../../lib/constants';
import { format, addDays, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '../../components/ui/Button';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { loginOneSignal } from '../../lib/onesignal';
export default function Reservar() {
  const { socio } = useAuth();
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
  const [turnosData, setTurnosData] = useState<any[]>([]);
  const [canchasList, setCanchasList] = useState<any[]>([]);
  const [loadingLocal, setLoadingLocal] = useState(true);
  
  // List of all active socios for dropdown
  const [sociosList, setSociosList] = useState<any[]>([]);

  // States for modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<any>(null);
  const [modalCanchaId, setModalCanchaId] = useState<number>(1);
  const [tipoJuego, setTipoJuego] = useState<'single' | 'dobles'>('single');
  const [comp1, setComp1] = useState<string>(''); // DNI
  const [comp2, setComp2] = useState<string>('');
  const [comp3, setComp3] = useState<string>('');
  const [reservingLocal, setReservingLocal] = useState(false);
  
  // State for shift details modal
  const [infoTurno, setInfoTurno] = useState<any>(null);

  const dates = Array.from({ length: 7 }).map((_, i) => addDays(startOfDay(new Date()), i));

  useEffect(() => {
    const initPage = async () => {
      setLoadingLocal(true);
      await Promise.all([fetchTurnos(), fetchSocios(), fetchCanchas()]);
      setLoadingLocal(false);
    };
    initPage();
  }, [selectedDate]);

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

  const fetchSocios = async () => {
    const { data } = await supabase
      .from('socios')
      .select('dni, nombre, apellido')
      .eq('activo', true)
      .eq('estado', 'activo')
      .order('apellido', { ascending: true });
    if (data) setSociosList(data);
  };

  const fetchCanchas = async () => {
    const { data } = await supabase.from('canchas').select('*').order('id', { ascending: true });
    if (data) {
      setCanchasList(data.filter(c => c.id !== 3));
    }
  };

  const handlePayDebt = () => {
    alert("Próximamente habilitaremos el pago con Mercado Pago.");
  };

  const handleInformarPago = () => {
    if (!socio) return;
    const phoneNumber = '543400510262';
    const mensaje = `Hola! Soy ${socio.nombre} ${socio.apellido}, mi DNI es ${socio.dni}. Quiero informar un pago para regularizar mi situación.`;
    const url = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
  };


  const hasActiveTurno = async (dniCheck: string) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const nowHour = format(new Date(), 'HH:mm');
    
    // Obtenemos los turnos del jugador desde hoy en adelante que estén OCUPADOS
    const { data } = await supabase
      .from('turnos')
      .select('fecha, hora_fin')
      .eq('socio_dni', dniCheck)
      .eq('estado', 'ocupado')
      .gte('fecha', today);
    
    if (!data || data.length === 0) return false;

    // Si tiene turnos mañana o después, ya cuenta como 1 activo
    const futureTurns = data.filter(t => t.fecha > today);
    if (futureTurns.length > 0) return true;

    // Si tiene turnos hoy, verificar que no hayan terminado aún
    const todayTurns = data.filter(t => t.fecha === today);
    const activeToday = todayTurns.some(t => t.hora_fin > nowHour);
    
    return activeToday;
  };

  const handleReserveClick = (shift: any, canchaId: number) => {
    setSelectedShift(shift);
    setModalCanchaId(canchaId);
    setTipoJuego('single');
    setComp1('');
    setComp2('');
    setComp3('');
    setIsModalOpen(true);
  };

  const confirmReservation = async () => {
    if (!socio) return;
    if (socio?.isMoroso) {
      alert(`No puedes reservar: Posees una deuda de ${socio.mesesDeuda} meses. Por favor, regulariza tu situación.`);
      return;
    }
    setReservingLocal(true);
    
    // Determine the list of DNIS involved
    const participants = [socio.dni];
    if (tipoJuego === 'single' && comp1) participants.push(comp1);
    else if (tipoJuego === 'dobles') {
      if (comp1) participants.push(comp1);
      if (comp2) participants.push(comp2);
      if (comp3) participants.push(comp3);
    }

    // Check uniqueness explicitly to avoid a single person twice
    const uniqueParticipants = Array.from(new Set(participants));
    if (uniqueParticipants.length !== participants.length) {
      alert("Has seleccionado al mismo jugador repetidas veces.");
      setReservingLocal(false);
      return;
    }

    // Validate rules: Max 1 active for EVERY participant
    for (const d of participants) {
      const active = await hasActiveTurno(d);
      if (active) {
        const s = sociosList.find(x => x.dni === d) || socio;
        alert(`Error: El jugador ${s.apellido}, ${s.nombre} ya tiene un turno activo. Debe cancelarlo antes de reservar o integrar otra partida.`);
        setReservingLocal(false);
        return;
      }
    }

    // Format acompanante string for DB (storing names so it renders perfectly on screen without schema mods)
    let acomnames = '';
    const nameMap = new Map(sociosList.map(s => [s.dni, `${s.apellido}, ${s.nombre.charAt(0)}.`]));
    if (tipoJuego === 'single' && comp1) acomnames = nameMap.get(comp1) || '';
    if (tipoJuego === 'dobles') {
      const names = [comp1, comp2, comp3].filter(Boolean).map(d => nameMap.get(d));
      acomnames = names.join(' / ');
    }

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    
    const { error } = await supabase.from('turnos').upsert({
      cancha_id: modalCanchaId,
      fecha: dateStr,
      hora_inicio: selectedShift.start,
      hora_fin: selectedShift.end,
      socio_dni: socio.dni,
      acompanante: acomnames,
      estado: 'ocupado'
    }, { onConflict: 'cancha_id,fecha,hora_inicio' });

    if (error) {
      alert("Error al reservar: " + error.message);
    } else {
      fetchTurnos();
      setIsModalOpen(false);
    }
    setReservingLocal(false);
  };

  const cancelTurno = async (turno: any) => {
    if (!confirm('¿Estás seguro de cancelar tu reserva?')) return;
    setReservingLocal(true);
    
    const id = typeof turno === 'string' ? turno : turno?.id;
    
    let query = supabase
      .from('turnos')
      .update({ 
        estado: 'libre', 
        socio_dni: null, 
        acompanante: null 
      });

    if (id && id !== 'undefined') {
      query = query.eq('id', id);
    } else if (typeof turno === 'object') {
      query = query
        .eq('cancha_id', turno.cancha_id)
        .eq('fecha', turno.fecha)
        .eq('hora_inicio', turno.hora_inicio);
    } else {
      alert("Error: No se pudo identificar el turno a cancelar.");
      setReservingLocal(false);
      return;
    }

    const { error } = await query;
    if (error) {
      alert("Error al cancelar: " + error.message);
    } else {
      let finalId = id;
      if ((!finalId || finalId === 'undefined') && typeof turno === 'object') {
        const { data: updatedTurno } = await supabase
          .from('turnos')
          .select('id')
          .eq('cancha_id', turno.cancha_id)
          .eq('fecha', turno.fecha)
          .eq('hora_inicio', turno.hora_inicio)
          .single();
        if (updatedTurno) {
          finalId = updatedTurno.id;
        }
      }

      if (finalId && finalId !== 'undefined') {
        supabase.functions.invoke('notify-waitlist', {
          body: { turno_id: finalId }
        }).catch(err => console.error("Error al notificar lista de espera", err));
      }
      fetchTurnos();
      setInfoTurno(null);
    }
    setReservingLocal(false);
  };

  const joinWaitlist = async () => {
    if (!socio || !infoTurno) return;
    setReservingLocal(true);
    
    // Vincular OneSignal si no está vinculado
    await loginOneSignal(socio.dni);

    try {
      const { error } = await supabase.from('lista_espera').insert({
        turno_id: infoTurno.id,
        socio_dni: socio.dni
      });
      
      if (error) {
        if (error.code === '23505') alert("Ya estás en la lista de espera de este turno.");
        else alert("Error al unirse: " + error.message);
      } else {
        alert("¡Te has unido a la lista de espera! Te notificaremos si el turno se libera.");
        setInfoTurno(null);
      }
    } catch (err) {
      console.error(err);
    }
    setReservingLocal(false);
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
    const isMio = turnoDb?.socio_dni === socio?.dni;
    const isOcupadoPorOtro = turnoDb?.estado === 'ocupado' && !isMio;

    let bgClass = "bg-surface border-available text-available hover:bg-available/10";
    if (isVencido) {
      bgClass = "bg-surface border-[#2a2a2a] text-[#555] opacity-50 cursor-not-allowed";
    } else if (isBloqueado) {
      bgClass = "bg-surface border-blocked text-blocked opacity-80";
    } else if (isMio) {
      bgClass = "bg-[#d97706] border-[#d97706] text-white"; // Turno Propio (orange-600)
    } else if (isOcupadoPorOtro) {
      bgClass = "bg-[#1d4ed8] border-[#1d4ed8] text-white"; // Turno Reservado (blue-700)
    } else {
      bgClass = "bg-[#93c5fd] border-[#93c5fd] text-blue-900"; // Libre Normal (blue-300)
    }

    const handleClick = () => {
      if (isVencido) return;
      if (socio?.isMoroso) {
         alert("Posees meses impagos. Por favor regulariza tu situación para reservar.");
         return;
      }
      if (isLibre) {
        handleReserveClick(shift, canchaId);
      } else {
        setInfoTurno({ ...turnoDb, shift }); // Guardamos el turno para ver el detalle
      }
    };

    const isShort = shift.start === '19:00';
    return (
      <button 
        key={shift.start} 
        onClick={handleClick} 
        className={`flex flex-col items-center justify-center ${isShort ? 'h-10' : 'h-14'} rounded-lg text-sm font-bold border transition-colors shadow-sm ${bgClass}`}
      >
        <span>{shift.start}</span>
        {isShort && <span className="text-[10px] font-bold leading-none mt-0.5">(1 Hora)</span>}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Welcome Card */}
      {socio && (
        <div className="flex justify-between items-center bg-[#161616] p-4 rounded-xl border border-[#2a2a2a] mb-2 shadow-sm">
          <div className="flex flex-col">
            <span className="text-[10px] text-textSec uppercase font-bold tracking-wider mb-1">Bienvenido/a</span>
            <span className="text-lg font-bold text-primary leading-none">{socio.nombre} {socio.apellido}</span>
          </div>
          <div className="w-12 h-12 rounded-full bg-[#0d0d0d] flex items-center justify-center border-2 border-primary">
            <span className="text-lg font-bold text-textPri uppercase">{socio.nombre.charAt(0)}{socio.apellido.charAt(0)}</span>
          </div>
        </div>
      )}

      <h2 className="text-xl font-bold uppercase tracking-wide text-textSec">Seleccioná el día</h2>
      
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
      </div>

      <h2 className="text-sm font-bold uppercase tracking-wide text-textSec mt-4">Horarios</h2>

      {/* Grid Menu de Canchas y Horarios */}
      <div className="flex flex-col gap-8">
        {loadingLocal ? (
          <p className="text-center text-textSec py-10">Cargando...</p>
        ) : (
          <>
            {socio?.isMoroso && (
              <div className="bg-[#1a0f0f] border-2 border-blocked text-[#e8a3a3] p-5 rounded-xl mb-6 flex flex-col gap-4 shadow-[0_0_15px_rgba(239,68,68,0.15)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blocked/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                <div className="flex flex-col gap-1 relative z-10">
                  <p className="font-black tracking-wide text-sm text-blocked uppercase">⚠️ Bloqueo por Morosidad</p>
                  <p className="text-sm font-medium">Se registran {socio?.mesesDeuda} meses impagos. Por favor regulariza tu situación.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 relative z-10">
                  <Button variant="primary" className="flex-1 font-bold shadow-lg shadow-primary/20" onClick={handlePayDebt} disabled={loadingLocal}>
                      Mercado Pago
                  </Button>
                  <Button variant="secondary" className="flex-1 font-bold border-[#444] bg-[#222]" onClick={handleInformarPago} disabled={loadingLocal}>
                      Informar Pago
                  </Button>
                </div>
              </div>
            )}

            {canchasList.map(cancha => (
              <div key={cancha.id} className="mb-8">
                <h3 className="text-lg font-bold text-textPri mb-4 border-b border-[#2a2a2a] pb-2">{cancha.nombre}</h3>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                  {SHIFTS.map(shift => renderBotonCancha(shift, cancha.id))}
                </div>
              </div>
            ))}

            {/* Referencias (Legend) */}
            <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium items-center justify-start mt-6 border-t border-border pt-6 text-textPri">
              <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-md bg-[#93c5fd]"></div> Turno Libre</div>
              <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-md bg-[#1d4ed8]"></div> Turno Reservado</div>
              <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-md bg-[#d97706]"></div> Turno Propio</div>
              <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-md border border-blocked bg-[#161616]"></div> Bloqueado</div>
              <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-md border border-[#2a2a2a] bg-[#161616]"></div> Vencido</div>
            </div>
          </>
        )}
      </div>

      {/* Modal Reserva */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#0d0d0d]/80 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-sm my-auto overflow-visible">
            <h3 className="text-lg font-bold mb-4">Confirmar Reserva</h3>
            <p className="text-sm mb-4 text-textSec border-b border-border pb-4">
              Cancha {modalCanchaId} • {format(selectedDate, 'dd/MM/yyyy')} • {selectedShift?.start}hs
            </p>
            
            <div className="flex gap-4 mb-4">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="radio" value="single" checked={tipoJuego === 'single'} onChange={() => setTipoJuego('single')} className="text-primary accent-primary" />
                Single
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="radio" value="dobles" checked={tipoJuego === 'dobles'} onChange={() => setTipoJuego('dobles')} className="text-primary accent-primary" />
                Dobles
              </label>
            </div>

            {selectedShift?.start === '19:00' && (
              <div className="bg-surface border border-[#2a2a2a] text-textPri text-xs font-bold p-3 rounded-lg mb-4 text-center shadow-sm">
                ⚠️ Atención: Este turno es de 1 hora (finaliza 20:00 hs).
              </div>
            )}

            <div className="flex flex-col gap-3 mb-6 bg-[#0d0d0d] p-3 rounded-lg border border-[#2a2a2a]">
              <label className="text-xs font-semibold text-textSec uppercase">Jugador/es Rivales (opcional)</label>
              
              <SearchableSelect
                 options={sociosList.filter(s => s.dni !== socio?.dni).map(s => ({ value: s.dni, label: `${s.apellido}, ${s.nombre}` }))}
                 value={comp1}
                 onChange={setComp1}
                 placeholder="Seleccionar Jugador 2..."
              />

              {tipoJuego === 'dobles' && (
                <>
                  <SearchableSelect
                     options={sociosList.filter(s => s.dni !== socio?.dni).map(s => ({ value: s.dni, label: `${s.apellido}, ${s.nombre}` }))}
                     value={comp2}
                     onChange={setComp2}
                     placeholder="Seleccionar Jugador 3..."
                  />
                  <SearchableSelect
                     options={sociosList.filter(s => s.dni !== socio?.dni).map(s => ({ value: s.dni, label: `${s.apellido}, ${s.nombre}` }))}
                     value={comp3}
                     onChange={setComp3}
                     placeholder="Seleccionar Jugador 4..."
                  />
                </>
              )}
            </div>

            <div className="flex gap-3">
              <Button variant="secondary" fullWidth onClick={() => setIsModalOpen(false)}>Cancelar</Button>
              <Button variant="primary" fullWidth onClick={confirmReservation} disabled={reservingLocal}>
                {reservingLocal ? 'Reservando...' : 'Reservar'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalle (Turno Ocupado/Bloqueado) */}
      {infoTurno && (
        <div className="fixed inset-0 bg-[#0d0d0d]/80 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-sm my-auto text-center overflow-visible">
            {(() => {
              const isMio = infoTurno.socio_dni === socio?.dni;
              return (
                <>
                  <h3 className="text-lg font-bold mb-2 text-primary">Detalle del Turno</h3>
            <p className="text-textSec mb-6 border-b border-border pb-4">{infoTurno.shift.start} a {infoTurno.shift.end}hs - Cancha {infoTurno.cancha_id}</p>
            
            {infoTurno.estado === 'bloqueado' ? (
              <p className="text-blocked text-lg font-semibold bg-blocked/10 p-4 rounded-lg">{infoTurno.motivo_bloqueo || 'Bloqueado por Mantenimiento'}</p>
            ) : (
              <div className="bg-[#0d0d0d] rounded-lg p-4 border border-[#2a2a2a] text-left">
                <p className="text-xs font-bold text-textSec mb-1 uppercase">Titular de la Reserva</p>
                <p className="text-lg text-primary">{infoTurno.socios.apellido}, {infoTurno.socios.nombre}</p>
                
                {infoTurno.acompanante && (
                  <div className="mt-4 pt-4 border-t border-[#2a2a2a]">
                    <p className="text-xs font-bold text-textSec mb-1 uppercase">Jugadores adicionales</p>
                    <p className="text-sm text-textPri">{infoTurno.acompanante}</p>
                  </div>
                      )}
                    </div>
                  )}
                  
                  <div className="flex flex-col gap-3 mt-6">
                    {infoTurno.estado === 'ocupado' && !isMio && (
                      <Button variant="primary" fullWidth onClick={joinWaitlist} disabled={reservingLocal}>
                        {reservingLocal ? 'Procesando...' : 'Unirse a lista de espera'}
                      </Button>
                    )}
                    {isMio && (
                      <Button variant="danger" fullWidth onClick={() => cancelTurno(infoTurno)} disabled={reservingLocal}>
                        {reservingLocal ? 'Procesando...' : 'Cancelar Reserva'}
                      </Button>
                    )}
                    <Button variant="secondary" fullWidth onClick={() => setInfoTurno(null)}>Cerrar</Button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

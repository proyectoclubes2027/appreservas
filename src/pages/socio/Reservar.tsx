import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { SHIFTS } from '../../lib/constants';
import { format, addDays, startOfDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '../../components/ui/Button';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { loginOneSignal } from '../../lib/onesignal';
import { useLocation, useNavigate } from 'react-router-dom';
import { useClubConfig } from '../../lib/useClubConfig';

const isValidUuid = (value: any): boolean => {
  if (typeof value !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
};

export default function Reservar() {
  const { socio } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const hasProcessedEditRef = useRef(false);
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
  
  // State for edit mode
  const [editTurnoId, setEditTurnoId] = useState<string | null>(null);

  const { config } = useClubConfig();
  const diasVisibles = config.dias_anticipacion || 2;
  const dates = Array.from({ length: diasVisibles }).map((_, i) => addDays(startOfDay(new Date()), i));

  useEffect(() => {
    const initPage = async () => {
      setLoadingLocal(true);
      await Promise.all([fetchTurnos(), fetchSocios(), fetchCanchas()]);
      setLoadingLocal(false);
    };
    initPage();
  }, [selectedDate]);

  useEffect(() => {
    if (location.state?.editTurno && !hasProcessedEditRef.current && sociosList.length > 0) {
      const turno = location.state.editTurno;
      const tDate = parseISO(turno.fecha);
      setSelectedDate(startOfDay(tDate));
      
      setSelectedShift({ start: turno.hora_inicio.slice(0,5), end: turno.hora_fin.slice(0,5) });
      setModalCanchaId(turno.cancha_id);
      setTipoJuego('single');
      setComp1('');
      setComp2('');
      setComp3('');
      setEditTurnoId(turno.id);
      setIsModalOpen(true);
      
      hasProcessedEditRef.current = true;
      // Clear state so it doesn't reopen if they refresh
      navigate('/reservar', { replace: true, state: {} });
    }
  }, [location.state, sociosList]);

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
    try {
      // Fetch socios activos (excluyendo admins)
      const { data: sociosData, error: sociosError } = await supabase
        .from('socios')
        .select('id, dni, nombre, apellido, categoria, rol, fecha_alta')
        .eq('estado', 'activo')
        .neq('rol', 'admin')
        .order('apellido', { ascending: true });

      if (sociosError) {
        console.error('Error fetching socios:', sociosError.message);
        return;
      }
      if (!sociosData || sociosData.length === 0) {
        setSociosList([]);
        return;
      }

      // Fetch pagos usando select('*') para evitar problemas con nombres camelCase
      const { data: pagosData, error: pagosError } = await supabase
        .from('pago_cuotas')
        .select('*');

      if (pagosError) {
        console.warn('Error fetching pago_cuotas (morosidad no disponible):', pagosError.message);
      }

      // Mapear el último mes pagado por socio_id
      const ultimoPagoMap = new Map<string, string>();
      if (pagosData) {
        for (const pago of pagosData) {
          const mesPagado: string = pago.mesPagado ?? pago.mespagado ?? '';
          if (!mesPagado) continue;
          const socioId: string = pago.socio_id;
          const currentLast = ultimoPagoMap.get(socioId);
          if (!currentLast || mesPagado > currentLast) {
            ultimoPagoMap.set(socioId, mesPagado);
          }
        }
      }

      // Fetch cuotas para tener en cuenta la deuda real cargada
      const { data: cuotasData, error: cuotasError } = await supabase
        .from('cuotas')
        .select('socio_id, estado, mes');

      const cuotasPendientesMap = new Map<string, number>();
      const debeMesActualMap = new Map<string, boolean>();
      
      const ahora = new Date();
      let yA = ahora.getFullYear();
      let mA = ahora.getMonth() + 1;
      
      if (ahora.getDate() < 15) {
        mA -= 1;
        if (mA === 0) {
          mA = 12;
          yA -= 1;
        }
      }
      
      const mesActualStr = `${yA}-${String(mA).padStart(2, "0")}`;

      if (cuotasData && !cuotasError) {
        for (const c of cuotasData) {
          if (c.estado === 'pendiente') {
            cuotasPendientesMap.set(c.socio_id, (cuotasPendientesMap.get(c.socio_id) || 0) + 1);
            if (c.mes === mesActualStr) {
              debeMesActualMap.set(c.socio_id, true);
            }
          }
        }
      }

      const enriched = sociosData.map(s => {
        // Vitalicios y admins nunca son morosos
        if (s.categoria === 'vitalicio' || s.rol === 'admin') {
          return { ...s, mesesDeuda: 0, isMoroso: false };
        }

        const ultimoPago = ultimoPagoMap.get(s.id);
        let mesesAdeudadosVirtuales = 0;

        if (ultimoPago) {
          const [y, m] = ultimoPago.split('-').map(Number);
          mesesAdeudadosVirtuales = (yA - y) * 12 + (mA - m);
        } else if (s.fecha_alta) {
          const fechaStr = String(s.fecha_alta).substring(0, 10);
          const [fy, fm] = fechaStr.split('-').map(Number);
          mesesAdeudadosVirtuales = (yA - fy) * 12 + (mA - fm);
        }

        // Deuda física (tabla cuotas)
        let mesesAdeudadosFisicos = cuotasPendientesMap.get(s.id) || 0;
        
        // Usamos el mayor entre el cálculo físico y el virtual para no perder deuda manual
        let mesesAdeudados = Math.max(mesesAdeudadosVirtuales, mesesAdeudadosFisicos);

        // Tolerancia del mes actual (si lo debe, se le perdona 1 mes)
        const debeMesVirtual = mesesAdeudadosVirtuales > 0;
        const debeMesFisico = debeMesActualMap.get(s.id) || false;
        
        if (debeMesVirtual || debeMesFisico) {
            mesesAdeudados = Math.max(0, mesesAdeudados - 1);
        }

        return {
          ...s,
          mesesDeuda: mesesAdeudados,
          isMoroso: mesesAdeudados >= 4,
        };
      });

      setSociosList(enriched);
    } catch (err) {
      console.error('fetchSocios error inesperado:', err);
    }
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


  const hasActiveTurno = async (dniCheck: string, ignoreTurnoId?: string) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const nowHour = format(new Date(), 'HH:mm');
    
    // Construir el string de nombre que se usa en 'acompanante'
    const s = sociosList.find(x => x.dni === dniCheck) || (dniCheck === socio?.dni ? socio : null);
    if (!s) return false;
    const nameStr = `${s.apellido}, ${s.nombre.charAt(0)}.`;

    // Obtenemos los turnos del jugador desde hoy en adelante que estén OCUPADOS
    // Buscamos tanto si es titular (socio_dni) como si es acompañante (acompanante ilike)
    const [reqTitular, reqAcom] = await Promise.all([
      supabase.from('turnos').select('id, fecha, hora_fin').eq('socio_dni', dniCheck).eq('estado', 'ocupado').gte('fecha', today),
      supabase.from('turnos').select('id, fecha, hora_fin').ilike('acompanante', `%${nameStr}%`).eq('estado', 'ocupado').gte('fecha', today)
    ]);
    
    const data = [...(reqTitular.data || []), ...(reqAcom.data || [])].filter(t => t.id !== ignoreTurnoId);
    
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
    setEditTurnoId(null);
    setIsModalOpen(true);
  };

  const handleEditClick = () => {
    if (!infoTurno) return;
    setSelectedShift(infoTurno.shift);
    setModalCanchaId(infoTurno.cancha_id);
    setTipoJuego('single');
    setComp1('');
    setComp2('');
    setComp3('');
    setEditTurnoId(infoTurno.id);
    setInfoTurno(null);
    setIsModalOpen(true);
  };

  const confirmReservation = async () => {
    if (!socio) return;
    if ((socio?.mesesDeuda ?? 0) >= 4) {
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

    if (participants.length < 2) {
      alert("Debes seleccionar al menos un compañero para poder reservar.");
      setReservingLocal(false);
      return;
    }

    // Check uniqueness explicitly to avoid a single person twice
    const uniqueParticipants = Array.from(new Set(participants));
    if (uniqueParticipants.length !== participants.length) {
      alert("Has seleccionado al mismo jugador repetidas veces.");
      setReservingLocal(false);
      return;
    }

    // Validate Invitado limit (max 5 per year per titular)
    if (participants.includes('123987456')) {
      const currentYearStr = new Date().getFullYear().toString();
      const startOfYear = `${currentYearStr}-01-01`;
      const endOfYear = `${currentYearStr}-12-31`;

      const { data: invitadoData, error: invitadoError } = await supabase
        .from('turnos')
        .select('id')
        .eq('socio_dni', socio.dni)
        .gte('fecha', startOfYear)
        .lte('fecha', endOfYear)
        .ilike('acompanante', '%Especial, I.%')
        .neq('estado', 'libre');

      if (!invitadoError && invitadoData && invitadoData.length >= 5) {
        alert("Has alcanzado el límite de 5 reservas anuales con un Invitado.");
        setReservingLocal(false);
        return;
      }
    }

    // Check if the current user has an active penalty
    if (config.validacion_qr_activa) {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const { data: penaltyData } = await supabase
        .from('penalizaciones')
        .select('*')
        .eq('socio_dni', socio.dni)
        .eq('activa', true)
        .gte('fecha_fin', todayStr)
        .maybeSingle();

      if (penaltyData) {
        alert(`Tenés una sanción activa hasta el ${format(parseISO(penaltyData.fecha_fin), 'dd/MM/yyyy')} por no haber validado la presencia en tu turno anterior.`);
        setReservingLocal(false);
        return;
      }
    }

    // Validate rules: Max 1 active for EVERY participant, and no participant can be moroso
    for (const d of participants) {
      const s = sociosList.find(x => x.dni === d) || (d === socio.dni ? socio : null);
      if ((s?.mesesDeuda ?? 0) >= 4) {
        alert(`El jugador ${s.apellido}, ${s.nombre} no puede reservar turnos`);
        setReservingLocal(false);
        return;
      }

      if (d !== '123987456') {
        const active = await hasActiveTurno(d, editTurnoId || undefined);
        if (active) {
          const sObj = s || socio;
          alert(`Error: El jugador ${sObj.apellido}, ${sObj.nombre} ya tiene un turno activo. Debe cancelarlo antes de reservar o integrar otra partida.`);
          setReservingLocal(false);
          return;
        }
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
      estado: 'ocupado',
      validado: false,
      validado_at: null
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
      setReservingLocal(false);
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
      if ((socio?.mesesDeuda ?? 0) >= 4) {
         alert("Posees meses impagos. Por favor regulariza tu situación para reservar.");
         return;
      }
      if (isLibre) {
        handleReserveClick(shift, canchaId);
      } else {
        setInfoTurno({ ...turnoDb, shift }); // Guardamos el turno para ver el detalle
      }
    };

    return (
      <button 
        key={shift.start} 
        onClick={handleClick} 
        className={`flex flex-col items-center justify-center h-14 rounded-lg text-sm font-bold border transition-colors shadow-sm ${bgClass}`}
      >
        <span>{shift.start}</span>
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
            {((socio?.mesesDeuda ?? 0) >= 4) && (
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
            <h3 className="text-lg font-bold mb-4">{editTurnoId ? 'Editar Reserva' : 'Confirmar Reserva'}</h3>
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


            <div className="flex flex-col gap-3 mb-6 bg-[#0d0d0d] p-3 rounded-lg border border-[#2a2a2a]">
              <label className="text-xs font-semibold text-textSec uppercase">Jugador/es Rivales (opcional)</label>
              
              <SearchableSelect
                 options={sociosList.filter(s => s.dni !== socio?.dni).map(s => ({ value: s.dni, label: `${s.apellido}, ${s.nombre}`, isMoroso: s.isMoroso, mesesDeuda: s.mesesDeuda }))}
                 value={comp1}
                 onChange={setComp1}
                 placeholder="Seleccionar Jugador 2..."
              />

              {tipoJuego === 'dobles' && (
                <>
                  <SearchableSelect
                     options={sociosList.filter(s => s.dni !== socio?.dni).map(s => ({ value: s.dni, label: `${s.apellido}, ${s.nombre}`, isMoroso: s.isMoroso, mesesDeuda: s.mesesDeuda }))}
                     value={comp2}
                     onChange={setComp2}
                     placeholder="Seleccionar Jugador 3..."
                  />
                  <SearchableSelect
                     options={sociosList.filter(s => s.dni !== socio?.dni).map(s => ({ value: s.dni, label: `${s.apellido}, ${s.nombre}`, isMoroso: s.isMoroso, mesesDeuda: s.mesesDeuda }))}
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
                {reservingLocal ? 'Procesando...' : (editTurnoId ? 'Guardar Cambios' : 'Reservar')}
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
                      <div className="flex gap-2 w-full">
                        <Button variant="secondary" fullWidth onClick={handleEditClick} disabled={reservingLocal}>
                          Editar Compañeros
                        </Button>
                        <Button variant="danger" fullWidth onClick={() => cancelTurno(infoTurno)} disabled={reservingLocal}>
                          {reservingLocal ? 'Procesando...' : 'Cancelar'}
                        </Button>
                      </div>
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

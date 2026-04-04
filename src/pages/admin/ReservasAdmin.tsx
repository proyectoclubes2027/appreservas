import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { format, addDays, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '../../components/ui/Button';
import { SHIFTS } from '../../lib/constants';

export default function ReservasAdmin() {
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

  // States for detail modal
  const [infoTurno, setInfoTurno] = useState<any>(null);

  const dates = Array.from({ length: 7 }).map((_, i) => addDays(startOfDay(new Date()), i));

  useEffect(() => {
    const initPage = async () => {
      setLoadingLocal(true);
      await Promise.all([fetchTurnos(), fetchCanchas()]);
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
            motivo_bloqueo: motivoBloqueo || (tipoBloqueo === 'clases' ? 'Clases' : 'Mantenimiento')
        });
    }

    const { error } = await supabase.from('turnos').insert(inserts);

    if (error) alert("Error: " + error.message);
    else fetchTurnos();

    setIsModalOpen(false);
    setMotivoBloqueo('');
    setTipoBloqueo('mantenimiento');
  };

  const unlockOrCancel = async (id: string) => {
    if (!confirm('¿Seguro que deseas eliminar esta reserva/bloqueo?')) return;
    const { error } = await supabase.from('turnos').delete().eq('id', id);
    if (!error) {
       fetchTurnos();
       setInfoTurno(null);
    } else alert("Error: " + error.message);
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
      <h2 className="text-xl font-bold uppercase tracking-wide text-textSec">Gestión de Reservas</h2>

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
              <Button variant="danger" fullWidth onClick={() => unlockOrCancel(infoTurno.id)}>
                {infoTurno.estado === 'bloqueado' ? 'Desbloquear' : 'Cancelar Turno'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '../../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { QrCode, CheckCircle2, CloudRain, Clock, Users, ShieldAlert } from 'lucide-react';
import { QRScannerModal } from '../../components/QRScannerModal';
import { CancelarTurnoModal } from '../../components/CancelarTurnoModal';
import { useClubConfig } from '../../lib/useClubConfig';
import { resolverCancelacionesTardiasVencidas, resolverTurnosSinValidar, estanTodosValidados } from '../../lib/cancelaciones';

const isValidUuid = (value: any): boolean => {
  if (typeof value !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
};

export default function MisTurnos() {
  const { socio } = useAuth();
  const navigate = useNavigate();
  const { config } = useClubConfig();
  const [sociosMap, setSociosMap] = useState<Map<string, string>>(new Map());
  const [turnos, setTurnos] = useState<any[]>([]);
  const [turnosTardios, setTurnosTardios] = useState<any[]>([]);
  const [loadingLocal, setLoadingLocal] = useState(true);

  // Estados para modal de escaneo QR
  const [scannerTurno, setScannerTurno] = useState<any>(null);

  // Estado para modal semáforo de cancelación
  const [turnoParaCancelar, setTurnoParaCancelar] = useState<any>(null);

  useEffect(() => {
    fetchMisTurnos();
  }, [socio]);

  const fetchMisTurnos = async () => {
    if (!socio) return;
    setLoadingLocal(true);

    // Resolver turnos tardíos vencidos y turnos sin validar antes de listar
    await Promise.all([
      resolverCancelacionesTardiasVencidas(config).catch(console.warn),
      resolverTurnosSinValidar(config).catch(console.warn),
    ]);

    // Cargar nombres de socios para mapear en la lista de participantes
    const { data: allSocios } = await supabase.from('socios').select('dni, nombre, apellido');
    if (allSocios) {
      const sMap = new Map<string, string>();
      allSocios.forEach((s: any) => sMap.set(s.dni, `${s.apellido}, ${s.nombre}`));
      setSociosMap(sMap);
    }

    // Traer turnos donde el socio sea titular O forme parte de participantes_dnis
    const { data, error } = await supabase
      .from('turnos')
      .select('*, canchas(nombre), socios(nombre, apellido)')
      .or(`socio_dni.eq.${socio.dni},participantes_dnis.cs.{${socio.dni}}`)
      .order('fecha', { ascending: false })
      .order('hora_inicio', { ascending: false });

    if (!error && data) {
      setTurnos(data);
    }

    // Traer turnos cancelados sobre la hora por este socio para mostrar su estado solidario
    const { data: tardiosData } = await supabase
      .from('turnos')
      .select('*, canchas(nombre)')
      .eq('cancelado_por_dni', socio.dni)
      .in('cancelacion_tipo', ['tardia_pendiente', 'tardia_salvada'])
      .order('fecha', { ascending: false })
      .order('hora_inicio', { ascending: false })
      .limit(5);

    if (tardiosData) {
      setTurnosTardios(tardiosData);
    }

    setLoadingLocal(false);
  };

  /**
   * Determina si el turno se encuentra dentro de la ventana de validación
   * y si el socio actual aún NO ha registrado su presencia.
   */
  const canValidateTurno = (turno: any): boolean => {
    if (turno.estado !== 'ocupado') return false;
    if (!socio) return false;

    // Si el socio actual ya validó su propia presencia, no necesita volver a escanear
    const validados: string[] = Array.isArray(turno.validados_dnis) ? turno.validados_dnis : [];
    if (validados.includes(socio.dni)) return false;

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
    if (!scannerTurno || !socio) return;

    try {
      // 1. Intentar validar usando la función RPC segura (valida a nivel servidor sin conflictos de permisos RLS)
      let rpcSuccess = false;
      let rpcAllCompleted = false;

      if (scannerTurno.id && isValidUuid(scannerTurno.id)) {
        const { data: rpcData, error: rpcError } = await supabase.rpc('validar_presencia_turno', {
          p_turno_id: scannerTurno.id,
          p_cancha_id: scannerTurno.cancha_id,
        });

        if (!rpcError && rpcData && rpcData.success) {
          rpcSuccess = true;
          rpcAllCompleted = Boolean(rpcData.all_completed);
        } else if (rpcError) {
          console.warn('RPC validar_presencia_turno falló, intentando fallback directo:', rpcError);
        }
      }

      // 2. Si el RPC funcionó, mostrar mensaje y recargar turnos
      if (rpcSuccess) {
        if (rpcAllCompleted) {
          alert('✓ ¡Turno 100% validado con éxito! Todos los jugadores registraron su presencia en la cancha.');
        } else {
          alert('✓ ¡Validaste tu presencia con éxito! Recordá que tus compañeros de turno también deben escanear el QR en la cancha.');
        }
        await fetchMisTurnos();
        return;
      }

      // Fallback directo en caso de que el RPC no estuviera disponible
      const prevValidados: string[] = Array.isArray(scannerTurno.validados_dnis)
        ? [...scannerTurno.validados_dnis]
        : [];

      if (!prevValidados.includes(socio.dni)) {
        prevValidados.push(socio.dni);
      }

      // Obtener participantes declarados
      const participants: string[] = (scannerTurno.participantes_dnis && scannerTurno.participantes_dnis.length > 0)
        ? scannerTurno.participantes_dnis
        : (scannerTurno.socio_dni ? [scannerTurno.socio_dni] : []);

      // Si el socio actual es el titular y hay Invitado Especial ('123987456'),
      // el escaneo del titular valida automáticamente al Invitado Especial
      if (socio.dni === scannerTurno.socio_dni && participants.includes('123987456')) {
        if (!prevValidados.includes('123987456')) {
          prevValidados.push('123987456');
        }
      }

      // Evaluar si todos los socios requeridos completaron la validación
      const allCompleted = estanTodosValidados(participants, prevValidados, scannerTurno.socio_dni);

      let query = supabase
        .from('turnos')
        .update({
          validados_dnis: prevValidados,
          validado: allCompleted,
          validado_at: allCompleted ? new Date().toISOString() : scannerTurno.validado_at,
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
        if (allCompleted) {
          alert('✓ ¡Turno 100% validado con éxito! Todos los jugadores registraron su presencia en la cancha.');
        } else {
          alert('✓ ¡Validaste tu presencia con éxito! Recordá que tus compañeros de turno también deben escanear el QR en la cancha.');
        }
        await fetchMisTurnos();
      }
    } catch (e: any) {
      console.error('Error al validar turno:', e);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Banner Informativo de Clima Inestable para Socios */}
      {config.clima_inestable && (
        <div className="bg-sky-950/40 border border-sky-500/40 rounded-2xl p-4 text-xs text-sky-200 flex items-start gap-3 shadow-md animate-[fadeIn_0.2s_ease-out]">
          <div className="p-2 bg-sky-500/20 text-sky-400 rounded-xl shrink-0 mt-0.5">
            <CloudRain size={20} />
          </div>
          <div>
            <p className="font-bold text-sky-300 text-sm">🌧️ Modo Clima Inestable Activo</p>
            <p className="text-sky-200/90 mt-1 leading-relaxed">
              Debido a las condiciones climáticas del día de hoy, <strong>el escaneo de código QR en la cancha no es obligatorio</strong> y podés cancelar tus reservas en cualquier momento sin ninguna penalidad ni sanción.
            </p>
          </div>
        </div>
      )}

      {/* Sección Informativa: Turnos Cancelados sobre la hora (Solidarios) */}
      {turnosTardios.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-amber-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-textPri">
              Cancelaciones sobre la hora (Sistema Solidario)
            </h3>
          </div>
          <div className="flex flex-col gap-2">
            {turnosTardios.map((t) => {
              const esSalvado = t.cancelacion_tipo === 'tardia_salvada';
              return (
                <div
                  key={t.id}
                  className={`p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
                    esSalvado
                      ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
                      : 'bg-amber-950/20 border-amber-500/30 text-amber-200'
                  }`}
                >
                  <div>
                    <span className="font-bold text-white mr-2">{t.canchas?.nombre}</span>
                    <span className="font-mono text-textSec mr-2">{t.fecha} ({(t.hora_inicio || '').slice(0, 5)}hs)</span>
                    <p className="text-[11px] mt-0.5 opacity-90">
                      {esSalvado
                        ? '✓ ¡Salvado! Otro socio tomó tu cancha liberada. Quedaste libre de sanción.'
                        : `⏳ Esperando reemplazo: si otro socio reserva la cancha antes de las ${(t.hora_inicio || '').slice(0, 5)}hs, no recibirás sanción.`}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 self-start sm:self-auto ${
                    esSalvado ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300 animate-pulse'
                  }`}>
                    {esSalvado ? 'Sin Sanción' : 'Pendiente de Reserva'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

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

            const esTitular = turno.socio_dni === socio?.dni;
            const validadosList: string[] = Array.isArray(turno.validados_dnis) ? turno.validados_dnis : [];
            const userValidated = socio ? validadosList.includes(socio.dni) : false;

            // Obtener lista completa de participantes
            const rawParts: string[] = (turno.participantes_dnis && turno.participantes_dnis.length > 0)
              ? turno.participantes_dnis
              : (turno.socio_dni ? [turno.socio_dni] : []);

            const sociosRequeridos = rawParts.filter(d => d && d !== '123987456');
            const validadosCount = sociosRequeridos.filter(d => validadosList.includes(d)).length;

            return (
              <div 
                key={turno.id} 
                className={`bg-surface border rounded-xl p-4 sm:p-5 flex flex-col gap-3 transition-colors ${
                  isValidable 
                    ? 'border-emerald-500/60 ring-2 ring-emerald-500/20 bg-emerald-950/10' 
                    : turno.validado 
                    ? 'border-emerald-900/40 bg-surface' 
                    : 'border-border'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#222] pb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs text-textSec font-bold uppercase tracking-wider">
                      {formattedDate}
                    </p>
                    {esTitular ? (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                        Titular
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-500/30">
                        Acompañante
                      </span>
                    )}

                    {turno.validado ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-950/90 text-emerald-400 border border-emerald-500/40">
                        <CheckCircle2 size={12} /> Turno 100% Validado
                      </span>
                    ) : userValidated ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-sky-950/90 text-sky-400 border border-sky-500/40">
                        <CheckCircle2 size={12} /> Tu Presencia Validada
                      </span>
                    ) : isValidable ? (
                      <span className="animate-pulse inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        <Clock size={12} /> Escaneo QR Disponible
                      </span>
                    ) : isFuture ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-700">
                        Programado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-red-950/60 text-red-400 border border-red-500/30">
                        Sin Validación Completa
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-textPri">
                      {(turno.hora_inicio || '').slice(0, 5)} - {(turno.hora_fin || '').slice(0, 5)} hs
                    </span>
                    <span className="text-xs text-textSec">• {turno.canchas?.nombre}</span>
                  </div>
                </div>

                {/* Sección de Participantes y estado de escaneo individual */}
                <div className="flex flex-col gap-1.5 py-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-textSec uppercase tracking-wider flex items-center gap-1.5">
                      <Users size={13} className="text-textSec" />
                      Jugadores del Turno ({validadosCount}/{sociosRequeridos.length} validados):
                    </span>
                    {config.validacion_qr_activa && !config.clima_inestable && (
                      <span className="text-[10px] text-amber-400/90 font-medium hidden sm:inline">
                        * Cada jugador debe escanear para no recibir sanción individual
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                    {rawParts.map((partDni) => {
                      const isGuest = partDni === '123987456';
                      const isMe = partDni === socio?.dni;
                      const isPartTitular = partDni === turno.socio_dni;
                      const nombre = isGuest
                        ? 'Invitado Especial'
                        : sociosMap.get(partDni) || (isPartTitular ? `${turno.socios?.apellido || ''}, ${turno.socios?.nombre || ''}` : `DNI ${partDni}`);

                      // El invitado especial queda validado si el titular ya escaneó
                      const isGuestValidated = isGuest && validadosList.includes(turno.socio_dni);
                      const isPartValidated = isGuest ? isGuestValidated : validadosList.includes(partDni);

                      return (
                        <div
                          key={partDni}
                          className={`p-2 rounded-lg border flex items-center justify-between text-xs transition-colors ${
                            isPartValidated
                              ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
                              : 'bg-zinc-900/60 border-zinc-800 text-zinc-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            {isPartValidated ? (
                              <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                            ) : (
                              <Clock size={14} className="text-amber-400 shrink-0" />
                            )}
                            <span className="font-medium truncate">
                              {nombre} {isMe && <span className="text-primary font-bold">(Vos)</span>}
                            </span>
                            {isPartTitular && (
                              <span className="text-[10px] text-zinc-500 uppercase">(Titular)</span>
                            )}
                          </div>

                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded shrink-0 ${
                              isPartValidated
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-zinc-800 text-zinc-400'
                            }`}
                          >
                            {isPartValidated ? '✓ Validado' : 'Pendiente QR'}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {!turno.validado && isValidable && !userValidated && (
                    <p className="text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 p-2 rounded-lg mt-1 flex items-center gap-1.5">
                      <ShieldAlert size={14} className="text-amber-400 shrink-0" />
                      <span>
                        Recordá escanear el código QR en la entrada de la cancha. La sanción se aplicará únicamente al socio que no valide su presencia.
                      </span>
                    </p>
                  )}
                </div>

                {/* Barra de Acciones */}
                <div className="flex items-center justify-end gap-2 flex-wrap sm:flex-nowrap pt-2 border-t border-[#1c1c1c]">
                  {/* Botón para escanear QR si está en el rango de horario y aún no validó */}
                  {isValidable && (
                    <Button
                      variant="primary"
                      className="text-xs px-3.5 py-2 font-bold flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-black border-none shadow-lg animate-bounce"
                      onClick={() => setScannerTurno(turno)}
                    >
                      <QrCode size={16} />
                      Validar mi presencia con QR
                    </Button>
                  )}

                  {userValidated && !turno.validado && (
                    <span className="text-xs px-2.5 py-1.5 rounded-md bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 size={13} /> Tu QR ya fue registrado
                    </span>
                  )}

                  {isFuture && turno.estado === 'ocupado' && esTitular && (
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
                        onClick={() => setTurnoParaCancelar(turno)}
                      >
                        Cancelar
                      </Button>
                    </>
                  )}

                  {!isFuture && !turno.validado && (
                    <span className="text-xs text-textSec px-2.5 py-1 bg-[#0d0d0d] rounded border border-[#2a2a2a] uppercase font-bold">
                      Completado
                    </span>
                  )}
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

      {/* Modal Semáforo de Cancelación */}
      {turnoParaCancelar && socio && (
        <CancelarTurnoModal
          isOpen={!!turnoParaCancelar}
          onClose={() => setTurnoParaCancelar(null)}
          turno={turnoParaCancelar}
          socioDni={socio.dni}
          config={config}
          onSuccess={(mensaje) => {
            alert(mensaje);
            fetchMisTurnos();
          }}
        />
      )}
    </div>
  );
}

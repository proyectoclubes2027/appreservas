import { supabase } from './supabase';
import { ClubConfig } from './config';
import { format, parseISO, addDays } from 'date-fns';

export type CategoriaCancelacion = 'clima' | 'normal' | 'tardia' | 'inmediata';

export interface InfoCancelacion {
  categoria: CategoriaCancelacion;
  minutosFaltantes: number;
  esClimaInestable: boolean;
  diasSancion: number;
  titulo: string;
  badge: string;
  color: 'sky' | 'emerald' | 'amber' | 'red';
  descripcion: string;
  impacto: string;
}

/**
 * Calcula los minutos faltantes desde el momento actual hasta el inicio del turno
 * en base a fecha ('YYYY-MM-DD') y hora_inicio ('HH:mm:ss' o 'HH:mm').
 */
export function calcularMinutosFaltantes(fechaStr: string, horaInicioStr: string): number {
  try {
    const horaLimpia = (horaInicioStr || '').slice(0, 5);
    // Parsear fecha y hora local
    const [year, month, day] = fechaStr.split('-').map(Number);
    const [hours, minutes] = horaLimpia.split(':').map(Number);
    const turnoDate = new Date(year, month - 1, day, hours, minutes, 0);

    const now = new Date();
    const diffMs = turnoDate.getTime() - now.getTime();
    return Math.round(diffMs / (1000 * 60));
  } catch (e) {
    console.error('Error calculando minutos faltantes:', e);
    return 999;
  }
}

/**
 * Evalúa las reglas del semáforo de cancelación según la anticipación y configuración del club.
 */
export function evaluarCancelacion(turno: any, config: ClubConfig): InfoCancelacion {
  const minutos = calcularMinutosFaltantes(turno.fecha, turno.hora_inicio);
  const diasSancion = config.penalizacion_dias || 7;
  const esClimaInestable = Boolean(config.clima_inestable);
  const sancionesCancelacionActiva = config.sanciones_cancelacion_activa !== false;

  // 1. Clima Inestable activo o Sanciones por cancelación desactivadas por CD
  if (esClimaInestable || !sancionesCancelacionActiva) {
    return {
      categoria: 'clima',
      minutosFaltantes: minutos,
      esClimaInestable: esClimaInestable,
      diasSancion,
      titulo: esClimaInestable ? 'Día con Clima Inestable' : 'Sanciones por Cancelación en Pausa',
      badge: esClimaInestable ? '🌧️ Clima Inestable' : '⏸️ Sin Sanción',
      color: 'sky',
      descripcion: esClimaInestable 
        ? 'El club tiene activo el modo de clima inestable.' 
        : 'Las sanciones automáticas por cancelación tardía están desactivadas temporalmente.',
      impacto: 'Podés cancelar tu reserva sin ninguna penalidad ni sanción disciplinaria.',
    };
  }

  // 2. Más de 2 horas (Normal / Verde)
  if (minutos > 120) {
    return {
      categoria: 'normal',
      minutosFaltantes: minutos,
      esClimaInestable: false,
      diasSancion,
      titulo: 'Cancelación con Tiempo (Normal)',
      badge: '🟢 Más de 2 horas',
      color: 'emerald',
      descripcion: `Faltan más de 2 horas para el turno (${minutos} min restantes).`,
      impacto: 'La cancha queda liberada con suficiente tiempo para otros socios. No genera ninguna penalidad.',
    };
  }

  // 3. Entre 30 min y 2 horas (Tardía / Solidaria / Amarillo)
  if (minutos >= 30) {
    return {
      categoria: 'tardia',
      minutosFaltantes: minutos,
      esClimaInestable: false,
      diasSancion,
      titulo: 'Cancelación sobre la hora (Solidaria)',
      badge: '🟡 Entre 30 min y 2 hs',
      color: 'amber',
      descripcion: `Estás cancelando con aviso sobre la hora (${minutos} min restantes).`,
      impacto: `Criterio Solidario: Tu turno se liberará de inmediato. Si otro socio lo reserva antes de las ${(turno.hora_inicio || '').slice(0, 5)}hs quedás LIBRE de sanción. Si nadie lo ocupa, se aplicará sanción de ${diasSancion} días.`,
    };
  }

  // 4. Menos de 30 minutos (Inmediata / Falta Directa / Rojo)
  return {
    categoria: 'inmediata',
    minutosFaltantes: Math.max(0, minutos),
    esClimaInestable: false,
    diasSancion,
    titulo: 'Cancelación Inmediata (Falta Directa)',
    badge: '🔴 Menos de 30 min',
    color: 'red',
    descripcion: `Faltan solo ${Math.max(0, minutos)} minutos para el inicio del turno.`,
    impacto: `No hay tiempo suficiente para que otro socio pueda ocupar la cancha. Al cancelar ahora, se aplicará una sanción directa de ${diasSancion} días sin poder reservar.`,
  };
}

/**
 * Ejecuta la cancelación de un turno en Supabase aplicando el semáforo y penalidades.
 */
export async function ejecutarCancelacion(
  turno: any,
  socioDni: string,
  config: ClubConfig
): Promise<{ success: boolean; mensaje: string; categoria: CategoriaCancelacion; error?: string }> {
  try {
    const evaluacion = evaluarCancelacion(turno, config);
    const diasSancion = config.penalizacion_dias || 7;
    const nowIso = new Date().toISOString();
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const fechaFinStr = format(addDays(new Date(), diasSancion), 'yyyy-MM-dd');

    // Mapear tipo de cancelación a guardar en el turno
    let cancelacionTipo = 'normal';
    if (evaluacion.categoria === 'tardia') {
      cancelacionTipo = 'tardia_pendiente';
    } else if (evaluacion.categoria === 'inmediata') {
      cancelacionTipo = 'inmediata';
    }

    // 1. Liberar el turno
    let query = supabase
      .from('turnos')
      .update({
        estado: 'libre',
        socio_dni: null,
        acompanante: null,
        participantes_dnis: [],
        validados_dnis: [],
        sancion_qr_aplicada: false,
        validado: false,
        validado_at: null,
        cancelado_por_dni: socioDni,
        cancelacion_tipo: cancelacionTipo,
        cancelado_at: nowIso,
      });

    if (turno.id) {
      query = query.eq('id', turno.id);
    } else {
      query = query
        .eq('cancha_id', turno.cancha_id)
        .eq('fecha', turno.fecha)
        .eq('hora_inicio', turno.hora_inicio);
    }

    const { error: cancelError } = await query;
    if (cancelError) throw cancelError;

    // 2. Si es cancelación inmediata (< 30 min), aplicar sanción directa
    if (evaluacion.categoria === 'inmediata') {
      const canchaNombre = turno.canchas?.nombre || `Cancha ${turno.cancha_id}`;
      const horaStr = (turno.hora_inicio || '').slice(0, 5);
      await supabase.from('penalizaciones').insert({
        socio_dni: socioDni,
        turno_id: turno.id || null,
        fecha_inicio: todayStr,
        fecha_fin: fechaFinStr,
        motivo: `Cancelación tardía con menos de 30 min de anticipación (${canchaNombre}, ${horaStr}hs)`,
        activa: true,
      });
    }

    // 3. Notificar lista de espera si corresponde
    if (turno.id) {
      supabase.functions.invoke('notify-waitlist', {
        body: { turno_id: turno.id },
      }).catch((e) => console.warn('Error notify-waitlist:', e));
    }

    // 4. Mensaje de retorno
    let mensaje = 'Turno cancelado exitosamente.';
    if (evaluacion.categoria === 'clima') {
      mensaje = 'Turno cancelado sin penalidad por modo clima inestable.';
    } else if (evaluacion.categoria === 'normal') {
      mensaje = 'Turno cancelado con más de 2 horas de anticipación (sin penalidad).';
    } else if (evaluacion.categoria === 'tardia') {
      mensaje = 'Turno liberado sobre la hora. Si otro socio lo reserva antes del inicio, no recibirás sanción.';
    } else if (evaluacion.categoria === 'inmediata') {
      mensaje = `Turno cancelado con menos de 30 minutos. Se aplicó una sanción de ${diasSancion} días.`;
    }

    return { success: true, mensaje, categoria: evaluacion.categoria };
  } catch (err: any) {
    console.error('Error al ejecutar cancelación:', err);
    return {
      success: false,
      mensaje: 'Error al cancelar el turno: ' + err.message,
      categoria: 'normal',
      error: err.message,
    };
  }
}

/**
 * Revisa turnos con cancelación 'tardia_pendiente' cuyo horario de inicio ya pasó.
 * Si quedaron libres (nadie los tomó), genera la sanción correspondiente.
 */
export async function resolverCancelacionesTardiasVencidas(config?: ClubConfig): Promise<number> {
  try {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const nowHour = format(new Date(), 'HH:mm:ss');
    const diasSancion = config?.penalizacion_dias || 7;
    const esClimaInestable = Boolean(config?.clima_inestable);
    const sancionesCancelacionActiva = config?.sanciones_cancelacion_activa !== false;

    // Si las sanciones por cancelación tardía están desactivadas o clima inestable, no sancionar
    if (!sancionesCancelacionActiva || esClimaInestable) {
      return 0;
    }
    const { data: turnosPendientes, error } = await supabase
      .from('turnos')
      .select('*, canchas(nombre)')
      .eq('cancelacion_tipo', 'tardia_pendiente')
      .lte('fecha', todayStr);

    if (error || !turnosPendientes || turnosPendientes.length === 0) return 0;

    let procesados = 0;

    for (const t of turnosPendientes) {
      // Verificar si ya venció el horario de inicio
      const esFechaAnterior = t.fecha < todayStr;
      const esMismoDiaVencido = t.fecha === todayStr && t.hora_inicio <= nowHour;

      if (esFechaAnterior || esMismoDiaVencido) {
        if (t.estado === 'libre' && t.cancelado_por_dni) {
          // Nadie tomó la cancha antes de la hora de inicio
          if (!esClimaInestable) {
            const fechaFinStr = format(addDays(parseISO(t.fecha), diasSancion), 'yyyy-MM-dd');
            const canchaNombre = t.canchas?.nombre || `Cancha ${t.cancha_id}`;
            const horaStr = (t.hora_inicio || '').slice(0, 5);

            await supabase.from('penalizaciones').insert({
              socio_dni: t.cancelado_por_dni,
              turno_id: t.id,
              fecha_inicio: t.fecha,
              fecha_fin: fechaFinStr,
              motivo: `Cancelación tardía sin reemplazo (${canchaNombre}, ${t.fecha} ${horaStr}hs)`,
              activa: true,
            });
          }

          // Marcar como tardia_sancionada para no procesar de nuevo
          await supabase
            .from('turnos')
            .update({ cancelacion_tipo: 'tardia_sancionada' })
            .eq('id', t.id);

          procesados++;
        } else if (t.estado === 'ocupado') {
          // Alguien la tomó
          await supabase
            .from('turnos')
            .update({ cancelacion_tipo: 'tardia_salvada' })
            .eq('id', t.id);

          procesados++;
        }
      }
    }

    return procesados;
  } catch (err) {
    console.warn('Error resolviendo cancelaciones tardías vencidas:', err);
    return 0;
  }
}

/**
 * Verifica si todos los socios participantes (excluyendo invitados especiales) ya validaron su presencia.
 */
export function estanTodosValidados(
  participantesDnis?: string[] | null,
  validadosDnis?: string[] | null,
  socioDniTitular?: string | null
): boolean {
  const parts = (participantesDnis && participantesDnis.length > 0)
    ? participantesDnis
    : (socioDniTitular ? [socioDniTitular] : []);

  // Filtrar invitado especial '123987456'
  const sociosRequeridos = parts.filter(d => d && d !== '123987456');
  if (sociosRequeridos.length === 0) return true;

  const validadosSet = new Set(validadosDnis || []);
  return sociosRequeridos.every(d => validadosSet.has(d));
}

/**
 * Revisa turnos cuyo horario ya venció (o expiró la ventana de tolerancia)
 * y que no completaron la validación QR de todos los jugadores.
 * Aplica sanciones a TODOS los socios participantes registrados en el turno.
 */
export async function resolverTurnosSinValidar(config?: ClubConfig): Promise<number> {
  try {
    const qrActivo = Boolean(config?.validacion_qr_activa);
    const esClimaInestable = Boolean(config?.clima_inestable);

    // Si la validación no está activa o el club está en modo clima inestable, no se sanciona
    if (!qrActivo || esClimaInestable) return 0;

    // 1. Intentar resolver vía RPC en Supabase primero (más rápido y atómico)
    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('resolver_turnos_sin_validar_sql');
      if (!rpcErr && rpcRes && typeof rpcRes.sanciones_aplicadas === 'number') {
        return rpcRes.sanciones_aplicadas;
      }
    } catch (_) {
      // Continuar con fallback client-side
    }

    // 2. Fallback client-side si el RPC no estuviera disponible
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const tolerancia = config?.tolerancia_minutos || 20;
    const diasSancion = config?.penalizacion_dias || 7;

    // Solo auditar turnos a partir del inicio de implementación del sistema QR (2026-10-26)
    const FECHA_MINIMA_QR = '2026-10-26';

    const { data: turnosSinValidar, error } = await supabase
      .from('turnos')
      .select('*, canchas(nombre)')
      .eq('estado', 'ocupado')
      .eq('validado', false)
      .eq('sancion_qr_aplicada', false)
      .gte('fecha', FECHA_MINIMA_QR)
      .lte('fecha', todayStr);

    if (error || !turnosSinValidar || turnosSinValidar.length === 0) return 0;

    let sancionesAplicadas = 0;

    for (const t of turnosSinValidar) {
      const esFechaAnterior = t.fecha < todayStr;
      let windowExpired = esFechaAnterior;

      if (!windowExpired && t.fecha === todayStr && t.hora_inicio) {
        const [h, m] = t.hora_inicio.slice(0, 5).split(':').map(Number);
        const startMinutes = h * 60 + m;
        // La ventana de escaneo termina en startMinutes + tolerancia
        windowExpired = currentMinutes > (startMinutes + tolerancia);
      }

      if (windowExpired) {
        const participants: string[] = (t.participantes_dnis && t.participantes_dnis.length > 0)
          ? t.participantes_dnis
          : (t.socio_dni ? [t.socio_dni] : []);

        const sociosASancionar = participants.filter((d: string) => d && d !== '123987456');

        // Si realmente estaban todos validados, marcar como validado sin sancionar
        const validadosList: string[] = t.validados_dnis || [];
        const todosValidados = sociosASancionar.length > 0 && sociosASancionar.every(d => validadosList.includes(d));

        if (todosValidados) {
          await supabase
            .from('turnos')
            .update({ validado: true, validado_at: new Date().toISOString() })
            .eq('id', t.id);
          continue;
        }

        // Si falta alguno por validar, se sanciona a TODOS los participantes registrados
        const canchaNombre = t.canchas?.nombre || `Cancha ${t.cancha_id}`;
        const horaStr = (t.hora_inicio || '').slice(0, 5);
        const fechaFinStr = format(addDays(new Date(), diasSancion), 'yyyy-MM-dd');

        for (const socioDni of sociosASancionar) {
          await supabase.from('penalizaciones').insert({
            socio_dni: socioDni,
            turno_id: t.id,
            fecha_inicio: todayStr,
            fecha_fin: fechaFinStr,
            motivo: `No se completó la validación QR de los participantes (${canchaNombre}, ${t.fecha} ${horaStr}hs) - Sanción a todos los jugadores`,
            activa: true,
          });
          sancionesAplicadas++;
        }

        await supabase
          .from('turnos')
          .update({ sancion_qr_aplicada: true })
          .eq('id', t.id);
      }
    }

    return sancionesAplicadas;
  } catch (err) {
    console.warn('Error resolviendo turnos sin validar:', err);
    return 0;
  }
}


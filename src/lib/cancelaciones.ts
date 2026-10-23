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
  const diasSancion = config.penalizacion_dias || 14;
  const esClimaInestable = Boolean(config.clima_inestable);

  // 1. Clima Inestable activo
  if (esClimaInestable) {
    return {
      categoria: 'clima',
      minutosFaltantes: minutos,
      esClimaInestable: true,
      diasSancion,
      titulo: 'Día con Clima Inestable',
      badge: '🌧️ Clima Inestable',
      color: 'sky',
      descripcion: 'El club tiene activo el modo de clima inestable.',
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
    const diasSancion = config.penalizacion_dias || 14;
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
    const diasSancion = config?.penalizacion_dias || 14;
    const esClimaInestable = Boolean(config?.clima_inestable);

    // Buscar turnos cancelados tardíamente pendientes
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

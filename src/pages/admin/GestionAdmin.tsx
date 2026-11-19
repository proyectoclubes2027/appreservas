import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  QrCode, 
  Calendar, 
  Clock, 
  ShieldAlert, 
  ShieldCheck, 
  CloudRain, 
  RefreshCw, 
  Zap,
  CheckCircle2,
  Sliders,
  Unlock,
  AlertCircle
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useClubConfig } from '../../lib/useClubConfig';
import { resolverTurnosSinValidar } from '../../lib/cancelaciones';
import { format, parseISO } from 'date-fns';

export default function GestionAdmin() {
  const { config, updateConfig, refreshConfig, loading: configLoading } = useClubConfig();

  // Local state for form values
  const [climaInestable, setClimaInestable] = useState(false);
  const [qrActivo, setQrActivo] = useState(false);
  const [mostrarAvisoQr, setMostrarAvisoQr] = useState(false);
  const [diasAnticipacion, setDiasAnticipacion] = useState(2);
  const [tolerancia, setTolerancia] = useState(20);
  const [penalizacionDias, setPenalizacionDias] = useState(7);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // Sanciones state
  const [penalizaciones, setPenalizaciones] = useState<any[]>([]);
  const [loadingPenalizaciones, setLoadingPenalizaciones] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [isCheckingQr, setIsCheckingQr] = useState(false);
  const [checkResultMsg, setCheckResultMsg] = useState('');

  // Desbloqueos rápidos
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (config) {
      setClimaInestable(Boolean(config.clima_inestable));
      setQrActivo(Boolean(config.validacion_qr_activa));
      setMostrarAvisoQr(Boolean(config.mostrar_aviso_qr));
      setDiasAnticipacion(config.dias_anticipacion || 2);
      setTolerancia(config.tolerancia_minutos || 20);
      setPenalizacionDias(config.penalizacion_dias || 7);
    }
  }, [config]);

  useEffect(() => {
    fetchPenalizaciones();
  }, []);

  const fetchPenalizaciones = async () => {
    setLoadingPenalizaciones(true);
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('penalizaciones')
        .select('*, turnos(fecha, hora_inicio, canchas(nombre))')
        .eq('activa', true)
        .gte('fecha_fin', todayStr)
        .order('fecha_fin', { ascending: true });

      if (!error && data) {
        const dnis = Array.from(new Set(data.map((p: any) => p.socio_dni)));
        if (dnis.length > 0) {
          const { data: sociosData } = await supabase
            .from('socios')
            .select('dni, nombre, apellido, telefono')
            .in('dni', dnis);
          const socioMap = new Map((sociosData || []).map((s: any) => [s.dni, s]));
          const enriched = data.map((p: any) => ({
            ...p,
            socio: socioMap.get(p.socio_dni),
          }));
          setPenalizaciones(enriched);
        } else {
          setPenalizaciones([]);
        }
      } else {
        setPenalizaciones([]);
      }
    } catch (err) {
      console.error('Error al cargar penalizaciones:', err);
    } finally {
      setLoadingPenalizaciones(false);
    }
  };

  const handleSaveConfig = async () => {
    setIsSaving(true);
    setSaveSuccessMsg('');
    const res = await updateConfig({
      clima_inestable: climaInestable,
      validacion_qr_activa: qrActivo,
      mostrar_aviso_qr: mostrarAvisoQr,
      dias_anticipacion: Number(diasAnticipacion),
      tolerancia_minutos: Number(tolerancia),
      penalizacion_dias: Number(penalizacionDias),
    });
    setIsSaving(false);

    if (res.success) {
      setSaveSuccessMsg('¡Configuración guardada correctamente!');
      setTimeout(() => setSaveSuccessMsg(''), 4000);
    } else {
      alert('Error al guardar configuración: ' + res.error);
    }
  };

  const handleToggleClimaInmediato = async () => {
    const nuevoValor = !climaInestable;
    setClimaInestable(nuevoValor);
    setIsSaving(true);
    const res = await updateConfig({ clima_inestable: nuevoValor });
    setIsSaving(false);
    if (!res.success) {
      setClimaInestable(!nuevoValor);
      alert('Error al actualizar clima: ' + res.error);
    }
  };

  const handleRemoverSancion = async (penalizacion: any) => {
    const nombreSocio = penalizacion.socio 
      ? `${penalizacion.socio.apellido}, ${penalizacion.socio.nombre}` 
      : `DNI ${penalizacion.socio_dni}`;

    const confirmacion = window.confirm(
      `¿Deseas levantar la sanción al socio ${nombreSocio}?\n\nQuedará habilitado inmediatamente para volver a reservar.`
    );
    if (!confirmacion) return;

    setRemovingId(penalizacion.id);
    try {
      const { error } = await supabase
        .from('penalizaciones')
        .update({ activa: false })
        .eq('id', penalizacion.id);

      if (error) {
        alert('Error al levantar sanción: ' + error.message);
      } else {
        await fetchPenalizaciones();
      }
    } catch (err: any) {
      alert('Error inesperado: ' + err.message);
    } finally {
      setRemovingId(null);
    }
  };

  const handleControlarQr = async () => {
    setIsCheckingQr(true);
    setCheckResultMsg('');
    try {
      const sancionesCount = await resolverTurnosSinValidar(config);
      if (sancionesCount > 0) {
        setCheckResultMsg(`✓ Se aplicaron ${sancionesCount} nueva(s) sanción(es) por turnos sin validar.`);
      } else {
        setCheckResultMsg('✓ Control finalizado: todos los turnos pasados están regularizados.');
      }
      await fetchPenalizaciones();
    } catch (err: any) {
      setCheckResultMsg('Error al ejecutar control: ' + err.message);
    } finally {
      setIsCheckingQr(false);
      setTimeout(() => setCheckResultMsg(''), 6000);
    }
  };

  const handleDesbloquearDia = async (diaSemana: 0 | 6, nombreDia: string) => {
    const confirmar = window.confirm(
      `¿Deseas desbloquear los turnos habituales de ${nombreDia} para las próximas semanas?`
    );
    if (!confirmar) return;

    setActionLoading(true);
    try {
      const today = new Date();
      let fechas: string[] = [];
      for (let i = 0; i < 28; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        if (d.getDay() === diaSemana) {
          fechas.push(format(d, 'yyyy-MM-dd'));
        }
      }

      if (fechas.length > 0) {
        const { error } = await supabase
          .from('turnos')
          .delete()
          .in('fecha', fechas)
          .eq('estado', 'bloqueado');

        if (error) {
          alert('Error al desbloquear: ' + error.message);
        } else {
          alert(`✓ Turnos de ${nombreDia} desbloqueados con éxito.`);
        }
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (configLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <RefreshCw size={24} className="text-primary animate-spin" />
        <p className="text-sm text-textSec">Cargando panel de gestión...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto pb-10">
      {/* Header */}
      <div className="bg-surface p-4 sm:p-6 rounded-2xl border border-border shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-primary/20 text-primary rounded-lg">
              <Sliders size={18} />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-primary">Panel Administrativo</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold uppercase tracking-wide text-textPri mt-1">
            Gestión y Configuración
          </h2>
          <p className="text-xs text-textSec mt-0.5">
            Administrá las reglas del club, el sistema de validación QR, el factor climático y las sanciones.
          </p>
        </div>

        <button
          onClick={() => { refreshConfig(); fetchPenalizaciones(); }}
          className="p-2.5 bg-slate-100 hover:bg-surface border border-border rounded-xl text-textSec hover:text-textPri text-xs font-semibold flex items-center gap-1.5 transition-colors self-end sm:self-auto"
          title="Actualizar datos"
        >
          <RefreshCw size={15} />
          <span>Actualizar</span>
        </button>
      </div>

      {/* Tarjeta 1: Factor Climático (Lluvia / Clima Inestable) */}
      <div className={`p-5 rounded-2xl border transition-all shadow-sm flex flex-col gap-3 ${
        climaInestable
          ? 'bg-sky-950/40 border-sky-500/50 shadow-sky-950/30'
          : 'bg-surface border-border'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`p-2.5 rounded-xl ${climaInestable ? 'bg-sky-500/20 text-sky-400' : 'bg-white/5 text-textSec'}`}>
              <CloudRain size={22} className={climaInestable ? 'animate-bounce' : ''} />
            </div>
            <div>
              <h3 className="text-base font-bold text-textPri flex items-center gap-2">
                Factor Climático: Clima Inestable / Lluvia
                {climaInestable && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-sky-500/20 border border-sky-500/40 text-sky-300 font-bold uppercase tracking-wider">
                    Activo Hoy
                  </span>
                )}
              </h3>
              <p className="text-xs text-textSec">
                Suspensión temporal de exigencias y sanciones ante mal tiempo o llovizna.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggleClimaInmediato}
            disabled={isSaving}
            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              climaInestable ? 'bg-sky-500' : 'bg-[#333]'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                climaInestable ? 'translate-x-5 !bg-black' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className={`p-3 rounded-xl text-xs ${
          climaInestable 
            ? 'bg-sky-500/10 border border-sky-500/30 text-sky-200' 
            : 'bg-slate-100 border border-slate-200 text-textSec'
        }`}>
          {climaInestable ? (
            <p>
              🌧️ <strong>MODO CLIMA INESTABLE ACTIVADO:</strong> Los socios pueden jugar si la cancha lo permite, pero <strong>no se exige validación por QR</strong> y las cancelaciones o ausencias <strong>no generan sanciones automáticas</strong> hoy.
            </p>
          ) : (
            <p>
              ☀️ <strong>Clima Normal:</strong> Rige el sistema habitual de validación por QR y las reglas de sanciones por no-show o cancelación tardía.
            </p>
          )}
        </div>
      </div>

      {/* Tarjeta 2: Sistema de Validación QR y Auditoría */}
      <div className="bg-surface p-5 rounded-2xl border border-border shadow-sm flex flex-col gap-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-border">
          <div className="p-2.5 bg-primary/20 text-primary rounded-xl">
            <QrCode size={20} />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-textPri">Validación de Asistencia por Código QR</h3>
            <p className="text-xs text-textSec">Control de presencia de todos los participantes en las canchas</p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
            qrActivo ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-zinc-800 text-zinc-400'
          }`}>
            {qrActivo ? 'QR Obligatorio' : 'QR Opcional'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Switch QR Activo */}
          <div className="p-3.5 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <p className="font-bold text-textPri text-sm">Exigir QR Obligatorio</p>
              <p className="text-xs text-textSec mt-0.5">Sanciona si algún socio participante no escanea el QR.</p>
            </div>
            <button
              type="button"
              onClick={() => setQrActivo(!qrActivo)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                qrActivo ? 'bg-primary' : 'bg-[#333]'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  qrActivo ? 'translate-x-5 !bg-slate-100' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Switch Banner Informativo */}
          <div className="p-3.5 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <p className="font-bold text-textPri text-sm">Aviso de QR a Socios</p>
              <p className="text-xs text-textSec mt-0.5">Muestra un banner recordatorio en el inicio de la app.</p>
            </div>
            <button
              type="button"
              onClick={() => setMostrarAvisoQr(!mostrarAvisoQr)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                mostrarAvisoQr ? 'bg-primary' : 'bg-[#333]'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  mostrarAvisoQr ? 'translate-x-5 !bg-slate-100' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Parámetros de tolerancia y sanción */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div className="flex flex-col gap-1.5 p-3.5 bg-slate-100 rounded-xl border border-slate-200">
            <label className="text-xs font-semibold text-textSec flex items-center gap-1.5">
              <Clock size={14} className="text-primary" />
              Tolerancia para escanear (minutos)
            </label>
            <input
              type="number"
              min="5"
              max="60"
              value={tolerancia}
              onChange={(e) => setTolerancia(Number(e.target.value))}
              className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-textPri focus:outline-none focus:border-primary font-bold"
            />
            <span className="text-[10px] text-textSec">
              Minutos después del inicio del turno en que caduca el plazo de escaneo.
            </span>
          </div>

          <div className="flex flex-col gap-1.5 p-3.5 bg-slate-100 rounded-xl border border-slate-200">
            <label className="text-xs font-semibold text-textSec flex items-center gap-1.5">
              <ShieldAlert size={14} className="text-amber-400" />
              Días de sanción por no validar
            </label>
            <input
              type="number"
              min="1"
              max="90"
              value={penalizacionDias}
              onChange={(e) => setPenalizacionDias(Number(e.target.value))}
              className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-textPri focus:outline-none focus:border-primary font-bold"
            />
            <span className="text-[10px] text-textSec">
              Días en que los participantes quedan inhabilitados para volver a reservar ({penalizacionDias === 7 ? '1 semana' : `${penalizacionDias} días`}).
            </span>
          </div>
        </div>

        {/* Botón de Auditoría Inmediata de QR */}
        <div className="bg-slate-100 p-3.5 rounded-xl border border-dashed border-slate-300 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Zap size={18} className="text-amber-400 shrink-0" />
            <div>
              <p className="text-xs font-bold text-textPri">Auditoría / Control Inmediato de QR</p>
              <p className="text-[11px] text-textSec">
                Evalúa turnos pasados al instante y genera las sanciones correspondientes sin esperar.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={handleControlarQr}
            disabled={isCheckingQr}
            className="text-xs py-2 px-3 shrink-0 flex items-center gap-1.5"
          >
            <Zap size={13} className={isCheckingQr ? 'animate-spin' : 'text-amber-400'} />
            <span>{isCheckingQr ? 'Revisando...' : '⚡ Controlar QR ahora'}</span>
          </Button>
        </div>

        {checkResultMsg && (
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-300 font-medium">
            {checkResultMsg}
          </div>
        )}
      </div>

      {/* Tarjeta 3: Reglas de Anticipación y Cancelación */}
      <div className="bg-surface p-5 rounded-2xl border border-border shadow-sm flex flex-col gap-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-border">
          <div className="p-2.5 bg-primary/20 text-primary rounded-xl">
            <Calendar size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-textPri">Reglas de Turnos y Anticipación</h3>
            <p className="text-xs text-textSec">Plazos de apertura de agenda para los socios</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5 p-3.5 bg-slate-100 rounded-xl border border-slate-200">
            <label className="text-xs font-semibold text-textSec flex items-center gap-1.5">
              <Calendar size={14} className="text-primary" />
              Días de anticipación para reservar
            </label>
            <input
              type="number"
              min="1"
              max="14"
              value={diasAnticipacion}
              onChange={(e) => setDiasAnticipacion(Number(e.target.value))}
              className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-textPri focus:outline-none focus:border-primary font-bold"
            />
            <span className="text-[10px] text-textSec">
              Cantidad de días hacia adelante visibles y disponibles para reservar.
            </span>
          </div>

          <div className="flex flex-col gap-2 p-3.5 bg-slate-100 rounded-xl border border-slate-200 justify-center">
            <div className="flex items-center gap-2 text-textPri text-xs font-bold">
              <CheckCircle2 size={15} className="text-primary" />
              <span>Límite de Turnos Simultáneos</span>
            </div>
            <p className="text-[11px] text-textSec">
              Cada socio puede tener como máximo <strong>1 turno activo por día</strong> para garantizar rotación equitativa de canchas.
            </p>
          </div>
        </div>

        {/* Botón Guardar Cambios */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          {saveSuccessMsg ? (
            <p className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 size={16} />
              {saveSuccessMsg}
            </p>
          ) : (
            <p className="text-[11px] text-textSec">Recordá guardar los cambios tras modificar los valores.</p>
          )}

          <Button
            type="button"
            onClick={handleSaveConfig}
            disabled={isSaving}
            className="w-full sm:w-auto px-6 py-2.5 text-xs font-bold"
          >
            {isSaving ? 'Guardando...' : 'Guardar Configuración'}
          </Button>
        </div>
      </div>

      {/* Tarjeta 4: Gestión de Sanciones Activas */}
      <div className="bg-surface p-5 rounded-2xl border border-border shadow-sm flex flex-col gap-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl">
              <ShieldAlert size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-textPri flex items-center gap-2">
                Socios Inhabilitados Hoy ({penalizaciones.length})
              </h3>
              <p className="text-xs text-textSec">Sanciones vigentes que impiden reservar turnos</p>
            </div>
          </div>

          <button
            onClick={fetchPenalizaciones}
            className="text-xs text-primary hover:underline flex items-center gap-1 font-semibold"
          >
            <RefreshCw size={12} className={loadingPenalizaciones ? 'animate-spin' : ''} />
            <span>Refrescar</span>
          </button>
        </div>

        {loadingPenalizaciones ? (
          <div className="p-6 text-center text-xs text-textSec">Cargando sanciones activas...</div>
        ) : penalizaciones.length === 0 ? (
          <div className="p-6 text-center bg-slate-100 rounded-xl border border-slate-200">
            <ShieldCheck size={28} className="text-emerald-400 mx-auto mb-2 opacity-80" />
            <p className="text-sm font-bold text-textPri">No hay socios sancionados hoy</p>
            <p className="text-xs text-textSec mt-1">
              Todos los socios del club se encuentran habilitados para reservar turnos.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {penalizaciones.map((p) => {
              const finFormatted = p.fecha_fin
                ? format(parseISO(p.fecha_fin), 'dd/MM/yyyy')
                : 'Sin fecha';
              const isRemoving = removingId === p.id;

              return (
                <div
                  key={p.id}
                  className="p-3.5 bg-slate-100 border border-border/80 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-textPri">
                        {p.socio ? `${p.socio.apellido}, ${p.socio.nombre}` : `DNI ${p.socio_dni}`}
                      </span>
                      <span className="text-[11px] text-textSec">
                        (DNI {p.socio_dni})
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        Hasta {finFormatted}
                      </span>
                    </div>

                    <p className="text-xs text-textSec flex items-center gap-1">
                      <AlertCircle size={13} className="text-amber-400 shrink-0" />
                      <span>{p.motivo}</span>
                    </p>

                    {p.turnos && (
                      <p className="text-[11px] text-textSec/80">
                        Turno asociado: {p.turnos.canchas?.nombre} • {p.turnos.fecha} ({p.turnos.hora_inicio?.substring(0, 5)} hs)
                      </p>
                    )}
                  </div>

                  <Button
                    variant="secondary"
                    onClick={() => handleRemoverSancion(p)}
                    disabled={isRemoving}
                    className="text-xs py-1.5 px-3 self-end sm:self-auto text-emerald-400 hover:text-emerald-300 border-emerald-500/30 hover:border-emerald-500/60"
                  >
                    <ShieldCheck size={14} className="mr-1" />
                    <span>{isRemoving ? 'Levantando...' : 'Levantar Sanción'}</span>
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tarjeta 5: Desbloqueos Masivos y Mantenimiento */}
      <div className="bg-surface p-5 rounded-2xl border border-border shadow-sm flex flex-col gap-3">
        <div className="flex items-center gap-2.5 pb-2 border-b border-border">
          <div className="p-2 bg-white/5 text-textSec rounded-xl">
            <Unlock size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-textPri">Acciones Rápidas de Turnos</h3>
            <p className="text-xs text-textSec">Desbloqueo masivo para los fines de semana</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={() => handleDesbloquearDia(6, 'Sábados')}
            disabled={actionLoading}
            className="p-3 bg-slate-100 hover:bg-white border border-border rounded-xl text-left transition-colors flex items-center justify-between"
          >
            <div>
              <p className="text-xs font-bold text-textPri">Desbloquear Sábados</p>
              <p className="text-[10px] text-textSec">Habilita todos los turnos bloqueados de los próximos sábados</p>
            </div>
            <Unlock size={15} className="text-primary" />
          </button>

          <button
            type="button"
            onClick={() => handleDesbloquearDia(0, 'Domingos')}
            disabled={actionLoading}
            className="p-3 bg-slate-100 hover:bg-white border border-border rounded-xl text-left transition-colors flex items-center justify-between"
          >
            <div>
              <p className="text-xs font-bold text-textPri">Desbloquear Domingos</p>
              <p className="text-[10px] text-textSec">Habilita todos los turnos bloqueados de los próximos domingos</p>
            </div>
            <Unlock size={15} className="text-primary" />
          </button>
        </div>
      </div>
    </div>
  );
}

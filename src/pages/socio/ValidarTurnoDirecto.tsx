import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { useClubConfig } from '../../lib/useClubConfig';
import { Button } from '../../components/ui/Button';
import { CheckCircle2, AlertCircle, Clock, ArrowRight, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const isValidUuid = (value: any): boolean => {
  if (typeof value !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
};

export default function ValidarTurnoDirecto() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { socio, user, loading: authLoading } = useAuth();
  const { config } = useClubConfig();

  const canchaParam = searchParams.get('cancha');
  const canchaId = canchaParam ? parseInt(canchaParam, 10) : null;

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'validating' | 'success' | 'already_validated' | 'no_shift' | 'error'>('validating');
  const [turnoInfo, setTurnoInfo] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    // Si la autenticación aún está cargando, esperamos
    if (authLoading) return;

    // Si el socio no está autenticado, guardamos el destino y lo mandamos al login
    if (!user || !socio) {
      const redirectUrl = `/validar?cancha=${canchaParam || '1'}`;
      sessionStorage.setItem('post_login_redirect', redirectUrl);
      navigate('/login', { replace: true });
      return;
    }

    if (!canchaId || isNaN(canchaId)) {
      setStatus('error');
      setErrorMessage('Número de cancha inválido en el código QR.');
      setLoading(false);
      return;
    }

    validarPresencia();
  }, [authLoading, user, socio, canchaId]);

  const validarPresencia = async () => {
    if (!socio || !canchaId) return;
    setLoading(true);

    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      
      // Buscar turnos ocupados de hoy en esta cancha
      const { data: turnosHoy, error: turnosErr } = await supabase
        .from('turnos')
        .select('*, canchas(nombre)')
        .eq('fecha', todayStr)
        .eq('cancha_id', canchaId)
        .eq('estado', 'ocupado');

      if (turnosErr) throw turnosErr;

      if (!turnosHoy || turnosHoy.length === 0) {
        setStatus('no_shift');
        setErrorMessage(`No tenés ningún turno reservado hoy en Cancha ${canchaId}.`);
        setLoading(false);
        return;
      }

      // Buscar si el socio forma parte de alguno de estos turnos (titular o participante)
      const turnoSocio = turnosHoy.find((t: any) => {
        const isTitular = t.socio_dni === socio.dni;
        const isPart = Array.isArray(t.participantes_dnis) && t.participantes_dnis.includes(socio.dni);
        return isTitular || isPart;
      });

      if (!turnoSocio) {
        setStatus('no_shift');
        setErrorMessage(`No figuras como jugador en ningún turno de hoy en Cancha ${canchaId}.`);
        setLoading(false);
        return;
      }

      setTurnoInfo(turnoSocio);

      // Verificar si ya validó previamente
      const validados: string[] = Array.isArray(turnoSocio.validados_dnis) ? turnoSocio.validados_dnis : [];
      if (validados.includes(socio.dni)) {
        setStatus('already_validated');
        setLoading(false);
        return;
      }

      // Validar ventana de horario con tolerancia
      const [startH, startM] = turnoSocio.hora_inicio.slice(0, 5).split(':').map(Number);
      const startMinutes = startH * 60 + startM;

      let endMinutes = startMinutes + 60;
      if (turnoSocio.hora_fin) {
        const [endH, endM] = turnoSocio.hora_fin.slice(0, 5).split(':').map(Number);
        endMinutes = endH * 60 + endM;
      }

      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      const tolerancia = config.tolerancia_minutos || 20;
      const windowStart = startMinutes - tolerancia;
      const windowEnd = endMinutes + tolerancia;

      if (currentMinutes < windowStart) {
        setStatus('no_shift');
        setErrorMessage(`Aún es muy temprano para validar. Tu turno comienza a las ${(turnoSocio.hora_inicio || '').slice(0, 5)} hs (habilitado desde ${Math.floor(windowStart / 60).toString().padStart(2, '0')}:${(windowStart % 60).toString().padStart(2, '0')} hs).`);
        setLoading(false);
        return;
      }

      if (currentMinutes > windowEnd) {
        setStatus('no_shift');
        setErrorMessage(`El tiempo de validación para este turno ya finalizó (terminó a las ${(turnoSocio.hora_fin || '').slice(0, 5)} hs).`);
        setLoading(false);
        return;
      }

      // Ejecutar validación vía RPC segura o fallback directo
      let rpcOk = false;
      if (turnoSocio.id && isValidUuid(turnoSocio.id)) {
        const { data: rpcData, error: rpcErr } = await supabase.rpc('validar_presencia_turno', {
          p_turno_id: turnoSocio.id,
          p_cancha_id: turnoSocio.cancha_id,
        });

        if (!rpcErr && rpcData?.success) {
          rpcOk = true;
        }
      }

      if (!rpcOk) {
        const updatedValidados = Array.from(new Set([...validados, socio.dni]));
        await supabase
          .from('turnos')
          .update({
            validados_dnis: updatedValidados,
            validado: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', turnoSocio.id);
      }

      setStatus('success');
    } catch (err: any) {
      console.error('Error validando turno directo:', err);
      setStatus('error');
      setErrorMessage(err.message || 'Ocurrió un error al registrar la presencia.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-[#eeeeee] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#161616] border border-[#2a2a2a] rounded-2xl p-6 sm:p-7 shadow-2xl space-y-6">
        
        {/* Encabezado del Club */}
        <div className="flex flex-col items-center text-center space-y-2 border-b border-[#262626] pb-5">
          <img
            src="/empalme-central-logo.png"
            alt="CAEC Tenis"
            className="w-48 h-auto object-contain drop-shadow"
          />
          <span className="text-xs font-bold uppercase tracking-widest text-primary pt-1">
            Validación de Presencia en Cancha
          </span>
        </div>

        {/* Estado: Procesando */}
        {loading && (
          <div className="py-10 flex flex-col items-center justify-center space-y-4 text-center">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">Validando tu presencia...</h3>
              <p className="text-xs text-textSec">Comprobando Cancha {canchaId} con tu usuario ({socio?.nombre})</p>
            </div>
          </div>
        )}

        {/* Estado: Éxito */}
        {!loading && status === 'success' && (
          <div className="space-y-5 animate-[fadeIn_0.3s]">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border-2 border-emerald-500/50 flex items-center justify-center text-emerald-400 mx-auto">
              <CheckCircle2 size={36} className="animate-bounce" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-xl font-black text-white">¡Presencia Confirmada!</h3>
              <p className="text-sm text-emerald-300 font-medium">
                Tu asistencia quedó registrada en el sistema.
              </p>
            </div>

            {turnoInfo && (
              <div className="bg-[#111111] border border-[#262626] rounded-xl p-4 space-y-2 text-xs">
                <div className="flex justify-between items-center text-textSec">
                  <span>Cancha:</span>
                  <span className="font-bold text-white uppercase">{turnoInfo.canchas?.nombre || `Cancha ${canchaId}`}</span>
                </div>
                <div className="flex justify-between items-center text-textSec">
                  <span>Horario:</span>
                  <span className="font-bold font-mono text-primary">
                    {(turnoInfo.hora_inicio || '').slice(0, 5)} - {(turnoInfo.hora_fin || '').slice(0, 5)} hs
                  </span>
                </div>
                <div className="flex justify-between items-center text-textSec">
                  <span>Jugador:</span>
                  <span className="font-bold text-white">{socio?.nombre} {socio?.apellido}</span>
                </div>
              </div>
            )}

            <div className="pt-2 flex flex-col gap-2">
              <Button
                variant="primary"
                fullWidth
                onClick={() => navigate('/mis-turnos', { replace: true })}
                className="h-11 font-black text-xs uppercase tracking-wide flex items-center justify-center gap-2"
              >
                <span>Ver Mis Turnos</span>
                <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        )}

        {/* Estado: Ya estaba validado */}
        {!loading && status === 'already_validated' && (
          <div className="space-y-5 animate-[fadeIn_0.3s]">
            <div className="w-16 h-16 rounded-2xl bg-sky-500/20 border-2 border-sky-500/50 flex items-center justify-center text-sky-400 mx-auto">
              <CheckCircle2 size={36} />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-black text-white">¡Ya estabas validado!</h3>
              <p className="text-xs text-textSec">
                Tu presencia para este turno ya se encontraba confirmada previamente.
              </p>
            </div>

            {turnoInfo && (
              <div className="bg-[#111111] border border-[#262626] rounded-xl p-4 space-y-2 text-xs">
                <div className="flex justify-between items-center text-textSec">
                  <span>Cancha:</span>
                  <span className="font-bold text-white uppercase">{turnoInfo.canchas?.nombre || `Cancha ${canchaId}`}</span>
                </div>
                <div className="flex justify-between items-center text-textSec">
                  <span>Horario:</span>
                  <span className="font-bold font-mono text-primary">
                    {(turnoInfo.hora_inicio || '').slice(0, 5)} - {(turnoInfo.hora_fin || '').slice(0, 5)} hs
                  </span>
                </div>
              </div>
            )}

            <Button
              variant="secondary"
              fullWidth
              onClick={() => navigate('/reservar', { replace: true })}
              className="h-11 font-bold text-xs"
            >
              Ir al Inicio
            </Button>
          </div>
        )}

        {/* Estado: No tiene turno activo en este horario / cancha */}
        {!loading && status === 'no_shift' && (
          <div className="space-y-5 animate-[fadeIn_0.3s]">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border-2 border-amber-500/50 flex items-center justify-center text-amber-400 mx-auto">
              <Clock size={36} />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-black text-white">Turno no disponible para validar</h3>
              <p className="text-xs text-amber-200/90 leading-relaxed">
                {errorMessage}
              </p>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <Button
                variant="primary"
                fullWidth
                onClick={() => navigate('/mis-turnos', { replace: true })}
                className="h-11 font-bold text-xs"
              >
                Revisar Mis Turnos
              </Button>
              <Button
                variant="secondary"
                fullWidth
                onClick={() => navigate('/reservar', { replace: true })}
                className="h-11 font-bold text-xs"
              >
                Ir a Reservas
              </Button>
            </div>
          </div>
        )}

        {/* Estado: Error general */}
        {!loading && status === 'error' && (
          <div className="space-y-5 animate-[fadeIn_0.3s]">
            <div className="w-16 h-16 rounded-2xl bg-red-500/20 border-2 border-red-500/50 flex items-center justify-center text-red-400 mx-auto">
              <AlertCircle size={36} />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-black text-white">No se pudo validar</h3>
              <p className="text-xs text-red-300 leading-relaxed">
                {errorMessage}
              </p>
            </div>

            <Button
              variant="secondary"
              fullWidth
              onClick={() => navigate('/reservar', { replace: true })}
              className="h-11 font-bold text-xs"
            >
              Volver al Inicio
            </Button>
          </div>
        )}

      </div>
    </div>
  );
}

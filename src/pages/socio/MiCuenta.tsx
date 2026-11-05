import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Zap, Users, AlertCircle, CheckCircle2, Clock, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

// URL del portal de secretaría (dashboard)
const DASHBOARD_URL = import.meta.env.VITE_DASHBOARD_URL || 'https://adm-socios-caec-tenis.vercel.app';

interface TurnoLuz {
  turnoId: string;
  fecha: string;
  horario: string;
  cancha: string;
  tipoPartido: string;
  esTitular: boolean;
  sociosCount: number;
  montoTotal: number;
  montoPorSocio: number;
  pagado: boolean;
  fechaPago: string | null;
}

interface Invitado {
  id: string;
  concepto: string;
  monto: number;
  fechaRegistro: string;
  metodoPago: string;
}

interface Resumen {
  luzPendiente: number;
  luzPagado: number;
  invitadosPagado: number;
  totalPendiente: number;
}

interface CuentaData {
  turnosLuz: TurnoLuz[];
  invitados: Invitado[];
  resumen: Resumen;
}

function formatMoney(amount: number) {
  return `$${amount.toLocaleString('es-AR')}`;
}

function formatFecha(fecha: string) {
  if (!fecha) return '';
  const [y, m, d] = fecha.split('-');
  return `${d}/${m}/${y}`;
}

function Seccion({ title, icon, defaultOpen = true, children }: {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden mb-4">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2 text-textPri font-semibold text-sm">
          {icon}
          {title}
        </div>
        {open ? <ChevronUp size={16} className="text-textSec" /> : <ChevronDown size={16} className="text-textSec" />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

export default function MiCuenta() {
  const { socio } = useAuth();
  const [data, setData] = useState<CuentaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCuenta = async () => {
    if (!socio?.dni) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${DASHBOARD_URL}/api/socio-cuenta?dni=${socio.dni}`);
      if (!res.ok) throw new Error('No se pudo obtener la información');
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      setError('No se pudo cargar la información. Intentá de nuevo más tarde.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCuenta();
  }, [socio?.dni]);

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-textPri">Mi Cuenta</h1>
        <button
          onClick={fetchCuenta}
          disabled={loading}
          className="p-2 rounded-full text-textSec hover:text-textPri transition-colors"
          title="Actualizar"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-surface rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {error && !loading && (
        <div className="flex items-center gap-3 bg-red-900/30 border border-red-700 rounded-xl p-4 text-red-400 text-sm">
          <AlertCircle size={18} className="shrink-0" />
          {error}
        </div>
      )}

      {data && !loading && (
        <>
          {/* Bloque: Turnos con Luz */}
          <Seccion
            title={`Turnos con Luz (${new Date().getFullYear()})`}
            icon={<Zap size={16} className="text-yellow-400" />}
          >
            {data.turnosLuz.length === 0 ? (
              <p className="text-textSec text-sm py-2">No tenés turnos nocturnos registrados este año.</p>
            ) : (
              <>
                {/* Resumen compacto */}
                <div className="flex gap-3 mb-3">
                  <div className="flex-1 bg-background rounded-lg p-3 text-center">
                    <p className="text-xs text-textSec mb-0.5">Pagado</p>
                    <p className="text-emerald-400 font-bold text-sm">{formatMoney(data.resumen.luzPagado)}</p>
                  </div>
                  <div className="flex-1 bg-background rounded-lg p-3 text-center">
                    <p className="text-xs text-textSec mb-0.5">Pendiente</p>
                    <p className={`font-bold text-sm ${data.resumen.luzPendiente > 0 ? 'text-amber-400' : 'text-textSec'}`}>
                      {formatMoney(data.resumen.luzPendiente)}
                    </p>
                  </div>
                </div>

                {/* Listado */}
                <div className="space-y-2">
                  {data.turnosLuz.map((t) => (
                    <div
                      key={t.turnoId}
                      className={`flex items-center justify-between rounded-lg px-3 py-2.5 border text-sm ${
                        t.pagado
                          ? 'bg-emerald-900/10 border-emerald-800/40'
                          : 'bg-amber-900/10 border-amber-800/40'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-textPri font-medium truncate">
                          {formatFecha(t.fecha)} · {t.horario}
                        </p>
                        <p className="text-textSec text-xs">
                          {t.cancha} · {t.tipoPartido} · {t.esTitular ? 'Titular' : 'Acompañante'}
                        </p>
                        {t.pagado && t.fechaPago && (
                          <p className="text-emerald-500 text-xs">Pagado el {formatFecha(t.fechaPago)}</p>
                        )}
                      </div>
                      <div className="ml-3 text-right shrink-0">
                        <p className="font-bold text-textPri">{formatMoney(t.montoPorSocio)}</p>
                        {t.pagado ? (
                          <CheckCircle2 size={14} className="text-emerald-400 ml-auto mt-0.5" />
                        ) : (
                          <Clock size={14} className="text-amber-400 ml-auto mt-0.5" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Seccion>

          {/* Bloque: Invitados Extra (Solo visible para socios estándar) */}
          {socio?.rol !== 'profesor' && (
            <Seccion
              title="Invitados Extra"
              icon={<Users size={16} className="text-blue-400" />}
              defaultOpen={data.invitados.length > 0}
            >
              {data.invitados.length === 0 ? (
                <p className="text-textSec text-sm py-2">No tenés cargos por invitados este año.</p>
              ) : (
                <>
                  <div className="flex gap-3 mb-3">
                    <div className="flex-1 bg-background rounded-lg p-3 text-center">
                      <p className="text-xs text-textSec mb-0.5">Total pagado</p>
                      <p className="text-emerald-400 font-bold text-sm">{formatMoney(data.resumen.invitadosPagado)}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {data.invitados.map((inv) => (
                      <div
                        key={inv.id}
                        className="flex items-center justify-between rounded-lg px-3 py-2.5 border border-emerald-800/40 bg-emerald-900/10 text-sm"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-textPri font-medium truncate">{inv.concepto}</p>
                          <p className="text-textSec text-xs">
                            {formatFecha(inv.fechaRegistro)} · {inv.metodoPago}
                          </p>
                        </div>
                        <div className="ml-3 text-right shrink-0">
                          <p className="font-bold text-textPri">{formatMoney(inv.monto)}</p>
                          <CheckCircle2 size={14} className="text-emerald-400 ml-auto mt-0.5" />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Seccion>
          )}

          {/* Nota al pie */}
          <p className="text-center text-textSec text-xs mt-2 pb-2">
            Los pagos son registrados por secretaría. Ante cualquier duda, consultá en el club.
          </p>
        </>
      )}
    </div>
  );
}


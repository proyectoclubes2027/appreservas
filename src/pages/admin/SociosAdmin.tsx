import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const MESES_MOROSO = 2; // Umbral para considerar moroso

export default function SociosAdmin() {
  const [socios, setSocios] = useState<any[]>([]);
  const [loadingLocal, setLoadingLocal] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'todos' | 'activos' | 'inactivos' | 'morosos'>('todos');

  // Modal editar socio
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    dni: '',
    nombre: '',
    apellido: '',
    email: '',
    rol: 'socio',
    activo: true
  });

  // Modal cuotas
  const [cuotasModal, setCuotasModal] = useState<any | null>(null); // socio seleccionado
  const [cuotas, setCuotas] = useState<any[]>([]);
  const [loadingCuotas, setLoadingCuotas] = useState(false);
  const [savingCuota, setSavingCuota] = useState(false);
  const [nuevaCuotaMes, setNuevaCuotaMes] = useState('');
  const [nuevaCuotaMonto, setNuevaCuotaMonto] = useState('8000');

  useEffect(() => {
    fetchSocios();
  }, []);

  const fetchSocios = async () => {
    setLoadingLocal(true);

    const { data: sociosData, error } = await supabase
      .from('socios')
      .select('*')
      .order('apellido', { ascending: true });

    if (error || !sociosData) {
      setLoadingLocal(false);
      return;
    }

    // Traer cuotas pendientes/vencidas para calcular morosidad
    const { data: cuotasData } = await supabase
      .from('cuotas')
      .select('socio_id, estado')
      .in('estado', ['pendiente', 'vencida']);

    const deudaMap = new Map<string, number>();
    if (cuotasData) {
      for (const c of cuotasData) {
        deudaMap.set(c.socio_id, (deudaMap.get(c.socio_id) || 0) + 1);
      }
    }

    const enriched = sociosData.map(s => ({
      ...s,
      mesesDeuda: deudaMap.get(s.id) || 0,
      isMoroso: (deudaMap.get(s.id) || 0) >= MESES_MOROSO,
    }));

    setSocios(enriched);
    setLoadingLocal(false);
  };

  const fetchCuotasDeSocio = async (socio: any) => {
    setLoadingCuotas(true);
    setCuotasModal(socio);
    setCuotas([]);

    const { data } = await supabase
      .from('cuotas')
      .select('*')
      .eq('socio_id', socio.id)
      .order('mes', { ascending: false });

    setCuotas(data || []);
    setLoadingCuotas(false);
  };

  const marcarCuotaPagada = async (cuotaId: string) => {
    setSavingCuota(true);
    await supabase.from('cuotas').update({ estado: 'pagada', fecha_pago: new Date().toISOString().split('T')[0] }).eq('id', cuotaId);
    await fetchCuotasDeSocio(cuotasModal);
    await fetchSocios();
    setSavingCuota(false);
  };

  const marcarCuotaPendiente = async (cuotaId: string) => {
    setSavingCuota(true);
    await supabase.from('cuotas').update({ estado: 'pendiente', fecha_pago: null }).eq('id', cuotaId);
    await fetchCuotasDeSocio(cuotasModal);
    await fetchSocios();
    setSavingCuota(false);
  };

  const agregarCuota = async () => {
    if (!nuevaCuotaMes || !nuevaCuotaMonto) return;
    setSavingCuota(true);

    const año = parseInt(nuevaCuotaMes.split('-')[0]);
    const mes = parseInt(nuevaCuotaMes.split('-')[1]);
    const vencimiento = new Date(año, mes - 1, 15).toISOString().split('T')[0];

    const { error } = await supabase.from('cuotas').insert({
      socio_id: cuotasModal.id,
      mes: nuevaCuotaMes,
      monto: parseFloat(nuevaCuotaMonto),
      estado: 'pendiente',
      fecha_vencimiento: vencimiento,
    });

    if (error) {
      alert('Error: ' + error.message);
    } else {
      setNuevaCuotaMes('');
      await fetchCuotasDeSocio(cuotasModal);
      await fetchSocios();
    }
    setSavingCuota(false);
  };

  const eliminarCuota = async (cuotaId: string) => {
    if (!confirm('¿Eliminar esta cuota?')) return;
    setSavingCuota(true);
    await supabase.from('cuotas').delete().eq('id', cuotaId);
    await fetchCuotasDeSocio(cuotasModal);
    await fetchSocios();
    setSavingCuota(false);
  };

  const exportToCSV = () => {
    const headers = ['DNI', 'Apellido', 'Nombre', 'Email', 'Rol', 'Activo', 'Meses Deuda'];
    const csvContent = [
      headers.join(','),
      ...socios.map(s => [
        s.dni,
        `"${s.apellido}"`,
        `"${s.nombre}"`,
        `"${s.email || ''}"`,
        s.rol,
        s.activo ? 'Si' : 'No',
        s.mesesDeuda || 0
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `socios_caec_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSave = async () => {
    if (editingId) {
      const { error } = await supabase.from('socios').update(formData).eq('id', editingId);
      if (error) alert(error.message);
    } else {
      const { error } = await supabase.from('socios').insert(formData);
      if (error) alert(error.message);
    }
    setIsModalOpen(false);
    fetchSocios();
  };

  const openEdit = (socio: any) => {
    setFormData({ dni: socio.dni, nombre: socio.nombre, apellido: socio.apellido, email: socio.email || '', rol: socio.rol, activo: socio.activo });
    setEditingId(socio.id);
    setIsModalOpen(true);
  };

  const toggleActivo = async (id: string, current: boolean) => {
    await supabase.from('socios').update({ activo: !current }).eq('id', id);
    fetchSocios();
  };

  const filteredSocios = socios.filter(s => {
    const matchesSearch = `${s.nombre} ${s.apellido}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.dni.includes(searchTerm) ||
      (s.email && s.email.toLowerCase().includes(searchTerm.toLowerCase()));

    if (filterStatus === 'activos') return matchesSearch && s.activo;
    if (filterStatus === 'inactivos') return matchesSearch && !s.activo;
    if (filterStatus === 'morosos') return matchesSearch && s.isMoroso;
    return matchesSearch;
  });

  const estadoCuotaStyle = (estado: string) => {
    if (estado === 'pagada') return 'bg-available/20 text-available';
    if (estado === 'vencida') return 'bg-blocked/20 text-blocked';
    return 'bg-yellow-500/20 text-yellow-400';
  };

  const mesToLabel = (mes: string) => {
    const [y, m] = mes.split('-');
    const date = new Date(parseInt(y), parseInt(m) - 1, 1);
    return format(date, 'MMMM yyyy', { locale: es }).replace(/^\w/, c => c.toUpperCase());
  };

  const morososCount = socios.filter(s => s.isMoroso).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold uppercase tracking-wide text-textSec">Gestión de Socios</h2>
          {morososCount > 0 && (
            <p className="text-xs text-blocked font-semibold mt-0.5">⚠️ {morososCount} socio{morososCount !== 1 ? 's' : ''} con morosidad activa</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" className="text-xs px-3 py-2" onClick={exportToCSV}>
            📥 CSV
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex gap-2">
          <Input
            placeholder="Buscar por nombre, apellido o DNI..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="flex-1"
          />
          <select
            className="bg-[#0d0d0d] border border-border rounded-md px-3 text-sm text-textPri outline-none focus:border-primary shrink-0"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as any)}
          >
            <option value="todos">Todos</option>
            <option value="activos">Activos</option>
            <option value="inactivos">Inactivos</option>
            <option value="morosos">Morosos</option>
          </select>
        </div>

        <div className="flex flex-col gap-2">
          {loadingLocal ? (
            <p className="text-center py-4">Cargando...</p>
          ) : filteredSocios.length === 0 ? (
            <p className="text-center py-4 text-textSec">No se encontraron socios.</p>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden bg-surface">
              {filteredSocios.map((socio, idx) => (
                <div
                  key={socio.id}
                  className={`flex flex-row items-center justify-between p-3 gap-3 ${idx !== 0 ? 'border-t border-border' : ''} hover:bg-white/5 transition-colors ${socio.isMoroso ? 'bg-blocked/5' : ''}`}
                >
                  <div className="flex flex-row items-center gap-3 flex-1 min-w-0">
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold text-sm truncate leading-tight ${socio.isMoroso ? 'text-blocked' : 'text-primary'}`}>
                        {socio.apellido}, {socio.nombre}
                        <span className="ml-2 lowercase font-normal opacity-80 text-textSec">({socio.email || 'sin correo'})</span>
                      </p>
                      <p className="text-[10px] text-textSec truncate">
                        DNI: {socio.dni} • {socio.rol.toUpperCase()}
                        {socio.isMoroso && <span className="text-blocked font-bold ml-2">• MOROSO ({socio.mesesDeuda} meses)</span>}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {socio.mesesDeuda > 0 && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${socio.isMoroso ? 'bg-blocked/20 text-blocked' : 'bg-yellow-500/20 text-yellow-400'}`}>
                        {socio.mesesDeuda}m
                      </span>
                    )}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${socio.activo ? 'bg-available/20 text-available' : 'bg-blocked/20 text-blocked'}`}>
                      {socio.activo ? 'Act' : 'Inac'}
                    </span>
                    <div className="flex gap-0.5">
                      {/* Botón Cuotas */}
                      <button
                        onClick={() => fetchCuotasDeSocio(socio)}
                        className="p-2 text-textSec hover:text-yellow-400 transition-colors"
                        title="Gestionar Cuotas"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                      {/* Botón Editar */}
                      <button
                        onClick={() => openEdit(socio)}
                        className="p-2 text-textSec hover:text-primary transition-colors"
                        title="Editar"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      {/* Botón Activar/Desactivar */}
                      <button
                        onClick={() => toggleActivo(socio.id, socio.activo)}
                        className={`p-2 transition-colors ${socio.activo ? 'text-textSec hover:text-blocked' : 'text-textSec hover:text-available'}`}
                        title={socio.activo ? 'Desactivar' : 'Activar'}
                      >
                        {socio.activo ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal Editar Socio */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#0d0d0d]/80 z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">{editingId ? 'Editar Socio' : 'Nuevo Socio'}</h3>

            <div className="flex flex-col gap-4 mb-6">
              <Input label="DNI" value={formData.dni} onChange={e => setFormData({...formData, dni: e.target.value})} disabled={!!editingId} />
              <Input label="Nombre" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} />
              <Input label="Apellido" value={formData.apellido} onChange={e => setFormData({...formData, apellido: e.target.value})} />
              <Input label="Email" value={formData.email} placeholder="ejemplo@google.com" onChange={e => setFormData({...formData, email: e.target.value})} />

              <div className="flex flex-col gap-1">
                <label className="text-sm text-textSec font-semibold uppercase">Rol</label>
                <select
                  className="bg-[#0d0d0d] border border-border rounded-md p-3 text-textPri outline-none focus:border-primary"
                  value={formData.rol}
                  onChange={e => setFormData({...formData, rol: e.target.value as 'socio' | 'admin'})}
                >
                  <option value="socio">Socio</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="secondary" fullWidth onClick={() => setIsModalOpen(false)}>Cancelar</Button>
              <Button variant="primary" fullWidth onClick={handleSave}>Guardar</Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Gestión de Cuotas */}
      {cuotasModal && (
        <div className="fixed inset-0 bg-[#0d0d0d]/80 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-md my-auto">
            {/* Header */}
            <div className="flex items-start justify-between mb-1">
              <div>
                <h3 className="text-lg font-bold text-primary">Cuotas</h3>
                <p className="text-sm text-textSec">{cuotasModal.apellido}, {cuotasModal.nombre}</p>
              </div>
              {cuotasModal.isMoroso && (
                <span className="text-xs px-2 py-1 rounded-full font-bold uppercase bg-blocked/20 text-blocked border border-blocked/30">
                  ⚠️ Moroso
                </span>
              )}
            </div>

            {/* Resumen deuda */}
            {cuotasModal.mesesDeuda > 0 && (
              <div className="bg-blocked/10 border border-blocked/20 rounded-lg p-3 mb-4 mt-3">
                <p className="text-sm text-blocked font-semibold">
                  {cuotasModal.mesesDeuda} cuota{cuotasModal.mesesDeuda !== 1 ? 's' : ''} impaga{cuotasModal.mesesDeuda !== 1 ? 's' : ''}
                  {cuotasModal.mesesDeuda >= MESES_MOROSO && ' — Bloqueado para reservar'}
                </p>
              </div>
            )}

            {/* Agregar cuota */}
            <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-4 mb-4">
              <p className="text-xs font-bold text-textSec uppercase mb-3">Agregar cuota</p>
              <div className="flex gap-2 items-end">
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-xs text-textSec">Mes</label>
                  <input
                    type="month"
                    className="bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-textPri outline-none focus:border-primary"
                    value={nuevaCuotaMes}
                    onChange={e => setNuevaCuotaMes(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1 w-28">
                  <label className="text-xs text-textSec">Monto ($)</label>
                  <input
                    type="number"
                    className="bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-textPri outline-none focus:border-primary"
                    value={nuevaCuotaMonto}
                    onChange={e => setNuevaCuotaMonto(e.target.value)}
                  />
                </div>
                <Button variant="primary" onClick={agregarCuota} disabled={savingCuota || !nuevaCuotaMes}>
                  +
                </Button>
              </div>
            </div>

            {/* Listado de cuotas */}
            <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
              {loadingCuotas ? (
                <p className="text-center text-textSec py-4 text-sm">Cargando...</p>
              ) : cuotas.length === 0 ? (
                <p className="text-center text-textSec py-4 text-sm italic">No hay cuotas registradas</p>
              ) : (
                cuotas.map(cuota => (
                  <div key={cuota.id} className="flex items-center justify-between bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3 py-2.5">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-textPri">{mesToLabel(cuota.mes)}</span>
                      <span className="text-[11px] text-textSec">
                        ${parseFloat(cuota.monto).toLocaleString('es-AR')}
                        {cuota.fecha_pago && ` • Pagado: ${cuota.fecha_pago}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${estadoCuotaStyle(cuota.estado)}`}>
                        {cuota.estado}
                      </span>
                      {cuota.estado !== 'pagada' ? (
                        <button
                          onClick={() => marcarCuotaPagada(cuota.id)}
                          disabled={savingCuota}
                          className="p-1.5 rounded-lg bg-available/10 text-available hover:bg-available/20 transition-colors disabled:opacity-50"
                          title="Marcar como pagada"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                        </button>
                      ) : (
                        <button
                          onClick={() => marcarCuotaPendiente(cuota.id)}
                          disabled={savingCuota}
                          className="p-1.5 rounded-lg bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition-colors disabled:opacity-50"
                          title="Marcar como pendiente"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </button>
                      )}
                      <button
                        onClick={() => eliminarCuota(cuota.id)}
                        disabled={savingCuota}
                        className="p-1.5 rounded-lg text-textSec hover:text-blocked hover:bg-blocked/10 transition-colors disabled:opacity-50"
                        title="Eliminar cuota"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-5">
              <Button variant="secondary" fullWidth onClick={() => { setCuotasModal(null); setCuotas([]); }}>
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

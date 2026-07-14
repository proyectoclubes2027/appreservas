import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export default function SociosAdmin() {
  const [socios, setSocios] = useState<any[]>([]);
  const [loadingLocal, setLoadingLocal] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'todos' | 'activos' | 'inactivos'>('todos');

  const exportToCSV = () => {
    const headers = ['DNI', 'Apellido', 'Nombre', 'Email', 'Rol', 'Activo'];
    const csvContent = [
      headers.join(','),
      ...socios.map(s => [
        s.dni,
        `"${s.apellido}"`,
        `"${s.nombre}"`,
        `"${s.email || ''}"`,
        s.rol,
        s.activo ? 'Si' : 'No'
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

  // Form states
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

  useEffect(() => {
    fetchSocios();
  }, []);

  const fetchSocios = async () => {
    setLoadingLocal(true);
    const { data, error } = await supabase.from('socios').select('*').order('apellido', { ascending: true });
    if (!error && data) setSocios(data);
    setLoadingLocal(false);
  };

  const handleSave = async () => {
    const dataToSave = { ...formData, estado: formData.activo ? 'activo' : 'inactivo' };
    if (editingId) {
      const { error } = await supabase.from('socios').update(dataToSave).eq('id', editingId);
      if (error) alert(error.message);
    } else {
      const { error } = await supabase.from('socios').insert(dataToSave);
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
    await supabase.from('socios').update({ activo: !current, estado: !current ? 'activo' : 'inactivo' }).eq('id', id);
    fetchSocios();
  };

  const filteredSocios = socios.filter(s => {
    const matchesSearch = `${s.nombre} ${s.apellido}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.dni.includes(searchTerm) ||
      (s.email && s.email.toLowerCase().includes(searchTerm.toLowerCase()));
      
    if (filterStatus === 'activos') return matchesSearch && s.activo;
    if (filterStatus === 'inactivos') return matchesSearch && !s.activo;
    return matchesSearch;
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold uppercase tracking-wide text-textSec">Gestión de Socios</h2>
        <div className="flex gap-2">
          <Button variant="secondary" className="text-xs px-3 py-2" onClick={exportToCSV}>
            📥 Exportar CSV
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
            onChange={e => setFilterStatus(e.target.value as 'todos' | 'activos' | 'inactivos')}
          >
            <option value="todos">Mostrar: Todos</option>
            <option value="activos">Mostrar: Activos</option>
            <option value="inactivos">Mostrar: Inactivos</option>
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
                  className={`flex flex-row items-center justify-between p-3 gap-3 ${idx !== 0 ? 'border-t border-border' : ''} hover:bg-white/5 transition-colors`}
                >
                  <div className="flex flex-row items-center gap-3 flex-1 min-w-0">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-primary truncate leading-tight">
                        {socio.apellido}, {socio.nombre} <span className="ml-2 lowercase font-normal opacity-80">({socio.email || 'sin correo'})</span>
                      </p>
                      <p className="text-[10px] text-textSec truncate">
                        DNI: {socio.dni} • {socio.rol.toUpperCase()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${socio.activo ? 'bg-available/20 text-available' : 'bg-blocked/20 text-blocked'}`}>
                      {socio.activo ? 'Act' : 'Inac'}
                    </span>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => openEdit(socio)}
                        className="p-2 text-textSec hover:text-primary transition-colors"
                        title="Editar"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
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
    </div>
  );
}

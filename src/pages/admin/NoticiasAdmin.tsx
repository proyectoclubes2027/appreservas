import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function NoticiasAdmin() {
  const [noticias, setNoticias] = useState<any[]>([]);
  const [titulo, setTitulo] = useState('');
  const [contenido, setContenido] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchNoticias();
  }, []);

  const fetchNoticias = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('noticias')
      .select('*')
      .order('fecha_creacion', { ascending: false });

    if (!error && data) {
      setNoticias(data);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo || !contenido) return;

    setSaving(true);
    const { data, error } = await supabase
      .from('noticias')
      .insert([{ titulo, contenido, activo: true }])
      .select();

    if (error) {
      alert('Error al guardar la noticia: ' + error.message);
    } else {
      // Intentar enviar notificación Push vía OneSignal (Broadcast)
      // Nota: Para hacerlo desde el cliente admin se requiere la REST API Key, 
      // lo cual no es seguro exponer en el frontend. 
      // Lo ideal es una Edge Function, pero por ahora notificamos éxito.
      
      // Enviar a Edge Function si estuviera disponible
      supabase.functions.invoke('notify-news', {
        body: { noticia_id: data[0].id }
      }).catch(err => console.error("Error al disparar notificación push", err));

      setTitulo('');
      setContenido('');
      fetchNoticias();
      alert('Noticia publicada con éxito.');
    }
    setSaving(false);
  };

  const toggleActivo = async (id: string, currentStatus: boolean) => {
    const updates: any = { activo: !currentStatus };
    if (!currentStatus) {
      // Si la volvemos a activar, le ponemos fecha actual para que sea la mas reciente
      updates.fecha_creacion = new Date().toISOString();
    }
    
    const { error } = await supabase
      .from('noticias')
      .update(updates)
      .eq('id', id);

    if (!error) fetchNoticias();
  };

  const eliminarNoticia = async (id: string) => {
    if (!confirm('¿Seguro que deseas eliminar esta noticia?')) return;
    const { error } = await supabase.from('noticias').delete().eq('id', id);
    if (!error) fetchNoticias();
  };

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl font-bold uppercase tracking-wide text-textSec">Comunicados a Socios</h2>

      <form onSubmit={handleSubmit} className="bg-surface border border-border p-6 rounded-xl flex flex-col gap-4">
        <h3 className="text-sm font-bold uppercase text-primary mb-2">Crear Nueva Noticia</h3>
        <div>
          <label className="text-xs font-bold text-textSec uppercase mb-1 block">Título</label>
          <Input 
            placeholder="Ej: Torneo de Dobles Sábado 15" 
            value={titulo} 
            onChange={e => setTitulo(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="text-xs font-bold text-textSec uppercase mb-1 block">Contenido / Mensaje</label>
          <textarea
            className="w-full bg-[#0d0d0d] border border-border rounded-md p-3 text-textPri outline-none focus:border-primary min-h-[120px] resize-none"
            placeholder="Escribe aquí el comunicado que verán los socios..."
            value={contenido}
            onChange={e => setContenido(e.target.value)}
            required
          />
        </div>
        <Button variant="primary" type="submit" disabled={saving}>
          {saving ? 'Publicando...' : 'Publicar y Notificar'}
        </Button>
      </form>

      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-bold uppercase text-textSec px-1">Historial de Noticias</h3>
        {loading ? (
          <p className="text-center py-10 text-textSec">Cargando...</p>
        ) : noticias.length === 0 ? (
          <p className="text-center py-10 text-textSec bg-surface rounded-xl border border-border">No hay noticias publicadas.</p>
        ) : (
          noticias.map(n => (
            <div key={n.id} className={`bg-surface border ${n.activo ? 'border-border' : 'border-dashed border-[#333] opacity-60'} p-4 rounded-xl flex flex-col gap-2`}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className={`font-bold ${n.activo ? 'text-textPri' : 'text-textSec'}`}>{n.titulo}</h4>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded-sm font-bold uppercase tracking-wider ${n.activo ? 'bg-primary/20 text-primary' : 'bg-[#333] text-textSec'}`}>
                      {n.activo ? 'Pública' : 'Oculta'}
                    </span>
                  </div>
                  <p className="text-[10px] text-textSec font-bold uppercase tracking-wider mt-1">
                    {format(new Date(n.fecha_creacion), "d 'de' MMMM, HH:mm'hs'", { locale: es })}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button 
                    onClick={() => toggleActivo(n.id, n.activo)}
                    className="text-[10px] uppercase font-black px-2 py-1 rounded border border-textSec text-textSec hover:border-textPri hover:text-textPri transition-colors"
                  >
                    {n.activo ? 'Desactivar' : 'Activar'}
                  </button>
                  <button 
                    onClick={() => eliminarNoticia(n.id)}
                    className="text-[10px] uppercase font-black px-2 py-1 rounded border border-danger/50 text-danger hover:border-danger hover:bg-danger/10 transition-colors"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
              <p className="text-sm text-textSec mt-1 whitespace-pre-wrap">{n.contenido}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

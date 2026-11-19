import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from './ui/Button';
import { X } from 'lucide-react';

export const NewsPopup = () => {
  const [noticia, setNoticia] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetchLatestNews();
  }, []);

  const fetchLatestNews = async () => {
    const { data, error } = await supabase
      .from('noticias')
      .select('*')
      .eq('activo', true)
      .order('fecha_creacion', { ascending: false })
      .limit(1)
      .single();

    if (!error && data) {
      setNoticia(data);
      setIsOpen(true);
    }
  };

  if (!isOpen || !noticia) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/70 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-surface border border-primary/30 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden relative animate-in fade-in zoom-in duration-300">
        {/* Header con gradiente */}
        <div className="bg-primary p-4 flex justify-between items-center">
          <h3 className="text-[#0d0d0d] font-black uppercase tracking-tighter text-xl">Comunicado Oficial</h3>
          <button 
            onClick={() => setIsOpen(false)}
            className="text-[#0d0d0d]/70 hover:text-[#0d0d0d] transition-colors p-1"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6">
          <h4 className="text-xl font-bold text-textPri mb-3 leading-tight">{noticia.titulo}</h4>
          <div className="max-h-[300px] overflow-y-auto pr-2 scrollbar-thin">
            <p className="text-textSec text-sm whitespace-pre-wrap leading-relaxed">
              {noticia.contenido}
            </p>
          </div>
          
          <div className="mt-8">
            <Button variant="primary" fullWidth onClick={() => setIsOpen(false)}>
              Entendido
            </Button>
          </div>
        </div>

        {/* Decoración sutil */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full -mr-12 -mt-12 blur-2xl pointer-events-none"></div>
      </div>
    </div>
  );
};

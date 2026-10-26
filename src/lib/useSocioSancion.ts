import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';

export interface SancionActiva {
  id: string;
  socio_dni: string;
  turno_id?: string;
  fecha_inicio: string;
  fecha_fin: string;
  motivo: string;
  activa: boolean;
  created_at: string;
}

export function useSocioSancion() {
  const { socio } = useAuth();
  const [sancion, setSancion] = useState<SancionActiva | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSancion = async () => {
    if (!socio?.dni || socio.rol !== 'socio') {
      setSancion(null);
      setLoading(false);
      return;
    }

    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('penalizaciones')
        .select('*')
        .eq('socio_dni', socio.dni)
        .eq('activa', true)
        .gte('fecha_fin', todayStr)
        .order('fecha_fin', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setSancion(data as SancionActiva);
      } else {
        setSancion(null);
      }
    } catch (err) {
      console.warn('Error al verificar sanción del socio:', err);
      setSancion(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSancion();
  }, [socio?.dni]);

  return {
    sancion,
    isSancionado: Boolean(sancion),
    loading,
    refreshSancion: fetchSancion,
  };
}

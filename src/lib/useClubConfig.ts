import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ClubConfig, DEFAULT_CONFIG } from '../lib/config';

export function useClubConfig() {
  const [config, setConfig] = useState<ClubConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('configuracion_club')
        .select('*')
        .eq('id', 'general')
        .maybeSingle();

      if (error) {
        console.warn('Error fetching configuracion_club (usando default):', error.message);
      } else if (data) {
        setConfig(data as ClubConfig);
      }
    } catch (err) {
      console.warn('Excepción al cargar configuración:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const updateConfig = async (newConfig: Partial<ClubConfig>) => {
    try {
      const updated: ClubConfig = { ...config, ...newConfig, id: 'general' };
      const { error } = await supabase
        .from('configuracion_club')
        .upsert({ ...updated, updated_at: new Date().toISOString() });

      if (error) throw error;
      setConfig(updated as ClubConfig);
      return { success: true };
    } catch (err: any) {
      console.error('Error updating config:', err);
      return { success: false, error: err.message };
    }
  };

  return { config, loading, refreshConfig: fetchConfig, updateConfig };
}

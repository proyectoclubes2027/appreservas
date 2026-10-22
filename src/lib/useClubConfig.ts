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
        const localAviso = localStorage.getItem('caec_mostrar_aviso_qr');
        const avisoVal =
          data.mostrar_aviso_qr !== undefined && data.mostrar_aviso_qr !== null
            ? Boolean(data.mostrar_aviso_qr)
            : localAviso !== null
            ? localAviso === 'true'
            : DEFAULT_CONFIG.mostrar_aviso_qr;

        setConfig({
          ...DEFAULT_CONFIG,
          ...data,
          mostrar_aviso_qr: avisoVal,
        });
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
      const payload: any = { ...updated, updated_at: new Date().toISOString() };

      const { error } = await supabase
        .from('configuracion_club')
        .upsert(payload);

      if (error) {
        // Si Supabase aún no tiene la columna mostrar_aviso_qr en la tabla
        const isMissingAvisoCol =
          error.message?.includes('mostrar_aviso_qr') ||
          (error as any).details?.includes('mostrar_aviso_qr');

        if (isMissingAvisoCol) {
          console.warn('Columna mostrar_aviso_qr no encontrada en Supabase. Guardando los demás ajustes...');
          const { mostrar_aviso_qr, ...payloadWithoutAviso } = payload;
          const retry = await supabase
            .from('configuracion_club')
            .upsert(payloadWithoutAviso);

          if (retry.error) throw retry.error;

          if (typeof updated.mostrar_aviso_qr === 'boolean') {
            localStorage.setItem('caec_mostrar_aviso_qr', String(updated.mostrar_aviso_qr));
          }
          setConfig(updated);
          return { success: true };
        }

        throw error;
      }

      if (typeof updated.mostrar_aviso_qr === 'boolean') {
        localStorage.setItem('caec_mostrar_aviso_qr', String(updated.mostrar_aviso_qr));
      }
      setConfig(updated as ClubConfig);
      return { success: true };
    } catch (err: any) {
      console.error('Error updating config:', err);
      return { success: false, error: err.message };
    }
  };

  return { config, loading, refreshConfig: fetchConfig, updateConfig };
}

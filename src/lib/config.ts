export const QR_PREFIX = 'CAEC-CANCHA-';

export interface ClubConfig {
  id: string;
  validacion_qr_activa: boolean;
  dias_anticipacion: number;
  tolerancia_minutos: number;
  penalizacion_dias: number;
  mostrar_aviso_qr: boolean;
  clima_inestable: boolean;
  sanciones_cancelacion_activa?: boolean;
}

export const DEFAULT_CONFIG: ClubConfig = {
  id: 'general',
  validacion_qr_activa: false, // Inicia desactivado hasta que admin decida
  dias_anticipacion: 2,        // Hoy y mañana por defecto
  tolerancia_minutos: 20,      // 20 min antes y 20 min después
  penalizacion_dias: 7,        // 1 semana
  mostrar_aviso_qr: false,     // Desactivado por defecto
  clima_inestable: false,      // Desactivado por defecto
  sanciones_cancelacion_activa: true, // Sanciones por cancelación tardía activas por defecto
};

export const QR_PREFIX = 'CAEC-CANCHA-';

export interface ClubConfig {
  id: string;
  validacion_qr_activa: boolean;
  dias_anticipacion: number;
  tolerancia_minutos: number;
  penalizacion_dias: number;
}

export const DEFAULT_CONFIG: ClubConfig = {
  id: 'general',
  validacion_qr_activa: false, // Inicia desactivado hasta que admin decida
  dias_anticipacion: 2,        // Hoy y mañana por defecto
  tolerancia_minutos: 20,      // 20 min antes y 20 min después
  penalizacion_dias: 14        // 2 semanas
};

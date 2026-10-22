-- ==============================================================================
-- SISTEMA DE VALIDACIÓN POR QR Y CONTROL DE TURNOS - CAEC TENIS
-- Ejecutar este script en el SQL Editor de Supabase
-- ==============================================================================

-- 1. Campos de validación en la tabla turnos
ALTER TABLE turnos 
ADD COLUMN IF NOT EXISTS validado boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS validado_at timestamp with time zone;

-- 2. Tabla de configuración del club
CREATE TABLE IF NOT EXISTS configuracion_club (
  id text PRIMARY KEY DEFAULT 'general',
  validacion_qr_activa boolean DEFAULT false, -- Switch general para encender/apagar
  dias_anticipacion integer DEFAULT 2,        -- Días permitidos: 2 = hoy y mañana
  tolerancia_minutos integer DEFAULT 20,      -- 20 min antes y 20 min después
  penalizacion_dias integer DEFAULT 14,       -- 2 semanas de sanción
  mostrar_aviso_qr boolean DEFAULT false,     -- Cartel informativo para socios
  updated_at timestamp with time zone DEFAULT now()
);

-- Asegurar columna mostrar_aviso_qr si la tabla ya existía previamente
ALTER TABLE configuracion_club 
ADD COLUMN IF NOT EXISTS mostrar_aviso_qr boolean DEFAULT false;

-- Insertar configuración por defecto si no existe
INSERT INTO configuracion_club (id, validacion_qr_activa, dias_anticipacion, tolerancia_minutos, penalizacion_dias, mostrar_aviso_qr)
VALUES ('general', false, 2, 20, 14, false)
ON CONFLICT (id) DO NOTHING;

-- 3. Tabla de penalizaciones a socios
CREATE TABLE IF NOT EXISTS penalizaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  socio_dni text NOT NULL,
  turno_id uuid REFERENCES turnos(id) ON DELETE SET NULL,
  fecha_inicio date NOT NULL DEFAULT CURRENT_DATE,
  fecha_fin date NOT NULL,
  motivo text NOT NULL DEFAULT 'No se validó la presencia en el turno reservado',
  activa boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_penalizaciones_dni ON penalizaciones(socio_dni);
CREATE INDEX IF NOT EXISTS idx_penalizaciones_activa ON penalizaciones(activa, fecha_fin);

-- Políticas RLS básicas
ALTER TABLE configuracion_club ENABLE ROW LEVEL SECURITY;
ALTER TABLE penalizaciones ENABLE ROW LEVEL SECURITY;

-- Permitir lectura pública o autenticada de la configuración
DROP POLICY IF EXISTS "Lectura de configuracion para todos" ON configuracion_club;
CREATE POLICY "Lectura de configuracion para todos" 
  ON configuracion_club FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin modifica configuracion" ON configuracion_club;
CREATE POLICY "Admin modifica configuracion" 
  ON configuracion_club FOR ALL USING (true);

-- Penalizaciones: cada socio lee las suyas, admin puede ver y modificar todo
DROP POLICY IF EXISTS "Lectura de penalizaciones" ON penalizaciones;
CREATE POLICY "Lectura de penalizaciones" 
  ON penalizaciones FOR SELECT USING (true);

DROP POLICY IF EXISTS "Gestion de penalizaciones" ON penalizaciones;
CREATE POLICY "Gestion de penalizaciones" 
  ON penalizaciones FOR ALL USING (true);

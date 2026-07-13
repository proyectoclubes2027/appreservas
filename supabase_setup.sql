-- Script de inicialización de Base de Datos para Reserva de Canchas CAEC
-- Ejecutar esto en el SQL Editor de tu proyecto en Supabase (https://supabase.com)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Tabla: socios
CREATE TABLE IF NOT EXISTS socios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dni TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    apellido TEXT NOT NULL,
    activo BOOLEAN DEFAULT true,
    email TEXT,
    telefono TEXT,
    datos_confirmados BOOLEAN DEFAULT false,
    rol TEXT DEFAULT 'socio' CHECK (rol IN ('socio', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabla: canchas
CREATE TABLE IF NOT EXISTS canchas (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    activa BOOLEAN DEFAULT true
);

-- 3. Tabla: turnos
CREATE TABLE IF NOT EXISTS turnos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cancha_id INTEGER REFERENCES canchas(id) NOT NULL,
    fecha DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    socio_dni TEXT REFERENCES socios(dni),
    acompanante TEXT,
    estado TEXT DEFAULT 'libre' CHECK (estado IN ('libre', 'ocupado', 'bloqueado')),
    motivo_bloqueo TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Asegurar que la combinación cancha_id, fecha, hora_inicio sea única
ALTER TABLE turnos ADD CONSTRAINT turnos_cancha_fecha_hora_key UNIQUE (cancha_id, fecha, hora_inicio);


-- 4. Tabla: cuotas
CREATE TABLE IF NOT EXISTS cuotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    socio_id UUID REFERENCES socios(id) ON DELETE CASCADE,
    mes TEXT NOT NULL,
    monto NUMERIC NOT NULL,
    estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagada', 'vencida')),
    fecha_vencimiento DATE NOT NULL,
    fecha_pago DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Asegurar que no haya dos cuotas para el mismo mes y socio
ALTER TABLE cuotas ADD CONSTRAINT cuotas_socio_mes_key UNIQUE (socio_id, mes);


-- SEED DATA INICIAL
INSERT INTO canchas (id, nombre) VALUES 
(1, 'Cancha 1'), 
(2, 'Cancha 2') 
ON CONFLICT (id) DO NOTHING;

INSERT INTO socios (dni, nombre, apellido, rol) VALUES 
('admin', 'Administrador', 'General', 'admin') 
ON CONFLICT (dni) DO NOTHING;

-- SEGURIDAD (RLS - Row Level Security)
ALTER TABLE socios ENABLE ROW LEVEL SECURITY;
ALTER TABLE canchas ENABLE ROW LEVEL SECURITY;
ALTER TABLE turnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuotas ENABLE ROW LEVEL SECURITY;

-- Funciones helper para RLS
CREATE OR REPLACE FUNCTION public.get_user_dni()
RETURNS TEXT AS $$
  SELECT split_part(auth.jwt()->>'email', '@', 1);
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
      SELECT 1 FROM socios WHERE dni = public.get_user_dni() AND rol = 'admin'
  );
$$ LANGUAGE sql STABLE;

-- Politicas para 'socios'
CREATE POLICY "Admin puede ver y editar todo en socios" ON socios
    FOR ALL USING (public.is_admin());

CREATE POLICY "Usuario logueado puede verse a si mismo y leer otros nombres de socio" ON socios
    FOR SELECT USING (auth.role() = 'authenticated');

-- Politicas para 'canchas'
CREATE POLICY "Canchas visibles para todos los autenticados" ON canchas
    FOR SELECT USING (auth.role() = 'authenticated');
    
CREATE POLICY "Admin puede modificar canchas" ON canchas
    FOR ALL USING (public.is_admin());

-- Politicas para 'turnos'
CREATE POLICY "Turnos visibles para todos los autenticados" ON turnos
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admin puede hacer todo en turnos" ON turnos
    FOR ALL USING (public.is_admin());

-- Los socios pueden insertar/actualizar un turno SOLAMENTE si:
-- 1. El turno estaba 'libre'
-- 2. El socio_dni que setean es su propio DNI o NULL (si lo cancelan)
-- 3. No son admin (pero esto no restringe la logica)
CREATE POLICY "Socio puede reservar (ocupar) y cancelar turnos" ON turnos
    FOR UPDATE USING (
        auth.role() = 'authenticated' AND NOT public.is_admin() AND
        (socio_dni = public.get_user_dni() OR estado = 'libre')
    ) WITH CHECK (
        auth.role() = 'authenticated' AND NOT public.is_admin() AND
        (socio_dni = public.get_user_dni() OR socio_dni IS NULL)
    );

CREATE POLICY "Socio puede insertar turnos si no existian y son libres u ocupados por el" ON turnos
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated' AND NOT public.is_admin() AND
        (socio_dni = public.get_user_dni() OR socio_dni IS NULL)
    );

-- Politicas para 'cuotas'
CREATE POLICY "Admin puede modificar cuotas" ON cuotas
    FOR ALL USING (public.is_admin());

CREATE POLICY "Cuotas visibles para todos los autenticados" ON cuotas
    FOR SELECT USING (auth.role() = 'authenticated');

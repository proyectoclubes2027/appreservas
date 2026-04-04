Tennis Club Bootstrap Kit
Este kit contiene todo lo necesario para replicar el sistema de reservas y notificaciones por WhatsApp en tu nuevo proyecto de las 2 canchas de tenis.

🤖 1. Prompt Maestro para Empezar
Copia y pega este prompt en un nuevo chat de IA para sentar las bases del proyecto:

"Estoy creando una Web App para un Club de Tenis que tiene 2 canchas. Necesito un sistema de reservas mobile-first (PWA) usando React (Vite), Supabase y CSS moderno (Dark Mode Premium).

Requisitos Clave:

Dashboard con selección de Cancha 1 y Cancha 2.
Grilla de horarios de 60 minutos (8:00 hs a 22:00 hs).
Los clientes deben poder reservar ingresando Nombre y Teléfono.
Privacidad: Los nombres de los clientes NO deben ser visibles públicamente (solo 'Ocupado').
Panel de Administración protegido por clave (Ej: 'Admin.2026') para ver nombres y cancelar turnos.
Integración con Supabase Edge Functions para enviar avisos de WhatsApp al club cada vez que alguien reserva.
Usa un diseño elegante con colores 'tenis' (verde lima, blanco y gris oscuro) y bordes redondeados tipo 'Glassmorphism'."

🛠️ 2. Skill de Base de Datos (SQL)
Ejecuta esto en el Editor SQL de Supabase para crear las tablas optimizadas para 2 canchas:

sql
-- Tabla de Canchas
CREATE TABLE canchas (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  descripcion TEXT
);
INSERT INTO canchas (nombre) VALUES ('Cancha 1'), ('Cancha 2');
-- Tabla de Reservas
CREATE TABLE reservas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cancha_id INT REFERENCES canchas(id),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  status TEXT DEFAULT 'booked',
  created_at TIMESTAMPTZ DEFAULT now(),
  -- Evitar solapamientos en la misma cancha
  UNIQUE(cancha_id, starts_at)
);
-- Habilitar RLS
ALTER TABLE reservas ENABLE ROW LEVEL SECURITY;
🚀 3. Skill de WhatsApp (Edge Function)
Usa este código en tu Edge Function create-reservation para enviar el WhatsApp usando CallMeBot:

typescript
// Fragmento clave para la Edge Function de Supabase
async function sendWhatsApp(apiKey: string, phone: string, text: string) {
  const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(text)}&apikey=${apiKey}`;
  await fetch(url);
}
// Dentro del handler de la función:
const msg = `🎾 ¡Nueva Reserva de Tenis!\n\n` +
            `• Cancha: ${data.cancha_name}\n` +
            `• Cliente: ${data.customer_name}\n` +
            `• Horario: ${data.time} hs\n` +
            `• Tel: ${data.phone}`;
await sendWhatsApp(Deno.env.get("CALLMEBOT_KEY"), Deno.env.get("CLUB_PHONE"), msg);
✨ 4. Tips Pro (UI/UX)
Para que el proyecto se vea tan profesional como el de la Peluquería:

Toggle de Canchas: En el App.tsx, usa un estado selectedCourt (1 o 2) para filtrar la grilla de horarios.
PWA Checklist: No olvides crear el manifest.json y el sw.js en la carpeta public para que el club pueda instalar la app en el escritorio o celular.
Selector de Fecha: Usa la técnica de input.showPicker() que aplicamos hoy para que el calendario se abra al tocar cualquier parte del botón de fecha.
IMPORTANT

Recuerda configurar los Secrets en Supabase (CALLMEBOT_KEY, CLUB_PHONE) para que las notificaciones funcionen en producción.

¡Con esto tienes el 90% del camino resuelto! Si necesitas el código CSS completo o la lógica del "ojo" de la contraseña para este nuevo proyecto, solo pídeme. 🎾🔥


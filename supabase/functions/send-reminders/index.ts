import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // 1. Obtener la hora del recordatorio (hora de Argentina + 1 hora)
    // Las funciones de Supabase corren en UTC; convertimos explícitamente a hora argentina.
    const nowUtc = new Date()
    const targetUtc = new Date(nowUtc.getTime() + 60 * 60 * 1000)

    const arDateFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
    const arHourFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Argentina/Buenos_Aires',
      hour: '2-digit',
      hour12: false
    })

    const fechaSQL = arDateFormatter.format(targetUtc)
    const horaSQL = `${arHourFormatter.format(targetUtc)}:00:00`

    console.log(`[Reminder] Buscando turnos para ${fechaSQL} a las ${horaSQL} (Hora Argentina)...`)

    // 2. Buscar turnos que coincidan
    const { data: turnos, error: turnosError } = await supabaseClient
      .from('turnos')
      .select('id, socio_dni, hora_inicio, canchas(nombre)')
      .eq('fecha', fechaSQL)
      .eq('hora_inicio', horaSQL)
      .eq('estado', 'ocupado')

    if (turnosError) throw turnosError

    if (!turnos || turnos.length === 0) {
      return new Response(JSON.stringify({ message: 'No hay turnos en esta franja horaria.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // 3. Credenciales OneSignal
    const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID')
    const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY')

    let enviados = 0

    // 4. Enviar notificaciones personalizadas
    for (const turno of turnos) {
      if (!turno.socio_dni) continue

      const notificationBody = {
        app_id: ONESIGNAL_APP_ID,
        include_aliases: {
          external_id: [String(turno.socio_dni)]
        },
        target_channel: "push",
        headings: { es: '🎾 Recordatorio de Turno', en: '🎾 Recordatorio de Turno' },
        contents: { es: `¡Hola! Tenés tu turno en 1 hora en la ${turno.canchas?.nombre || 'cancha'}. ¡Te esperamos!` },
        url: 'https://caectenis.netlify.app',
        priority: 10,
        android_visibility: 1
      }

      const res = await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Key ${ONESIGNAL_REST_API_KEY}`,
        },
        body: JSON.stringify(notificationBody),
      })

      if (res.ok) enviados++
    }

    return new Response(JSON.stringify({ success: true, turnosEncontrados: turnos.length, notificacionesEnviadas: enviados }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error('[Reminder] Error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Manejo de CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { turno_id } = await req.json()

    if (!turno_id) {
      return new Response(JSON.stringify({ error: 'Falta turno_id' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Inicializar el cliente de Supabase con SERVICE_ROLE_KEY para bypasear RLS
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // 1. Obtener detalles del turno para armar el mensaje
    const { data: turno, error: turnoError } = await supabaseClient
      .from('turnos')
      .select('*, canchas(nombre)')
      .eq('id', turno_id)
      .single()

    if (turnoError || !turno) {
      console.error('[notify-waitlist] Error al obtener turno:', turnoError)
      throw turnoError || new Error('Turno no encontrado')
    }

    // 2. Obtener la lista de usuarios en espera para este turno
    const { data: waitlist, error: waitlistError } = await supabaseClient
      .from('lista_espera')
      .select('socio_dni')
      .eq('turno_id', turno_id)

    console.log(`[notify-waitlist] Lista de espera para turno ${turno_id}:`, waitlist, 'error:', waitlistError)

    if (waitlistError) {
      throw waitlistError
    }

    if (!waitlist || waitlist.length === 0) {
      return new Response(JSON.stringify({ message: 'Nadie en lista de espera.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    const dnis = waitlist.map(w => String(w.socio_dni))
    console.log(`[notify-waitlist] Notificando a DNIs:`, dnis)

    // 3. Enviar notificación Push vía OneSignal a estos DNIs
    const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID')
    const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY')

    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
      throw new Error('Faltan credenciales de OneSignal en las variables de entorno.')
    }

    const cancha = turno.canchas?.nombre ?? 'Cancha'
    const mensaje = `Turno libre: ${cancha} el ${turno.fecha} a las ${turno.hora_inicio.slice(0,5)}hs. ¡Reservá ahora!`

    const notificationBody = {
      app_id: ONESIGNAL_APP_ID,
      include_aliases: { 
        external_id: dnis 
      },
      target_channel: "push",
      headings: { en: '¡Turno Liberado! 🎾', es: '¡Turno Liberado! 🎾' },
      contents: {
        en: mensaje,
        es: mensaje
      },
      url: 'https://caectenis.netlify.app',
      priority: 10,
      android_visibility: 1
    }

    console.log('[notify-waitlist] Payload enviado a OneSignal:', JSON.stringify(notificationBody))

    const onesignalRes = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(notificationBody),
    })

    const onesignalData = await onesignalRes.json()
    console.log('[notify-waitlist] Respuesta de OneSignal:', JSON.stringify(onesignalData))

    if (!onesignalRes.ok) {
      throw new Error(`OneSignal error ${onesignalRes.status}: ${JSON.stringify(onesignalData)}`)
    }

    // 4. Limpiar la lista de espera para este turno ya que fueron notificados
    await supabaseClient
      .from('lista_espera')
      .delete()
      .eq('turno_id', turno_id)

    return new Response(JSON.stringify({ success: true, notifiedCount: dnis.length, onesignalData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error('[notify-waitlist] Error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})

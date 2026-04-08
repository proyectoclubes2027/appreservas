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
    const { socio_dni, fecha, hora, motivo } = await req.json()

    if (!socio_dni) {
      return new Response(JSON.stringify({ error: 'Falta socio_dni' }), { status: 400, headers: corsHeaders })
    }

    const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID')
    const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY')

    const notificationBody = {
      app_id: ONESIGNAL_APP_ID,
      include_external_user_ids: [socio_dni],
      headings: { es: '⚠️ Turno Cancelado' },
      contents: { es: `Tu reserva del día ${fecha} a las ${hora}hs ha sido cancelada por el club. Motivo: ${motivo || 'No especificado'}.` },
      url: 'https://caectenis.netlify.app'
    }

    const res = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(notificationBody),
    })

    return new Response(JSON.stringify({ success: res.ok }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})

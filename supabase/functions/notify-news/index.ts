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
    const { noticia_id } = await req.json()

    if (!noticia_id) {
      return new Response(JSON.stringify({ error: 'Falta noticia_id' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // 1. Obtener detalles de la noticia
    const { data: noticia, error: noticiaError } = await supabaseClient
      .from('noticias')
      .select('*')
      .eq('id', noticia_id)
      .single()

    if (noticiaError || !noticia) {
      throw noticiaError || new Error('Noticia no encontrada')
    }

    // 2. Enviar notificación Push vía OneSignal (Broadcast a todos)
    const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID')
    const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY')

    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
      throw new Error('Faltan credenciales de OneSignal en las variables de entorno.')
    }

    const notificationBody = {
      app_id: ONESIGNAL_APP_ID,
      included_segments: ['All'],
      headings: { en: '¡Nuevo Comunicado! 📢', es: '¡Nuevo Comunicado! 📢' },
      contents: {
        en: noticia.titulo,
        es: noticia.titulo
      },
      // Redirigir a la app cuando la abran
      url: 'https://caectenis.netlify.app' // Cambia segun el dominio real
    }

    const onesignalRes = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(notificationBody),
    })

    const onesignalData = await onesignalRes.json()

    if (!onesignalRes.ok) {
      throw new Error(`OneSignal error ${onesignalRes.status}: ${JSON.stringify(onesignalData)}`)
    }

    return new Response(JSON.stringify({ success: true, onesignalData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error('[notify-news] Error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})

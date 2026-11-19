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

    if (noticiaError || !noticia) throw new Error('Noticia no encontrada')

    // 2. Credenciales
    const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID')
    const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY')

    // 3. Enviar Push masivo (Broadcast)
    const notificationBody = {
      app_id: ONESIGNAL_APP_ID,
      included_segments: ['All'],
      headings: { es: '📢 Nuevo Comunicado - CARP', en: '📢 Nuevo Comunicado - CARP' },
      contents: { es: noticia.titulo },
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

    return new Response(JSON.stringify({ success: true }), {
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

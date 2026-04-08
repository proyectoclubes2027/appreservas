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

    // 1. Obtener mes actual (YYYY-MM)
    const ahora = new Date()
    const mesActual = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`

    // 2. Obtener todos los socios activos
    const { data: socios, error: sociosError } = await supabaseClient
      .from('socios')
      .select('id, categoria, apellido, nombre')
      .eq('activo', true)
      .eq('estado', 'activo')

    if (sociosError) throw sociosError

    console.log(`[Cron Mes] Procesando ${socios.length} socios para el mes ${mesActual}`)

    let generadas = 0
    let omitidas = 0

    for (const socio of socios) {
      // 3. Verificar si ya se generó la cuota para este socio/mes (evitar duplicados)
      const { data: existe } = await supabaseClient
        .from('cuotas')
        .select('id')
        .eq('socio_id', socio.id)
        .eq('mes', mesActual)
        .maybeSingle()

      if (existe) {
        omitidas++
        continue
      }

      // 4. Determinar monto según categoría
      // Socios: $8000, Alumnos: $5000, Vitalicios: $0 (u otra regla)
      let monto = 8000
      if (socio.categoria === 'alumno') monto = 5000
      if (socio.categoria === 'vitalicio') monto = 0

      if (monto > 0) {
        const { error: insertError } = await supabaseClient
          .from('cuotas')
          .insert({
            socio_id: socio.id,
            mes: mesActual,
            monto: monto,
            estado: 'pendiente',
            fecha_vencimiento: new Date(ahora.getFullYear(), ahora.getMonth(), 15).toISOString().split('T')[0] // Vence el 15
          })

        if (!insertError) generadas++
      } else {
        omitidas++
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      mes: mesActual, 
      generadas, 
      omitidas 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error('[Cron Mes] Error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Manejo de CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { socio_dni, nombre, monto, cuota_id } = await req.json()

    // NOTA: Estas son credenciales de PRUEBA (Sandbox) para el prototipo.
    // Una vez aprobado, se deben cambiar por las reales del club.
    const MP_ACCESS_TOKEN = "APP_USR-7634424364234567-080413-5685685685685685-12345678" // Placeholder de prueba

    const body = {
      items: [
        {
          title: `Adicional Tenis - CAEC (${nombre})`,
          quantity: 1,
          unit_price: Number(monto),
          currency_id: "ARS",
        }
      ],
      back_urls: {
        success: "https://reservas-caec.vercel.app/pago-exitoso",
        failure: "https://reservas-caec.vercel.app/reservar",
        pending: "https://reservas-caec.vercel.app/reservar",
      },
      auto_return: "approved",
      external_reference: cuota_id || socio_dni,
      notification_url: "https://gaqobqwojhnntdtjndrw.supabase.co/functions/v1/mp-webhook",
    }

    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()

    return new Response(
      JSON.stringify({ init_point: data.init_point }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})

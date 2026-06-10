const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gaqobqwojhnntdtjndrw.supabase.co';
const supabaseAnonKey = 'sb_publishable_m0icTuFvVriIcpX143xPug_9D1AGOgP';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  // Insertar una cuota de prueba sin auth para ver si hay restriccion RLS
  const { data: cuotaTest, error: insertError } = await supabase
    .from('cuotas')
    .insert({ socio_id: 'cf01a1d5-a1f9-4304-8217-ca2d3fedc7e1', mes: '2026-05', monto: 8000, estado: 'pendiente', fecha_vencimiento: '2026-05-15' })
    .select();

  if (insertError) {
    console.error("Insert error (expected if RLS active):", insertError.message, insertError.code);
  } else {
    console.log("Insert OK (no RLS restriction!):", cuotaTest);
    // Limpiar
    if (cuotaTest && cuotaTest[0]) {
      const { error: delErr } = await supabase.from('cuotas').delete().eq('id', cuotaTest[0].id);
      console.log("Cleanup:", delErr ? delErr.message : 'OK');
    }
  }

  // Ver columns de cuotas via un select con error esperado
  const { data, error } = await supabase.from('cuotas').select('*').limit(1);
  if (error) {
    console.error("Read cuotas error:", error.message);
  } else {
    if (data && data.length > 0) {
      console.log("Cuotas columns:", Object.keys(data[0]));
    } else {
      // intento de obtener estructura vía un select con columna falsa
      const { error: colErr } = await supabase.from('cuotas').select('fecha_pago').limit(1);
      if (colErr) {
        console.log("fecha_pago column check error:", colErr.message);
      } else {
        console.log("fecha_pago column EXISTS");
      }
    }
  }
}
run();

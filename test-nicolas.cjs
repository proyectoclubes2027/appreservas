const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gaqobqwojhnntdtjndrw.supabase.co';
const supabaseAnonKey = 'sb_publishable_m0icTuFvVriIcpX143xPug_9D1AGOgP';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data: socios, error: sociosErr } = await supabase.from('socios').select('*').eq('dni', '27862689');
  if (sociosErr) { console.log(sociosErr); return; }
  
  if (socios.length === 0) { console.log("No socio found"); return; }
  const nicolas = socios[0];
  console.log("Socio:", nicolas.id, nicolas.fecha_alta);
  
  const { data: pagos, error: pagosErr } = await supabase.from('pago_cuotas').select('*').eq('socio_id', nicolas.id).order('mesPagado', { ascending: false });
  console.log("Pagos:", pagos);
}
run();

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gaqobqwojhnntdtjndrw.supabase.co';
const supabaseAnonKey = 'sb_publishable_m0icTuFvVriIcpX143xPug_9D1AGOgP';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data, error } = await supabase.from('pago_cuotas').select('*').limit(1);
  if (error) {
    console.error("Error:", error.message);
  } else {
    console.log("pago_cuotas table columns:", data.length ? Object.keys(data[0]) : "table exists but empty");
  }
}
run();

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gaqobqwojhnntdtjndrw.supabase.co';
const supabaseAnonKey = 'sb_publishable_m0icTuFvVriIcpX143xPug_9D1AGOgP';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data, error } = await supabase.from('socios').select('estado');
  if (error) {
    console.error("Error:", error.message);
  } else {
    const estados = new Set(data.map(d => d.estado));
    console.log("Distinct estados in socios:", Array.from(estados));
  }
}
run();

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gaqobqwojhnntdtjndrw.supabase.co';
const supabaseAnonKey = 'sb_publishable_m0icTuFvVriIcpX143xPug_9D1AGOgP';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data: cuotas, error } = await supabase.from('cuotas').select('*').limit(5);
  if (error) {
    console.error("Error fetching cuotas:", error);
  } else {
    console.log("Cuotas structure:", cuotas);
  }
}
run();

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gaqobqwojhnntdtjndrw.supabase.co';
const supabaseAnonKey = 'sb_publishable_m0icTuFvVriIcpX143xPug_9D1AGOgP';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data, error } = await supabase
    .from('socios')
    .select('*')
    .limit(1);
  if (error) {
    console.error("Error fetching socios:", error);
  } else {
    console.log("Fetched socio data structure:", data);
  }
}
run();

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gaqobqwojhnntdtjndrw.supabase.co';
const supabaseAnonKey = 'sb_publishable_m0icTuFvVriIcpX143xPug_9D1AGOgP';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data, error } = await supabase.from('information_schema.tables').select('table_name').eq('table_schema', 'public');
  if (error) {
    // If we can't read information_schema, try to use a postgres function if it exists or just rest query via api
    console.error("Error reading information_schema via api (expected for anon):", error.message);
  } else {
    console.log("Tables:", data);
  }
}
run();

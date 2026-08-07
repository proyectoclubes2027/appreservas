import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gaqobqwojhnntdtjndrw.supabase.co';
const supabaseAnonKey = 'sb_publishable_m0icTuFvVriIcpX143xPug_9D1AGOgP';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSocio() {
  const { data, error } = await supabase
    .from('socios')
    .select('activo, estado, nombre, apellido')
    .eq('dni', '20847021')
    .single();

  console.log("Error:", error);
  console.log("Data:", data);
}

checkSocio();

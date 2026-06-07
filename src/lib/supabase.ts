import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('tu-proyecto')) {
  console.warn(
    'Supabase: URL o clave Anon no configurada o usa los marcadores de posición. Las llamadas a la base de datos fallarán.'
  );
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

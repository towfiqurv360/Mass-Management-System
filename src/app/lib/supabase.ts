import { createClient } from '@supabase/supabase-js';


const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dmkmnrczjalhwbmehinl.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_i_5J4qbhyQIfH7LovqXMww_0cBpzkmX';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
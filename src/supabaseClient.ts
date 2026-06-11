import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Detect if we are using the default placeholder values or empty values
export const isSupabaseConfigured = 
  supabaseUrl.trim() !== '' && 
  !supabaseUrl.includes('your-supabase-project') &&
  supabaseAnonKey.trim() !== '' && 
  !supabaseAnonKey.includes('your-anon-key');

export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder-project.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'placeholder-key-for-client-initialization'
);

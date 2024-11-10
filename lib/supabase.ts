import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL');
if (!supabaseAnonKey) throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY');
if (!supabaseServiceKey) throw new Error('Missing env.SUPABASE_SERVICE_ROLE_KEY');

// Client for public operations
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Admin client for migrations and background jobs
export const supabaseAdmin = createClient<Database>(
  supabaseUrl,
  supabaseServiceKey
); 
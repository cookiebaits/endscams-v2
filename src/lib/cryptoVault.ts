/**
 * Client-side configuration and secrets helper
 */

export function getClientVaultSecrets() {
  const env = (import.meta as any).env || {};
  const envUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL || '';
  const envKey = env.SUPABASE_ANON_KEY || env.SUPABASE_KEY || env.VITE_SUPABASE_ANON_KEY || '';
  let storedUrl = '';
  let storedKey = '';

  if (typeof window !== 'undefined') {
    storedUrl = localStorage.getItem('endscams_supabase_url') || localStorage.getItem('supabase_url') || '';
    storedKey = localStorage.getItem('endscams_supabase_key') || localStorage.getItem('supabase_key') || '';
  }

  const supabaseUrl = envUrl || storedUrl || '';
  const supabaseKey = envKey || storedKey || '';
  const projectRef = supabaseUrl ? supabaseUrl.replace(/^https?:\/\//, '').split('.')[0] : 'demo-project';

  return {
    supabaseUrl,
    supabaseKey,
    projectRef,
    hasConfiguredSupabase: Boolean(supabaseUrl && supabaseKey),
  };
}

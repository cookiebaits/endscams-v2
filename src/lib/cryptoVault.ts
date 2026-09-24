export function getClientVaultSecrets() {
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || '';
  const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '';
  const projectRef = supabaseUrl ? supabaseUrl.replace(/^https?:\/\//, '').split('.')[0] : '';
  return {
    supabaseUrl,
    supabaseAnonKey,
    projectRef,
  };
}

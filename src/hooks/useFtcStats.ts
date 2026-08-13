import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface FtcStats {
  total_loss: string;
  total_loss_short: string;
  total_reports: string;
  total_reports_short: string;
  yoy_increase: string;
  median_loss: string;
  identity_theft_victims: string;
  report_year: number | string;
  last_updated: string | null;
}

const DEFAULTS: FtcStats = {
  total_loss: '$12.5 billion',
  total_loss_short: '$12.5B',
  total_reports: '2.8 million',
  total_reports_short: '2.8M+',
  yoy_increase: '+14%',
  median_loss: '$500',
  identity_theft_victims: '1.1M',
  report_year: '2024',
  last_updated: null,
};

export function useFtcStats() {
  const [stats, setStats] = useState<FtcStats>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('ftc_stats').select('*').maybeSingle();
    if (data) setStats(data as FtcStats);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const update = useCallback(async (updates: Partial<FtcStats>) => {
    const { error } = await supabase
      .from('ftc_stats')
      .update({ ...updates, last_updated: new Date().toISOString() })
      .eq('id', 1);
    if (!error) await fetch();
    return error;
  }, [fetch]);

  return { stats, loading, refetch: fetch, update };
}

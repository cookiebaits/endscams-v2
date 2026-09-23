import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface FtcStats {
  total_loss: string;
  total_loss_short: string;
  total_reports: string;
  total_reports_short: string;
  yoy_increase: string;
  median_loss: string;
  identity_theft_victims: string;
  report_year: string;
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
  report_year: '2026',
  last_updated: null,
};

export function useFtcStats() {
  const [stats, setStats] = useState<FtcStats>(DEFAULTS);

  useEffect(() => {
    supabase
      .from('ftc_stats')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setStats({
            total_loss: data.total_loss ?? DEFAULTS.total_loss,
            total_loss_short: data.total_loss_short ?? DEFAULTS.total_loss_short,
            total_reports: data.total_reports ?? DEFAULTS.total_reports,
            total_reports_short: data.total_reports_short ?? DEFAULTS.total_reports_short,
            yoy_increase: data.yoy_increase ?? DEFAULTS.yoy_increase,
            median_loss: data.median_loss ?? DEFAULTS.median_loss,
            identity_theft_victims: data.identity_theft_victims ?? DEFAULTS.identity_theft_victims,
            report_year: data.report_year ?? DEFAULTS.report_year,
            last_updated: data.last_updated ?? null,
          });
        }
      });
  }, []);

  const update = async (updates: Partial<FtcStats>) => {
    const { error } = await supabase
      .from('ftc_stats')
      .update({ ...updates, last_updated: new Date().toISOString() })
      .eq('id', 1);
    if (!error) {
      setStats((prev) => ({ ...prev, ...updates, last_updated: new Date().toISOString() }));
    }
    return error;
  };

  return { stats, update };
}

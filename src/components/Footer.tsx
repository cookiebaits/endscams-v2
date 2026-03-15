import { useState } from 'react';
import { X, RefreshCw, Save, CheckCircle, AlertCircle } from 'lucide-react';
import { useFtcStats, FtcStats } from '../hooks/useFtcStats';

export default function Footer() {
  const [clicks, setClicks] = useState(0);
  const [lastClick, setLastClick] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const { stats, update } = useFtcStats();

  const handleCopyrightClick = () => {
    const now = Date.now();
    const next = now - lastClick < 800 ? clicks + 1 : 1;
    setClicks(next);
    setLastClick(now);
    if (next >= 3) {
      setClicks(0);
      setModalOpen(true);
    }
  };

  return (
    <>
      <footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <button
            onClick={handleCopyrightClick}
            className="text-xs text-gray-400 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-500 transition-colors select-none cursor-default"
            title=""
          >
            &copy; {new Date().getFullYear()} EndScams.org — Cyberscam Watchdog Network. For educational purposes only.
          </button>
          <p className="text-xs text-gray-400 dark:text-gray-600">
            FTC data: Consumer Sentinel Network &middot; Last updated {stats.last_updated ? new Date(stats.last_updated).toLocaleDateString() : 'N/A'}
          </p>
        </div>
      </footer>

      {modalOpen && (
        <FtcUpdateModal stats={stats} onClose={() => setModalOpen(false)} onSave={update} />
      )}
    </>
  );
}

function FtcUpdateModal({
  stats,
  onClose,
  onSave,
}: {
  stats: FtcStats;
  onClose: () => void;
  onSave: (updates: Partial<FtcStats>) => Promise<unknown>;
}) {
  const [form, setForm] = useState<FtcStats>({ ...stats });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const set = (key: keyof FtcStats, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    setStatus('idle');
    const error = await onSave(form);
    setSaving(false);
    setStatus(error ? 'error' : 'success');
    if (!error) setTimeout(onClose, 1200);
  };

  const fields: { key: keyof FtcStats; label: string; hint: string }[] = [
    { key: 'report_year', label: 'Report Year', hint: 'e.g. 2026' },
    { key: 'total_loss', label: 'Total Consumer Loss (long)', hint: 'e.g. $12.5 billion' },
    { key: 'total_loss_short', label: 'Total Consumer Loss (short)', hint: 'e.g. $12.5B' },
    { key: 'total_reports', label: 'Total Reports Filed (long)', hint: 'e.g. 2.8 million' },
    { key: 'total_reports_short', label: 'Total Reports Filed (short)', hint: 'e.g. 2.8M+' },
    { key: 'yoy_increase', label: 'Year-over-Year Increase', hint: 'e.g. +14%' },
    { key: 'median_loss', label: 'Median Loss per Victim', hint: 'e.g. $500' },
    { key: 'identity_theft_victims', label: 'Identity Theft Victims', hint: 'e.g. 1.1M' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-brand-500" />
            <h2 className="font-bold text-gray-900 dark:text-white">Update FTC Statistics</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Update the FTC data displayed across the site. Changes take effect immediately after saving.
          </p>

          {fields.map(({ key, label, hint }) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                {label}
              </label>
              <input
                type="text"
                value={form[key] ?? ''}
                onChange={e => set(key, e.target.value)}
                placeholder={hint}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition"
              />
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between p-5 border-t border-gray-200 dark:border-gray-800">
          {status === 'success' && (
            <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400 text-sm font-medium">
              <CheckCircle className="w-4 h-4" /> Saved successfully
            </span>
          )}
          {status === 'error' && (
            <span className="flex items-center gap-1.5 text-red-500 text-sm font-medium">
              <AlertCircle className="w-4 h-4" /> Failed to save
            </span>
          )}
          {status === 'idle' && <span />}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition-colors disabled:opacity-60"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

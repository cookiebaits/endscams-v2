import React, { useState } from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';

interface BannerProps {
  variant?: 'warning' | 'info' | 'error';
  id?: string;
  dismissible?: boolean;
  message: React.ReactNode;
}

export default function Banner({ variant = 'info', id, dismissible = true, message }: BannerProps) {
  const [dismissed, setDismissed] = useState(() => {
    if (id && typeof window !== 'undefined') {
      return localStorage.getItem(`banner_dismissed_${id}`) === 'true';
    }
    return false;
  });

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    if (id && typeof window !== 'undefined') {
      localStorage.setItem(`banner_dismissed_${id}`, 'true');
    }
  };

  const bgClasses =
    variant === 'warning'
      ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
      : variant === 'error'
      ? 'bg-red-500/10 border-red-500/30 text-red-200'
      : 'bg-blue-500/10 border-blue-500/30 text-blue-200';

  return (
    <div className={`w-full border-b px-4 py-2.5 text-xs flex items-center justify-between gap-3 ${bgClasses}`}>
      <div className="flex items-center gap-2 max-w-5xl mx-auto">
        {variant === 'warning' ? (
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
        ) : (
          <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />
        )}
        <div className="leading-snug">{message}</div>
      </div>
      {dismissible && (
        <button
          type="button"
          onClick={handleDismiss}
          className="text-slate-400 hover:text-slate-200 p-1 rounded transition cursor-pointer"
          title="Dismiss banner"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

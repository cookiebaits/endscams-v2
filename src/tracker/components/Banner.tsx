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
    <div className={`w-full border-b px-4 py-2.5 sm:py-3 text-xs sm:text-sm md:text-base font-medium transition-colors relative z-30 ${bgClasses}`}>
      <div className="max-w-7xl mx-auto flex items-center justify-center relative min-h-[1.75rem]">
        <div className="flex items-center justify-center gap-2 text-center max-w-5xl px-6 sm:px-8">
          {variant === 'warning' ? (
            <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 shrink-0" />
          ) : (
            <Info className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400 shrink-0" />
          )}
          <div className="leading-snug text-center">{message}</div>
        </div>
        {dismissible && (
          <button
            type="button"
            onClick={handleDismiss}
            className="text-slate-400 hover:text-slate-200 p-1 rounded transition cursor-pointer absolute right-0 top-1/2 -translate-y-1/2"
            title="Dismiss banner"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

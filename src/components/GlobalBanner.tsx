import { useState, useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';

export default function GlobalBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem('global_banner_dismissed');
    if (!dismissed) {
      setIsVisible(true);
    }
  }, []);

  if (!isVisible) return null;

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('global_banner_dismissed', 'true');
  };

  return (
    <div className="bg-red-600 text-white px-4 py-2.5 sm:py-3 text-xs sm:text-sm md:text-base font-medium z-50 relative">
      <div className="max-w-7xl mx-auto flex items-center justify-center relative min-h-[1.75rem]">
        <div className="flex items-center justify-center gap-2 text-center max-w-5xl px-6 sm:px-8">
          <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
          <span className="leading-snug text-center">
            <strong>ALERT:</strong> Active threat bulletin. Multiple reports of scams targeting vulnerable users, see Scam Tracker for more details.
          </span>
        </div>
        <button
          onClick={handleDismiss}
          className="p-1 hover:bg-red-700 rounded-lg transition-colors absolute right-0 top-1/2 -translate-y-1/2"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

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
    <div className="bg-red-600 text-white px-10 py-2 sm:px-4 flex items-center justify-between text-xs sm:text-sm font-medium z-50 relative">
      <div className="flex items-start sm:items-center gap-2 max-w-7xl mx-auto flex-1 justify-center text-center">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 sm:mt-0 hidden sm:block" />
        <span>
          <strong>ALERT:</strong> Active threat bulletin. Multiple reports of new tech support scams targeting vulnerable users.
        </span>
      </div>
      <button
        onClick={handleDismiss}
        className="p-1.5 hover:bg-red-700 rounded-lg transition-colors absolute right-2 top-1/2 -translate-y-1/2"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4 sm:w-5 sm:h-5" />
      </button>
    </div>
  );
}

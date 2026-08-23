import { AlertTriangle, Info, CheckCircle, XCircle, X } from 'lucide-react';
import { useState, useEffect } from 'react';

export type BannerVariant = 'info' | 'warning' | 'error' | 'success';

interface BannerProps {
  variant?: BannerVariant;
  message: React.ReactNode;
  dismissible?: boolean;
  id?: string; // If provided, the dismissed state will be saved to localStorage
  center?: boolean;
}

export default function Banner({ variant = 'info', message, dismissible = false, id, center = false }: BannerProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (id) {
      const dismissed = localStorage.getItem(`banner_dismissed_${id}`);
      if (dismissed === 'true') {
        setIsVisible(false);
      }
    }
  }, [id]);

  if (!isVisible) return null;

  const handleDismiss = () => {
    setIsVisible(false);
    if (id) {
      localStorage.setItem(`banner_dismissed_${id}`, 'true');
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'warning':
        return {
          bg: 'bg-amber-100 dark:bg-amber-900/40',
          border: 'border-amber-200 dark:border-amber-800',
          text: 'text-amber-900 dark:text-amber-100',
          icon: <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />,
          closeHover: 'hover:bg-amber-200 dark:hover:bg-amber-800/60',
        };
      case 'error':
        return {
          bg: 'bg-red-100 dark:bg-red-900/40',
          border: 'border-red-200 dark:border-red-800',
          text: 'text-red-900 dark:text-red-100',
          icon: <XCircle className="w-5 h-5 flex-shrink-0 text-red-600 dark:text-red-400" />,
          closeHover: 'hover:bg-red-200 dark:hover:bg-red-800/60',
        };
      case 'success':
        return {
          bg: 'bg-green-100 dark:bg-green-900/40',
          border: 'border-green-200 dark:border-green-800',
          text: 'text-green-900 dark:text-green-100',
          icon: <CheckCircle className="w-5 h-5 flex-shrink-0 text-green-600 dark:text-green-400" />,
          closeHover: 'hover:bg-green-200 dark:hover:bg-green-800/60',
        };
      case 'info':
      default:
        return {
          bg: 'bg-blue-100 dark:bg-blue-900/40',
          border: 'border-blue-200 dark:border-blue-800',
          text: 'text-blue-900 dark:text-blue-100',
          icon: <Info className="w-5 h-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />,
          closeHover: 'hover:bg-blue-200 dark:hover:bg-blue-800/60',
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <div className={`w-full px-4 py-3 border-b ${styles.bg} ${styles.border} ${styles.text} transition-colors relative z-30`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between relative">
        <div className={`flex items-start sm:items-center gap-3 ${center ? 'mx-auto justify-center w-full' : ''}`}>
          <div className="mt-0.5 sm:mt-0">{styles.icon}</div>
          <div className={`font-medium leading-tight sm:leading-normal pr-6 ${center ? 'text-center' : ''}`}>
            {message}
          </div>
        </div>
        {dismissible && (
          <button
            onClick={handleDismiss}
            className={`p-1.5 rounded-lg transition-colors absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 ${styles.closeHover}`}
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
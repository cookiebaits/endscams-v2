import { useState, useEffect } from 'react';

export type DeviceModePreference = 'auto' | 'mobile' | 'desktop';

export function useDeviceMode() {
  const [preference, setPreference] = useState<DeviceModePreference>('auto');
  const [isMobileScreen, setIsMobileScreen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const isSmallScreen = window.innerWidth < 768;
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
    return isSmallScreen || isMobileUA;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkMobile = () => {
      const isSmallScreen = window.innerWidth < 768;
      const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );
      const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setIsMobileScreen(isSmallScreen || (isMobileUA && isTouch));
    };

    checkMobile();

    window.addEventListener('resize', checkMobile);
    window.addEventListener('orientationchange', checkMobile);

    const mql = window.matchMedia('(max-width: 768px)');
    const handleMql = (e: MediaQueryListEvent) => {
      setIsMobileScreen(e.matches);
    };

    if (mql.addEventListener) {
      mql.addEventListener('change', handleMql);
    }

    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('orientationchange', checkMobile);
      if (mql.removeEventListener) {
        mql.removeEventListener('change', handleMql);
      }
    };
  }, []);

  // Compute effective active view based on auto detection or manual user override
  const isMobile = preference === 'auto' ? isMobileScreen : preference === 'mobile';

  return {
    isMobile,
    isAutoDetected: preference === 'auto',
    preference,
    setPreference,
    detectedIsMobileScreen: isMobileScreen,
  };
}

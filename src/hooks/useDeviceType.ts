import { useState, useEffect } from 'react';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

export interface DeviceInfo {
  isMobile: boolean;
  isMobilePhone: boolean;
  isMobileBrowser: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isTouch: boolean;
  deviceType: DeviceType;
  orientation: 'portrait' | 'landscape';
}

function getDeviceInfo(): DeviceInfo {
  if (typeof window === 'undefined') {
    return {
      isMobile: false,
      isMobilePhone: false,
      isMobileBrowser: false,
      isTablet: false,
      isDesktop: true,
      isTouch: false,
      deviceType: 'desktop',
      orientation: 'landscape',
    };
  }

  const ua = navigator.userAgent || '';
  const width = window.innerWidth;
  const isTouch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;

  const mobileRegex = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i;
  const tabletRegex = /iPad|Android(?!.*Mobile)|Tablet|PlayBook|Silk/i;

  const isMobileUA = mobileRegex.test(ua);
  const isTabletUA = tabletRegex.test(ua);

  const isMobilePhone = (isMobileUA && !isTabletUA) || width <= 640;
  const isTablet = (isTabletUA || (isTouch && width > 640 && width <= 1024)) && !isMobilePhone;
  const isDesktop = width > 1024 && !isMobileUA && !isTabletUA;

  const isMobile = isMobilePhone || isTablet || width <= 768;
  const isMobileBrowser = isMobileUA || isTouch;

  let deviceType: DeviceType = 'desktop';
  if (isMobilePhone || width <= 640) {
    deviceType = 'mobile';
  } else if (isTablet || (width > 640 && width <= 1024)) {
    deviceType = 'tablet';
  }

  const orientation = window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';

  return {
    isMobile,
    isMobilePhone,
    isMobileBrowser,
    isTablet,
    isDesktop,
    isTouch,
    deviceType,
    orientation,
  };
}

export function useDeviceType(): DeviceInfo {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(getDeviceInfo);

  useEffect(() => {
    const handleResize = () => {
      setDeviceInfo(getDeviceInfo());
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    // Initial sync
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  return deviceInfo;
}

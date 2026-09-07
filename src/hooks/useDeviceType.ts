import { useState, useEffect } from 'react';

export type DeviceType = 'mobile-phone' | 'mobile-browser' | 'tablet' | 'desktop';

export interface DeviceInfo {
  deviceType: DeviceType;
  isMobilePhone: boolean;
  isMobileBrowser: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isTouch: boolean;
  isLandscape: boolean;
  screenWidth: number;
  screenHeight: number;
}

function getDeviceInfo(): DeviceInfo {
  if (typeof window === 'undefined') {
    return {
      deviceType: 'desktop',
      isMobilePhone: false,
      isMobileBrowser: false,
      isTablet: false,
      isDesktop: true,
      isTouch: false,
      isLandscape: false,
      screenWidth: 1024,
      screenHeight: 768,
    };
  }

  const ua = navigator.userAgent || '';
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isLandscape = screenWidth > screenHeight;

  const isMobileUA = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isTabletUA = /iPad|Android(?!.*Mobile)|Tablet/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  let deviceType: DeviceType = 'desktop';
  if (isTabletUA || (isTouch && screenWidth >= 640 && screenWidth <= 1024)) {
    deviceType = 'tablet';
  } else if (isMobileUA || screenWidth < 640) {
    deviceType = 'mobile-phone';
  } else if (isTouch && screenWidth < 1024) {
    deviceType = 'mobile-browser';
  } else {
    deviceType = 'desktop';
  }

  const isMobilePhone = deviceType === 'mobile-phone';
  const isTablet = deviceType === 'tablet';
  const isDesktop = deviceType === 'desktop';
  const isMobileBrowser = isMobilePhone || isTablet || (isTouch && screenWidth < 1024);

  return {
    deviceType,
    isMobilePhone,
    isMobileBrowser,
    isTablet,
    isDesktop,
    isTouch,
    isLandscape,
    screenWidth,
    screenHeight,
  };
}

export function useDeviceType(): DeviceInfo {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(() => getDeviceInfo());

  useEffect(() => {
    const handleResize = () => {
      setDeviceInfo(getDeviceInfo());
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  return deviceInfo;
}

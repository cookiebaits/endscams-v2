import { useEffect, useRef, useState } from 'react';
import TrackerApp from '../tracker/src/App';

export default function TrackerPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState('calc(100vh - 80px)');

  useEffect(() => {
    const updateHeight = () => {
      const nav = document.querySelector('nav');
      const navH = nav ? nav.offsetHeight : 80;
      const topOffset = containerRef.current ? containerRef.current.getBoundingClientRect().top : navH;
      const calculatedH = window.innerHeight - (topOffset > 0 ? topOffset : navH);
      setContainerHeight(`${Math.max(calculatedH, 400)}px`);
    };

    updateHeight();
    const timer = setTimeout(updateHeight, 100);
    window.addEventListener('resize', updateHeight);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateHeight);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ height: containerHeight }}
      className="w-full bg-slate-950 text-slate-100 overflow-y-auto scroll-smooth"
    >
      <TrackerApp />
    </div>
  );
}

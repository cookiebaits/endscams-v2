import { useState, useEffect, useRef } from "react";

export default function TrackerPage() {
  const [isLoaded, setIsLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [frameHeight, setFrameHeight] = useState("600px");

  useEffect(() => {
    const updateHeight = () => {
      const nav = document.querySelector('nav');
      const footer = document.querySelector('footer');

      const navH = nav ? nav.offsetHeight : 80;
      const footH = footer ? footer.offsetHeight : 150;
      const windowH = window.innerHeight;
      let topOffset = containerRef.current ? containerRef.current.getBoundingClientRect().top : navH;

      if (topOffset <= 0) topOffset = navH + 40;

      const targetHeight = windowH - topOffset - footH;

      if (targetHeight > 100) {
        setFrameHeight(`${targetHeight + 50}px`);
      } else {
        setFrameHeight("500px");
      }
    };

    // Slight delay to ensure DOM is fully rendered before measuring
    setTimeout(updateHeight, 100);
    window.addEventListener("resize", updateHeight);

    return () => {
      window.removeEventListener("resize", updateHeight);
    };
  }, []);

  return (
    <div ref={containerRef} className="bg-slate-950 flex flex-col w-full">
      <div className="w-full relative overflow-x-auto" style={{ height: frameHeight }}>
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950 z-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
          </div>
        )}
        <iframe
          src="https://esscan.ai.studio"
          className="min-w-[1024px] w-full h-full border-0"
          onLoad={() => setIsLoaded(true)}
          title="End Scam Scan"
          allow="microphone; camera; display-capture; clipboard-read; clipboard-write"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        />
      </div>
    </div>
  );
}

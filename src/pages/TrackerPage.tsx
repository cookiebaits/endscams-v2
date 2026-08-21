import { useState, useEffect, useRef } from "react";

export default function TrackerPage() {
  const [isLoaded, setIsLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [frameHeight, setFrameHeight] = useState("600px");

  useEffect(() => {
    document.body.style.overflow = "hidden";

    const updateHeight = () => {
      // Find the header and footer heights directly
      const nav = document.querySelector('nav');
      const footer = document.querySelector('footer');

      const navH = nav ? nav.offsetHeight : 80;
      const footH = footer ? footer.offsetHeight : 150;
      // We can also just calculate it cleanly:
      const windowH = window.innerHeight;
      let topOffset = containerRef.current ? containerRef.current.getBoundingClientRect().top : navH;

      // If topOffset is weirdly small/large, fallback to a safe calculation
      if (topOffset <= 0) topOffset = navH + 40; // approx

      // The height we want is the remaining window height MINUS the footer height
      const targetHeight = windowH - topOffset - footH;

      if (targetHeight > 100) {
        setFrameHeight(`${targetHeight}px`);
      } else {
        // Fallback for extremely small screens
        setFrameHeight("400px");
      }
    };

    // Slight delay to ensure DOM is fully rendered before measuring
    setTimeout(updateHeight, 100);
    window.addEventListener("resize", updateHeight);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("resize", updateHeight);
    };
  }, []);

  return (
    <div ref={containerRef} className="bg-slate-950 flex flex-col overflow-hidden w-full">
      <div className="w-full relative overflow-x-auto overflow-y-hidden" style={{ height: frameHeight }}>
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

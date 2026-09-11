import { useState, useEffect } from 'react';
import { Shield, ArrowRight, X } from 'lucide-react';
import TermsModal from './TermsModal';

export const DISCLAIMER_ACCEPTED_KEY = 'disclaimer_accepted';

export function isDisclaimerAccepted(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(DISCLAIMER_ACCEPTED_KEY) === 'true';
}

export function acceptDisclaimer(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DISCLAIMER_ACCEPTED_KEY, 'true');
  localStorage.setItem('disclaimer_accepted_date', new Date().toISOString());
  window.dispatchEvent(new Event('disclaimer_status_changed'));
}

export function requireDisclaimerAcceptance(): boolean {
  if (isDisclaimerAccepted()) {
    return true;
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('open_terms_modal'));
  }
  return false;
}

export default function TermsBanner() {
  const [isAccepted, setIsAccepted] = useState<boolean>(true);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  useEffect(() => {
    const checkStatus = () => {
      setIsAccepted(isDisclaimerAccepted());
    };

    const handleOpenModal = () => {
      setIsModalOpen(true);
    };

    checkStatus();

    window.addEventListener('disclaimer_status_changed', checkStatus);
    window.addEventListener('storage', checkStatus);
    window.addEventListener('open_terms_modal', handleOpenModal);

    return () => {
      window.removeEventListener('disclaimer_status_changed', checkStatus);
      window.removeEventListener('storage', checkStatus);
      window.removeEventListener('open_terms_modal', handleOpenModal);
    };
  }, []);

  const handleAccept = () => {
    acceptDisclaimer();
    setIsAccepted(true);
    setIsModalOpen(false);
  };

  return (
    <>
      {!isAccepted && !isDismissed && (
        <div
          id="discrete-terms-banner"
          className="fixed bottom-4 left-4 right-4 z-50 max-w-5xl mx-auto bg-[#0b1329]/95 dark:bg-[#070d1e]/95 backdrop-blur-md border border-slate-800/80 rounded-2xl shadow-2xl p-4 sm:p-5 text-white transition-all duration-300 animate-in slide-in-from-bottom-5"
        >
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">

            {/* Left section: Shield & Text */}
            <div className="flex items-start gap-3.5 flex-1">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5 lg:mt-0">
                <Shield className="w-5 h-5 text-emerald-400" />
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-semibold text-white tracking-tight">
                  Privacy &amp; Persistence
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
                  We use essential local storage to securely manage your authentication session, user plan data, and meeting preferences.{' '}
                  <span className="text-emerald-400 font-medium">
                    We do not use third-party tracking, marketing cookies, or pixel tags.
                  </span>
                </p>
              </div>
            </div>

            {/* Right section: Links & Accept Action */}
            <div className="flex items-center justify-between lg:justify-end gap-4 w-full lg:w-auto pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800/60">

              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="text-xs font-semibold tracking-wider text-slate-300 hover:text-white transition-colors uppercase whitespace-nowrap"
              >
                PRIVACY POLICY &amp; TERMS
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleAccept}
                  className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-medium px-5 py-2 rounded-full text-sm flex items-center gap-1.5 shadow-md shadow-emerald-950/40 transition-all duration-150 transform active:scale-95 whitespace-nowrap"
                >
                  <span>Accept</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsDismissed(true)}
                  className="text-slate-400 hover:text-slate-200 transition-colors p-1.5 rounded-lg hover:bg-slate-800/50"
                  aria-label="Dismiss banner"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

      <TermsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAccept={handleAccept}
      />
    </>
  );
}

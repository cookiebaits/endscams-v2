/* eslint-disable no-irregular-whitespace */

import { useNavigate } from "react-router";
import { Shield, AlertTriangle } from "lucide-react";
import Banner from '../components/Banner';
import { TERMS_AND_PRIVACY_TEXT } from '../data/termsAndPrivacy';
import { acceptDisclaimer } from '../components/TermsBanner';

export default function DisclaimerPage() {
  const navigate = useNavigate();

  const handleAccept = () => {
    acceptDisclaimer();
    navigate("/home");
  };

  const handleDeny = () => {
    window.location.href = "https://search.brave.com";
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
      <Banner
        variant="warning"
        message={<span><strong>Action Required:</strong> Please read and accept our Terms of Service and Privacy Policy to access EndScams.org.</span>}
      />
      <div className="max-w-4xl mx-auto px-4 pt-8 pb-12">
        <div className="card p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-brand-500/10 rounded-full flex items-center justify-center">
              <Shield className="w-8 h-8 text-brand-500" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                Disclaimer: Terms and Conditions &amp; Privacy Policy
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mt-1">
                Please read carefully before proceeding
              </p>
            </div>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                By clicking "I Accept" below, you acknowledge that you have read, understood, and agree to be bound by all terms and conditions &amp; privacy policy outlined in this disclaimer.
              </p>
            </div>
          </div>

          <div className="prose dark:prose-invert max-w-none space-y-6 text-sm mb-8 max-h-[500px] overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-lg p-6 bg-white dark:bg-gray-900">
            <div style={{ whiteSpace: "pre-wrap" }}>{TERMS_AND_PRIVACY_TEXT}</div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleDeny}
              className="flex-1 px-6 py-3 border-2 border-slate-300 dark:border-slate-700 rounded-xl font-semibold text-slate-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              I Do Not Accept
            </button>
            <button
              onClick={handleAccept}
              className="flex-1 btn-primary px-6 py-3 rounded-xl font-semibold"
            >
              I Accept
            </button>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-500 text-center mt-4">
            By clicking "I Accept", you will be redirected to the main site. Clicking "I Do Not Accept" will redirect you to Brave Search.
          </p>
        </div>
      </div>
    </div>
  );
}

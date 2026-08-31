import { Shield, Landmark, PhoneCall, HeartHandshake, AlertCircle } from 'lucide-react';
import Banner from '../components/Banner';

export default function ShutdownPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-200 pb-16 text-slate-700 dark:text-slate-300">
      <Banner
        variant="info"
        id="shutdown_reminder_banner"
        dismissible
        message={
          <span>
            <strong>Important Notice:</strong> Cyberscam Watchdog Network focuses on scam investigation and victim resource direction. For refunds, legal case updates, or crisis support, please refer to the guidance below.
          </span>
        }
      />

      <div className="max-w-4xl mx-auto px-4 pt-8">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-500/10 mb-5">
            <Shield className="w-8 h-8 text-brand-500" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white mb-4">
            Scam Investigation &amp; Resource Guidance
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Our organization strictly focuses on investigating scams, providing educational tools, and directing victims to official support channels.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Bank & Refunds */}
          <div className="card p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Landmark className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Financial Refunds &amp; Recovery</h2>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                For financial disputes, chargebacks, or refund requests, please work directly with your bank, credit card issuer, or financial institution. Our organization does not process refunds or financial recovery.
              </p>
            </div>
          </div>

          {/* Law Enforcement */}
          <div className="card p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <PhoneCall className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Criminal Case Updates</h2>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                For status updates on open criminal investigations or police reports, please contact the specific law enforcement agency where you originally filed your report.
              </p>
            </div>
          </div>
        </div>

        {/* Mental Health & 988 Helpline */}
        <div className="card p-6 md:p-8 bg-red-500/10 border border-red-500/20 text-slate-900 dark:text-white mb-8 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-red-500/20 text-red-600 dark:text-red-400 shrink-0">
              <HeartHandshake className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-red-700 dark:text-red-300 mb-2 flex items-center gap-2">
                Mental Health &amp; Crisis Support
              </h2>
              <p className="text-sm md:text-base text-slate-700 dark:text-slate-200 leading-relaxed mb-4">
                We understand that dealing with scams can be emotionally overwhelming. While our team does not provide mental health services or therapy, immediate help is available.
              </p>
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-red-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">Suicide &amp; Crisis Lifeline</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Free, confidential, 24/7 support available nationwide.</p>
                </div>
                <a
                  href="tel:988"
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-sm transition-colors shrink-0 flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4" />
                  Call or Text 988
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

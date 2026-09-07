import React, { useState } from 'react';
import { Heart, ShieldCheck, CheckCircle2, Lock, ExternalLink, CreditCard, Sparkles } from 'lucide-react';
import Banner from '../components/Banner';

const PRESET_AMOUNTS = [10, 25, 50, 100, 250, 500];

export default function DonatePage() {
  const [selectedAmount, setSelectedAmount] = useState<number | 'custom'>(50);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [frequency, setFrequency] = useState<'one-time' | 'monthly'>('one-time');
  const [paymentMethod, setPaymentMethod] = useState<'paypal' | 'card'>('paypal');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  const getFinalAmount = (): number => {
    if (selectedAmount === 'custom') {
      const parsed = parseFloat(customAmount);
      return isNaN(parsed) || parsed <= 0 ? 0 : parsed;
    }
    return selectedAmount;
  };

  const handleDonate = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = getFinalAmount();
    if (amt <= 0) return;

    setIsSubmitting(true);
    // Simulate brief processing / redirect preparation
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-200 pb-20 text-slate-800 dark:text-slate-200">
      <Banner
        variant="info"
        id="donate_banner"
        dismissible
        message={
          <span>
            <strong>Cyberscam Watchdog Network:</strong> CWN is a 501(1)(c) Non-Profit Organization dedicated to fighting cyber fraud and educating communities.
          </span>
        }
      />

      <div className="max-w-4xl mx-auto px-4 pt-10">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white mb-4 flex items-center justify-center gap-3">
            <Heart className="w-10 h-10 text-red-500 fill-red-500 flex-shrink-0 animate-pulse" />
            <span>Support Our Non-Profit Mission</span>
          </h1>
          <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto text-base md:text-lg leading-relaxed">
            Your tax-deductible contribution directly funds our 24/7 scam tracking intelligence, community workshops, and free victim assistance resources.
          </p>
        </div>

        <div className="grid md:grid-cols-12 gap-8">
          {/* Main Donation Card */}
          <div className="md:col-span-7 bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xl">
            {isSuccess ? (
              <div className="text-center py-8 animate-fade-in">
                <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Thank You for Your Support!</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                  Your generous donation of <strong className="text-brand-500">${getFinalAmount().toFixed(2)}</strong> helps keep our scam prevention infrastructure operating 24/7.
                </p>
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60 text-xs text-slate-500 dark:text-slate-400 mb-6">
                  A receipt has been issued. Cyberscam Watchdog Network is a 501(1)(c) Non-Profit Organization. Tax ID EIN: XX-XXXXXXX.
                </div>
                <button
                  onClick={() => setIsSuccess(false)}
                  className="btn-primary py-3 px-6 text-sm"
                >
                  Make Another Donation
                </button>
              </div>
            ) : (
              <form onSubmit={handleDonate} className="space-y-6">
                {/* Frequency Toggle */}
                <div className="grid grid-cols-2 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setFrequency('one-time')}
                    className={`py-2.5 text-sm font-bold rounded-xl transition-all ${
                      frequency === 'one-time'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-md'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Give One-Time
                  </button>
                  <button
                    type="button"
                    onClick={() => setFrequency('monthly')}
                    className={`py-2.5 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                      frequency === 'monthly'
                        ? 'bg-brand-600 text-white shadow-md'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    Give Monthly
                  </button>
                </div>

                {/* Amount Selection Grid */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                    Select Contribution Amount ($ USD)
                  </label>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    {PRESET_AMOUNTS.map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => {
                          setSelectedAmount(amt);
                          setCustomAmount('');
                        }}
                        className={`py-3 px-2 rounded-2xl font-black text-lg transition-all border ${
                          selectedAmount === amt
                            ? 'border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-400 ring-2 ring-brand-500/30'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 hover:border-brand-500/50'
                        }`}
                      >
                        ${amt}
                      </button>
                    ))}
                  </div>

                  {/* Custom Amount Field */}
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                    <input
                      type="number"
                      placeholder="Custom Amount"
                      min="1"
                      step="any"
                      value={customAmount}
                      onChange={(e) => {
                        setSelectedAmount('custom');
                        setCustomAmount(e.target.value);
                      }}
                      className={`input-field pl-8 font-bold ${
                        selectedAmount === 'custom' ? 'border-brand-500 ring-2 ring-brand-500/30' : ''
                      }`}
                    />
                  </div>
                </div>

                {/* Payment Option Selection */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                    Payment Method
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('paypal')}
                      className={`p-4 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all ${
                        paymentMethod === 'paypal'
                          ? 'border-amber-500 bg-amber-500/10 text-amber-500 ring-2 ring-amber-500/30'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span className="font-extrabold text-base italic tracking-tight text-blue-600 dark:text-blue-400">
                        Pay<span className="text-cyan-500">Pal</span>
                      </span>
                      <span className="text-xs font-medium">PayPal / Venmo</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('card')}
                      className={`p-4 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all ${
                        paymentMethod === 'card'
                          ? 'border-brand-500 bg-brand-500/10 text-brand-500 ring-2 ring-brand-500/30'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <CreditCard className="w-6 h-6 text-brand-500" />
                      <span className="text-xs font-medium">Debit or Credit Card</span>
                    </button>
                  </div>
                </div>

                {/* Submit Action Button */}
                <button
                  type="submit"
                  disabled={isSubmitting || getFinalAmount() <= 0}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-black text-lg transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 min-h-[56px]"
                >
                  {isSubmitting ? (
                    <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Lock className="w-5 h-5" />
                      <span>
                        Complete ${getFinalAmount().toFixed(2)} {frequency === 'monthly' ? 'Monthly' : ''} Donation
                      </span>
                    </>
                  )}
                </button>

                <div className="flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <Lock className="w-3.5 h-3.5 text-green-500" />
                  <span>256-bit Encrypted Secure SSL Checkout</span>
                </div>
              </form>
            )}
          </div>

          {/* Info Side Panel */}
          <div className="md:col-span-5 space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-2xl bg-brand-500/10 text-brand-500">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-base">501(1)(c) Non-Profit</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Official Organization Status</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                Cyberscam Watchdog Network is designated as a 501(1)(c) Non-Profit Organization. All contributions are tax-deductible to the fullest extent permitted by law.
              </p>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
                <div className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>0% goes to private shareholders. 100% directly funds scam defense.</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>Free access to scam reports for law enforcement and senior citizens.</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>Full financial transparency and annual public reporting.</span>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-brand-900/30 to-purple-900/30 rounded-3xl p-6 border border-brand-500/20 text-white">
              <h4 className="font-extrabold text-sm mb-2 text-brand-400">Prefer Mail or Wire Support?</h4>
              <p className="text-xs text-slate-300 leading-relaxed mb-3">
                For corporate sponsorships, grant partnerships, or check donations, please reach out directly to our finance team.
              </p>
              <a
                href="mailto:donate@endscams.org"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-white hover:underline"
              >
                <span>Contact donate@endscams.org</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

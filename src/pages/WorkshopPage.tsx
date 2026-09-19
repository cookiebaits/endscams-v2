import { useState } from 'react';
import { Link } from 'react-router';
import {
  User, Send, CheckCircle, AlertCircle, Loader2,
  ShieldCheck, ArrowLeft, GraduationCap
} from 'lucide-react';
import Banner from '../components/Banner';

type WorkshopFormData = {
  name: string;
  company: string;
  contactNumber: string;
  email: string;
  organizationType: string;
  audienceSize: string;
  preferredDate: string;
  location: string;
  workshopType: string;
  budget: string;
  additionalInfo: string;
};

const ORGANIZATION_TYPES = [
  'Corporation / Business',
  'Non-Profit / Charity',
  'School / University',
  'Community Group',
  'Senior Center / Assisted Living',
  'Government Agency',
  'Religious Organization',
  'Other',
];

const WORKSHOP_TYPES = [
  'General Security Awareness',
  'Scam Prevention for Seniors',
  'Phishing & Email Safety',
  'Social Media Safety',
  'Identity Theft Prevention',
  'Safe Online Shopping & Banking',
  'Custom / Other',
];

const BUDGET_RANGES = [
  'Under $500',
  '$500 - $1,000',
  '$1,000 - $2,500',
  '$2,500 - $5,000',
  '$5,000+',
  'Not sure yet',
];

export default function WorkshopPage() {
  const [form, setForm] = useState<WorkshopFormData>({
    name: '',
    company: '',
    contactNumber: '',
    email: '',
    organizationType: '',
    audienceSize: '',
    preferredDate: '',
    location: '',
    workshopType: '',
    budget: '',
    additionalInfo: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof WorkshopFormData, string>>>({});
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const update = (field: keyof WorkshopFormData, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const validate = (): boolean => {
    const e: Partial<Record<keyof WorkshopFormData, string>> = {};
    if (!form.name.trim()) e.name = 'Please enter your name.';
    if (!form.contactNumber.trim()) e.contactNumber = 'Please enter a contact number.';
    if (!form.email.trim()) e.email = 'Please enter your email.';
    else if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Please enter a valid email address.';
    if (!form.organizationType) e.organizationType = 'Please select an organization type.';
    if (!form.audienceSize.trim()) e.audienceSize = 'Please estimate the audience size.';
    if (!form.location.trim()) e.location = 'Please enter the location.';
    if (!form.workshopType) e.workshopType = 'Please select a workshop type.';
    if (!form.budget) e.budget = 'Please select a budget range.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setStatus('submitting');
    setErrorMsg('');

    try {
      const fetcherUrl = (import.meta.env.VITE_FETCHER_URL || 'https://fetcher.endscams.org').replace(/\/+$/, '');
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const baseUrl = isLocal ? 'http://localhost:8000' : fetcherUrl;

      const res = await fetch(`${baseUrl}/api/workshop-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data?.success) {
        setStatus('success');
      } else {
        setStatus('error');
        setErrorMsg(data?.error || 'Failed to send workshop request. Please try again or email us directly.');
      }
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err?.message || 'Network error. Please check your connection and try again.');
    }
  };

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex items-center justify-center px-4 py-20">
        <div className="max-w-lg w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 md:p-10 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-emerald-500" />
          </div>
          <h1 className="text-2xl md:text-3xl font-black mb-4 text-slate-900 dark:text-white">
            Request Sent Successfully!
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mb-2 text-sm md:text-base">
            Thank you, {form.name.split(' ')[0]}. We've received your workshop request and will reach out to you at <span className="font-semibold text-brand-500">{form.email}</span> within 1-2 business days.
          </p>
          <p className="text-slate-500 dark:text-slate-500 mb-8 text-sm">
            For urgent inquiries, you can also email us directly at <a href="mailto:outreach@endscams.org" className="text-brand-500 hover:underline">outreach@endscams.org</a>.
          </p>
          <Link
            to="/home"
            className="btn-primary inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-base font-semibold shadow-lg shadow-brand-500/20 transition-all hover:scale-[1.02]"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Banner
        variant="info"
        message={<span className="text-[1.15em] font-medium">Request a Security Workshop — We bring cybersecurity education to your organization.</span>}
        center
        id="workshop_banner"
      />

      <div className="max-w-2xl mx-auto px-4 py-12 md:py-16">
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
            <GraduationCap className="w-8 h-8 text-brand-500" />
          </div>
          <h1 className="text-3xl md:text-4xl font-black mb-3 text-slate-900 dark:text-white">
            Work With Us
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm md:text-base max-w-lg mx-auto">
            Fill out the form below and we'll get back to you within 1-2 business days to discuss your security workshop.
          </p>
        </div>

        {status === 'error' && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-600 dark:text-red-400">{errorMsg}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 space-y-6">
          {/* Contact Information */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <User className="w-5 h-5 text-brand-500" />
              Contact Information
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none text-sm text-slate-900 dark:text-white"
                  placeholder="John Doe"
                />
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Company / Organization
                </label>
                <input
                  type="text"
                  value={form.company}
                  onChange={(e) => update('company', e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none text-sm text-slate-900 dark:text-white"
                  placeholder="Acme Corp"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Contact Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={form.contactNumber}
                  onChange={(e) => update('contactNumber', e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none text-sm text-slate-900 dark:text-white"
                  placeholder="(555) 123-4567"
                />
                {errors.contactNumber && <p className="text-xs text-red-500 mt-1">{errors.contactNumber}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none text-sm text-slate-900 dark:text-white"
                  placeholder="john@company.com"
                />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
              </div>
            </div>
          </div>

          {/* Workshop Details */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <ShieldCheck className="w-5 h-5 text-brand-500" />
              Workshop Details
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Organization Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.organizationType}
                  onChange={(e) => update('organizationType', e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none text-sm text-slate-900 dark:text-white"
                >
                  <option value="">Select type...</option>
                  {ORGANIZATION_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                {errors.organizationType && <p className="text-xs text-red-500 mt-1">{errors.organizationType}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Expected Audience Size <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.audienceSize}
                  onChange={(e) => update('audienceSize', e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none text-sm text-slate-900 dark:text-white"
                  placeholder="e.g. 25-50 people"
                />
                {errors.audienceSize && <p className="text-xs text-red-500 mt-1">{errors.audienceSize}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Preferred Date
                </label>
                <input
                  type="date"
                  value={form.preferredDate}
                  onChange={(e) => update('preferredDate', e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Location <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => update('location', e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none text-sm text-slate-900 dark:text-white"
                  placeholder="City, State or Virtual"
                />
                {errors.location && <p className="text-xs text-red-500 mt-1">{errors.location}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Workshop Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.workshopType}
                  onChange={(e) => update('workshopType', e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none text-sm text-slate-900 dark:text-white"
                >
                  <option value="">Select workshop...</option>
                  {WORKSHOP_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                {errors.workshopType && <p className="text-xs text-red-500 mt-1">{errors.workshopType}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Budget for Presentation <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.budget}
                  onChange={(e) => update('budget', e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none text-sm text-slate-900 dark:text-white"
                >
                  <option value="">Select budget...</option>
                  {BUDGET_RANGES.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
                {errors.budget && <p className="text-xs text-red-500 mt-1">{errors.budget}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Additional Information
              </label>
              <textarea
                value={form.additionalInfo}
                onChange={(e) => update('additionalInfo', e.target.value)}
                rows={4}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none text-sm text-slate-900 dark:text-white resize-none"
                placeholder="Tell us about any specific topics you'd like covered, accessibility needs, or any other details..."
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={status === 'submitting'}
            className="btn-primary w-full py-3.5 rounded-xl text-base font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-all hover:scale-[1.01]"
          >
            {status === 'submitting' ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Sending Request...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                Submit Workshop Request
              </>
            )}
          </button>

          <p className="text-center text-xs text-slate-400 dark:text-slate-500">
            We'll respond within 1-2 business days. For urgent inquiries, email{' '}
            <a href="mailto:outreach@endscams.org" className="text-brand-500 hover:underline">outreach@endscams.org</a>
          </p>
        </form>
      </div>
    </div>
  );
}

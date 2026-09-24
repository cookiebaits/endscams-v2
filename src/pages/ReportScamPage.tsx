import React, { useState } from 'react';
import {
  ShieldAlert,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Calendar,
  Building2,
  DollarSign,
  Phone,
  MessageSquare,
  FileText,
  User,
  Mail,
  Send,
  X,
} from 'lucide-react';
import { upsertToSupabase } from '../lib/supabase';
import { ThreatRecord } from '../types';
import { formatDisplayPhone } from '../utils/phoneUtils';
import { getPSTDateStamp } from '../utils/dateUtils';

export interface ReportScamPageProps {
  isModal?: boolean;
  onCloseModal?: () => void;
  onNavigateToTracker?: () => void;
  onRecordCreated?: (record: ThreatRecord) => void;
}

export const ReportScamPage: React.FC<ReportScamPageProps> = ({
  isModal = false,
  onCloseModal,
  onNavigateToTracker,
  onRecordCreated,
}) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isWhatsapp, setIsWhatsapp] = useState(false);
  const [companyImpersonated, setCompanyImpersonated] = useState('');
  const [category, setCategory] = useState('Lottery & Sweepstakes Scams');
  const [howContacted, setHowContacted] = useState('Phone Call');
  const [reportDate, setReportDate] = useState(() => getPSTDateStamp());
  const [moneyLost, setMoneyLost] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [description, setDescription] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [reporterEmail, setReporterEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const cleanDigits = phoneNumber.replace(/\D/g, '');
    if (!cleanDigits || cleanDigits.length < 7) {
      setFeedback({ type: 'error', message: 'Please enter a valid phone number with at least 7 digits.' });
      return;
    }

    setIsSubmitting(true);

    const newRecord: ThreatRecord = {
      id: `report-${Date.now()}-${cleanDigits.slice(-4)}`,
      phone_number: formatDisplayPhone(phoneNumber, cleanDigits),
      phone_digits: cleanDigits,
      is_whatsapp: isWhatsapp,
      category,
      impersonated_company: companyImpersonated.trim() || 'N/A',
      scammer_name: companyImpersonated.trim() || 'N/A',
      how_contacted: howContacted,
      report_date: reportDate,
      money_lost: moneyLost ? parseFloat(moneyLost) : undefined,
      amount_charged: moneyLost ? `$${moneyLost}` : 'N/A',
      invoice_number: invoiceNumber.trim() || 'N/A',
      description: description.trim() || 'Reported via EndScams Report form.',
      source_name: 'Community Report',
      source_url: 'https://endscams.org/report',
      reporter_name: reporterName.trim() || undefined,
      reporter_email: reporterEmail.trim() || undefined,
      is_down: false,
    };

    try {
      // 1. Send to server backend route /api/report
      try {
        await fetch('/api/report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newRecord),
        });
      } catch (err) {
        console.warn('Backend /api/report offline, continuing with direct Supabase sync:', err);
      }

      // 2. Direct Supabase sync
      await upsertToSupabase([newRecord]);

      // 3. Callback to parent tracker if provided
      if (onRecordCreated) {
        onRecordCreated(newRecord);
      }

      setFeedback({
        type: 'success',
        message: `Report submitted successfully for ${newRecord.phone_number}! Added to live database.`,
      });

      // Reset form
      setPhoneNumber('');
      setIsWhatsapp(false);
      setCompanyImpersonated('');
      setMoneyLost('');
      setInvoiceNumber('');
      setDescription('');
      setReporterName('');
      setReporterEmail('');
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `Failed to submit report: ${err.message || 'Unknown error'}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const content = (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100">Submit a Scam Threat Report</h1>
            <p className="text-xs text-slate-400">
              Numbers submitted are immediately verified, persisted to Supabase, and tracked on the live scanner.
            </p>
          </div>
        </div>

        {isModal && onCloseModal && (
          <button
            onClick={onCloseModal}
            className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center space-x-2.5 ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Phone Number */}
          <div className="space-y-1.5">
            <label className="block text-slate-300 font-semibold flex items-center space-x-1.5">
              <Phone className="w-3.5 h-3.5 text-amber-400" />
              <span>Suspect Phone Number *</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 1 (800) 555-0199 or +234 810..."
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono text-sm"
            />
            <label className="flex items-center space-x-2 text-[11px] text-emerald-400 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={isWhatsapp}
                onChange={(e) => setIsWhatsapp(e.target.checked)}
                className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
              />
              <span>Suspect also contacted via WhatsApp</span>
            </label>
          </div>

          {/* Company / Brand Impersonated */}
          <div className="space-y-1.5">
            <label className="block text-slate-300 font-semibold flex items-center space-x-1.5">
              <Building2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Impersonated Entity / Caller Name</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Publishers Clearing House, Geek Squad, PayPal"
              value={companyImpersonated}
              onChange={(e) => setCompanyImpersonated(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm"
            />
          </div>

          {/* Scam Category */}
          <div className="space-y-1.5">
            <label className="block text-slate-300 font-semibold">Scam Category *</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500 text-sm"
            >
              <option value="Lottery & Sweepstakes Scams">Lottery & Sweepstakes Scams (PCH, Mega Millions, etc.)</option>
              <option value="General Tech Support & Refund Scams">General Tech Support & Refund Scams</option>
              <option value="Crypto BTC Recovery Scam">Crypto BTC Recovery Scam</option>
              <option value="Social Media Prize & Giveaway Scam">Social Media Prize & Giveaway Scam</option>
              <option value="Spellcaster WhatsApp Extortion">Spellcaster WhatsApp Extortion</option>
              <option value="Publishing Chat Scam">Publishing Chat Scam</option>
              <option value="Government Impersonation & Warrant Scams">Government Impersonation & Warrant Scams</option>
              <option value="Emergency & Grandparent Scams">Emergency & Grandparent Scams</option>
              <option value="Other Scam">Other Scam</option>
            </select>
          </div>

          {/* How Contacted */}
          <div className="space-y-1.5">
            <label className="block text-slate-300 font-semibold flex items-center space-x-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
              <span>How Were You Contacted?</span>
            </label>
            <select
              value={howContacted}
              onChange={(e) => setHowContacted(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500 text-sm"
            >
              <option value="Phone Call">Phone Call</option>
              <option value="Text Message (SMS)">Text Message (SMS)</option>
              <option value="WhatsApp">WhatsApp</option>
              <option value="Email">Email</option>
              <option value="Website / Pop-up">Website / Pop-up</option>
              <option value="Social Media">Social Media</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Financial Loss */}
          <div className="space-y-1.5">
            <label className="block text-slate-300 font-semibold flex items-center space-x-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              <span>Financial Loss ($) (Optional)</span>
            </label>
            <input
              type="number"
              min="0"
              step="any"
              placeholder="0.00 (leave blank if no money was lost)"
              value={moneyLost}
              onChange={(e) => setMoneyLost(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono text-sm"
            />
          </div>

          {/* Date of Contact */}
          <div className="space-y-1.5">
            <label className="block text-slate-300 font-semibold flex items-center space-x-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span>Date Contacted (PST)</span>
            </label>
            <input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500 text-sm"
            />
          </div>
        </div>

        {/* Threat Description / Details */}
        <div className="space-y-1.5">
          <label className="block text-slate-300 font-semibold flex items-center space-x-1.5">
            <FileText className="w-3.5 h-3.5 text-amber-400" />
            <span>Describe What Happened (Threat Details & Callback Demands) *</span>
          </label>
          <textarea
            required
            rows={4}
            placeholder="Explain the scam script, demands made, software pushed (e.g. AnyDesk), gift cards or wire requests..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm leading-relaxed resize-none"
          />
        </div>

        {/* Reporter Optional Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
          <div className="space-y-1.5">
            <label className="block text-slate-400 font-medium flex items-center space-x-1.5">
              <User className="w-3.5 h-3.5" />
              <span>Your Name or Alias (Optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Anonymous Reporter"
              value={reporterName}
              onChange={(e) => setReporterName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-slate-600"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-slate-400 font-medium flex items-center space-x-1.5">
              <Mail className="w-3.5 h-3.5" />
              <span>Email for Verification (Optional)</span>
            </label>
            <input
              type="email"
              placeholder="reporter@example.com"
              value={reporterEmail}
              onChange={(e) => setReporterEmail(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-slate-600"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-800">
          {onNavigateToTracker && (
            <button
              type="button"
              onClick={onNavigateToTracker}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center space-x-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Tracker</span>
            </button>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="ml-auto px-6 py-2.5 bg-gradient-to-r from-red-600 to-amber-500 hover:from-red-500 hover:to-amber-400 text-slate-950 font-bold rounded-xl text-xs transition shadow-lg flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isSubmitting ? 'Submitting & Syncing...' : 'Submit Report'}</span>
          </button>
        </div>
      </form>
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-3xl my-8">
          {content}
        </div>
      </div>
    );
  }

  return <div className="py-6 px-4">{content}</div>;
};

export default ReportScamPage;

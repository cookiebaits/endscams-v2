import { useState } from 'react';
import { AlertTriangle, CheckCircle, ExternalLink, Paperclip } from 'lucide-react';
import Banner from '../components/Banner';
import ReportScamForm from '../components/ReportScamForm';

const FEDERAL_LINKS = [
  { name: 'FBI IC3 — Internet Crime Complaint Center', url: 'https://www.ic3.gov' },
  { name: 'FTC — Federal Trade Commission', url: 'https://reportfraud.ftc.gov' },
  { name: 'USA.gov — Report Scams', url: 'https://www.usa.gov/report-scams' },
  { name: 'CISA — Cybersecurity Threats', url: 'https://www.cisa.gov/report' },
];

export default function ReportScamPage() {
  const [submittedReport, setSubmittedReport] = useState<{ phone_number: string; category: string; description: string; file_url?: string } | null>(null);

  if (submittedReport) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-200 pb-16 flex items-center justify-center">
        <div className="max-w-md mx-auto px-4 text-center animate-slide-up">
          <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">Report Submitted</h1>
          <p className="text-slate-500 dark:text-slate-400 mb-4 leading-relaxed text-sm">
            Thank you for helping protect others. Your report for <strong className="text-brand-500">{submittedReport.phone_number}</strong> has been saved directly to the database and Scam Tracker.
          </p>
          {submittedReport.file_url && (
            <a
              href={submittedReport.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-brand-500 hover:text-brand-600 underline mb-6"
            >
              <Paperclip className="w-4 h-4" />
              View Uploaded Evidence
            </a>
          )}
          <div className="mb-8 text-left bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <p className="text-xs font-semibold text-slate-300 mb-2">Also consider reporting to federal agencies:</p>
            <div className="space-y-1.5">
              {FEDERAL_LINKS.map(link => (
                <a
                  key={link.name}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-brand-400 hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                  {link.name}
                </a>
              ))}
            </div>
          </div>
          <button onClick={() => setSubmittedReport(null)} className="btn-primary w-full">Submit Another Report</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-200 pb-16 text-slate-700 dark:text-slate-300">
      <Banner
        variant="warning"
        id="report_privacy"
        dismissible
        message={<span><strong>Privacy Notice:</strong> Any information you submit will be publicly visible on the Scam Tracker for 45 days. Do not include your own personal banking details.</span>}
      />
      <div className="max-w-2xl mx-auto px-4 pt-8">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-3">
            <div className="flex-shrink-0 inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-brand-500/10">
              <AlertTriangle className="w-6 h-6 sm:w-7 sm:h-7 text-brand-500" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white uppercase tracking-wider text-left">Report a Scam</h1>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Help protect your community. Reports are saved directly to the database and retained in the Scam Tracker.
          </p>
        </div>

        <ReportScamForm onSuccess={(rep) => setSubmittedReport(rep)} />
      </div>
    </div>
  );
}

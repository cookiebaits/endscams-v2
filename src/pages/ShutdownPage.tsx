import { useState } from 'react';
import {
  Shield,
  Landmark,
  PhoneCall,
  HeartHandshake,
  AlertTriangle,
  FileText,
  Lock,
  CheckCircle2,
  XCircle,
  HelpCircle,
  RotateCcw,
  ExternalLink,
} from 'lucide-react';
import Banner from '../components/Banner';

interface Question {
  id: number;
  text: string;
  explanation: string;
}

const QUESTIONS: Question[] = [
  {
    id: 1,
    text: 'Did someone contact you unexpectedly via phone, text, email, or social media?',
    explanation: 'Unsolicited contact is the primary vector for fraudulent schemes and scam solicitations.',
  },
  {
    id: 2,
    text: 'Did they claim to represent a government agency (IRS, FTC, SSA), tech support, bank, or law enforcement?',
    explanation: 'Impersonation of official authorities or trusted brands is designed to intimidate and lower your guard.',
  },
  {
    id: 3,
    text: 'Were you pressured to act urgently to avoid arrest, fine, account suspension, or immediate asset loss?',
    explanation: 'Scammers create artificial urgency to prevent victims from verifying claims or thinking rationally.',
  },
  {
    id: 4,
    text: 'Did they ask you to pay or transfer money via Gift Cards, Bitcoin/Crypto, Zelle, Cash App, or Wire Transfer?',
    explanation: 'Legitimate agencies and businesses never demand payment via untraceable or irreversible methods.',
  },
  {
    id: 5,
    text: 'Were you instructed to download remote access software (e.g., AnyDesk, TeamViewer, QuickAssist)?',
    explanation: 'Remote access tool installation grants scammers full control over your computer and financial accounts.',
  },
  {
    id: 6,
    text: 'Did they claim you won a lottery, sweepstakes, job offer, or grant that you never applied for?',
    explanation: 'Unsolicited winnings or lucrative remote jobs that require upfront processing fees are classic scams.',
  },
  {
    id: 7,
    text: 'Is the sender email or website link slightly misspelled compared to the official organization domain?',
    explanation: 'Typosquatting and spoofed domain names (e.g., support-amazon-security.com) are common red flags.',
  },
  {
    id: 8,
    text: 'Were you told to keep this interaction secret from bank tellers, police officers, or family members?',
    explanation: 'Scammers frequently instruct victims to lie or hide details to prevent outside intervention.',
  },
  {
    id: 9,
    text: 'Did they send a check and ask you to deposit it and wire or transfer a portion back to them?',
    explanation: 'Fake check scams rely on funds appearing temporarily available before the check bounces days later.',
  },
  {
    id: 10,
    text: 'Have you already transferred funds, shared account credentials, or provided your Social Security Number?',
    explanation: 'Sharing sensitive credentials or sending funds requires immediate protective containment steps.',
  },
];

export default function ShutdownPage() {
  const [answers, setAnswers] = useState<Record<number, 'yes' | 'no' | 'unsure' | null>>({});

  const handleSelectAnswer = (qId: number, val: 'yes' | 'no' | 'unsure') => {
    setAnswers((prev) => ({ ...prev, [qId]: val }));
  };

  const answeredCount = Object.keys(answers).filter((k) => answers[Number(k)] !== null).length;
  const yesCount = Object.values(answers).filter((v) => v === 'yes').length;

  const resetAssessment = () => {
    setAnswers({});
  };

  const getRiskLevel = () => {
    if (answeredCount === 0) return null;
    if (yesCount >= 4) return { level: 'HIGH RISK', color: 'red', text: 'Multiple high-severity scam indicators detected. Take protective action immediately.' };
    if (yesCount >= 2) return { level: 'MODERATE RISK', color: 'amber', text: 'Suspicious activity indicators present. Exercise extreme caution and verify independently.' };
    return { level: 'LOW RISK', color: 'green', text: 'Few direct scam indicators selected, but always stay vigilant.' };
  };

  const risk = getRiskLevel();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-200 pb-16 text-slate-700 dark:text-slate-300">
      <Banner
        variant="info"
        id="shutdown_top_notice_banner"
        dismissible
        message={
          <span>
            <strong>Scam Triage &amp; Shutdown Guidance:</strong> Review our organizational scope below, complete the 10-question assessment, and follow the &quot;Now What?&quot; action steps.
          </span>
        }
      />

      <div className="max-w-4xl mx-auto px-4 pt-8">
        {/* Header Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-brand-500/10 mb-4">
            <Shield className="w-7 h-7 text-brand-500" />
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white mb-3">
            Scam Shutdown Assessment &amp; Guidance
          </h1>
          <p className="text-base md:text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Evaluate potential scam threats with our 10-question checklist and access clear, immediate guidance on what steps to take next.
          </p>
        </div>

        {/* P2: Top Reminder Card (Scope & Key Responsibilities) */}
        <div className="card p-6 md:p-8 mb-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
            <Shield className="w-6 h-6 text-brand-500 shrink-0" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Scope of Services &amp; Operational Reminder
            </h2>
          </div>

          <p className="text-sm md:text-base text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
            Please keep the following important distinctions in mind regarding our organization&apos;s capabilities and support boundaries:
          </p>

          <div className="grid sm:grid-cols-2 gap-4">
            {/* Box 1: Focus */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-5 h-5 text-brand-500" />
                <h3 className="font-bold text-slate-900 dark:text-white text-sm md:text-base">Our Primary Focus</h3>
              </div>
              <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                We concentrate on investigating scam networks, publishing educational guides, and directing victims to official protective resources.
              </p>
            </div>

            {/* Box 2: Refunds */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 mb-2">
                <Landmark className="w-5 h-5 text-blue-500" />
                <h3 className="font-bold text-slate-900 dark:text-white text-sm md:text-base">Financial Refunds</h3>
              </div>
              <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Our organization does not process refunds or recover lost funds. For financial disputes and chargebacks, please work directly with your bank or credit card company.
              </p>
            </div>

            {/* Box 3: Police Case Updates */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 mb-2">
                <PhoneCall className="w-5 h-5 text-indigo-500" />
                <h3 className="font-bold text-slate-900 dark:text-white text-sm md:text-base">Criminal Case Updates</h3>
              </div>
              <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                We do not manage law enforcement investigations. For criminal case status updates, please follow up with the law enforcement agency where you filed your police report.
              </p>
            </div>

            {/* Box 4: Crisis Support */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 mb-2">
                <HeartHandshake className="w-5 h-5 text-red-500" />
                <h3 className="font-bold text-slate-900 dark:text-white text-sm md:text-base">Crisis &amp; Mental Support</h3>
              </div>
              <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                We recognize that scam experiences cause immense stress. We do not offer mental health counseling; if you are struggling emotionally, please call or text <strong>988</strong> immediately.
              </p>
            </div>
          </div>
        </div>

        {/* 10 Yes / No Questions Questionnaire */}
        <div className="card p-6 md:p-8 mb-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>10-Question Scam Assessment Checklist</span>
              </h2>
              <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
                Answer each question below to evaluate potential threat indicators.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {answeredCount} / 10 Answered
              </span>
              {answeredCount > 0 && (
                <button
                  onClick={resetAssessment}
                  className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-8">
            <div
              className="h-full bg-brand-500 transition-all duration-300"
              style={{ width: `${(answeredCount / 10) * 100}%` }}
            />
          </div>

          {/* Risk Level Output Banner */}
          {risk && (
            <div
              className={`mb-8 p-4 rounded-xl border flex items-start gap-3 transition-all ${
                risk.color === 'red'
                  ? 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300'
                  : risk.color === 'amber'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                  : 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-300'
              }`}
            >
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-sm md:text-base flex items-center gap-2">
                  <span>Assessment Indicator: {risk.level}</span>
                  <span className="text-xs font-normal opacity-90">({yesCount} positive indicators selected)</span>
                </div>
                <p className="text-xs md:text-sm mt-1 leading-relaxed">{risk.text}</p>
              </div>
            </div>
          )}

          {/* Questions List */}
          <div className="space-y-6">
            {QUESTIONS.map((q) => {
              const currentAns = answers[q.id];
              return (
                <div
                  key={q.id}
                  className={`p-4 md:p-5 rounded-xl border transition-all ${
                    currentAns === 'yes'
                      ? 'border-red-500/40 bg-red-500/5 dark:bg-red-950/10'
                      : currentAns === 'no'
                      ? 'border-green-500/40 bg-green-500/5 dark:bg-green-950/10'
                      : currentAns === 'unsure'
                      ? 'border-amber-500/40 bg-amber-500/5 dark:bg-amber-950/10'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40'
                  }`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <span className="w-6 h-6 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {q.id}
                    </span>
                    <div>
                      <h3 className="text-sm md:text-base font-semibold text-slate-900 dark:text-white leading-snug">
                        {q.text}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{q.explanation}</p>
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="flex flex-wrap items-center gap-2 pl-9">
                    <button
                      onClick={() => handleSelectAnswer(q.id, 'yes')}
                      className={`px-4 py-2 rounded-lg text-xs md:text-sm font-semibold flex items-center gap-1.5 transition-all ${
                        currentAns === 'yes'
                          ? 'bg-red-600 text-white shadow-sm'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-red-500'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Yes
                    </button>

                    <button
                      onClick={() => handleSelectAnswer(q.id, 'no')}
                      className={`px-4 py-2 rounded-lg text-xs md:text-sm font-semibold flex items-center gap-1.5 transition-all ${
                        currentAns === 'no'
                          ? 'bg-green-600 text-white shadow-sm'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-green-500'
                      }`}
                    >
                      <XCircle className="w-4 h-4" />
                      No
                    </button>

                    <button
                      onClick={() => handleSelectAnswer(q.id, 'unsure')}
                      className={`px-4 py-2 rounded-lg text-xs md:text-sm font-semibold flex items-center gap-1.5 transition-all ${
                        currentAns === 'unsure'
                          ? 'bg-amber-600 text-white shadow-sm'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-amber-500'
                      }`}
                    >
                      <HelpCircle className="w-4 h-4" />
                      Unsure
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* P1 & P3: "Now What?" Section (Post-Questionnaire Action Guide) */}
        <div className="card p-6 md:p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl">
          <div className="mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span>Now What?</span>
            </h2>
            <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mt-1">
              Follow these crucial next steps to protect your finances, report criminal activity, and get emergency support.
            </p>
          </div>

          {/* First Priority: Suicide & Crisis Support (988) + Law Enforcement Disclaimer */}
          <div className="p-5 md:p-6 rounded-2xl bg-red-500/10 border-2 border-red-500/30 text-slate-900 dark:text-white mb-8">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-red-600 text-white shrink-0 mt-0.5">
                <HeartHandshake className="w-6 h-6 md:w-7 md:h-7" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded bg-red-600 text-white">
                    CRITICAL NOTICE
                  </span>
                  <span className="text-xs font-bold text-red-700 dark:text-red-300">
                    We Are NOT Law Enforcement
                  </span>
                </div>

                <h3 className="text-lg md:text-xl font-bold text-red-800 dark:text-red-200 mb-2">
                  Emergency Mental Health &amp; Crisis Support (Call or Text 988)
                </h3>

                <p className="text-xs md:text-sm text-slate-700 dark:text-slate-200 leading-relaxed mb-4">
                  Please be aware that our organization is <strong>not a law enforcement agency</strong> and does not handle emergency crisis intervention or legal proceedings. If you or someone you know is experiencing thoughts of suicide, emotional distress, or extreme anxiety, please reach out for immediate, free, and confidential assistance:
                </p>

                <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-red-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white text-sm md:text-base">
                      988 Suicide &amp; Crisis Lifeline
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Available 24/7 across the United States &amp; Canada. Call or text 988.
                    </p>
                  </div>
                  <a
                    href="tel:988"
                    className="w-full sm:w-auto px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 shrink-0 shadow-sm"
                  >
                    <PhoneCall className="w-4 h-4" />
                    Call / Text 988 Now
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Action Steps Grid */}
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Required Action Steps Following Your Assessment</span>
            </h3>

            {/* Step 1: Work with Bank */}
            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-500 text-white font-bold flex items-center justify-center shrink-0 text-sm mt-0.5">
                1
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-slate-900 dark:text-white text-base mb-1 flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-blue-500" />
                  Work Directly With Your Bank or Financial Institution
                </h4>
                <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                  Our organization <strong>does not process refunds or financial recovery</strong>. If money was transferred or accounts compromised, contact your bank, credit card issuer, or wire service immediately to initiate fraud disputes, freeze accounts, and request chargebacks.
                </p>
                <div className="flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                  <span className="px-2.5 py-1 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    ✓ Request Fraud Department
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    ✓ Freeze Cards &amp; Transfers
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    ✓ File Formal Chargeback Claim
                  </span>
                </div>
              </div>
            </div>

            {/* Step 2: Work with Law Enforcement */}
            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-indigo-500 text-white font-bold flex items-center justify-center shrink-0 text-sm mt-0.5">
                2
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-slate-900 dark:text-white text-base mb-1 flex items-center gap-2">
                  <PhoneCall className="w-5 h-5 text-indigo-500" />
                  Follow Up With Law Enforcement Agency
                </h4>
                <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                  File an official police report with your local police department or sheriff&apos;s office. Keep your police report / case number handy. For all criminal case updates, follow up directly with the specific law enforcement department where you filed your report.
                </p>
                <div className="flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                  <span className="px-2.5 py-1 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    ✓ Local Sheriff / Police Non-Emergency Hotline
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    ✓ Obtain Official Incident Report #
                  </span>
                </div>
              </div>
            </div>

            {/* Step 3: File Federal Scam Reports */}
            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-brand-500 text-white font-bold flex items-center justify-center shrink-0 text-sm mt-0.5">
                3
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-slate-900 dark:text-white text-base mb-1 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-brand-500" />
                  File Official Federal &amp; Consumer Reports
                </h4>
                <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                  Report fraud details to regulatory databases to help law enforcement track cybercrime cartels and shut down scam infrastructure.
                </p>

                <div className="grid sm:grid-cols-2 gap-3">
                  <a
                    href="https://reportfraud.ftc.gov"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-brand-500 transition-colors flex items-center justify-between group"
                  >
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white text-xs md:text-sm block">
                        FTC Fraud Report
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">ReportFraud.ftc.gov</span>
                    </div>
                    <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-brand-500 transition-colors" />
                  </a>

                  <a
                    href="https://www.ic3.gov"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-brand-500 transition-colors flex items-center justify-between group"
                  >
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white text-xs md:text-sm block">
                        FBI IC3 Crime Complaint
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">IC3.gov</span>
                    </div>
                    <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-brand-500 transition-colors" />
                  </a>
                </div>
              </div>
            </div>

            {/* Step 4: Secure Credentials */}
            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-emerald-500 text-white font-bold flex items-center justify-center shrink-0 text-sm mt-0.5">
                4
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-slate-900 dark:text-white text-base mb-1 flex items-center gap-2">
                  <Lock className="w-5 h-5 text-emerald-500" />
                  Secure Devices, Passwords &amp; Credit Bureaus
                </h4>
                <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  If remote desktop apps (e.g. AnyDesk) were installed, uninstall them immediately and run an antivirus scan. Change passwords for compromised bank and email accounts, enable two-factor authentication, and place a fraud alert or credit freeze with Equifax, Experian, and TransUnion.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle,
  PhoneCall,
  Landmark,
  Building2,
  FileText,
  Info,
  HeartHandshake,
  ShieldCheck,
  Smartphone,
  Monitor
} from 'lucide-react';
import { useDeviceType } from '../hooks/useDeviceType';

const CHECKLIST_ITEMS = [
  {
    id: 'police',
    question: 'Did you file a police report?',
    noAction: 'Immediately file a police report for being a victim of a scam. Provide them with all the details, communication logs, and transaction receipts you have gathered. This report is critical for disputing fraudulent charges with your bank and placing hard blocks on your credit.'
  },
  {
    id: 'phone',
    question: 'Did you get a new phone number?',
    noAction: 'Immediately go to your cell phone provider store to get a new number. Scammers often sell active numbers on the dark web, leading to relentless follow-up calls and potential SIM-swapping attacks if your number remains unchanged.'
  },
  {
    id: 'contact',
    question: "Did you block the scammer's contact and close any phone lines you opened for them?",
    noAction: 'Make sure to talk to your provider about closing extra lines and get help blocking their number on your new line. Scammers rely on keeping communication open to manipulate you further; severing all ties is your strongest defense.'
  },
  {
    id: 'bank',
    question: 'Did you report to your bank as a victim of fraud?',
    noAction: 'Contact your bank immediately to report the fraud. Speak to their dedicated fraud department to secure your accounts, freeze existing funds, issue new debit/credit cards, and initiate potential chargebacks or reversals for unauthorized transactions.'
  },
  {
    id: 'id',
    question: 'Did you confirm your Social Security number and Credit has been compromised?',
    noAction: 'If you provided your social security number, assume its compromised. Go to the local social security office to get resources on identity theft prevention, and immediately place a fraud alert across all major credit bureaus.'
  },
  {
    id: 'access',
    question: 'Did you change passwords if you provided them access to any accounts (Bank, social media, email etc)?',
    noAction: 'Change all your passwords immediately from a secure, uncompromised device. Enable strong two-factor authentication (2FA) using an authenticator app wherever possible, and meticulously check your account settings for any unrecognized recovery emails or phone numbers.'
  },
  {
    id: 'freeze',
    question: 'Did you check if you sent the scammer any form of ID such as passport or driver license?',
    noAction: 'Check if you sent any messages and photos containing your ID. If you did, head to the DMV and the U.S. Department of State to report that you were a victim of fraud so they can flag your documents.'
  },
  {
    id: 'recovery',
    question: "Have you ignored 'money recovery agents' who contacted you? (Recovery is just another form of Advanced Fee Fraud)",
    noAction: 'Do not trust anyone claiming they can recover your lost money or hack the scammers for an upfront fee. Legitimate agencies (like law enforcement or your bank) do not charge fees to investigate fraud or help victims.'
  },
  {
    id: 'social',
    question: 'Did you tighten up security/visibility on your social media accounts?',
    noAction: 'Set your social media profiles to strictly private. Scammers scrape public profiles to map your family and friends for future targeted attacks. Be extremely cautious of friend requests from strangers or duplicated accounts of people you already know.'
  },
  {
    id: 'help',
    question: 'Have you reached out to a trusted family member or friend for technical help?',
    noAction: 'Reach out to a trusted tech-savvy contact for help in securing your devices, running anti-virus scans, changing passwords, and monitoring your accounts. A trusted contact can also provide much-needed emotional support during this stressful time.'
  }
];

export default function ShutdownPage() {
  const device = useDeviceType();
  const [answers, setAnswers] = useState<Record<string, 'yes' | 'no' | null>>({});

  const handleAnswer = (id: string, answer: 'yes' | 'no') => {
    setAnswers(prev => ({ ...prev, [id]: answer }));
  };

  const answeredCount = Object.keys(answers).length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-200 pb-16 text-slate-700 dark:text-slate-300">
      {/* Device Auto-Detection Indicator */}
      <div className="bg-slate-200/60 dark:bg-slate-900/60 border-b border-slate-300 dark:border-slate-800 py-1 px-4 text-center text-xs text-slate-600 dark:text-slate-400 flex items-center justify-center gap-2">
        {device.isMobilePhone ? (
          <>
            <Smartphone className="w-3.5 h-3.5 text-brand-500" />
            <span>Mobile Phone View Auto-Detected — Stacked touch controls active</span>
          </>
        ) : (
          <>
            <Monitor className="w-3.5 h-3.5 text-brand-500" />
            <span>Desktop Computer View Auto-Detected</span>
          </>
        )}
      </div>

      <div className="max-w-4xl mx-auto px-4 pt-8">

        {/* Header Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 mb-6">
            <ShieldAlert className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 dark:text-white mb-4 uppercase tracking-wider border-l-4 border-red-500 pl-4 inline-block text-left">
            Scam Shutdown Checklist
          </h1>
          <p className="text-slate-500 dark:text-slate-400 max-w-2xl mx-auto text-base sm:text-lg mt-2 leading-relaxed">
            If you have been compromised, follow these next steps to shut down scammers and protect your identity.
          </p>
        </div>

        {/* Top Reminder Section */}
        <div className="mb-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Info className="w-5 h-5" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
              Important Notice & Our Scope of Operation
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs sm:text-sm">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-1.5 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-brand-500" />
                Our Focus
              </h3>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                We focus on investigating scam operations, providing educational guidance, and directing victims to legitimate support channels.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-1.5 flex items-center gap-2">
                <Landmark className="w-4 h-4 text-amber-500" />
                Refunds & Police Reports
              </h3>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                For financial refunds, work directly with your bank. For criminal case updates, follow up with the law enforcement agency handling your police report.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-red-500/5 dark:bg-red-950/20 border border-red-200/60 dark:border-red-900/40">
              <h3 className="font-semibold text-red-700 dark:text-red-400 mb-1.5 flex items-center gap-2">
                <PhoneCall className="w-4 h-4 text-red-500" />
                Mental Health Support
              </h3>
              <p className="text-red-800 dark:text-red-300 leading-relaxed">
                We understand this is a stressful time, but we cannot handle mental health crises. If you are struggling emotionally, please call or text <strong className="text-red-600 dark:text-red-400 font-bold">988</strong> immediately.
              </p>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mb-8 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs sm:text-sm text-amber-800 dark:text-amber-400 leading-relaxed">
            <strong>Disclaimer:</strong> These are recommendations based on previous interactions and it isn't a foolproof way to stop scammers. This is for educational purposes only.
          </p>
        </div>

        {/* Checklist */}
        <div className="space-y-6 mb-14">
          {CHECKLIST_ITEMS.map((item, index) => {
            const currentAnswer = answers[item.id];

            return (
              <div
                key={item.id}
                className="bg-white dark:bg-slate-900 rounded-xl p-5 md:p-6 shadow-sm border border-slate-200 dark:border-slate-800 transition-colors"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-start gap-3">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-500/10 text-brand-500 font-bold text-sm flex-shrink-0 mt-0.5">
                        {index + 1}
                      </span>
                      <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white leading-snug">
                        {item.question}
                      </h3>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    <button
                      onClick={() => handleAnswer(item.id, 'yes')}
                      className={`flex-1 sm:flex-initial px-6 py-2.5 rounded-lg font-bold transition-colors border text-sm ${
                        currentAnswer === 'yes'
                          ? 'bg-green-500 text-white border-green-500 hover:bg-green-600'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => handleAnswer(item.id, 'no')}
                      className={`flex-1 sm:flex-initial px-6 py-2.5 rounded-lg font-bold transition-colors border text-sm ${
                        currentAnswer === 'no'
                          ? 'bg-red-500 text-white border-red-500 hover:bg-red-600'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      No
                    </button>
                  </div>
                </div>

                {/* Result Section */}
                {currentAnswer && (
                  <div className={`mt-5 p-4 rounded-lg flex items-start gap-3 animate-fade-in ${
                    currentAnswer === 'yes'
                      ? 'bg-green-50 dark:bg-green-950/20 border border-green-100 dark:border-green-900/30'
                      : 'bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30'
                  }`}>
                    {currentAnswer === 'yes' ? (
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    )}
                    <p className={`text-sm sm:text-base font-bold ${
                      currentAnswer === 'yes'
                        ? 'text-green-800 dark:text-green-300'
                        : 'text-red-800 dark:text-red-300'
                    }`}>
                      {currentAnswer === 'yes' ? 'Retain proof and receipt, then proceed to the next item.' : item.noAction}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* "Now What?" Section */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-8 shadow-md">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-5 mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-red-500/10 text-red-500">
                <HeartHandshake className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 dark:text-white uppercase tracking-wide">
                  Now What?
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                  What to do after completing the 10 checklist questions above
                </p>
              </div>
            </div>
          </div>

          {/* 1. Suicide & Mental Health Crisis Callout */}
          <div className="mb-6 p-4 sm:p-5 rounded-xl bg-red-500/10 dark:bg-red-950/40 border-2 border-red-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <PhoneCall className="w-7 h-7 text-red-500 flex-shrink-0 mt-1 sm:mt-0" />
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Need Immediate Mental Health Support?
                </h3>
                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">
                  <strong>We are NOT law enforcement or mental health professionals.</strong> If you are feeling overwhelmed, hopeless, or having thoughts of suicide, please call or text <strong className="text-red-600 dark:text-red-400">988</strong> immediately for free, confidential, 24/7 help.
                </p>
              </div>
            </div>
            <a
              href="tel:988"
              className="w-full sm:w-auto flex-shrink-0 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-colors shadow-sm"
            >
              <PhoneCall className="w-5 h-5" />
              Call or Text 988
            </a>
          </div>

          {/* 2. Official Channels & Financial/Legal Recovery */}
          <div className="mb-8">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-brand-500" />
              Working with Official Authorities
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
              Our organization does not handle refunds, legal proceedings, or criminal investigations. You must work through official, accredited organizations:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 sm:p-5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                    <Landmark className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                    1. Bank & Financial Claims
                  </h4>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Contact your bank's dedicated fraud department immediately. Only your financial institution can process chargebacks, place freezes, or assist with potential financial reversals.
                </p>
              </div>

              <div className="p-4 sm:p-5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                    2. Law Enforcement Updates
                  </h4>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  For updates regarding criminal investigations or prosecution, maintain contact directly with the police department or law enforcement group where you filed your official report.
                </p>
              </div>
            </div>
          </div>

          {/* 3. Action Plan after completing the 10 questions */}
          <div className="p-4 sm:p-5 rounded-xl bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <FileText className="w-5 h-5 text-brand-500" />
              Summary Checklist Next Steps ({answeredCount}/10 completed)
            </h3>

            <div className="space-y-3 text-xs sm:text-sm">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-500/10 text-brand-500 font-bold text-xs flex-shrink-0 mt-0.5">
                  A
                </div>
                <div>
                  <strong className="text-slate-900 dark:text-white">Address any "No" answers:</strong>
                  <span className="text-slate-600 dark:text-slate-300 ml-1">
                    Every "No" represents an open vulnerability. Prioritize completing the recommended actions for those specific items first.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-500/10 text-brand-500 font-bold text-xs flex-shrink-0 mt-0.5">
                  B
                </div>
                <div>
                  <strong className="text-slate-900 dark:text-white">Organize your records:</strong>
                  <span className="text-slate-600 dark:text-slate-300 ml-1">
                    Keep a dedicated folder with call logs, chat transcripts, reference numbers from your bank, and your official police report file number.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-500/10 text-brand-500 font-bold text-xs flex-shrink-0 mt-0.5">
                  C
                </div>
                <div>
                  <strong className="text-slate-900 dark:text-white">Beware of secondary scams:</strong>
                  <span className="text-slate-600 dark:text-slate-300 ml-1">
                    Never pay upfront fees to unsolicited "recovery specialists" on social media or email. Legitimate authorities will never charge money to recover funds.
                  </span>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

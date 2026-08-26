import { useState } from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle } from 'lucide-react';

const CHECKLIST_ITEMS = [
  {
    id: 'police',
    question: 'Did you file a police report?',
    noAction: 'Immediately file a police report for being a victim of a scam.'
  },
  {
    id: 'phone',
    question: 'Did you get a new phone number?',
    noAction: 'Immediately go to your cell phone provider store to get a new number.'
  },
  {
    id: 'contact',
    question: "Did you block the scammer's contact and close any phone lines you opened for them?",
    noAction: 'Make sure to talk to your provider about closing extra lines and get help blocking their number on your new line.'
  },
  {
    id: 'bank',
    question: 'Did you report to your bank as a victim of fraud?',
    noAction: 'Contact your bank immediately to report the fraud. They can help secure your accounts, issue new cards, and potentially reverse unauthorized transactions.'
  },
  {
    id: 'id',
    question: 'Did you place a fraud alert if you gave them your ID or Social Security number?',
    noAction: 'If you provided your ID or SSN, you are at risk of identity theft. Place a fraud alert or freeze on your credit reports immediately.'
  },
  {
    id: 'access',
    question: 'Did you change passwords if you provided them access to any accounts (Bank, social media, email etc)?',
    noAction: 'Change all your passwords immediately. Enable two-factor authentication (2FA) wherever possible, and check for any unrecognized recovery emails or phone numbers.'
  },
  {
    id: 'freeze',
    question: 'Did you freeze your credit if your identity was compromised?',
    noAction: 'Contact the three major credit bureaus (Equifax, Experian, TransUnion) to freeze your credit. This prevents scammers from opening new accounts in your name.'
  },
  {
    id: 'recovery',
    question: 'Have you ignored recovery agents who contacted you? (Recovery is just another form of Advanced Fee Fraud)',
    noAction: 'Do not trust anyone claiming they can recover your lost money for a fee. Legitimate agencies (like law enforcement) do not charge fees to help victims.'
  },
  {
    id: 'help',
    question: 'Have you reached out to a trusted family member or friend for technical help?',
    noAction: 'Reach out to them for help in securing your devices, changing passwords, and monitoring your accounts. A trusted contact can also provide emotional support.'
  },
  {
    id: 'social',
    question: 'Did you tighten up security/visibility on your social media accounts?',
    noAction: 'Set your social media profiles to private. Be cautious of friend requests from strangers or duplicated accounts of people you know.'
  }
];

export default function ShutdownPage() {
  const [answers, setAnswers] = useState<Record<string, 'yes' | 'no' | null>>({});

  const handleAnswer = (id: string, answer: 'yes' | 'no') => {
    setAnswers(prev => ({ ...prev, [id]: answer }));
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-200 pb-16 text-slate-700 dark:text-slate-300">
      <div className="max-w-4xl mx-auto px-4 pt-8">

        {/* Header Section */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 mb-6">
            <ShieldAlert className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white mb-4 uppercase tracking-wider border-l-4 border-red-500 pl-4">
            Scam Shutdown Checklist
          </h1>
          <p className="text-slate-500 dark:text-slate-400 max-w-2xl mx-auto text-lg">
            If you have been compromised, follow these next steps to shut down scammers and protect your identity.
          </p>
        </div>

        {/* Disclaimer */}
        <div className="mb-8 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 dark:text-amber-400">
            <strong>Disclaimer:</strong> These are recommendations based on previous interactions and it isn't a foolproof way to stop scammers. This is for educational purposes only.
          </p>
        </div>

        {/* Checklist */}
        <div className="space-y-6">
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
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white leading-snug">
                        {item.question}
                      </h3>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 ml-9 md:ml-0 md:flex-shrink-0">
                    <button
                      onClick={() => handleAnswer(item.id, 'yes')}
                      className={`px-6 py-2 rounded-lg font-medium transition-colors border ${
                        currentAnswer === 'yes'
                          ? 'bg-green-500 text-white border-green-500 hover:bg-green-600'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => handleAnswer(item.id, 'no')}
                      className={`px-6 py-2 rounded-lg font-medium transition-colors border ${
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
                    <p className={`text-sm ${
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

      </div>
    </div>
  );
}

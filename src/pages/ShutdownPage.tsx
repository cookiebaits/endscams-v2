import { useState } from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle } from 'lucide-react';

const CHECKLIST_ITEMS = [
  {
    id: 'police',
    question: 'File a police report',
    yesAction: 'If you answered yes, keep a copy of the police report. It will be helpful for disputing charges with your bank or freezing your credit.'
  },
  {
    id: 'phone',
    question: 'New Phone # / have they asked you to open a new phone line',
    yesAction: 'Do not open a new phone line for them. If your current number is compromised and you are receiving non-stop scam calls, consider changing your phone number.'
  },
  {
    id: 'bank',
    question: 'Report bank as victim of fraud',
    yesAction: 'Contact your bank immediately to report the fraud. They can help secure your accounts, issue new cards, and potentially reverse unauthorized transactions.'
  },
  {
    id: 'id',
    question: 'Did they give their ID or Social security number?',
    yesAction: 'If you provided your ID or SSN, you are at risk of identity theft. Place a fraud alert or freeze on your credit reports immediately.'
  },
  {
    id: 'access',
    question: 'Did they provide them with access to any of their accounts? Bank, social media, email etc.',
    yesAction: 'Change all your passwords immediately. Enable two-factor authentication (2FA) wherever possible, and check for any unrecognized recovery emails or phone numbers.'
  },
  {
    id: 'contact',
    question: 'Cut off all contacts with the scammer',
    yesAction: 'Block their phone numbers, email addresses, and social media accounts. Do not engage with them further, as they may try to manipulate or threaten you.'
  },
  {
    id: 'freeze',
    question: 'Freeze credit if identity has been provided.',
    yesAction: 'Contact the three major credit bureaus (Equifax, Experian, TransUnion) to freeze your credit. This prevents scammers from opening new accounts in your name.'
  },
  {
    id: 'recovery',
    question: 'Have you been contacted by any recovery agents? Recovery is just another form of Advanced Fee Fraud.',
    yesAction: 'Do not trust anyone claiming they can recover your lost money for a fee. Legitimate agencies (like law enforcement) do not charge fees to help victims.'
  },
  {
    id: 'help',
    question: 'Do they have a family member or friend with some technical knowledge that can help them.',
    yesAction: 'Reach out to them for help in securing your devices, changing passwords, and monitoring your accounts. A trusted contact can also provide emotional support.'
  },
  {
    id: 'social',
    question: 'Tighten up security/visibility on any Social media they have and stay vigilant.',
    yesAction: 'Set your social media profiles to private. Be cautious of friend requests from strangers or duplicated accounts of people you know.'
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
                          ? 'bg-red-500 text-white border-red-500 hover:bg-red-600'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => handleAnswer(item.id, 'no')}
                      className={`px-6 py-2 rounded-lg font-medium transition-colors border ${
                        currentAnswer === 'no'
                          ? 'bg-green-500 text-white border-green-500 hover:bg-green-600'
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
                      ? 'bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30'
                      : 'bg-green-50 dark:bg-green-950/20 border border-green-100 dark:border-green-900/30'
                  }`}>
                    {currentAnswer === 'yes' ? (
                      <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    )}
                    <p className={`text-sm ${
                      currentAnswer === 'yes'
                        ? 'text-red-800 dark:text-red-300'
                        : 'text-green-800 dark:text-green-300'
                    }`}>
                      {currentAnswer === 'yes' ? item.yesAction : 'No action needed.'}
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

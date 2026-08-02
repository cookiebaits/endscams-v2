'use strict';
import { useState } from 'react';
import { AlertTriangle, Phone, FileText, CheckCircle, Shield, Zap } from 'lucide-react';

type QuestionnaireAnswers = {
  ownsService: string | null;
  downloadRequest: string | null;
  personalInfoKnown: string | null;
  amount: string | null;
  hasCents: boolean;
  paymentMethod: string | null;
  companyName: string | null;
};

type ResultType = 'very-likely' | 'likely' | 'not-likely' | null;

export default function TriagePage() {
  const [currentQuestion, setCurrentQuestion] = useState(1);
  const [answers, setAnswers] = useState<QuestionnaireAnswers>({
    ownsService: null,
    downloadRequest: null,
    personalInfoKnown: null,
    amount: null,
    hasCents: false,
    paymentMethod: null,
    companyName: null,
  });
  const [resultType, setResultType] = useState<ResultType>(null);
  const [resultData, setResultData] = useState<{ flags: string[]; explanation: string; }>({ flags: [], explanation: '' });

  const handleAnswer = (questionNum: number, answer: string) => {
    const newAnswers = { ...answers };

    if (questionNum === 1) {
      newAnswers.ownsService = answer;
      if (answer === 'no') {
        showResult(
          'very-likely',
          ["You don't own the service/product they're contacting you about"],
          'Legitimate companies typically only contact existing customers about services they have. If you don\'t have an account with them, this is a major red flag.'
        );
        return;
      }
    } else if (questionNum === 2) {
      newAnswers.downloadRequest = answer;
      if (answer === 'yes') {
        showResult(
          'very-likely',
          ['They asked you to download software or files'],
          'Legitimate companies rarely ask you to download unsolicited software. This is a common tactic used by scammers to install malware or spyware on your device.'
        );
        return;
      }
    } else if (questionNum === 3) {
      newAnswers.personalInfoKnown = answer;
      if (answer === 'no') {
        showResult(
          'very-likely',
          ["They don't know any of your personal information"],
          'Legitimate companies have your account information and can verify your identity. Scammers often contact random people with generic messages.'
        );
        return;
      }
    }

    setAnswers(newAnswers);
    moveToNextQuestion();
  };

  const moveToNextQuestion = () => {
    setCurrentQuestion(prev => (prev < 6 ? prev + 1 : prev));
  };

  const handleAmountChange = (value: string) => {
    const hasCents = value.includes('.') && value.split('.')[1]?.length > 0;
    setAnswers(prev => ({ ...prev, amount: value, hasCents }));
  };

  const proceedFromAmount = () => {
    if (!answers.hasCents && answers.amount) {
      showResult(
        'likely',
        ['Amount is a whole number without cents'],
        'Legitimate businesses typically include sales tax in their pricing, resulting in amounts with cents. Whole dollar amounts can be suspicious.'
      );
      return;
    }
    moveToNextQuestion();
  };

  const selectPayment = (method: string) => {
    const dangerousMethods = ['bitcoin', 'gift-card', 'zelle', 'cash-app', 'bitcoin-atm', 'barcode', 'wire-transfer'];
    const methodNames: Record<string, string> = {
      'bitcoin': 'Bitcoin/Cryptocurrency',
      'gift-card': 'Gift Cards',
      'zelle': 'Zelle',
      'cash-app': 'Cash App',
      'bitcoin-atm': 'Bitcoin ATM',
      'barcode': 'Store Barcode/QR Code',
      'wire-transfer': 'Wire Transfer',
    };

    setAnswers(prev => ({ ...prev, paymentMethod: method }));

    if (dangerousMethods.includes(method)) {
      showResult(
        'very-likely',
        [`Requested payment via ${methodNames[method]}`],
        `Legitimate businesses never request payment through ${methodNames[method]}. These payment methods are preferred by scammers because they are difficult to trace and often irreversible.`
      );
      return;
    } else {
      moveToNextQuestion();
    }
  };

  const showResults = () => {
    const companyName = (document.getElementById('companyInput') as HTMLInputElement)?.value.trim() || '';
    setAnswers(prev => ({ ...prev, companyName }));

    const safePaymentMethods = ['credit-card'];
    const warningPaymentMethods = ['paypal', 'debit-card'];

    if (safePaymentMethods.includes(answers.paymentMethod || '')) {
      showResult(
        'not-likely',
        [
          'Payment method is credit card (has fraud protection)',
          'They know your personal information',
          'Amount includes cents (suggests legitimate business)',
        ],
        'The scenario shows several indicators of a legitimate business: they\'re using credit cards which offer fraud protection, they know your personal information, and the pricing includes cents.'
      );
    } else if (warningPaymentMethods.includes(answers.paymentMethod || '')) {
      showResult(
        'likely',
        ['Payment method offers limited protection', 'Additional verification recommended'],
        'While some indicators suggest legitimacy, the payment method offers limited consumer protection. Debit cards and PayPal transfers can be harder to reverse than credit card charges.'
      );
    }
  };

  const showResult = (type: ResultType, flags: string[], explanation: string) => {
    setResultType(type);
    setResultData({ flags, explanation });
  };

  const resetQuestionnaire = () => {
    setCurrentQuestion(1);
    setAnswers({
      ownsService: null,
      downloadRequest: null,
      personalInfoKnown: null,
      amount: null,
      hasCents: false,
      paymentMethod: null,
      companyName: null,
    });
    setResultType(null);
    setResultData({ flags: [], explanation: '' });
  };

  const progress = (currentQuestion / 6) * 100;

  if (resultType) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pt-20 pb-16">
        <div className="max-w-2xl mx-auto px-4">
          {resultType === 'very-likely' && (
            <div className="animate-slide-up">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 mb-5">
                  <AlertTriangle className="w-8 h-8 text-red-500" />
                </div>
                <h1 className="text-4xl font-black text-gray-900 dark:text-white mb-3">VERY LIKELY A SCAM</h1>
                <p className="text-gray-500 dark:text-gray-400">Immediate action recommended</p>
              </div>

              <div className="mb-6 rounded-xl border-2 border-red-500/30 bg-red-500/5 p-6">
                <div className="flex items-start gap-3 mb-3">
                  <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-red-600 dark:text-red-400 mb-2">🚨 EMERGENCY ACTION REQUIRED 🚨</h3>
                    <p className="text-sm text-red-600 dark:text-red-400">
                      Contact your local sheriff\'s non-emergency hotline NOW<br />
                      Do not send any money or share personal information
                    </p>
                  </div>
                </div>
              </div>

              <div className="card p-6 mb-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-red-500" />
                  Major Red Flags Detected
                </h3>
                <ul className="space-y-2">
                  {resultData.flags.map((flag, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="text-red-500 font-bold mt-1">⚠️</span>
                      <span className="text-gray-700 dark:text-gray-300">{flag}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="card p-6 mb-6 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50">
                <h3 className="font-bold text-amber-900 dark:text-amber-200 mb-3">Why This Is Likely A Scam</h3>
                <p className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed">{resultData.explanation}</p>
              </div>

              <div className="card p-6 mb-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Immediate Steps to Take</h3>
                <ul className="space-y-2">
                  {[
                    'Stop all communication immediately',
                    'Do not send any money or personal information',
                    'Contact your bank to block any pending transactions',
                    'Report to the FTC at ReportFraud.ftc.gov',
                    'Call your local sheriff\'s non-emergency hotline',
                    'Document all communications for evidence',
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="text-green-500 font-bold">✓</span>
                      <span className="text-gray-700 dark:text-gray-300">{step}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid sm:grid-cols-3 gap-3 mb-6">
                <a
                  href="https://search.brave.com/search?q=local+sheriff+non-emergency+hotline+near+me"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary flex items-center justify-center gap-2 py-3"
                >
                  <Phone className="w-4 h-4" />
                  Sheriff Hotline
                </a>
                <a
                  href="https://reportfraud.ftc.gov"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary flex items-center justify-center gap-2 py-3"
                >
                  <FileText className="w-4 h-4" />
                  Report to FTC
                </a>
                <button onClick={resetQuestionnaire} className="btn-primary py-3">
                  Start Over
                </button>
              </div>
            </div>
          )}

          {resultType === 'likely' && (
            <div className="animate-slide-up">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/10 mb-5">
                  <AlertTriangle className="w-8 h-8 text-amber-500" />
                </div>
                <h1 className="text-4xl font-black text-gray-900 dark:text-white mb-3">LIKELY A SCAM</h1>
                <p className="text-gray-500 dark:text-gray-400">Exercise extreme caution</p>
              </div>

              <div className="card p-6 mb-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  Warning Signs Detected
                </h3>
                <ul className="space-y-2">
                  {resultData.flags.map((flag, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="text-amber-500 font-bold">⚠️</span>
                      <span className="text-gray-700 dark:text-gray-300">{flag}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="card p-6 mb-6 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50">
                <h3 className="font-bold text-amber-900 dark:text-amber-200 mb-3">Why This Raises Concern</h3>
                <p className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed">{resultData.explanation}</p>
              </div>

              <div className="card p-6 mb-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Recommended Actions</h3>
                <ul className="space-y-2">
                  {[
                    'Verify the company independently through official channels',
                    'Do not provide additional personal information',
                    'Contact the company using their official website or phone number',
                    'Consult with trusted family or friends before proceeding',
                    'Consider calling your local sheriff\'s non-emergency hotline for guidance',
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="text-amber-500 font-bold">→</span>
                      <span className="text-gray-700 dark:text-gray-300">{step}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 mb-6">
                <a
                  href="https://search.brave.com/search?q=local+sheriff+non-emergency+hotline+near+me"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary flex items-center justify-center gap-2 py-3"
                >
                  <Phone className="w-4 h-4" />
                  Sheriff Hotline
                </a>
                <button onClick={resetQuestionnaire} className="btn-primary py-3">
                  Start Over
                </button>
              </div>
            </div>
          )}

          {resultType === 'not-likely' && (
            <div className="animate-slide-up">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mb-5">
                  <CheckCircle className="w-8 h-8 text-green-500" />
                </div>
                <h1 className="text-4xl font-black text-gray-900 dark:text-white mb-3">NOT LIKELY A SCAM</h1>
                <p className="text-gray-500 dark:text-gray-400">But still exercise caution</p>
              </div>

              <div className="card p-6 mb-6 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900/50">
                <h3 className="font-bold text-green-900 dark:text-green-200 mb-3">Positive Indicators</h3>
                <p className="text-sm text-green-900 dark:text-green-200 leading-relaxed">{resultData.explanation}</p>
              </div>

              <div className="card p-6 mb-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Continue to Exercise Caution</h3>
                <ul className="space-y-2">
                  {[
                    'Always verify requests independently',
                    'Never share passwords or verification codes',
                    'Monitor your accounts for unusual activity',
                    'Be wary of high-pressure tactics or rushed decisions',
                    'If anything feels wrong, trust your instincts and verify',
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="text-green-500 font-bold">✓</span>
                      <span className="text-gray-700 dark:text-gray-300">{step}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 mb-6">
                <a
                  href="https://search.brave.com/search?q=local+sheriff+non-emergency+hotline+near+me"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary flex items-center justify-center gap-2 py-3"
                >
                  <Phone className="w-4 h-4" />
                  Save Sheriff Number
                </a>
                <button onClick={resetQuestionnaire} className="btn-primary py-3">
                  Start Over
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pt-20 pb-16">
      <div className="max-w-2xl mx-auto px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-brand-500/10 mb-5">
            <Shield className="w-7 h-7 text-brand-500" />
          </div>
          <h1 className="text-4xl font-black text-gray-900 dark:text-white mb-3">Scam Detection Questionnaire</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Answer a few quick questions to help determine if you\'re dealing with a scam.
          </p>
        </div>

        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Question {currentQuestion} of 6</span>
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">{Math.round(progress)}%</span>
          </div>
          <div className="w-full h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand-500 to-purple-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="mb-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50">
          <p className="text-xs text-amber-900 dark:text-amber-200">
            <strong>⚠️ IMPORTANT DISCLAIMER:</strong> This questionnaire is for educational reference only and results are not guaranteed. Scam detection requires professional judgment and verification.
          </p>
        </div>

        {currentQuestion === 1 && (
          <div className="card p-6 md:p-8 animate-slide-up">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-brand-500 text-white flex items-center justify-center font-bold text-sm">1</div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Do you own this service, have an account with, or own the product they're contacting you about?
              </h2>
            </div>
            <div className="space-y-3 mt-6">
              <button
                onClick={() => handleAnswer(1, 'yes')}
                className="w-full p-4 text-left bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-800 rounded-xl hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-950/20 transition-all"
              >
                <span className="font-medium text-gray-900 dark:text-white">Yes</span>
              </button>
              <button
                onClick={() => handleAnswer(1, 'no')}
                className="w-full p-4 text-left bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-800 rounded-xl hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-950/20 transition-all"
              >
                <span className="font-medium text-gray-900 dark:text-white">No</span>
              </button>
            </div>
          </div>
        )}

        {currentQuestion === 2 && (
          <div className="card p-6 md:p-8 animate-slide-up">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-brand-500 text-white flex items-center justify-center font-bold text-sm">2</div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Are they asking you to download any software, apps, or files?
              </h2>
            </div>
            <div className="space-y-3 mt-6">
              <button
                onClick={() => handleAnswer(2, 'yes')}
                className="w-full p-4 text-left bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-800 rounded-xl hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-950/20 transition-all"
              >
                <span className="font-medium text-gray-900 dark:text-white">Yes</span>
              </button>
              <button
                onClick={() => handleAnswer(2, 'no')}
                className="w-full p-4 text-left bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-800 rounded-xl hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-950/20 transition-all"
              >
                <span className="font-medium text-gray-900 dark:text-white">No</span>
              </button>
            </div>
          </div>
        )}

        {currentQuestion === 3 && (
          <div className="card p-6 md:p-8 animate-slide-up">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-brand-500 text-white flex items-center justify-center font-bold text-sm">3</div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Do they know your address or any personal information besides your name?
              </h2>
            </div>
            <div className="space-y-3 mt-6">
              <button
                onClick={() => handleAnswer(3, 'yes')}
                className="w-full p-4 text-left bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-800 rounded-xl hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-950/20 transition-all"
              >
                <span className="font-medium text-gray-900 dark:text-white">Yes, they know my personal details</span>
              </button>
              <button
                onClick={() => handleAnswer(3, 'partial')}
                className="w-full p-4 text-left bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-800 rounded-xl hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-950/20 transition-all"
              >
                <span className="font-medium text-gray-900 dark:text-white">They only know my name/email</span>
              </button>
              <button
                onClick={() => handleAnswer(3, 'no')}
                className="w-full p-4 text-left bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-800 rounded-xl hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-950/20 transition-all"
              >
                <span className="font-medium text-gray-900 dark:text-white">No, they don\'t know any of my information</span>
              </button>
            </div>
          </div>
        )}

        {currentQuestion === 4 && (
          <div className="card p-6 md:p-8 animate-slide-up">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-brand-500 text-white flex items-center justify-center font-bold text-sm">4</div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">How much money are they asking for? (Include Dollar and Cents)</h2>
            </div>
            <div className="mt-6">
              <input
                id="amountInput"
                type="text"
                placeholder="Enter amount (e.g., $500.00)"
                onChange={(e) => handleAmountChange(e.target.value)}
                value={answers.amount || ''}
                className="input-field w-full mb-4"
              />
              {!answers.hasCents && answers.amount && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mb-4 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>Legitimate businesses typically charge sales tax and include cents. Whole dollar amounts can be suspicious.</span>
                </p>
              )}
              <button onClick={proceedFromAmount} className="btn-primary w-full py-3">
                Continue
              </button>
            </div>
          </div>
        )}

        {currentQuestion === 5 && (
          <div className="card p-6 md:p-8 animate-slide-up">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-brand-500 text-white flex items-center justify-center font-bold text-sm">5</div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">What payment method are they requesting?</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
              <button
                onClick={() => selectPayment('credit-card')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  answers.paymentMethod === 'credit-card'
                    ? 'border-green-500 bg-green-50 dark:bg-green-950/20'
                    : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 hover:border-green-500'
                }`}
              >
                <span className="font-medium text-gray-900 dark:text-white">💳 Credit Card</span>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">Safer option</p>
              </button>
              <button
                onClick={() => selectPayment('debit-card')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  answers.paymentMethod === 'debit-card'
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/20'
                    : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 hover:border-amber-500'
                }`}
              >
                <span className="font-medium text-gray-900 dark:text-white">💳 Debit Card</span>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Limited protection</p>
              </button>
              <button
                onClick={() => selectPayment('paypal')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  answers.paymentMethod === 'paypal'
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/20'
                    : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 hover:border-amber-500'
                }`}
              >
                <span className="font-medium text-gray-900 dark:text-white">💰 PayPal</span>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Limited protection</p>
              </button>
              <button
                onClick={() => selectPayment('bitcoin')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  answers.paymentMethod === 'bitcoin'
                    ? 'border-red-500 bg-red-50 dark:bg-red-950/20'
                    : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 hover:border-red-500'
                }`}
              >
                <span className="font-medium text-gray-900 dark:text-white">₿ Bitcoin/Crypto</span>
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">High risk</p>
              </button>
              <button
                onClick={() => selectPayment('gift-card')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  answers.paymentMethod === 'gift-card'
                    ? 'border-red-500 bg-red-50 dark:bg-red-950/20'
                    : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 hover:border-red-500'
                }`}
              >
                <span className="font-medium text-gray-900 dark:text-white">🎁 Gift Cards</span>
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">High risk</p>
              </button>
              <button
                onClick={() => selectPayment('zelle')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  answers.paymentMethod === 'zelle'
                    ? 'border-red-500 bg-red-50 dark:bg-red-950/20'
                    : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 hover:border-red-500'
                }`}
              >
                <span className="font-medium text-gray-900 dark:text-white">💸 Zelle</span>
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">High risk</p>
              </button>
              <button
                onClick={() => selectPayment('cash-app')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  answers.paymentMethod === 'cash-app'
                    ? 'border-red-500 bg-red-50 dark:bg-red-950/20'
                    : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 hover:border-red-500'
                }`}
              >
                <span className="font-medium text-gray-900 dark:text-white">💵 Cash App</span>
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">High risk</p>
              </button>
              <button
                onClick={() => selectPayment('wire-transfer')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  answers.paymentMethod === 'wire-transfer'
                    ? 'border-red-500 bg-red-50 dark:bg-red-950/20'
                    : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 hover:border-red-500'
                }`}
              >
                <span className="font-medium text-gray-900 dark:text-white">🏦 Wire Transfer</span>
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">High risk</p>
              </button>
            </div>
          </div>
        )}

        {currentQuestion === 6 && (
          <div className="card p-6 md:p-8 animate-slide-up">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-brand-500 text-white flex items-center justify-center font-bold text-sm">6</div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">What company name do they claim to be from?</h2>
            </div>
            <div className="mt-6">
              <input
                id="companyInput"
                type="text"
                placeholder="Enter company name"
                className="input-field w-full mb-4"
              />
              <button onClick={showResults} className="btn-primary w-full py-3">
                Get Results
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

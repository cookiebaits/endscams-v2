import React, { useState } from 'react';
import { AlertTriangle, DollarSign, TrendingUp, Users, Shield, ChevronDown, ChevronUp, ExternalLink, Info } from 'lucide-react';

const FTC_TOTAL_LOSS = '$12.5 billion';
const FTC_TOTAL_REPORTS = '2.8 million';
const FTC_SOURCE = 'https://www.ftc.gov/reports/consumer-sentinel-network';
const FTC_REPORT_URL = 'https://reportfraud.ftc.gov/';

const TOP_SCAMS = [
  {
    rank: 1,
    title: 'Imposter Scams',
    lossAmount: '$2.95B',
    reports: 854000,
    description: 'Scammers impersonate government agencies (IRS, SSA, Medicare), well-known companies (Amazon, Microsoft, banks), or even friends and family to steal money or personal information.',
    tips: [
      'Government agencies never demand immediate payment or gift cards.',
      'Verify caller identity by hanging up and calling the official number directly.',
      'Never wire money or send crypto to someone claiming to be from the government.',
      'Do not share Social Security numbers over unsolicited calls.',
    ],
    source: 'https://www.ftc.gov/news-events/data-visualizations/data-spotlight/2024/01/imposter-scams-top-2023-reports-ftc',
  },
  {
    rank: 2,
    title: 'Investment Scams (Crypto & Pig Butchering)',
    lossAmount: '$2.73B',
    reports: 117000,
    description: 'Fraudulent investment schemes including cryptocurrency fraud, "pig butchering" romance investment scams, and fake trading platforms promise unrealistic returns before stealing funds.',
    tips: [
      'If it promises guaranteed high returns, it\'s a scam.',
      'Never invest money you cannot afford to lose through unregulated platforms.',
      'Research any investment platform on SEC.gov and FINRA.org.',
      'Be skeptical of romantic partners pushing investment opportunities.',
    ],
    source: 'https://www.ftc.gov/reports/investment-scams',
  },
  {
    rank: 3,
    title: 'Online Shopping Scams',
    lossAmount: '$392M',
    reports: 380000,
    description: 'Fake online stores, counterfeit goods, non-delivery of products, and bogus sellers on social media platforms and marketplaces like Facebook Marketplace.',
    tips: [
      'Research sellers and check reviews before purchasing.',
      'Pay with credit cards for buyer protection — never wire transfers.',
      'Be cautious of deals that seem too good to be true.',
      'Verify website security (HTTPS) and physical address.',
    ],
    source: 'https://www.ftc.gov/news-events/news/press-releases/2024/02/ftc-releases-2023-consumer-sentinel-network-data-book',
  },
  {
    rank: 4,
    title: 'Tech Support Scams',
    lossAmount: '$924M',
    reports: 146000,
    description: 'Scammers pose as tech support from Microsoft, Apple, or other companies claiming your device is infected. They gain remote access and steal financial information or charge for fake services.',
    tips: [
      'Legitimate companies do not make unsolicited tech support calls.',
      'Never allow remote access to your computer from an unsolicited caller.',
      'Pop-up warnings claiming your computer is infected are scams.',
      'Never pay for tech support with gift cards or wire transfers.',
    ],
    source: 'https://www.ftc.gov/news-events/data-visualizations/data-spotlight/2022/10/tech-support-scams',
  },
  {
    rank: 5,
    title: 'Prize, Sweepstakes & Lottery Scams',
    lossAmount: '$255M',
    reports: 158000,
    description: 'You\'ve "won" a lottery, sweepstakes, or prize — but you must pay fees, taxes, or processing charges first. Publisher\'s Clearing House, foreign lotteries, and mega prize scams.',
    tips: [
      'You cannot win a contest you never entered.',
      'Never pay fees upfront to claim a prize — legitimate winnings have no advance fees.',
      'Publishers Clearing House does not notify winners by phone demanding payment.',
      'Foreign lottery winnings that require fees are always scams.',
    ],
    source: 'https://consumer.ftc.gov/articles/prize-sweepstakes-lottery-scams',
  },
  {
    rank: 6,
    title: 'Romance Scams',
    lossAmount: '$1.14B',
    reports: 64000,
    description: 'Scammers build fake romantic relationships online then ask for money, often claiming emergencies, medical crises, or investment opportunities. Highest reported losses per victim.',
    tips: [
      'Be wary of online relationships that never meet in person.',
      'Never send money to someone you\'ve only met online.',
      'Research profile photos using reverse image search.',
      'Report suspicious profiles to the platform immediately.',
    ],
    source: 'https://consumer.ftc.gov/articles/what-you-need-know-about-romance-scams',
  },
  {
    rank: 7,
    title: 'Business & Employment Opportunity Scams',
    lossAmount: '$316M',
    reports: 99000,
    description: 'Fake job offers requiring upfront payment, work-from-home reshipping schemes, fake check scams, pyramid schemes, and fraudulent franchise or business opportunity offers.',
    tips: [
      'Legitimate employers never ask for upfront payments.',
      'Be skeptical of high-paying jobs with minimal qualifications required.',
      'Research companies thoroughly on the BBB and Glassdoor.',
      'Reshipping or check cashing jobs are almost always money laundering schemes.',
    ],
    source: 'https://consumer.ftc.gov/articles/job-scams',
  },
  {
    rank: 8,
    title: 'Identity Theft',
    lossAmount: '$819M',
    reports: 1100000,
    description: 'Theft of personal information including Social Security numbers, credit card data, and account credentials used to open fraudulent accounts or file false tax returns.',
    tips: [
      'Monitor your credit reports regularly at AnnualCreditReport.com.',
      'Place a credit freeze if you suspect your information was compromised.',
      'Use unique, strong passwords and enable two-factor authentication.',
      'Report identity theft at IdentityTheft.gov for a personalized recovery plan.',
    ],
    source: 'https://www.identitytheft.gov/',
  },
  {
    rank: 9,
    title: 'Debt Collection Scams',
    lossAmount: '$131M',
    reports: 93000,
    description: 'Fake debt collectors threaten lawsuits, arrest, or wage garnishment for debts that may not exist or are time-barred. They pressure victims into paying immediately.',
    tips: [
      'Legitimate debt collectors must send written validation notices.',
      'Request debt validation in writing before paying anything.',
      'Know your rights under the Fair Debt Collection Practices Act (FDCPA).',
      'Never pay debts via wire transfer, prepaid cards, or cryptocurrency.',
    ],
    source: 'https://consumer.ftc.gov/articles/debt-collection',
  },
  {
    rank: 10,
    title: 'Health Care & Medical Scams',
    lossAmount: '$178M',
    reports: 112000,
    description: 'Fake health insurance, COVID-19 test kit fraud, bogus Medicare supplement plans, unproven treatments, and medical equipment scams targeting seniors.',
    tips: [
      'Verify Medicare or insurance offers directly with the provider.',
      'Do not give Medicare or insurance numbers to unsolicited callers.',
      'Consult licensed healthcare providers before purchasing any treatment.',
      'Report Medicare fraud at 1-800-MEDICARE or HHS OIG hotline.',
    ],
    source: 'https://consumer.ftc.gov/features/fighting-back-against-scams',
  },
];

export default function FTCScamsPage() {
  const [expanded, setExpanded] = useState<number | null>(null);

  const toggle = (rank: number) => setExpanded(e => (e === rank ? null : rank));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pt-20 pb-16">
      <div className="max-w-5xl mx-auto px-4">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-500/10 mb-6">
            <AlertTriangle className="w-8 h-8 text-brand-500" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white mb-4">FTC Top Scams 2026</h1>
          <p className="text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
            The Federal Trade Commission's most reported consumer fraud categories. Data from the Consumer Sentinel Network.
          </p>
          <a
            href={FTC_SOURCE}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-4 text-sm text-brand-500 hover:underline"
          >
            <ExternalLink className="w-4 h-4" />
            Source: FTC Consumer Sentinel Network Data Book
          </a>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <StatCard icon={DollarSign} label="Total Consumer Losses" value={FTC_TOTAL_LOSS} color="text-red-500" />
          <StatCard icon={Users} label="Total Reports Filed" value={FTC_TOTAL_REPORTS} color="text-blue-500" />
          <StatCard icon={TrendingUp} label="YoY Increase" value="+14%" color="text-yellow-500" />
          <StatCard icon={Shield} label="Median Loss/Victim" value="$500" color="text-green-500" />
        </div>

        <div className="card p-4 mb-8 flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Data reflects reports submitted to the FTC through the Consumer Sentinel Network for the most recent reporting period. Total losses represent amounts reported — actual losses are likely higher.
            <a href={FTC_SOURCE} target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:underline ml-1">View the full FTC data book.</a>
          </p>
        </div>

        <div className="space-y-3">
          {TOP_SCAMS.map(scam => (
            <ScamCard key={scam.rank} scam={scam} isExpanded={expanded === scam.rank} onToggle={() => toggle(scam.rank)} />
          ))}
        </div>

        <div className="mt-12 card p-6 text-center">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Been Targeted by a Scam?</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Report it to protect others and help track fraud patterns.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <a href={FTC_REPORT_URL} target="_blank" rel="noopener noreferrer" className="btn-primary inline-flex items-center gap-2 text-sm">
              <ExternalLink className="w-4 h-4" />Report to FTC
            </a>
            <a href="https://www.ic3.gov/Home/ComplaintChoice" target="_blank" rel="noopener noreferrer" className="btn-outline inline-flex items-center gap-2 text-sm">
              <ExternalLink className="w-4 h-4" />Report to FBI IC3
            </a>
            <a href="/report" className="btn-outline inline-flex items-center gap-2 text-sm">
              Report to EndScams
            </a>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-600 mt-4">
            Source: <a href={FTC_SOURCE} target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:underline">FTC Consumer Sentinel Network</a> | Updated based on most recent available data.
          </p>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <div className="card p-4">
      <Icon className={`w-6 h-6 ${color} mb-2`} />
      <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</div>
    </div>
  );
}

function ScamCard({ scam, isExpanded, onToggle }: { scam: typeof TOP_SCAMS[0]; isExpanded: boolean; onToggle: () => void }) {
  const rankColors = ['bg-red-500', 'bg-red-400', 'bg-orange-500', 'bg-orange-400', 'bg-yellow-500', 'bg-yellow-400', 'bg-blue-500', 'bg-blue-400', 'bg-teal-500', 'bg-teal-400'];

  return (
    <div className={`card overflow-hidden transition-all duration-300 ${isExpanded ? 'border-brand-500/50' : ''}`}>
      <button
        onClick={onToggle}
        className="w-full p-5 flex items-center justify-between text-left hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-full ${rankColors[scam.rank - 1] || 'bg-gray-500'} flex items-center justify-center flex-shrink-0`}>
            <span className="text-white font-black text-sm">#{scam.rank}</span>
          </div>
          <div className="text-left">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{scam.title}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 hidden sm:block line-clamp-1">{scam.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0 ml-4">
          <div className="text-right hidden md:block">
            <div className="text-red-500 font-bold text-sm">{scam.lossAmount}</div>
            <div className="text-xs text-gray-400">{scam.reports.toLocaleString()} reports</div>
          </div>
          {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </div>
      </button>

      {isExpanded && (
        <div className="px-5 pb-5 border-t border-gray-200 dark:border-gray-800 animate-fade-in">
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-4 sm:hidden mb-4">{scam.description}</p>
          <div className="md:hidden flex justify-between text-sm my-4">
            <span className="text-red-500 font-bold">Losses: {scam.lossAmount}</span>
            <span className="text-gray-500">{scam.reports.toLocaleString()} reports</span>
          </div>
          <div className="grid md:grid-cols-2 gap-6 mt-4">
            <div>
              <h4 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2 text-sm">
                <Shield className="w-4 h-4 text-brand-500" />How to Protect Yourself
              </h4>
              <ul className="space-y-2">
                {scam.tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-2 flex-shrink-0" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-gray-900 dark:text-white mb-3 text-sm">Resources & Sources</h4>
              <div className="space-y-3">
                <a href={scam.source} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-brand-500 hover:underline">
                  <ExternalLink className="w-4 h-4" />FTC Source: {scam.title}
                </a>
                <a href={FTC_REPORT_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-brand-500 hover:underline">
                  <ExternalLink className="w-4 h-4" />Report This Scam to the FTC
                </a>
                <a href="https://www.bbb.org/scamtracker" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-brand-500 hover:underline">
                  <ExternalLink className="w-4 h-4" />BBB Scam Tracker
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

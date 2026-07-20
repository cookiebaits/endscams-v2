import React, { useState } from 'react';
import { AlertTriangle, DollarSign, TrendingUp, Users, Shield, ChevronDown, ChevronUp, ExternalLink, Info } from 'lucide-react';


const FTC_SOURCE = 'https://www.ftc.gov/terms/consumer-sentinel-network';
const FTC_REPORT_URL = 'https://reportfraud.ftc.gov/';

const TOP_SCAMS = [
  {
    rank: 1,
    title: 'Imposter Scams',
    lossAmount: '>$3.5B',
    reports: 1000000,
    description: 'The most frequently reported fraud since 2020. Scammers impersonate government agencies, businesses, or individuals to steal money. Highest frequency of reports.',
    tips: [
      'Government agencies and legitimate businesses never demand immediate payment via gift cards or crypto.',
      'Verify caller identity by hanging up and calling the official number directly.',
      'Do not share Social Security numbers over unsolicited calls.',
    ],
    source: 'https://www.ftc.gov/terms/consumer-sentinel-network',
    govResources: [
      { label: 'USA.gov — Government Impersonator Scams', url: 'https://www.usa.gov/government-impersonator' },
    ],
  },
  {
    rank: 2,
    title: 'Investment Scams',
    lossAmount: '>$7.9B',
    reports: 0,
    description: 'Fraudulent investment schemes account for half of all total reported fraud losses. The average individual loss is over $10,000.',
    tips: [
      'If it promises guaranteed high returns, it\'s a scam.',
      'Never invest money you cannot afford to lose through unregulated platforms.',
      'Be skeptical of romantic partners pushing investment opportunities.',
    ],
    source: 'https://www.ftc.gov/terms/consumer-sentinel-network',
    govResources: [
      { label: 'SEC — Report Investment Fraud', url: 'https://www.sec.gov/tcr' },
    ],
  },
  {
    rank: 3,
    title: 'Social Media Scams',
    lossAmount: '>$2.0B',
    reports: 0,
    description: 'Social media is the top contact method by aggregate reported losses. Scammers use these platforms to initiate romance, investment, and shopping fraud.',
    tips: [
      'Be wary of online relationships that never meet in person.',
      'Research sellers and check reviews before purchasing via social media ads.',
      'Verify the identity of friends asking for money via direct message.',
    ],
    source: 'https://www.ftc.gov/terms/consumer-sentinel-network',
    govResources: [
      { label: 'FBI IC3 — Internet Crime Complaint Center', url: 'https://www.ic3.gov/Home/ComplaintChoice' },
    ],
  }
];

export default function FTCScamsPage() {
  const [expanded, setExpanded] = useState<number | null>(null);
  // Hardcoded stats based on March 2026 testimony (reporting 2025 data)
  const stats = {
    total_loss: '$15.9B',
    total_reports: '3M',
    yoy_increase: '32.5%', // Calculated from 12B to 15.9B
    median_loss: '>$10k (Inv)' // Average individual loss for investment scams
  };

  const toggle = (rank: number) => setExpanded(e => (e === rank ? null : rank));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pt-20 pb-16">
      <div className="max-w-5xl mx-auto px-4">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-500/10 mb-6">
            <AlertTriangle className="w-8 h-8 text-brand-500" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white mb-4">FTC Latest Scam Reports</h1>
          <p className="text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
            The Federal Trade Commission's most reported consumer fraud categories for 2025 (reported March 2026). Data from the Consumer Sentinel Network.
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
          <StatCard icon={DollarSign} label="Total Consumer Losses" value={stats.total_loss} color="text-red-500" />
          <StatCard icon={Users} label="Total Reports Filed" value={stats.total_reports} color="text-blue-500" />
          <StatCard icon={TrendingUp} label="YoY Increase" value={stats.yoy_increase} color="text-yellow-500" />
          <StatCard icon={Shield} label="Median Loss/Victim" value={stats.median_loss} color="text-green-500" />
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
              <div className="space-y-2">
                <a href={scam.source} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-brand-500 hover:underline font-medium">
                  <ExternalLink className="w-4 h-4 flex-shrink-0" />FTC — {scam.title}
                </a>
                <a href={FTC_REPORT_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-brand-500 hover:underline">
                  <ExternalLink className="w-4 h-4 flex-shrink-0" />ReportFraud.ftc.gov
                </a>
                {scam.govResources.map((r, i) => (
                  <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-brand-500 dark:hover:text-brand-400 transition-colors">
                    <ExternalLink className="w-4 h-4 flex-shrink-0 mt-0.5" />{r.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

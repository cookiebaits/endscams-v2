import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Phone, Shield, Radar, AlertTriangle, BookOpen, ExternalLink, CheckCircle, XCircle, Loader2, DollarSign, Clock, XOctagon } from 'lucide-react';
import { supabase, normalizePhone, formatPhoneDisplay, isTollFree } from '../lib/supabase';

type ImpactStats = {
  money_saved: number;
  scammer_hours_wasted: number;
  resources_shutdown: number;
};

function normalizeInput(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 10);
}

function formatTyping(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

type SearchResult = {
  found: boolean;
  reports: Array<{ id: string; category: string; description: string; incident_date: string; source: string; source_url?: string }>;
  trackerEntries: Array<{ id: string; source_name: string; source_url: string; report_date: string; category?: string; description?: string }>;
};

export default function HomePage() {
  const [input, setInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [searched, setSearched] = useState(false);
  const [searchedDigits, setSearchedDigits] = useState('');
  const [impactStats, setImpactStats] = useState<ImpactStats | null>(null);

  useEffect(() => {
    const fetchImpactStats = async () => {
      const { data } = await supabase
        .from('impact_statistics')
        .select('money_saved, scammer_hours_wasted, resources_shutdown')
        .order('last_updated', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setImpactStats(data);
      }
    };

    const updateStats = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-impact-stats`,
          {
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
          }
        );
        await response.json();
      } catch (error) {
        console.error('Failed to update stats:', error);
      }
    };

    fetchImpactStats();
    updateStats();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(formatTyping(e.target.value));
    setResult(null);
    setSearched(false);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = normalizeInput(input);
    if (digits.length < 10) return;

    setSearching(true);
    setSearched(false);
    setSearchedDigits(digits);

    try {
      const [reportsRes, trackerRes] = await Promise.all([
        supabase.from('scam_reports').select('id,category,description,incident_date,source,source_url').eq('phone_digits', digits).gt('expires_at', new Date().toISOString()).order('incident_date', { ascending: false }),
        supabase.from('tracker_entries').select('id,source_name,source_url,report_date,category,description').eq('phone_digits', digits).gt('expires_at', new Date().toISOString()).order('report_date', { ascending: false }),
      ]);

      const reports = reportsRes.data || [];
      const trackerEntries = trackerRes.data || [];
      setResult({ found: reports.length > 0 || trackerEntries.length > 0, reports, trackerEntries });
    } catch {
      setResult({ found: false, reports: [], trackerEntries: [] });
    } finally {
      setSearching(false);
      setSearched(true);
    }
  };

  const buildSearchUrl = (engine: string, digits: string) => {
    const formatted = formatPhoneDisplay(digits);
    const dashes = `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`;
    const q = encodeURIComponent(`"${formatted}" OR "${dashes}" OR "${digits}" scam`);
    if (engine === 'google') return `https://www.google.com/search?q=${q}`;
    if (engine === 'bing') return `https://www.bing.com/search?q=${q}`;
    return `https://search.brave.com/search?q=${q}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <section className="relative pt-24 pb-20 overflow-hidden">
        <div
          className="absolute inset-0 opacity-30 dark:opacity-20"
          style={{ backgroundImage: `url('https://images.pexels.com/photos/5380664/pexels-photo-5380664.jpeg?auto=compress&cs=tinysrgb&w=1920')`, backgroundSize: 'cover', backgroundPosition: 'center' }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/80 via-gray-50/90 to-gray-50 dark:from-gray-950/80 dark:via-gray-950/90 dark:to-gray-950" />

        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-brand-500/10 border border-brand-500/30 rounded-full text-brand-500 text-sm font-medium mb-8">
            <Shield className="w-4 h-4" />
            CyberScam Watch Dog Network
          </div>

          <h1 className="text-5xl md:text-7xl font-black mb-6 text-gray-900 dark:text-white leading-tight tracking-tight">
            End Scams Through<br />
            <span className="text-brand-500">Education</span>
          </h1>

          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 mb-10 max-w-2xl mx-auto">
            Search any phone number in our database. We cross-reference reports from multiple sources to help you stay protected.
          </p>

          <form onSubmit={handleSearch} className="max-w-2xl mx-auto mb-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="(555) 123-4567"
                  value={input}
                  onChange={handleChange}
                  maxLength={14}
                  className="input-field pl-12 h-14 text-lg rounded-xl"
                />
              </div>
              <button
                type="submit"
                disabled={normalizeInput(input).length < 10 || searching}
                className="btn-primary h-14 px-8 rounded-xl text-base"
              >
                {searching ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Search className="w-5 h-5 mr-2 inline-block" />Search</>}
              </button>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-left pl-1">
              Accepts: (555) 123-4567 &nbsp;|&nbsp; 555-123-4567 &nbsp;|&nbsp; 5551234567
            </p>
          </form>

          {searching && (
            <div className="max-w-2xl mx-auto mt-6 p-6 card text-center animate-fade-in">
              <Loader2 className="w-8 h-8 text-brand-500 mx-auto mb-2 animate-spin" />
              <p className="text-gray-600 dark:text-gray-400">Searching our database...</p>
            </div>
          )}

          {searched && !searching && result && (
            <div className="max-w-2xl mx-auto mt-6 animate-slide-up space-y-4">
              {result.found ? (
                <div className="card p-6 border-2 border-brand-500/50 bg-red-50 dark:bg-red-950/20">
                  <div className="flex items-center gap-3 mb-4">
                    <XCircle className="w-8 h-8 text-red-500 flex-shrink-0" />
                    <div className="text-left">
                      <p className="font-bold text-red-600 dark:text-red-400 text-lg">Warning — This number has been reported</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Found {result.reports.length + result.trackerEntries.length} report(s) for {formatPhoneDisplay(searchedDigits)}
                      </p>
                    </div>
                  </div>

                  {result.reports.map(r => (
                    <ReportCard key={r.id} label={r.category} date={r.incident_date} description={r.description} sourceName="User Report" sourceUrl={r.source_url} />
                  ))}
                  {result.trackerEntries.map(t => (
                    <ReportCard key={t.id} label={t.category || 'Scam'} date={t.report_date} description={t.description || ''} sourceName={t.source_name} sourceUrl={t.source_url} />
                  ))}
                </div>
              ) : (
                <div className="card p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <CheckCircle className="w-8 h-8 text-green-500 flex-shrink-0" />
                    <div className="text-left">
                      <p className="font-bold text-green-600 dark:text-green-400 text-lg">Not found in our database</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        We could not match any records for {formatPhoneDisplay(searchedDigits)} in our database. For a deeper search, check the sources below.
                      </p>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-3 mt-4">
                    {(['google', 'bing', 'brave'] as const).map(engine => (
                      <a
                        key={engine}
                        href={buildSearchUrl(engine, searchedDigits)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg font-medium text-sm text-gray-700 dark:text-gray-300 transition-all"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Search {engine.charAt(0).toUpperCase() + engine.slice(1)}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {result.found && (
                <div className="card p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Search deeper with external sources:</p>
                  <div className="grid sm:grid-cols-3 gap-3">
                    {(['google', 'bing', 'brave'] as const).map(engine => (
                      <a
                        key={engine}
                        href={buildSearchUrl(engine, searchedDigits)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg font-medium text-sm text-gray-700 dark:text-gray-300 transition-all"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Search {engine.charAt(0).toUpperCase() + engine.slice(1)}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="section-title text-center mb-4">Our Impact</h2>
          <p className="section-subtitle text-center mb-12">
            Together, we're making a real difference in the fight against scammers.
          </p>
          {impactStats ? (
            <div className="grid md:grid-cols-3 gap-6">
              <ImpactCard
                icon={DollarSign}
                value={`$${impactStats.money_saved.toLocaleString('en-US')}`}
                label="Estimated Money Saved"
                description="Total dollars protected from scammer hands"
                color="text-green-500"
                bgColor="bg-green-500/10"
              />
              <ImpactCard
                icon={Clock}
                value={`${impactStats.scammer_hours_wasted.toLocaleString('en-US')} hrs`}
                label="Scammer Time Wasted"
                description="Hours of scammer resources exhausted"
                color="text-blue-500"
                bgColor="bg-blue-500/10"
              />
              <ImpactCard
                icon={XOctagon}
                value={impactStats.resources_shutdown.toLocaleString()}
                label="Resources Shutdown"
                description="Number of confirmed website, phone and finance shutdown"
                color="text-red-500"
                bgColor="bg-red-500/10"
              />
            </div>
          ) : (
            <div className="text-center">
              <Loader2 className="w-8 h-8 text-brand-500 mx-auto mb-2 animate-spin" />
              <p className="text-gray-500 dark:text-gray-400 text-sm">Loading impact statistics...</p>
            </div>
          )}
        </div>
      </section>

      <section className="py-20 bg-gray-50 dark:bg-gray-950">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="section-title text-center mb-4">Scam Resources & Tools</h2>
          <p className="section-subtitle text-center mb-12">
            Access our comprehensive database and educational materials to stay protected.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            <FeatureCard icon={Radar} title="Scam Tracker" description="Browse real scam phone numbers from our database, sourced from BBB reports, user submissions, and other verified sources." link="/tracker" />
            <FeatureCard icon={AlertTriangle} title="FTC Top Scams" description="Stay informed about the top 10 most reported scams to the Federal Trade Commission in 2026." link="/ftc-scams" />
            <FeatureCard icon={BookOpen} title="Education Center" description="Learn how to identify scams, protect yourself, and what steps to take if you've been targeted." link="/education" />
          </div>
        </div>
      </section>

      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="section-title mb-4">Been Targeted? Report It</h2>
          <p className="section-subtitle mb-8">
            Your report helps protect others in the community. Add the scammer's number to our database.
          </p>
          <Link to="/report" className="btn-primary inline-flex items-center gap-2 text-lg px-8 py-4">
            <AlertTriangle className="w-5 h-5" />
            Report a Scam Now
          </Link>
        </div>
      </section>
    </div>
  );
}

function ReportCard({ label, date, description, sourceName, sourceUrl }: { label: string; date: string; description: string; sourceName: string; sourceUrl?: string | null }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 mb-3 text-left">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold px-2 py-1 bg-brand-500/10 text-brand-500 rounded">{label}</span>
        <span className="text-xs text-gray-400">{date}</span>
      </div>
      {description && <p className="text-sm text-gray-700 dark:text-gray-300 mb-2 line-clamp-3">{description}</p>}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">Source: {sourceName}</span>
        {sourceUrl && (
          <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-500 hover:underline flex items-center gap-1">
            <ExternalLink className="w-3 h-3" />View Report
          </a>
        )}
      </div>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description, link }: { icon: React.ElementType; title: string; description: string; link: string }) {
  return (
    <Link to={link} className="card p-6 hover:border-brand-500/50 transition-all duration-300 hover:shadow-md group block">
      <div className="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center mb-4 group-hover:bg-brand-500/20 transition-colors">
        <Icon className="w-6 h-6 text-brand-500" />
      </div>
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 group-hover:text-brand-500 transition-colors">{title}</h3>
      <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{description}</p>
    </Link>
  );
}

function ImpactCard({ icon: Icon, value, label, description, color, bgColor }: { icon: React.ElementType; value: string; label: string; description: string; color: string; bgColor: string }) {
  return (
    <div className="card p-8 text-center hover:border-brand-500/30 transition-all duration-300 hover:shadow-lg">
      <div className={`w-16 h-16 rounded-full ${bgColor} flex items-center justify-center mx-auto mb-4`}>
        <Icon className={`w-8 h-8 ${color}`} />
      </div>
      <div className={`text-4xl font-black ${color} mb-2`}>{value}</div>
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{label}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
    </div>
  );
}

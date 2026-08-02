import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  Phone,
  Shield,
  Radar,
  AlertTriangle,
  BookOpen,
  ExternalLink,
  CheckCircle,
  XCircle,
  Loader2,
  DollarSign,
} from "lucide-react";
import { supabase, formatPhoneDisplay } from "../lib/supabase";

type ImpactStats = {
  money_saved: number;
  scammer_hours_wasted: number;
  resources_shutdown: number;
};

function normalizeInput(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 10);
}

function formatTyping(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

type SearchResult = {
  found: boolean;
  reports: Array<{
    id: string;
    category: string;
    description: string;
    incident_date: string;
    source: string;
    source_url?: string;
  }>;
  trackerEntries: Array<{
    id: string;
    source_name: string;
    source_url: string;
    report_date: string;
    category?: string;
    description?: string;
  }>;
};

export default function HomePage() {
  const [input, setInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [searched, setSearched] = useState(false);
  const [searchedDigits, setSearchedDigits] = useState("");
  const [impactStats, setImpactStats] = useState<ImpactStats | null>(null);

  useEffect(() => {
    const fetchImpactStats = async () => {
      const { data } = await supabase
        .from("impact_statistics")
        .select("money_saved, scammer_hours_wasted, resources_shutdown")
        .order("last_updated", { ascending: false })
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
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
          },
        );
        await response.json();
      } catch (error) {
        console.error("Failed to update stats:", error);
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
        supabase
          .from("scam_reports")
          .select("id,category,description,incident_date,source,source_url")
          .eq("phone_digits", digits)
          .gt("expires_at", new Date().toISOString())
          .order("incident_date", { ascending: false }),
        supabase
          .from("tracker_entries")
          .select("id,source_name,source_url,report_date,category,description")
          .eq("phone_digits", digits)
          .gt("expires_at", new Date().toISOString())
          .order("report_date", { ascending: false }),
      ]);

      const reports = reportsRes.data || [];
      const trackerEntries = trackerRes.data || [];
      setResult({
        found: reports.length > 0 || trackerEntries.length > 0,
        reports,
        trackerEntries,
      });
    } catch {
      setResult({ found: false, reports: [], trackerEntries: [] });
    } finally {
      setSearching(false);
      setSearched(true);
    }
  };

  const buildSearchUrl = (engine: string, digits: string) => {
    const formatted = formatPhoneDisplay(digits);
    const dashes = `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    const q = encodeURIComponent(
      `"${formatted}" OR "${dashes}" OR "${digits}" scam`,
    );
    if (engine === "google") return `https://www.google.com/search?q=${q}`;
    if (engine === "bing") return `https://www.bing.com/search?q=${q}`;
    return `https://search.brave.com/search?q=${q}`;
  };

  return (
    <div className="min-h-screen bg-[#F3F2EF] dark:bg-gray-900 pt-24 pb-10">
      <div className="max-w-[1128px] mx-auto px-4 flex flex-col md:flex-row gap-6">
        {/* Left Sidebar */}
        <div className="w-full md:w-[225px] flex-shrink-0 flex flex-col gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="h-14 bg-gray-200 dark:bg-gray-700 relative">
              <img
                src="/cwn-logo.png"
                alt="Cyberscam Watchdog Network Logo"
                className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full border-4 border-white dark:border-gray-800 bg-white object-contain p-1"
              />
            </div>
            <div className="pt-10 pb-4 px-4 text-center border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white text-base">
                Cyberscam Watchdog Network
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                EndScams.org
              </p>
            </div>
            <div className="p-4 text-sm text-gray-600 dark:text-gray-400 flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span>Community Reports</span>
                <span className="font-medium text-brand-500">12K+</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Scams Tracked</span>
                <span className="font-medium text-brand-500">8.5K+</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              Partnered With
            </h3>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-center p-2 border border-gray-100 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-800/50">
                <img
                  src="/partner-1.png"
                  alt="Partner 1"
                  className="h-16 object-contain"
                />
              </div>
              <div className="flex items-center justify-center p-2 border border-gray-100 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-800/50">
                <img
                  src="/partner-2.png"
                  alt="Partner 2"
                  className="h-16 object-contain"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Main Feed Column */}
        <div className="flex-1 flex flex-col gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-brand-500/10 flex items-center justify-center flex-shrink-0">
                <Shield className="w-6 h-6 text-brand-500" />
              </div>
              <div className="flex-1">
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Search Scam Database
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Enter a phone number to cross-reference multiple sources.
                </p>
              </div>
            </div>

            <form
              onSubmit={handleSearch}
              className="flex flex-col sm:flex-row gap-3"
            >
              <div className="relative flex-1">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="(555) 123-4567"
                  value={input}
                  onChange={handleChange}
                  maxLength={14}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-full text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={searching || input.replace(/\D/g, "").length < 10}
                className="px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white font-medium text-sm rounded-full flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
              >
                {searching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                {searching ? "Searching..." : "Search"}
              </button>
            </form>
          </div>

          {searched && result && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  Search Results
                </h2>
              </div>
              <div className="p-4 space-y-4">
                {result.found ? (
                  <div className="border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 rounded-md p-4">
                    <div className="flex items-center gap-3 mb-4">
                      <XCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-red-600 dark:text-red-400 text-sm">
                          Warning: This number has been reported
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          Found{" "}
                          {result.reports.length + result.trackerEntries.length}{" "}
                          report(s) for {formatPhoneDisplay(searchedDigits)}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {result.reports.map((r) => (
                        <ReportCard
                          key={r.id}
                          label={r.category}
                          date={r.incident_date}
                          description={r.description}
                          sourceName="User Report"
                          sourceUrl={r.source_url}
                        />
                      ))}
                      {result.trackerEntries.map((t) => (
                        <ReportCard
                          key={t.id}
                          label={t.category || "Scam"}
                          date={t.report_date}
                          description={t.description || ""}
                          sourceName={t.source_name}
                          sourceUrl={t.source_url}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="border border-gray-200 dark:border-gray-700 rounded-md p-4">
                    <div className="flex items-center gap-3 mb-4">
                      <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-green-600 dark:text-green-400 text-sm">
                          Not found in our database
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          We could not match any records for{" "}
                          {formatPhoneDisplay(searchedDigits)}. For a deeper
                          search, check the sources below.
                        </p>
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-2 mt-4">
                      {(["google", "bing", "brave"] as const).map((engine) => (
                        <a
                          key={engine}
                          href={buildSearchUrl(engine, searchedDigits)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Search{" "}
                          {engine.charAt(0).toUpperCase() + engine.slice(1)}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {result.found && (
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">
                      Search deeper with external sources:
                    </p>
                    <div className="grid sm:grid-cols-3 gap-2">
                      {(["google", "bing", "brave"] as const).map((engine) => (
                        <a
                          key={engine}
                          href={buildSearchUrl(engine, searchedDigits)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Search{" "}
                          {engine.charAt(0).toUpperCase() + engine.slice(1)}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 flex flex-col items-center justify-center text-center">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Been Targeted? Report It
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-md">
              Your report helps protect others in the community. Add the
              scammer's number to our database.
            </p>
            <Link
              to="/report"
              className="px-6 py-2 border-2 border-brand-500 text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10 font-medium rounded-full text-sm transition-colors inline-flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4" />
              Report a Scam
            </Link>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-full md:w-[300px] flex-shrink-0 flex flex-col gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-brand-500" /> Our Impact
            </h2>
            {impactStats ? (
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Estimated Money Saved
                  </p>
                  <p className="text-xl font-semibold text-green-600">
                    ${impactStats.money_saved.toLocaleString("en-US")}
                  </p>
                </div>
                <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Scammer Time Wasted
                  </p>
                  <p className="text-xl font-semibold text-blue-600">
                    {impactStats.scammer_hours_wasted.toLocaleString("en-US")}{" "}
                    hrs
                  </p>
                </div>
                <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Resources Shutdown
                  </p>
                  <p className="text-xl font-semibold text-red-600">
                    {impactStats.resources_shutdown.toLocaleString()}
                  </p>
                </div>
              </div>
            ) : (
              <div className="py-4 text-center">
                <Loader2 className="w-5 h-5 text-brand-500 mx-auto animate-spin" />
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
              Resources & Tools
            </h2>
            <div className="space-y-3">
              <Link to="/tracker" className="group block">
                <div className="flex gap-3 items-start">
                  <Radar className="w-5 h-5 text-gray-400 group-hover:text-brand-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-brand-500">
                      Scam Tracker
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                      Browse real scam phone numbers from our database.
                    </p>
                  </div>
                </div>
              </Link>
              <div className="h-px bg-gray-100 dark:bg-gray-700 my-2"></div>
              <Link to="/ftc-scams" className="group block">
                <div className="flex gap-3 items-start">
                  <AlertTriangle className="w-5 h-5 text-gray-400 group-hover:text-brand-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-brand-500">
                      FTC Top Scams
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                      Top 10 most reported scams to the FTC.
                    </p>
                  </div>
                </div>
              </Link>
              <div className="h-px bg-gray-100 dark:bg-gray-700 my-2"></div>
              <Link to="/education" className="group block">
                <div className="flex gap-3 items-start">
                  <BookOpen className="w-5 h-5 text-gray-400 group-hover:text-brand-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-brand-500">
                      Education Center
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                      Learn how to identify and protect yourself from scams.
                    </p>
                  </div>
                </div>
              </Link>
            </div>
          </div>

          <div className="text-center text-xs text-gray-500 dark:text-gray-400 px-4">
            EndScams.org {new Date().getFullYear()}{" "}
            <Link to="/disclaimer" className="hover:underline">
              Disclaimer
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportCard({
  label,
  date,
  description,
  sourceName,
  sourceUrl,
}: {
  label: string;
  date: string;
  description: string;
  sourceName: string;
  sourceUrl?: string | null;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 mb-3 text-left">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold px-2 py-1 bg-brand-500/10 text-brand-500 rounded">
          {label}
        </span>
        <span className="text-xs text-gray-400">{date}</span>
      </div>
      {description && (
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-2 line-clamp-3">
          {description}
        </p>
      )}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">Source: {sourceName}</span>
        {sourceUrl && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-brand-500 hover:underline flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" />
            View Report
          </a>
        )}
      </div>
    </div>
  );
}

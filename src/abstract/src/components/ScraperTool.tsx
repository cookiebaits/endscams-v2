import React, { useState } from 'react';
import { apiClient } from '../services/apiClient';
import { ScrapeResult } from '../types';
import { 
  Code2, 
  Search, 
  FileText, 
  Eye, 
  Copy, 
  Check, 
  ExternalLink, 
  ShieldAlert, 
  RefreshCw
} from 'lucide-react';

export const ScraperTool: React.FC = () => {
  const [url, setUrl] = useState('https://news.ycombinator.com');
  const [renderJs, setRenderJs] = useState(false);
  const [countryCode, setCountryCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScrapeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'text' | 'html' | 'preview'>('text');
  const [copied, setCopied] = useState(false);

  const presets = [
    { label: 'Hacker News', url: 'https://news.ycombinator.com' },
    { label: 'Example Domain', url: 'https://example.com' },
    { label: 'HTTPBin HTML', url: 'https://httpbin.org/html' },
    { label: 'Wikipedia Tech', url: 'https://en.wikipedia.org/wiki/Application_programming_interface' },
  ];

  const handleScrape = async (targetUrl = url) => {
    if (!targetUrl.trim() || !targetUrl.startsWith('http')) {
      setError('Please provide a valid URL starting with http:// or https://');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await apiClient.scrapeUrl(targetUrl, renderJs, countryCode || undefined);
      setResult(response);
    } catch (err: any) {
      console.error('Scrape error:', err);
      setError(err.message || 'Failed to scrape destination URL.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Helper to extract title, meta tags, and cleaned text from HTML
  const extractPageDetails = (html: string) => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      const title = doc.querySelector('title')?.innerText || 'Untitled Webpage';
      const metaDesc = doc.querySelector('meta[name="description"]')?.getAttribute('content') || 
                       doc.querySelector('meta[property="og:description"]')?.getAttribute('content') || 
                       'No description meta tag provided';

      // Remove script, style, and svg tags for clean text extraction
      doc.querySelectorAll('script, style, noscript, svg').forEach((el) => el.remove());
      const rawText = doc.body?.innerText || '';
      const cleanText = rawText.replace(/\n\s*\n/g, '\n\n').trim();

      const links: { href: string; text: string }[] = [];
      doc.querySelectorAll('a[href]').forEach((el) => {
        const href = el.getAttribute('href');
        const text = el.textContent?.trim();
        if (href && text && !href.startsWith('#') && !href.startsWith('javascript:')) {
          links.push({ href, text });
        }
      });

      return {
        title,
        metaDesc,
        cleanText,
        linksCount: links.length,
        links: links.slice(0, 25)
      };
    } catch {
      return {
        title: 'Extracted Content',
        metaDesc: '',
        cleanText: html.slice(0, 2000),
        linksCount: 0,
        links: []
      };
    }
  };

  const parsed = result?.html ? extractPageDetails(result.html) : null;

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Code2 className="w-5 h-5 text-purple-600" />
            Web Scraper & Content Extractor
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Extract HTML, parse meta tags, sanitize body text, and bypass CAPTCHAs and cloudflare protections using AbstractAPI.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
            Encrypted API Proxy
          </span>
        </div>
      </div>

      {/* Input Form */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
          Target Webpage URL
        </label>
        
        <form onSubmit={(e) => { e.preventDefault(); handleScrape(); }} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Code2 className="w-4 h-4" />
              </div>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 text-slate-900 dark:text-white text-sm font-mono placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-purple-500/20 active:scale-98"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Scraping...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Scrape Page</span>
                </>
              )}
            </button>
          </div>

          {/* Advanced options */}
          <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-slate-600 dark:text-slate-300">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={renderJs}
                onChange={(e) => setRenderJs(e.target.checked)}
                className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 w-4 h-4"
              />
              <span>Render JavaScript (Headless Chrome)</span>
            </label>

            <div className="flex items-center gap-2">
              <span className="text-slate-400">Geo-Proxy:</span>
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value="">Auto / Default</option>
                <option value="us">United States (US)</option>
                <option value="gb">United Kingdom (GB)</option>
                <option value="de">Germany (DE)</option>
                <option value="jp">Japan (JP)</option>
              </select>
            </div>
          </div>
        </form>

        {/* Presets */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
          <span className="text-xs text-slate-500 dark:text-slate-400">Quick Sites:</span>
          {presets.map((preset) => (
            <button
              key={preset.url}
              type="button"
              onClick={() => {
                setUrl(preset.url);
                handleScrape(preset.url);
              }}
              className="px-2.5 py-1 text-xs rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-sm flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Scraper Error</p>
            <p className="text-xs mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Results Display */}
      {result && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
          {/* Top Status Banner */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400">
                <Code2 className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white font-mono truncate max-w-md" title={result.target_url}>
                    {result.target_url}
                  </h3>
                  <a
                    href={result.target_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                  <span>Size: {((result.size_bytes || 0) / 1024).toFixed(1)} KB</span>
                  <span>•</span>
                  <span>Source: {result.source || 'Scraper Engine'}</span>
                  {result.fallback_used && (
                    <>
                      <span>•</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                        Direct Proxy Fallback
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => handleCopy(result.html)}
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center gap-1.5 hover:bg-slate-50 transition-colors shadow-sm"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied HTML' : 'Copy Raw HTML'}
            </button>
          </div>

          {/* Subtabs for Viewers */}
          <div className="border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
            {[
              { id: 'text', label: 'Extracted Content & Meta', icon: FileText },
              { id: 'html', label: 'HTML Source Code', icon: Code2 },
              { id: 'preview', label: 'Rendered Sandbox View', icon: Eye }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSubTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                    isActive
                      ? 'border-purple-600 text-purple-600 dark:border-purple-400 dark:text-purple-400'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Subtab 1: Extracted Text & Meta */}
          {activeSubTab === 'text' && parsed && (
            <div className="space-y-4">
              {/* Metadata Card */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Page Title</span>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">{parsed.title}</h4>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Meta Description</span>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">{parsed.metaDesc}</p>
                </div>
              </div>

              {/* Clean Text Box */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Sanitized Text Content ({parsed.cleanText.length} characters)
                  </span>
                  <button
                    onClick={() => handleCopy(parsed.cleanText)}
                    className="text-xs text-purple-600 hover:underline flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copy Text</span>
                  </button>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-sans text-xs text-slate-800 dark:text-slate-200 leading-relaxed max-h-96 overflow-y-auto whitespace-pre-wrap">
                  {parsed.cleanText || 'No readable text content found in document body.'}
                </div>
              </div>

              {/* Extracted Links */}
              {parsed.links.length > 0 && (
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/30">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-2">
                    Extracted Hyperlinks ({parsed.linksCount} found)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                    {parsed.links.map((link, idx) => (
                      <a
                        key={idx}
                        href={link.href.startsWith('http') ? link.href : `${result.target_url}/${link.href.replace(/^\//, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs flex items-center justify-between gap-2 hover:border-purple-300 transition-colors"
                      >
                        <span className="truncate text-slate-800 dark:text-slate-200 font-medium">{link.text}</span>
                        <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Subtab 2: HTML Source Code */}
          {activeSubTab === 'html' && (
            <div className="relative">
              <pre className="p-4 rounded-xl bg-slate-950 text-slate-200 text-xs font-mono overflow-x-auto max-h-[500px] border border-slate-800 scrollbar-thin">
                {result.html}
              </pre>
              <button
                onClick={() => handleCopy(result.html)}
                className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1.5 shadow"
              >
                <Copy className="w-3 h-3" />
                <span>Copy Code</span>
              </button>
            </div>
          )}

          {/* Subtab 3: Rendered Sandbox Preview */}
          {activeSubTab === 'preview' && (
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white shadow-inner">
              <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2 text-xs font-mono text-slate-500 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
                <span>Sandboxed iframe preview (scripts restricted)</span>
                <span className="text-[10px] text-amber-600 font-semibold">Security Isolated</span>
              </div>
              <iframe
                title="Scraped Webpage Preview"
                srcDoc={result.html}
                sandbox="allow-same-origin"
                className="w-full h-96 border-none"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

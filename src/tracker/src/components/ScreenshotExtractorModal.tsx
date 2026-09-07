import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Upload,
  Clipboard,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Sparkles,
  DollarSign,
  Building2,
  Hash,
  ExternalLink,
  MessageCircle,
  Globe,
  Maximize2,
  Minimize2,
  Eye,
} from 'lucide-react';
import { ScamPhoneRecord } from '../types';

interface ScreenshotExtractorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExtractionComplete: (newRecords: ScamPhoneRecord[], summary: string) => void;
}

interface SourcePreset {
  id: string;
  name: string;
  platform: string;
  url: string;
  description: string;
  badge: string;
  category: 'tsu' | 'scammer-info' | 'custom';
}

const SOURCE_PRESETS: SourcePreset[] = [
  // Tech Scammers United (techscammersunited.com)
  {
    id: 'tsu-paypal',
    name: 'TSU: PayPal (order:latest)',
    platform: 'Tech Support United',
    url: 'https://techscammersunited.com/search?q=PayPal%20order%3Alatest',
    description: 'PayPal SMS text alerts and fake invoice callback numbers sorted newest first.',
    badge: 'PayPal / Latest',
    category: 'tsu',
  },
  {
    id: 'tsu-geek-squad',
    name: 'TSU: Geek Squad (order:latest)',
    platform: 'Tech Support United',
    url: 'https://techscammersunited.com/search?q=Geek%20Squad%20order%3Alatest',
    description: 'Geek Squad & Best Buy auto-renewal refund scams sorted newest first.',
    badge: 'Geek Squad / Latest',
    category: 'tsu',
  },
  {
    id: 'tsu-apple',
    name: 'TSU: Apple Phishing (order:latest)',
    platform: 'Tech Support United',
    url: 'https://techscammersunited.com/search?q=Apple%20order%3Alatest',
    description: 'Apple iCloud security alerts and invoice photo text scams sorted newest first.',
    badge: 'Apple / Latest',
    category: 'tsu',
  },
  {
    id: 'tsu-pch',
    name: 'TSU: PCH / Publishers Clearing House',
    platform: 'Tech Support United',
    url: 'https://techscammersunited.com/search?q=Publishers%20Clearing%20House%20order%3Alatest',
    description: 'Publishers Clearing House (PCH) lottery impostor numbers sorted newest first.',
    badge: 'PCH / Latest',
    category: 'tsu',
  },
  {
    id: 'tsu-amazon',
    name: 'TSU: Amazon Invoices (order:latest)',
    platform: 'Tech Support United',
    url: 'https://techscammersunited.com/search?q=Amazon%20order%3Alatest',
    description: 'Amazon order confirmations and unauthorized charge scam lines.',
    badge: 'Amazon / Latest',
    category: 'tsu',
  },
  {
    id: 'tsu-antivirus',
    name: 'TSU: Norton & McAfee (order:latest)',
    platform: 'Tech Support United',
    url: 'https://techscammersunited.com/search?q=Norton%20McAfee%20order%3Alatest',
    description: 'Norton, McAfee, and TotalAV fake renewal phone numbers.',
    badge: 'Antivirus / Latest',
    category: 'tsu',
  },
  {
    id: 'tsu-latest',
    name: 'TSU: Latest Feed (Discourse)',
    platform: 'Tech Support United',
    url: 'https://techscammersunited.com/latest',
    description: 'Live real-time forum topic feed sorted newest numbers on top.',
    badge: 'Real-Time Feed',
    category: 'tsu',
  },

  // Scammer.info (scammer.info)
  {
    id: 'scammer-info-paypal',
    name: 'Scammer.info: PayPal (order:latest)',
    platform: 'Scammer.info',
    url: 'https://scammer.info/search?q=PayPal%20order%3Alatest',
    description: 'PayPal fake invoice threads and callback lines sorted newest first.',
    badge: 'PayPal / Latest',
    category: 'scammer-info',
  },
  {
    id: 'scammer-info-geek-squad',
    name: 'Scammer.info: Geek Squad (order:latest)',
    platform: 'Scammer.info',
    url: 'https://scammer.info/search?q=Geek%20Squad%20order%3Alatest',
    description: 'Geek Squad & Best Buy refund scam threads sorted newest first.',
    badge: 'Geek Squad / Latest',
    category: 'scammer-info',
  },
  {
    id: 'scammer-info-apple',
    name: 'Scammer.info: Apple Phishing (order:latest)',
    platform: 'Scammer.info',
    url: 'https://scammer.info/search?q=Apple%20order%3Alatest',
    description: 'Apple account lock and receipt text scams sorted newest first.',
    badge: 'Apple / Latest',
    category: 'scammer-info',
  },
  {
    id: 'scammer-info-pch',
    name: 'Scammer.info: PCH Sweepstakes (order:latest)',
    platform: 'Scammer.info',
    url: 'https://scammer.info/search?q=PCH%20order%3Alatest',
    description: 'Publishers Clearing House prize agent scam threads sorted newest first.',
    badge: 'PCH / Latest',
    category: 'scammer-info',
  },
  {
    id: 'scammer-info-latest',
    name: 'Scammer.info: All Scams (order:latest)',
    platform: 'Scammer.info',
    url: 'https://scammer.info/search?q=order%3Alatest',
    description: 'Comprehensive newest-first search across all scambaiting threads.',
    badge: 'All Scams / Latest',
    category: 'scammer-info',
  },
];

export const ScreenshotExtractorModal: React.FC<ScreenshotExtractorModalProps> = ({
  isOpen,
  onClose,
  onExtractionComplete,
}) => {
  const [activeTab, setActiveTab] = useState<'auto' | 'upload'>('auto');
  const [presetFilter, setPresetFilter] = useState<'all' | 'tsu' | 'scammer-info'>('all');
  
  // Auto-screenshot state
  const [selectedPresetId, setSelectedPresetId] = useState<string>('tsu-paypal');
  const [quickKeyword, setQuickKeyword] = useState<string>('PayPal');
  const [quickPlatform, setQuickPlatform] = useState<'tsu' | 'scammer-info'>('tsu');
  const [customUrl, setCustomUrl] = useState<string>('');
  const [customPlatform, setCustomPlatform] = useState<string>('Tech Support United');
  
  // Manual upload state
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('image/png');
  const [platformContext, setPlatformContext] = useState<string>('Tech Support United');
  
  // Execution & results state
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [extractedResults, setExtractedResults] = useState<ScamPhoneRecord[] | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [capturedScreenshotUrl, setCapturedScreenshotUrl] = useState<string | null>(null);
  const [isZoomedScreenshot, setIsZoomedScreenshot] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when closed
  useEffect(() => {
    if (!isOpen) {
      setImagePreview(null);
      setExtractedResults(null);
      setErrorMsg(null);
      setIsAnalyzing(false);
      setStatusMessage('');
      setCapturedScreenshotUrl(null);
      setIsZoomedScreenshot(false);
    }
  }, [isOpen]);

  // Handle global paste when modal is open
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            setActiveTab('upload');
            processFile(blob);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen]);

  if (!isOpen) return null;

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please upload a valid image file (PNG, JPG, WebP).');
      return;
    }
    setErrorMsg(null);
    setExtractedResults(null);
    setMimeType(file.type);

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setImagePreview(result);
    };
    reader.onerror = () => {
      setErrorMsg('Failed to read image file.');
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      processFile(files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handlePasteClick = async () => {
    try {
      setErrorMsg(null);
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        const imageType = item.types.find((type) => type.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          processFile(new File([blob], 'clipboard-screenshot.png', { type: imageType }));
          return;
        }
      }
      setErrorMsg('No image found on clipboard. You can press Ctrl+V / Cmd+V or browse a file.');
    } catch {
      setErrorMsg('Clipboard access denied or unavailable. Use Ctrl+V / Cmd+V to paste directly.');
    }
  };

  // 1. Auto-Capture Live Page Screenshot & Extract
  const handleAutoScreenshotAndExtract = async () => {
    let targetUrl = '';
    let targetPlatform = '';

    if (selectedPresetId === 'custom') {
      if (!customUrl.trim()) {
        setErrorMsg('Please enter a valid URL to screenshot.');
        return;
      }
      targetUrl = customUrl.trim();
      targetPlatform = customPlatform;
    } else {
      const preset = SOURCE_PRESETS.find((p) => p.id === selectedPresetId);
      if (!preset) return;
      targetUrl = preset.url;
      targetPlatform = preset.platform;
    }

    setIsAnalyzing(true);
    setErrorMsg(null);
    setExtractedResults(null);
    setCapturedScreenshotUrl(null);
    setStatusMessage(`Taking live screenshot of ${targetPlatform} (newest on top) and executing Vision OCR...`);

    try {
      const res = await fetch('/api/scan-page-screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceUrl: targetUrl,
          platform: targetPlatform,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to capture screenshot and extract scam data.');
      }

      if (data.screenshotBase64) {
        setCapturedScreenshotUrl(data.screenshotBase64);
      }

      setExtractedResults(data.newlyFound || []);
      setStatusMessage(data.message || `Processed screenshot and extracted scam numbers.`);

      onExtractionComplete(
        data.newlyFound || [],
        data.message || `Extracted ${data.extractedCount} scam numbers from screenshot.`
      );
    } catch (err: any) {
      console.error('Auto screenshot extraction error:', err);
      setErrorMsg(err.message || 'Error processing live screenshot.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 2. Manual Upload Screenshot Extract
  const handleManualUploadExtract = async () => {
    if (!imagePreview) {
      setErrorMsg('Please select or paste an image screenshot first.');
      return;
    }

    setIsAnalyzing(true);
    setErrorMsg(null);
    setStatusMessage('Scanning screenshot with Vision OCR (identifying phone numbers, companies, invoices, and amounts)...');

    try {
      const res = await fetch('/api/extract-screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: imagePreview,
          mimeType,
          platformContext,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to extract screenshot intelligence.');
      }

      setExtractedResults(data.newlyFound || []);
      setStatusMessage(data.message || `Successfully processed screenshot.`);

      onExtractionComplete(
        data.newlyFound || [],
        data.message || `Extracted ${data.extractedCount} scam numbers from screenshot.`
      );
    } catch (err: any) {
      console.error('Screenshot extraction error:', err);
      setErrorMsg(err.message || 'Error processing screenshot.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-5 my-8 text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-400 rounded-xl border border-indigo-500/30 shadow-inner">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>Page Screenshot & Multimodal OCR Harvester</span>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-purple-500/20 text-purple-300 rounded-full border border-purple-500/30">
                  Newest On Top
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Captures a real-time page screenshot, performs visual OCR, maps direct thread links, and strictly extracts entries with callback numbers.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('auto')}
            className={`inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'auto'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/50'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Auto-Capture Live Source (Recommended)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'upload'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/50'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload / Paste Screenshot File</span>
          </button>
        </div>

        {/* TAB 1: AUTO-CAPTURE LIVE SOURCE SCREENSHOT */}
        {activeTab === 'auto' && (
          <div className="space-y-4">
            {/* Quick Forum Search Parameter Builder */}
            <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3 shadow-inner">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Quick Scam Keyword Search Builder (order:latest)
                </span>
                <div className="flex items-center space-x-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setQuickPlatform('tsu');
                      setCustomPlatform('Tech Support United');
                      const url = `https://techscammersunited.com/search?q=${encodeURIComponent(quickKeyword)}%20order%3Alatest`;
                      setCustomUrl(url);
                      setSelectedPresetId('custom');
                    }}
                    className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                      quickPlatform === 'tsu' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Tech Scammers United
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setQuickPlatform('scammer-info');
                      setCustomPlatform('Scammer.info');
                      const url = `https://scammer.info/search?q=${encodeURIComponent(quickKeyword)}%20order%3Alatest`;
                      setCustomUrl(url);
                      setSelectedPresetId('custom');
                    }}
                    className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                      quickPlatform === 'scammer-info' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Scammer.info
                  </button>
                </div>
              </div>

              {/* Common Scam Quick Keywords */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: 'PayPal', query: 'PayPal' },
                  { label: 'Geek Squad', query: 'Geek Squad' },
                  { label: 'Apple', query: 'Apple' },
                  { label: 'PCH / Publishers Clearing House', query: 'Publishers Clearing House' },
                  { label: 'Amazon', query: 'Amazon' },
                  { label: 'Norton & McAfee', query: 'Norton McAfee' },
                  { label: 'Crypto Recovery', query: 'Crypto Recovery' },
                  { label: 'Windows Defender', query: 'Windows Defender' },
                  { label: 'All Latest Scams', query: '' },
                ].map((item) => {
                  const isCurrent = quickKeyword === item.query;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => {
                        setQuickKeyword(item.query);
                        const baseUrl = quickPlatform === 'tsu' ? 'https://techscammersunited.com' : 'https://scammer.info';
                        const generated = item.query
                          ? `${baseUrl}/search?q=${encodeURIComponent(item.query)}%20order%3Alatest`
                          : `${baseUrl}/search?q=order%3Alatest`;
                        setCustomUrl(generated);
                        setCustomPlatform(quickPlatform === 'tsu' ? 'Tech Support United' : 'Scammer.info');
                        setSelectedPresetId('custom');
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                        isCurrent && selectedPresetId === 'custom'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                          : 'bg-slate-900 hover:bg-slate-850 text-slate-300 border-slate-700/80 hover:border-slate-600'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>

              {/* Current Active Search URL Display */}
              {selectedPresetId === 'custom' && customUrl && (
                <div className="flex items-center justify-between text-[11px] bg-slate-900/90 px-3 py-1.5 rounded-lg border border-indigo-500/30 text-indigo-300">
                  <span className="truncate font-mono">
                    <strong>Target URL:</strong> {customUrl}
                  </span>
                  <a
                    href={customUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 inline-flex items-center text-slate-400 hover:text-indigo-200 shrink-0"
                  >
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </div>
              )}
            </div>

            {/* Presets List with Filter Tabs */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Or Choose From Standard Presets (Newest-First):
                </label>
                <div className="flex items-center space-x-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setPresetFilter('all')}
                    className={`px-2 py-0.5 rounded ${presetFilter === 'all' ? 'bg-slate-800 text-slate-100 font-semibold' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    All ({SOURCE_PRESETS.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetFilter('tsu')}
                    className={`px-2 py-0.5 rounded ${presetFilter === 'tsu' ? 'bg-slate-800 text-slate-100 font-semibold' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Tech Scammers United
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetFilter('scammer-info')}
                    className={`px-2 py-0.5 rounded ${presetFilter === 'scammer-info' ? 'bg-slate-800 text-slate-100 font-semibold' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Scammer.info
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-1">
                {SOURCE_PRESETS.filter((p) => presetFilter === 'all' || p.category === presetFilter).map((preset) => {
                  const isSelected = selectedPresetId === preset.id;
                  return (
                    <div
                      key={preset.id}
                      onClick={() => setSelectedPresetId(preset.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer space-y-1 ${
                        isSelected
                          ? 'bg-indigo-950/40 border-indigo-500 shadow-md shadow-indigo-950/50 ring-1 ring-indigo-500/50'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-950'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-200">{preset.name}</span>
                        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-slate-800 text-indigo-300 border border-indigo-500/20">
                          {preset.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">{preset.description}</p>
                      <div className="text-[10px] font-mono text-slate-500 truncate pt-1">{preset.url}</div>
                    </div>
                  );
                })}

                {/* Custom URL Option Card */}
                <div
                  onClick={() => {
                    setSelectedPresetId('custom');
                    if (!customUrl) {
                      setCustomUrl('https://techscammersunited.com/search?q=PayPal%20order%3Alatest');
                    }
                  }}
                  className={`p-3 rounded-xl border transition-all cursor-pointer space-y-1 ${
                    selectedPresetId === 'custom'
                      ? 'bg-indigo-950/40 border-indigo-500 shadow-md shadow-indigo-950/50 ring-1 ring-indigo-500/50'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-950'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">Custom Target Page URL</span>
                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-slate-800 text-amber-300 border border-amber-500/20">
                      Custom URL
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">Enter or edit any web page URL with search parameters to screenshot and extract.</p>
                </div>
              </div>
            </div>

            {/* Custom URL Input Field */}
            {selectedPresetId === 'custom' && (
              <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2 animate-in fade-in duration-150">
                <label className="text-xs font-medium text-slate-300">Target Web Page URL to Screenshot:</label>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="https://techscammersunited.com/search?q=PayPal%20order%3Alatest"
                    className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <select
                    value={customPlatform}
                    onChange={(e) => setCustomPlatform(e.target.value)}
                    className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Tech Support United">Tech Scammers United</option>
                    <option value="Scammer.info">Scammer.info</option>
                    <option value="Web Scam Database">Other Scam Database</option>
                  </select>
                </div>
              </div>
            )}

            {/* Action Button */}
            <div className="pt-2 flex items-center justify-between">
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Filters only posts with callback numbers; extracts direct links & summary cards.</span>
              </div>

              <button
                type="button"
                onClick={handleAutoScreenshotAndExtract}
                disabled={isAnalyzing}
                className="inline-flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all disabled:opacity-50 cursor-pointer"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Capturing Screenshot & OCR Scanning...</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4 text-indigo-200" />
                    <span>Take Screenshot & Extract Scams</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: MANUAL UPLOAD / PASTE SCREENSHOT */}
        {activeTab === 'upload' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-medium">Platform Context:</span>
                <select
                  value={platformContext}
                  onChange={(e) => setPlatformContext(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="Tech Support United">Tech Support United (techscammersunited.com)</option>
                  <option value="Scammer.info">Scammer.info (scammer.info)</option>
                  <option value="SMS / Phishing Text">SMS Phishing / Text Message</option>
                  <option value="Email Phishing">Email Invoice / Phishing Receipt</option>
                  <option value="Social Media Fraud">Social Media / WhatsApp Group</option>
                </select>
              </div>
            </div>

            {!imagePreview ? (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="border-2 border-dashed border-slate-700 hover:border-indigo-500/60 rounded-xl p-8 text-center bg-slate-950/50 hover:bg-slate-950/80 transition-all cursor-pointer space-y-4"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />

                <div className="mx-auto w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-inner">
                  <Upload className="w-7 h-7" />
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-200">
                    Drag and drop your screenshot here, or <span className="text-indigo-400 underline">browse files</span>
                  </p>
                  <p className="text-xs text-slate-400">
                    Supports PNG, JPG, JPEG, WebP. You can also press <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] font-mono text-slate-300">Ctrl+V</kbd> anywhere.
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePasteClick();
                    }}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors shadow-sm"
                  >
                    <Clipboard className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Paste from Clipboard</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative border border-slate-700 rounded-xl overflow-hidden bg-slate-950 max-h-72 flex items-center justify-center">
                  <img
                    src={imagePreview}
                    alt="Screenshot Preview"
                    className="max-h-72 w-auto object-contain"
                  />
                  <button
                    onClick={() => {
                      setImagePreview(null);
                      setExtractedResults(null);
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-slate-900/90 hover:bg-red-600 text-slate-200 rounded-lg border border-slate-700 transition-colors"
                    title="Remove image"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isAnalyzing}
                    className="text-xs text-slate-400 hover:text-slate-200 underline"
                  >
                    Choose different image
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />

                  <button
                    type="button"
                    onClick={handleManualUploadExtract}
                    disabled={isAnalyzing}
                    className="inline-flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Extracting & Posting...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-amber-300" />
                        <span>Extract & Post Scam Numbers</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Captured Screenshot Visual Verification Card */}
        {capturedScreenshotUrl && (
          <div className="p-3.5 bg-slate-950 border border-indigo-500/30 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-semibold text-indigo-300">
                <Eye className="w-4 h-4 text-indigo-400" />
                <span>Live Rendered Page Screenshot Captured by Harvester:</span>
              </div>
              <button
                type="button"
                onClick={() => setIsZoomedScreenshot(!isZoomedScreenshot)}
                className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center space-x-1"
              >
                {isZoomedScreenshot ? (
                  <>
                    <Minimize2 className="w-3.5 h-3.5" />
                    <span>Collapse</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Expand View</span>
                  </>
                )}
              </button>
            </div>

            <div className={`relative border border-slate-800 rounded-lg overflow-hidden bg-slate-900 flex items-center justify-center transition-all ${
              isZoomedScreenshot ? 'max-h-[500px]' : 'max-h-48'
            }`}>
              <img
                src={capturedScreenshotUrl}
                alt="Live Page Screenshot"
                className={`w-full object-top object-contain ${
                  isZoomedScreenshot ? 'max-h-[500px]' : 'max-h-48'
                }`}
              />
            </div>
          </div>
        )}

        {/* Error Feedback */}
        {errorMsg && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-xs flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Status / Success Feedback */}
        {statusMessage && !errorMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-start space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Extracted Results Preview */}
        {extractedResults && extractedResults.length > 0 && (
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Extracted Numbers & Scam Summaries ({extractedResults.length})
              </h4>
              <span className="text-[11px] text-emerald-400 font-medium">
                ✓ Added to 60-Day Retained Archive
              </span>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {extractedResults.map((rec) => (
                <div
                  key={rec.id}
                  className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2 text-xs hover:border-slate-700 transition-colors"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <span className="font-mono text-sm font-bold text-amber-400">
                        {rec.phone}
                      </span>
                      {rec.impersonatedCompany && (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-blue-500/15 text-blue-300 border border-blue-500/30 rounded-md text-[10px] font-semibold">
                          <Building2 className="w-3 h-3" />
                          <span>{rec.impersonatedCompany}</span>
                        </span>
                      )}
                      {rec.amountCharged && rec.amountCharged !== 'N/A' && (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded-md text-[10px] font-semibold">
                          <DollarSign className="w-3 h-3" />
                          <span>{rec.amountCharged}</span>
                        </span>
                      )}
                      {rec.invoiceNumber && rec.invoiceNumber !== 'N/A' && (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-purple-500/15 text-purple-300 border border-purple-500/30 rounded-md text-[10px] font-semibold">
                          <Hash className="w-3 h-3" />
                          <span>{rec.invoiceNumber}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      {rec.sourceUrl && (
                        <a
                          href={rec.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-400 hover:text-indigo-300 flex items-center space-x-1 text-[11px]"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Direct Thread Link</span>
                        </a>
                      )}
                      <a
                        href={`https://wa.me/${rec.cleanPhone}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-400 hover:text-emerald-300 flex items-center space-x-1 text-[11px]"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </a>
                    </div>
                  </div>

                  {rec.detailedSummary && (
                    <p className="text-slate-300 text-[11px] leading-relaxed bg-slate-900/60 p-2 rounded border border-slate-800/80">
                      <span className="font-semibold text-slate-400">Summary: </span>
                      {rec.detailedSummary}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors"
              >
                Close & View Table
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

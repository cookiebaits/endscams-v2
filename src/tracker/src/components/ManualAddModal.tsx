import React, { useState, useRef, useEffect } from 'react';
import {
  PhoneCall,
  X,
  Upload,
  Trash2,
  Sparkles,
  Loader2,
  Check,
  Camera,
} from 'lucide-react';
import { ScamPhoneRecord } from '../types';

interface ManualAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddRecord: (record: Omit<ScamPhoneRecord, 'id' | 'detectedAt'>) => void;
}

export const ManualAddModal: React.FC<ManualAddModalProps> = ({
  isOpen,
  onClose,
  onAddRecord,
}) => {
  const [form, setForm] = useState({
    phone: '',
    scamType: 'Tech Support / Geek Squad Impersonation',
    sourceUrl: '',
    platform: 'Personal Email Call or Text',
    snippet: '',
  });

  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState<string | null>(null);
  const [isExtractingOcr, setIsExtractingOcr] = useState(false);
  const [ocrMessage, setOcrMessage] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isOpen) {
      // Reset form when closed
      setForm({
        phone: '',
        scamType: 'Tech Support / Geek Squad Impersonation',
        sourceUrl: '',
        platform: 'Personal Email Call or Text',
        snippet: '',
      });
      setAttachedImage(null);
      setImageFileName(null);
      setOcrMessage(null);
      setIsExtractingOcr(false);
    }
  }, [isOpen]);

  // Handle clipboard paste (Ctrl+V / Cmd+V) of images anywhere in the modal
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          loadImageFile(file, `Pasted Screenshot ${new Date().toLocaleTimeString()}`);
          break;
        }
      }
    }
  };

  const loadImageFile = (file: File, customName?: string) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, JPG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setAttachedImage(dataUrl);
      setImageFileName(customName || file.name);
      setOcrMessage('Screenshot attached! You can also click "Extract with AI" to pull numbers and text.');
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      loadImageFile(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      loadImageFile(file);
    }
  };

  const removeImage = () => {
    setAttachedImage(null);
    setImageFileName(null);
    setOcrMessage(null);
  };

  // Optional OCR extraction from the screenshot
  const handleExtractFromImage = async () => {
    if (!attachedImage) return;

    setIsExtractingOcr(true);
    setOcrMessage('Analyzing screenshot with AI OCR...');

    try {
      const base64Data = attachedImage.split(',')[1];
      const mimeType = attachedImage.split(';')[0].replace('data:', '') || 'image/png';

      const response = await fetch('/api/extract-screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64Data,
          mimeType,
          platformContext: form.platform,
        }),
      });

      if (!response.ok) {
        throw new Error('OCR service response not OK');
      }

      const data = await response.json();
      if (data.records && data.records.length > 0) {
        const topRec = data.records[0];
        setForm((prev) => ({
          ...prev,
          phone: prev.phone || topRec.phone || '',
          scamType: topRec.scamType || prev.scamType,
          snippet: prev.snippet
            ? `${prev.snippet}\n${topRec.snippet || topRec.detailedSummary || ''}`
            : topRec.snippet || topRec.detailedSummary || prev.snippet,
        }));
        setOcrMessage(`Successfully extracted phone number ${topRec.phone} and threat text!`);
      } else {
        setOcrMessage('No phone numbers detected in this screenshot, but image remains attached as evidence.');
      }
    } catch (err: any) {
      console.warn('OCR extraction failed:', err);
      setOcrMessage('Could not auto-extract text, but screenshot remains attached.');
    } finally {
      setIsExtractingOcr(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const phoneVal = form.phone.trim();
    if (!phoneVal) return;

    // Toll-Free check
    const digits = phoneVal.replace(/\D/g, '');
    const local = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
    const isTollFree = local.length === 10 && ['800', '888', '877', '866', '855', '844', '833'].some((p) => local.startsWith(p));
    if (isTollFree) {
      alert('North American toll-free numbers (800, 888, 877, 866, 855, 844, and 833) are strictly prohibited and rejected.');
      return;
    }

    // Fictitious / invalid pattern check
    if (digits.length < 7 || digits.length > 15 || digits.includes('555') || /(\d)\1{4,}/.test(digits)) {
      alert('Invalid or fictitious phone number pattern detected (555-exchanges, repeating/sequential digits, or under 7 digits are rejected).');
      return;
    }

    // Reddit check
    if (form.sourceUrl.toLowerCase().includes('reddit') || form.platform.toLowerCase().includes('reddit')) {
      alert('Unverified Reddit sources are excluded. Please provide an authentic source URL or platform.');
      return;
    }

    let domain = 'web';
    try {
      if (form.sourceUrl && form.sourceUrl.startsWith('http')) {
        domain = new URL(form.sourceUrl).hostname.replace('www.', '');
      } else if (form.platform === 'Personal Email Call or Text') {
        domain = 'Direct Communication';
      }
    } catch {
      domain = 'web';
    }

    const snippetText = form.snippet.trim() || (attachedImage ? 'Evidence screenshot attached' : 'Manually entered record');

    onAddRecord({
      phone: form.phone.trim(),
      cleanPhone: form.phone.replace(/\D/g, ''),
      scamType: form.scamType,
      sourceUrl: form.sourceUrl.trim() || (form.platform === 'Personal Email Call or Text' ? '' : 'https://scammer.info'),
      sourceDomain: domain,
      platform: form.platform,
      snippet: snippetText,
      searchQuery: 'Manual Entry',
      confidence: 'High',
      imageUrl: attachedImage || undefined,
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onPaste={handlePaste}
    >
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <PhoneCall className="w-5 h-5 text-amber-400" />
            <span>Add Manual Phone Entry</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Phone Number */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Phone Number *
            </label>
            <input
              type="text"
              required
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="e.g. +234 812 345 6789 or +1 888 123 4567"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Type of Scam */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Type of Scam
            </label>
            <select
              value={form.scamType}
              onChange={(e) => setForm({ ...form, scamType: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            >
              <option value="Tech Support / Geek Squad Impersonation">
                Tech Support / Geek Squad Impersonation
              </option>
              <option value="Spellcaster Scam">Spellcaster Scam</option>
              <option value="Crypto / BTC Recovery Scam">Crypto / BTC Recovery Scam</option>
              <option value="Guestbook Spam">Guestbook Spam</option>
              <option value="Romance / Relationship Scam">Romance / Relationship Scam</option>
              <option value="Investment / Forex Scam">Investment / Forex Scam</option>
              <option value="Manual Verification">Manual Verification</option>
            </select>
          </div>

          {/* Source URL */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Source URL
            </label>
            <input
              type="text"
              value={form.sourceUrl}
              onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })}
              placeholder="https://scammer.info/t/... or leave blank if direct call/email"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Platform */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Platform
            </label>
            <select
              value={form.platform}
              onChange={(e) => setForm({ ...form, platform: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            >
              <option value="Scammer.info">Scammer.info</option>
              <option value="Tech Support United">Tech Support United</option>
              <option value="Tech Scammers United">Tech Scammers United</option>
              <option value="WhoCallsMe">WhoCallsMe</option>
              <option value="800notes">800notes</option>
              <option value="Social Media">Social Media</option>
              <option value="Telegram">Telegram</option>
              <option value="Guestbook">Guestbook</option>
              <option value="Personal Email Call or Text">Personal Email Call or Text</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Context Snippet & Image / Screenshot Attachment */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-300">
                Context Snippet
              </label>
              <span className="text-[11px] text-slate-400">
                Supports image upload or Ctrl+V paste
              </span>
            </div>

            <textarea
              ref={textareaRef}
              value={form.snippet}
              onChange={(e) => setForm({ ...form, snippet: e.target.value })}
              onPaste={handlePaste}
              rows={2}
              placeholder="Short note, email text, or paste a screenshot directly (Ctrl+V)..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />

            {/* Image / Screenshot Upload & Paste Dropzone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-3 transition-colors ${
                dragOver
                  ? 'border-amber-500 bg-amber-500/10'
                  : attachedImage
                  ? 'border-slate-700 bg-slate-950/60'
                  : 'border-slate-800 hover:border-slate-700 bg-slate-950/40'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileInputChange}
                className="hidden"
              />

              {!attachedImage ? (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                      <Camera className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-200">
                        Upload or paste screenshot / image
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Paste directly with <kbd className="px-1 py-0.5 bg-slate-800 rounded font-mono text-slate-300">Ctrl+V</kbd> or drop image file
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition-colors flex items-center space-x-1.5 shrink-0 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Image</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-700 shrink-0 bg-slate-900">
                        <img
                          src={attachedImage}
                          alt="Evidence screenshot"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-200 truncate">
                          {imageFileName || 'Attached Screenshot'}
                        </p>
                        <p className="text-[10px] text-emerald-400 flex items-center space-x-1">
                          <Check className="w-3 h-3" />
                          <span>Image attached to record</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleExtractFromImage}
                        disabled={isExtractingOcr}
                        className="py-1 px-2.5 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 rounded-lg text-[11px] font-semibold transition-colors flex items-center space-x-1 cursor-pointer disabled:opacity-40"
                        title="Auto-extract phone number and text using AI OCR"
                      >
                        {isExtractingOcr ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Sparkles className="w-3 h-3 text-cyan-400" />
                        )}
                        <span>{isExtractingOcr ? 'Extracting...' : 'Extract with AI'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={removeImage}
                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                        title="Remove attached image"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {ocrMessage && (
                    <div className="text-[11px] text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 p-2 rounded-lg flex items-center space-x-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>{ocrMessage}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg shadow transition-colors cursor-pointer flex items-center space-x-1.5"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Add Record</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

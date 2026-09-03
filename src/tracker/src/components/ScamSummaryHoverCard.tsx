import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Building2,
  DollarSign,
  FileText,
  Hash,
  ExternalLink,
  PhoneCall,
  MessageCircle,
  Copy,
  Check,
  ShieldAlert,
  Calendar,
} from 'lucide-react';
import { ScamPhoneRecord } from '../types';
import { formatPST } from '../utils/dateUtils';

interface ScamSummaryHoverCardProps {
  record: ScamPhoneRecord;
  children: React.ReactNode;
}

export const ScamSummaryHoverCard: React.FC<ScamSummaryHoverCardProps> = ({
  record,
  children,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    placement: 'top' | 'bottom';
  }>({
    top: 0,
    left: 0,
    placement: 'bottom',
  });

  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const calculatePosition = () => {
    if (!triggerRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const cardWidth = Math.min(384, window.innerWidth - 24);
    const cardHeight = 360; // Estimated max height of the popover

    // Check vertical space available
    const spaceAbove = triggerRect.top;
    const spaceBelow = window.innerHeight - triggerRect.bottom;

    let placement: 'top' | 'bottom' = 'bottom';
    let top = 0;

    // If space above is less than card height + padding, or if there is significantly more room below
    if (spaceAbove < 350 || spaceBelow >= 360) {
      // Place below trigger
      placement = 'bottom';
      top = triggerRect.bottom + 8;
    } else {
      // Place above trigger
      placement = 'top';
      top = Math.max(12, triggerRect.top - cardHeight - 8);
    }

    // Horizontal positioning: align with trigger left, clamped to viewport bounds
    let left = triggerRect.left;
    if (left + cardWidth > window.innerWidth - 16) {
      left = window.innerWidth - cardWidth - 16;
    }
    if (left < 16) {
      left = 16;
    }

    setPosition({
      top,
      left,
      placement,
    });
  };

  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    calculatePosition();
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    closeTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 150);
  };

  const handlePopoverMouseEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  const handlePopoverMouseLeave = () => {
    closeTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 150);
  };

  // Recalculate position on scroll or resize when open
  useEffect(() => {
    if (!isOpen) return;

    const handleScrollOrResize = () => {
      calculatePosition();
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen]);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(record.phone);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Derive company name fallback if not explicitly stored
  const getDerivedCompany = () => {
    if (record.impersonatedCompany && record.impersonatedCompany !== 'N/A') {
      return record.impersonatedCompany;
    }
    const lower = `${record.scamType} ${record.snippet}`.toLowerCase();
    if (lower.includes('paypal')) return 'PayPal';
    if (lower.includes('apple') || lower.includes('icloud')) return 'Apple';
    if (lower.includes('geek squad') || lower.includes('best buy')) return 'Geek Squad / Best Buy';
    if (lower.includes('amazon')) return 'Amazon';
    if (lower.includes('mcafee')) return 'McAfee Antivirus';
    if (lower.includes('norton')) return 'Norton LifeLock';
    if (lower.includes('pch') || lower.includes('clearing house')) return 'Publishers Clearing House';
    if (lower.includes('hmrc')) return 'HM Revenue & Customs (HMRC)';
    if (lower.includes('crypto') || lower.includes('btc') || lower.includes('wallet')) return 'Crypto Recovery Service';
    if (lower.includes('spell') || lower.includes('psychic')) return 'Psychic / Love Spell Practitioner';
    return 'Financial / Tech Impersonator';
  };

  // Derive invoice number fallback
  const getDerivedInvoice = () => {
    if (record.invoiceNumber && record.invoiceNumber !== 'N/A') {
      return record.invoiceNumber;
    }
    const match = record.snippet.match(/(?:inv(?:oice)?|order|ref|case)[\s#:-]*([a-z0-9-]+)/i);
    if (match) return match[1];
    return 'N/A (Direct SMS / Call Alert)';
  };

  // Derive amount charged fallback
  const getDerivedAmount = () => {
    if (record.amountCharged && record.amountCharged !== 'N/A') {
      return record.amountCharged;
    }
    const match = record.snippet.match(/(\$[\d,]+(?:\.\d{2})?|£[\d,]+(?:\.\d{2})?)/);
    if (match) return match[1];
    return 'Unspecified / Variable Fee';
  };

  // Derive summary fallback
  const getDerivedSummary = () => {
    if (record.detailedSummary && record.detailedSummary.length > 10) {
      return record.detailedSummary;
    }
    if (record.snippet && record.snippet.length > 20) {
      return record.snippet;
    }
    return `Fraudulent hotline cataloged on ${record.platform} impersonating ${getDerivedCompany()}. Directs victims to fraudulent callback lines or fake remote support.`;
  };

  const company = getDerivedCompany();
  const invoice = getDerivedInvoice();
  const amount = getDerivedAmount();
  const summary = getDerivedSummary();

  const popoverContent = isOpen && typeof document !== 'undefined' ? (
    createPortal(
      <div
        ref={popoverRef}
        className="fixed z-[9999] w-80 md:w-96 p-4 bg-slate-900/98 border border-amber-500/40 rounded-2xl shadow-2xl backdrop-blur-md text-slate-100 animate-in fade-in zoom-in-95 duration-150 pointer-events-auto"
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
          filter: 'drop-shadow(0 20px 30px rgba(0, 0, 0, 0.85))',
        }}
        onMouseEnter={handlePopoverMouseEnter}
        onMouseLeave={handlePopoverMouseLeave}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-amber-500/15 text-amber-400 rounded-lg border border-amber-500/30">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold">
                Scam Intelligence Report
              </span>
              <h4 className="text-sm font-bold text-slate-100 leading-tight">
                {record.scamType}
              </h4>
            </div>
          </div>

          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-medium whitespace-nowrap">
            {record.platform}
          </span>
        </div>

        {/* Key Intelligence Badges Grid */}
        <div className="grid grid-cols-2 gap-2 my-3">
          {/* Impersonated Company */}
          <div className="p-2 bg-slate-950/80 rounded-xl border border-slate-800 space-y-0.5">
            <div className="flex items-center space-x-1 text-[10px] text-slate-400 font-medium">
              <Building2 className="w-3 h-3 text-blue-400" />
              <span>Impersonating:</span>
            </div>
            <p className="text-xs font-bold text-blue-300 truncate" title={company}>
              {company}
            </p>
          </div>

          {/* Amount Charged / Demanded */}
          <div className="p-2 bg-slate-950/80 rounded-xl border border-slate-800 space-y-0.5">
            <div className="flex items-center space-x-1 text-[10px] text-slate-400 font-medium">
              <DollarSign className="w-3 h-3 text-emerald-400" />
              <span>Amount / Fee:</span>
            </div>
            <p className="text-xs font-bold text-emerald-300 truncate" title={amount}>
              {amount}
            </p>
          </div>

          {/* Invoice / Reference Number */}
          <div className="p-2 bg-slate-950/80 rounded-xl border border-slate-800 space-y-0.5 col-span-2">
            <div className="flex items-center space-x-1 text-[10px] text-slate-400 font-medium">
              <Hash className="w-3 h-3 text-purple-400" />
              <span>Invoice / Order #:</span>
            </div>
            <p className="text-xs font-mono font-semibold text-purple-300 truncate" title={invoice}>
              {invoice}
            </p>
          </div>
        </div>

        {/* Full Summary Description */}
        <div className="p-2.5 bg-slate-950/90 rounded-xl border border-slate-800/90 space-y-1">
          <div className="flex items-center space-x-1 text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
            <FileText className="w-3 h-3 text-amber-400" />
            <span>Modus Operandi & Summary:</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed max-h-28 overflow-y-auto pr-1">
            {summary}
          </p>
        </div>

        {/* Phone Number & Direct Action Links */}
        <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center space-x-1.5 font-mono font-bold text-amber-400">
            <PhoneCall className="w-3.5 h-3.5 text-amber-500" />
            <span>{record.phone}</span>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center space-x-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md border border-slate-700 text-[11px] font-medium transition-colors"
              title="Copy phone"
            >
              {copied ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <a
              href={`https://wa.me/${record.cleanPhone}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1 px-2 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 rounded-md text-[11px] font-medium transition-colors"
              title="Open WhatsApp"
            >
              <MessageCircle className="w-3 h-3" />
              <span>WhatsApp</span>
            </a>

            <a
              href={record.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1 px-2 py-1 bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30 rounded-md text-[11px] font-medium transition-colors"
              title="Open Source Thread"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Source</span>
            </a>
          </div>
        </div>

        {/* Timestamp footer */}
        <div className="mt-2 text-[10px] text-slate-500 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatPST(record.detectedAt)}
          </span>
          <span className="text-amber-500/80">Hover info card</span>
        </div>
      </div>,
      document.body
    )
  ) : null;

  return (
    <div
      ref={triggerRef}
      className="relative inline-block w-full"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Target trigger element */}
      {children}

      {/* Portal Hover Popover Card */}
      {popoverContent}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { supabase, normalizePhone, formatPhoneDisplay, isTollFree } from '../lib/supabase';
import { requireDisclaimerAcceptance } from '../components/TermsBanner';
import { isUserCountryAllowed } from '../utils/geoIp';

export default function ReportScamPage() {
  const [phone, setPhone] = useState('');
  const [altPhone1, setAltPhone1] = useState('');
  const [altPhone2, setAltPhone2] = useState('');
  const [alt2IsWhatsApp, setAlt2IsWhatsApp] = useState(false);
  const [category, setCategory] = useState('Lottery & Sweepstakes Scams');
  const [company, setCompany] = useState('');
  const [howContacted, setHowContacted] = useState('Phone Call');
  const [incidentDate, setIncidentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [moneyLost, setMoneyLost] = useState('');
  const [isWhatsApp, setIsWhatsApp] = useState(false);
  const [description, setDescription] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [reporterEmail, setReporterEmail] = useState('');

  const [alert, setAlert] = useState<{ message: string; isError: boolean } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    document.title = 'Report a Scam Line | EndScams Watchdog';
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlert(null);

    if (!requireDisclaimerAcceptance()) return;

    const countryAllowed = await isUserCountryAllowed();
    if (!countryAllowed) {
      return;
    }

    const cleanPhone = phone.trim();
    const cleanDesc = description.trim();

    if (!cleanPhone || !cleanDesc) {
      setAlert({ message: 'Please provide both the scam phone number and a description.', isError: true });
      return;
    }

    const primaryDigits = normalizePhone(cleanPhone);
    if (primaryDigits.length < 7 || primaryDigits.length > 15) {
      setAlert({ message: 'Please enter a valid primary phone number (7-15 digits).', isError: true });
      return;
    }

    if (isTollFree(primaryDigits)) {
      setAlert({ message: 'Toll-free numbers (800, 888, 877, 866, 855, 844, 833) are strictly prohibited.', isError: true });
      return;
    }

    // Process Alt Numbers
    const altNumbersList: Array<{ phone: string; digits: string; is_whatsapp?: boolean }> = [];

    if (altPhone1.trim()) {
      const alt1Digits = normalizePhone(altPhone1.trim());
      if (alt1Digits.length >= 7 && !isTollFree(alt1Digits)) {
        altNumbersList.push({
          phone: formatPhoneDisplay(alt1Digits),
          digits: alt1Digits,
          is_whatsapp: false,
        });
      }
    }

    if (altPhone2.trim()) {
      const alt2Digits = normalizePhone(altPhone2.trim());
      if (alt2Digits.length >= 7 && !isTollFree(alt2Digits)) {
        altNumbersList.push({
          phone: formatPhoneDisplay(alt2Digits),
          digits: alt2Digits,
          is_whatsapp: alt2IsWhatsApp,
        });
      }
    }

    setIsSubmitting(true);

    const formattedPrimary = formatPhoneDisplay(primaryDigits);
    const amountVal = moneyLost ? `$${parseFloat(moneyLost).toFixed(2)}` : 'N/A';

    const payload = {
      phone_number: formattedPrimary,
      phone_digits: primaryDigits,
      category: category,
      impersonated_company: company.trim() || 'N/A',
      how_contacted: howContacted,
      incident_date: incidentDate,
      money_lost: moneyLost ? parseFloat(moneyLost) : null,
      amount_charged: amountVal,
      is_whatsapp: isWhatsApp,
      description: cleanDesc,
      reporter_name: reporterName.trim() || null,
      reporter_email: reporterEmail.trim() || null,
      alt_numbers: altNumbersList,
      source: 'user_report',
      source_name: 'EndScams Report (endscams.org/report)',
      source_url: typeof window !== 'undefined' ? window.location.href || 'https://endscams.org/report' : 'https://endscams.org/report',
    };

    try {
      // 1. Post to backend API
      try {
        await fetch('/api/report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch (err) {
        console.warn('[Report] Backend /api/report request failed:', err);
      }

      // 2. Direct Supabase Storage Persist
      try {
        await supabase.from('scam_reports').insert({
          phone_number: formattedPrimary,
          phone_digits: primaryDigits,
          category: category,
          description: cleanDesc,
          how_contacted: howContacted,
          incident_date: incidentDate,
          reporter_name: reporterName.trim() || null,
          reporter_email: reporterEmail.trim() || null,
          money_lost: moneyLost ? parseFloat(moneyLost) : null,
          source: 'user_report',
        });

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 60);

        await supabase.from('tracker_entries').upsert({
          id: `rec-${primaryDigits}`,
          phone_number: formattedPrimary,
          phone_digits: primaryDigits,
          source_name: 'User Report (endscams.org/report)',
          source_url: 'https://endscams.org/report',
          report_date: incidentDate,
          category: category,
          impersonated_company: company.trim() || 'N/A',
          description: cleanDesc,
          amount_charged: amountVal,
          is_down: false,
          expires_at: expiresAt.toISOString(),
        }, { onConflict: 'phone_digits' });
      } catch (sbErr) {
        console.warn('[Report] Supabase persist notice:', sbErr);
      }

      // 3. Sync across active browser windows via BroadcastChannels
      const reportRecord = {
        id: `report-${Date.now()}-${primaryDigits}`,
        phone: formattedPrimary,
        phone_number: formattedPrimary,
        phone_digits: primaryDigits,
        cleanPhone: primaryDigits,
        category: category,
        scamType: category,
        impersonated_company: company.trim() || 'N/A',
        impersonatedCompany: company.trim() || 'N/A',
        description: cleanDesc,
        detailedSummary: cleanDesc,
        snippet: cleanDesc,
        how_contacted: howContacted,
        incident_date: incidentDate,
        report_date: incidentDate,
        postDate: incidentDate,
        money_lost: moneyLost ? parseFloat(moneyLost) : null,
        amount_charged: amountVal,
        amountCharged: amountVal,
        is_whatsapp: isWhatsApp,
        isWhatsapp: isWhatsApp,
        alt_numbers: altNumbersList,
        altNumbers: altNumbersList.map((a) => a.phone),
        source: 'user_report',
        source_name: 'User Report (endscams.org/report)',
        source_url: 'https://endscams.org/report',
        platform: howContacted,
        timestamp: new Date().toISOString(),
      };

      try {
        if ('BroadcastChannel' in window) {
          const bc1 = new BroadcastChannel('endscams-reports');
          bc1.postMessage({ type: 'NEW_REPORT', report: reportRecord, payload: reportRecord });
          bc1.close();

          const bc2 = new BroadcastChannel('end_scam_scan_sync_channel');
          bc2.postMessage({
            type: 'ADD_RECORD',
            event: 'ADD_RECORD',
            action: 'ADD_RECORD',
            payload: reportRecord,
            record: reportRecord,
          });
          bc2.close();
        }
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'ENDSCAMS_REPORT', payload: reportRecord, record: reportRecord }, '*');
        }
      } catch (bcErr) {
        console.warn('[Report] BroadcastChannel sync warning:', bcErr);
      }

      // 4. LocalStorage shared sync for /tracker
      try {
        const userReportsRaw = localStorage.getItem('user_reported_scams') || '[]';
        const userReports = JSON.parse(userReportsRaw);
        userReports.unshift(reportRecord);
        localStorage.setItem('user_reported_scams', JSON.stringify(userReports));

        const esscanRaw = localStorage.getItem('esscan_threat_records_v2') || '[]';
        const esscanRecords = JSON.parse(esscanRaw);
        const filtered = Array.isArray(esscanRecords) ? esscanRecords.filter((r: any) => (r.phone_digits || r.phone) !== primaryDigits) : [];
        filtered.unshift({
          id: reportRecord.id,
          phone_number: formattedPrimary,
          phone_digits: primaryDigits,
          source_name: 'User Report (endscams.org/report)',
          source_url: 'https://endscams.org/report',
          report_date: incidentDate,
          category: category,
          description: cleanDesc,
          impersonated_company: company.trim() || 'N/A',
          invoice_number: 'N/A',
          amount_charged: amountVal,
          is_whatsapp: isWhatsApp,
          alt_numbers: altNumbersList,
          is_down: false,
        });
        localStorage.setItem('esscan_threat_records_v2', JSON.stringify(filtered));
      } catch (lsErr) {
        console.warn('[Report] LocalStorage sync warning:', lsErr);
      }

      setAlert({
        message: `Success! ${formattedPrimary} (${company.trim() || 'Reported Entity'}) has been recorded and synchronized with the tracker.`,
        isError: false,
      });

      // Reset form fields
      setPhone('');
      setAltPhone1('');
      setAltPhone2('');
      setAlt2IsWhatsApp(false);
      setCompany('');
      setDescription('');
      setMoneyLost('');
      setIsWhatsApp(false);
      setReporterName('');
      setReporterEmail('');
      setIncidentDate(new Date().toISOString().split('T')[0]);
    } catch (err: any) {
      setAlert({ message: err.message || 'Error submitting report.', isError: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 py-10 px-4 text-slate-100 flex items-center justify-center">
      {/* EndScams Direct Report Form Container */}
      <div
        id="endscams-report-container"
        style={{
          maxWidth: '720px',
          width: '100%',
          margin: '0 auto',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          color: '#f1f5f9',
          background: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
            borderBottom: '1px solid #1e293b',
            paddingBottom: '16px',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#ffffff' }}>Report a Scam Line</h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
              Instantly catalog scam phone numbers to the live public tracker.
            </p>
          </div>
          <span
            style={{
              fontSize: '0.7rem',
              fontFamily: 'monospace',
              background: 'rgba(16, 185, 129, 0.1)',
              color: '#34d399',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              padding: '4px 10px',
              borderRadius: '9999px',
            }}
          >
            Live Sync Active
          </span>
        </div>

        {alert && (
          <div
            id="report-alert"
            style={{
              display: 'block',
              padding: '12px 16px',
              borderRadius: '10px',
              marginBottom: '16px',
              fontSize: '0.875rem',
              background: alert.isError ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
              color: alert.isError ? '#fca5a5' : '#6ee7b7',
              border: `1px solid ${alert.isError ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
            }}
          >
            {alert.message}
          </div>
        )}

        <form id="endscams-report-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Phone & Category */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '6px', color: '#e2e8f0' }}>
                Scam Phone Number <span style={{ color: '#f87171' }}>*</span>
              </label>
              <input
                type="tel"
                id="report-phone"
                name="phone_number"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 1 (502) 237-9660 or 800-..."
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 14px',
                  background: '#020617',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  color: '#ffffff',
                  fontSize: '0.875rem',
                }}
              />
              <span style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '4px', display: 'block' }}>
                Real dialable scam numbers only.
              </span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '6px', color: '#e2e8f0' }}>
                Scam Category <span style={{ color: '#f87171' }}>*</span>
              </label>
              <select
                id="report-category"
                name="category"
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 14px',
                  background: '#020617',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  color: '#ffffff',
                  fontSize: '0.875rem',
                }}
              >
                <option value="Lottery & Sweepstakes Scams">Lottery & Sweepstakes Scams (American Cash Award, PCH, etc.)</option>
                <option value="General Tech Support & Refund Scams">General Tech Support & Refund Scams</option>
                <option value="Crypto BTC Recovery Scam">Crypto BTC Recovery Scam</option>
                <option value="Social Media Prize & Giveaway Scam">Social Media Prize & Giveaway Scam</option>
                <option value="Government Impersonation & Warrant Scams">Government Impersonation & Warrant Scams</option>
                <option value="Emergency & Grandparent Scams">Emergency & Grandparent Scams</option>
                <option value="Spellcaster WhatsApp Extortion">Spellcaster WhatsApp Extortion</option>
                <option value="Publishing Chat Scam">Publishing Chat Scam</option>
                <option value="Spiritual / Herbal / Fortune Scam">Spiritual / Herbal / Fortune Scam</option>
                <option value="Other Scam">Other Scam</option>
              </select>
            </div>
          </div>

          {/* Extra Row for Alt Number #1 and Alt Number #2 / WhatsApp */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '6px', color: '#cbd5e1' }}>
                Alt Phone Number #1 <span style={{ color: '#64748b', fontWeight: 'normal' }}>(Optional)</span>
              </label>
              <input
                type="tel"
                id="report-alt-phone-1"
                name="alt_phone_1"
                value={altPhone1}
                onChange={(e) => setAltPhone1(e.target.value)}
                placeholder="e.g. +1 (502) 237-9661"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 14px',
                  background: '#020617',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  color: '#ffffff',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#cbd5e1' }}>
                  Alt Phone Number #2 / WhatsApp <span style={{ color: '#64748b', fontWeight: 'normal' }}>(Optional)</span>
                </label>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="tel"
                  id="report-alt-phone-2"
                  name="alt_phone_2"
                  value={altPhone2}
                  onChange={(e) => setAltPhone2(e.target.value)}
                  placeholder="e.g. +234 810 552 9412"
                  style={{
                    flex: 1,
                    boxSizing: 'border-box',
                    padding: '10px 14px',
                    background: '#020617',
                    border: '1px solid #334155',
                    borderRadius: '10px',
                    color: '#ffffff',
                    fontSize: '0.875rem',
                  }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: '#34d399', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  <input
                    type="checkbox"
                    checked={alt2IsWhatsApp}
                    onChange={(e) => setAlt2IsWhatsApp(e.target.checked)}
                    style={{ width: '14px', height: '14px', accentColor: '#10b981' }}
                  />
                  <span>WhatsApp</span>
                </label>
              </div>
            </div>
          </div>

          {/* Impersonated Entity & How Contacted */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '6px', color: '#e2e8f0' }}>
                Impersonated Company / Scammer Name
              </label>
              <input
                type="text"
                id="report-company"
                name="impersonated_company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. American Cash Award (James Washington) or Geek Squad"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 14px',
                  background: '#020617',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  color: '#ffffff',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '6px', color: '#e2e8f0' }}>
                How Were You Contacted?
              </label>
              <select
                id="report-how-contacted"
                name="how_contacted"
                value={howContacted}
                onChange={(e) => setHowContacted(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 14px',
                  background: '#020617',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  color: '#ffffff',
                  fontSize: '0.875rem',
                }}
              >
                <option value="Phone Call">Phone Call</option>
                <option value="Text Message">Text Message</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Email">Email</option>
                <option value="Social Media">Social Media</option>
                <option value="Website">Website</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* Date & Money Lost */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '6px', color: '#e2e8f0' }}>
                Date of Incident
              </label>
              <input
                type="date"
                id="report-date"
                name="incident_date"
                value={incidentDate}
                onChange={(e) => setIncidentDate(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 14px',
                  background: '#020617',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  color: '#ffffff',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '6px', color: '#e2e8f0' }}>
                Financial Loss ($) <span style={{ color: '#64748b', fontWeight: 'normal' }}>(Optional)</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                id="report-loss"
                name="money_lost"
                value={moneyLost}
                onChange={(e) => setMoneyLost(e.target.value)}
                placeholder="e.g. 250.00"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 14px',
                  background: '#020617',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  color: '#ffffff',
                  fontSize: '0.875rem',
                }}
              />
            </div>
          </div>

          {/* WhatsApp Checkbox */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              id="report-whatsapp"
              name="is_whatsapp"
              checked={isWhatsApp}
              onChange={(e) => setIsWhatsApp(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: '#ef4444', cursor: 'pointer' }}
            />
            <label htmlFor="report-whatsapp" style={{ fontSize: '0.75rem', color: '#cbd5e1', cursor: 'pointer' }}>
              This primary phone number operates as a WhatsApp or direct messaging threat line
            </label>
          </div>

          {/* Description */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '6px', color: '#e2e8f0' }}>
              Describe What Happened <span style={{ color: '#f87171' }}>*</span>
            </label>
            <textarea
              id="report-description"
              name="description"
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide details on the call or message: What did the scammer say? What name did they give? What fees or gift cards did they demand? Any secondary callback numbers..."
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px 14px',
                background: '#020617',
                border: '1px solid #334155',
                borderRadius: '10px',
                color: '#ffffff',
                fontSize: '0.875rem',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Reporter info (Optional) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '6px', color: '#94a3b8' }}>
                Your Name / Initials <span style={{ color: '#64748b', fontWeight: 'normal' }}>(Optional)</span>
              </label>
              <input
                type="text"
                id="report-reporter-name"
                name="reporter_name"
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
                placeholder="e.g. Anonymous or J.D."
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '8px 12px',
                  background: '#020617',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  color: '#ffffff',
                  fontSize: '0.75rem',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '6px', color: '#94a3b8' }}>
                Your Email <span style={{ color: '#64748b', fontWeight: 'normal' }}>(Optional)</span>
              </label>
              <input
                type="email"
                id="report-reporter-email"
                name="reporter_email"
                value={reporterEmail}
                onChange={(e) => setReporterEmail(e.target.value)}
                placeholder="e.g. reporter@example.com"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '8px 12px',
                  background: '#020617',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  color: '#ffffff',
                  fontSize: '0.75rem',
                }}
              />
            </div>
          </div>

          {/* Submit Button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #1e293b', paddingTop: '16px', marginTop: '8px' }}>
            <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Submissions persist directly to the PostgreSQL database.</span>
            <button
              type="submit"
              id="report-submit-btn"
              disabled={isSubmitting}
              style={{
                background: 'linear-gradient(135deg, #dc2626, #e11d48)',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.875rem',
                padding: '10px 24px',
                border: 'none',
                borderRadius: '10px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.6 : 1,
                transition: 'opacity 0.2s',
              }}
            >
              {isSubmitting ? 'Submitting to Database...' : 'Submit Scam Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

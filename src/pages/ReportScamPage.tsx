import React, { useState, useEffect } from 'react';
import { supabase, normalizePhone, formatPhoneDisplay } from '../lib/supabase';
import { requireDisclaimerAcceptance } from '../components/TermsBanner';
import { isUserCountryAllowed } from '../utils/geoIp';

export default function ReportScamPage() {
  const [phone, setPhone] = useState('');
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
    document.title = 'Report a Scam | EndScams';
  }, []);

  const showAlert = (message: string, isError: boolean) => {
    setAlert({ message, isError });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!requireDisclaimerAcceptance()) return;

    const countryAllowed = await isUserCountryAllowed();
    if (!countryAllowed) {
      return;
    }

    if (!phone.trim() || !description.trim()) {
      showAlert('Please provide both the scam phone number and a description.', true);
      return;
    }

    setIsSubmitting(true);
    setAlert(null);

    const digits = normalizePhone(phone);
    const formattedPhone = digits ? formatPhoneDisplay(digits) : phone;

    const payload = {
      phone_number: phone.trim(),
      category: category,
      impersonated_company: company.trim(),
      how_contacted: howContacted,
      incident_date: incidentDate,
      money_lost: moneyLost ? parseFloat(moneyLost) : null,
      is_whatsapp: isWhatsApp,
      description: description.trim(),
      reporter_name: reporterName.trim(),
      reporter_email: reporterEmail.trim(),
      source: 'user_report',
      source_name: 'EndScams Report (endscams.org/report)',
      source_url: window.location.href || 'https://endscams.org/report',
    };

    let backendSuccess = false;

    try {
      // 1. Post to tracker backend API endpoint
      const targetEndpoint = '/api/report';
      const res = await fetch(targetEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        backendSuccess = true;
      }
    } catch (err) {
      console.warn('Backend /api/report fetch warning:', err);
    }

    // Direct Supabase Fallback/Sync for client-side resiliency
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 60);

      const trackerEntry = {
        id: `rec-${digits || Date.now()}`,
        phone_number: formattedPhone,
        phone_digits: digits || phone.replace(/\D/g, ''),
        source_name: 'User Report',
        source_url: '/report',
        report_date: incidentDate || new Date().toISOString().split('T')[0],
        category: category,
        description: description.trim(),
        impersonated_company: company.trim() || 'N/A',
        invoice_number: 'N/A',
        amount_charged: moneyLost ? `$${parseFloat(moneyLost).toFixed(2)}` : 'N/A',
        reported_down: false,
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      };

      await supabase.from('tracker_entries').upsert(trackerEntry, { onConflict: 'phone_digits,source_name' });
      await supabase.from('scam_reports').insert({
        phone_number: formattedPhone,
        phone_digits: digits,
        category,
        description: description.trim(),
        how_contacted: howContacted,
        incident_date: incidentDate,
        reporter_name: reporterName.trim() || null,
        reporter_email: reporterEmail.trim() || null,
        money_lost: moneyLost ? parseFloat(moneyLost) : null,
        source: 'user_report',
      });
    } catch (sbErr) {
      console.warn('Supabase direct insert warning:', sbErr);
    }

    // 2. Broadcast across tabs and windows
    try {
      if ('BroadcastChannel' in window) {
        const bc1 = new BroadcastChannel('endscams-reports');
        bc1.postMessage({ type: 'NEW_REPORT', report: payload });
        bc1.close();

        const bc2 = new BroadcastChannel('end_scam_scan_sync_channel');
        bc2.postMessage({
          type: 'ADD_RECORD',
          event: 'ADD_RECORD',
          action: 'ADD_RECORD',
          payload: {
            record: {
              id: `user-report-${Date.now()}-${digits}`,
              phone_number: formattedPhone,
              phone_digits: digits,
              source_name: 'User Report',
              source_url: '/report',
              report_date: incidentDate,
              category,
              description: description.trim(),
              impersonated_company: company.trim() || 'N/A',
              amount_charged: moneyLost ? `$${parseFloat(moneyLost).toFixed(2)}` : 'N/A',
              is_down: false,
            },
          },
        });
        bc2.close();
      }

      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'ENDSCAMS_REPORT', payload: payload }, '*');
      }
    } catch (bcErr) {
      console.warn('Broadcast warning:', bcErr);
    }

    // Save to local storage cache so Tracker page re-hydrates immediately
    try {
      const trackerRecord = {
        id: `user-report-${Date.now()}-${digits}`,
        phone_number: formattedPhone,
        phone_digits: digits,
        source_name: 'User Report',
        source_url: '/report',
        report_date: incidentDate,
        category,
        description: description.trim(),
        impersonated_company: company.trim() || 'N/A',
        invoice_number: 'N/A',
        amount_charged: moneyLost ? `$${parseFloat(moneyLost).toFixed(2)}` : 'N/A',
        is_down: false,
      };

      const esscanRaw = localStorage.getItem('esscan_threat_records_v2') || '[]';
      const esscanRecords = JSON.parse(esscanRaw);
      const filtered = Array.isArray(esscanRecords) ? esscanRecords.filter((r: any) => (r.phone_digits || r.phone) !== digits) : [];
      filtered.unshift(trackerRecord);
      localStorage.setItem('esscan_threat_records_v2', JSON.stringify(filtered));
    } catch (lsErr) {
      console.warn('LocalStorage sync warning:', lsErr);
    }

    showAlert(`Success! ${phone} (${company || 'Reported Entity'}) has been recorded and synchronized with the tracker.`, false);

    // Reset form
    setPhone('');
    setCompany('');
    setMoneyLost('');
    setIsWhatsApp(false);
    setDescription('');
    setReporterName('');
    setReporterEmail('');
    setIncidentDate(new Date().toISOString().split('T')[0]);
    setIsSubmitting(false);
  };

  return (
    <div className="py-8 px-4">
      {/* EndScams Direct Report Form */}
      <div
        id="endscams-report-container"
        style={{
          maxWidth: '720px',
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
            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>Instantly catalog scam phone numbers to the live public tracker.</p>
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
              <span style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '4px', display: 'block' }}>Real dialable scam numbers only.</span>
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
              style={{ width: '16px', height: '16px', accentColor: '#ef4444' }}
            />
            <label htmlFor="report-whatsapp" style={{ fontSize: '0.75rem', color: '#cbd5e1', cursor: 'pointer' }}>
              This phone number operates as a WhatsApp or direct messaging threat line
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
            ></textarea>
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
                cursor: 'pointer',
                transition: 'opacity 0.2s',
                opacity: isSubmitting ? 0.7 : 1,
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

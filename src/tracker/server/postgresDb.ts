import { Pool } from 'pg';
import { ScamPhoneRecord } from '../types';
import { getSecurePostgresUrl, getDatabaseSourceInfo, maskConnectionString, DatabaseSourceInfo } from './secureConfig';
import { NINETY_DAYS_MS, SIX_MONTHS_MS, isPrizeOrExtendedRetentionRecord } from '../utils/retentionUtils';

let poolInstance: Pool | null = null;
let loggedSource = false;

export { getDatabaseSourceInfo, maskConnectionString };
export type { DatabaseSourceInfo };

export function getPgPool(): Pool {
  if (!poolInstance) {
    const connStr = getSecurePostgresUrl(true);
    const srcInfo = getDatabaseSourceInfo();
    
    if (!loggedSource) {
      console.log(`[PostgreSQL DB] Active Database Source: ${srcInfo.source}`);
      console.log(`[PostgreSQL DB] Connection Target: ${srcInfo.sanitizedUrl} (Direct: ${srcInfo.isDirect ? 'Yes' : 'No'})`);
      loggedSource = true;
    }

    poolInstance = new Pool({
      connectionString: connStr,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    });

    poolInstance.on('error', (err) => {
      console.warn('[PostgreSQL Pool Note]', err.message);
    });
  }
  return poolInstance;
}

export async function testPostgresConnection(): Promise<{ ok: boolean; count?: number; error?: string; sourceInfo: DatabaseSourceInfo; latencyMs?: number }> {
  const start = Date.now();
  const sourceInfo = getDatabaseSourceInfo();
  try {
    const pool = getPgPool();
    const res = await pool.query('SELECT count(*) as count FROM tracker_entries');
    const latencyMs = Date.now() - start;
    return {
      ok: true,
      count: parseInt(res.rows[0]?.count || '0', 10),
      latencyMs,
      sourceInfo,
    };
  } catch (err: any) {
    return {
      ok: false,
      error: err.message,
      sourceInfo,
      latencyMs: Date.now() - start,
    };
  }
}

// Ensures required schema, tables, indexes, and constraints exist in PostgreSQL
export async function initPostgresDb(): Promise<boolean> {
  try {
    const pool = getPgPool();
    // 1. Ensure scam_reports table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS scam_reports (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        phone_number text,
        phone_digits text,
        category text,
        description text,
        how_contacted text,
        incident_date text,
        reporter_name text,
        reporter_email text,
        money_lost numeric,
        source text DEFAULT 'user_report',
        file_url text,
        file_name text,
        file_type text,
        created_at timestamp with time zone DEFAULT now()
      );
    `);

    // 2. Ensure tracker_entries table exists and has needed columns & constraints
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tracker_entries (
        id text PRIMARY KEY,
        phone_number text NOT NULL,
        phone_digits text NOT NULL,
        country_code text,
        country_name text,
        scam_type text,
        category text,
        impersonated_company text,
        invoice_number text,
        amount_charged text,
        source_platform text,
        source_name text,
        source_url text,
        source_domain text,
        threat_intel text,
        description text,
        detected_at timestamp with time zone,
        report_date text,
        post_date text,
        is_down boolean DEFAULT false,
        status text,
        expires_at timestamp with time zone,
        updated_at timestamp with time zone DEFAULT now(),
        created_at timestamp with time zone DEFAULT now()
      );
    `);

    // 3. Ensure constraint on tracker_entries (phone_digits, source_name)
    try {
      await pool.query(`
        ALTER TABLE tracker_entries DROP CONSTRAINT IF EXISTS tracker_entries_phone_source_key;
        ALTER TABLE tracker_entries ADD CONSTRAINT tracker_entries_phone_source_key UNIQUE (phone_digits, source_name);
      `);
    } catch {}

    // 4. Ensure scam_records table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS scam_records (
        id text PRIMARY KEY,
        phone text,
        phone_number text,
        clean_phone text,
        phone_digits text,
        country_code text,
        country_name text,
        scam_type text,
        category text,
        impersonated_company text,
        invoice_number text,
        amount_charged text,
        platform text,
        source_platform text,
        source_name text,
        source_url text,
        source_domain text,
        snippet text,
        threat_intel text,
        detailed_summary text,
        description text,
        detected_at timestamp with time zone,
        report_date text,
        post_date text,
        is_down boolean DEFAULT false,
        is_number_down boolean DEFAULT false,
        status text,
        expires_at timestamp with time zone,
        updated_at timestamp with time zone DEFAULT now(),
        created_at timestamp with time zone DEFAULT now()
      );
    `);

    // Ensure extended columns exist in tracker_entries and scam_records
    try {
      await pool.query(`
        ALTER TABLE tracker_entries ADD COLUMN IF NOT EXISTS alt_numbers text;
        ALTER TABLE tracker_entries ADD COLUMN IF NOT EXISTS is_whatsapp boolean DEFAULT false;
        ALTER TABLE tracker_entries ADD COLUMN IF NOT EXISTS how_contacted text;
        ALTER TABLE tracker_entries ADD COLUMN IF NOT EXISTS money_lost numeric;
        ALTER TABLE tracker_entries ADD COLUMN IF NOT EXISTS reporter_name text;
        ALTER TABLE tracker_entries ADD COLUMN IF NOT EXISTS reporter_email text;
        ALTER TABLE tracker_entries ADD COLUMN IF NOT EXISTS image_url text;

        ALTER TABLE scam_records ADD COLUMN IF NOT EXISTS alt_numbers text;
        ALTER TABLE scam_records ADD COLUMN IF NOT EXISTS is_whatsapp boolean DEFAULT false;
        ALTER TABLE scam_records ADD COLUMN IF NOT EXISTS how_contacted text;
        ALTER TABLE scam_records ADD COLUMN IF NOT EXISTS money_lost numeric;
        ALTER TABLE scam_records ADD COLUMN IF NOT EXISTS reporter_name text;
        ALTER TABLE scam_records ADD COLUMN IF NOT EXISTS reporter_email text;
        ALTER TABLE scam_records ADD COLUMN IF NOT EXISTS image_url text;
      `);
    } catch {}

    console.log('[PostgreSQL DB] Initialized and verified tables: tracker_entries, scam_records, scam_reports.');
    return true;
  } catch (err: any) {
    console.warn('[PostgreSQL DB] Init error:', err.message);
    return false;
  }
}

// Fetch all records from tracker_entries & scam_records on startup for store hydration
export async function fetchAllRecordsFromPostgres(): Promise<ScamPhoneRecord[]> {
  try {
    const pool = getPgPool();
    const res = await pool.query(`
      SELECT id, phone_number, phone_digits, country_code, country_name, scam_type, category,
             impersonated_company, invoice_number, amount_charged, source_platform, source_name,
             source_url, source_domain, threat_intel, description, detected_at, report_date,
             post_date, is_down, status, expires_at, updated_at,
             alt_numbers, is_whatsapp, how_contacted, money_lost, reporter_name, reporter_email, image_url
      FROM tracker_entries
      ORDER BY updated_at DESC NULLS LAST, id DESC
      LIMIT 1000;
    `);

    const records: ScamPhoneRecord[] = [];
    const seen = new Set<string>();

    for (const row of res.rows) {
      const clean = String(row.phone_digits || (row.phone_number ? row.phone_number.replace(/\D/g, '') : '')).trim();
      if (!clean || seen.has(clean)) continue;
      seen.add(clean);

      let parsedAlts: string[] | undefined = undefined;
      if (row.alt_numbers) {
        try {
          const parsed = JSON.parse(row.alt_numbers);
          if (Array.isArray(parsed)) {
            parsedAlts = parsed.map((a: any) => (typeof a === 'string' ? a : a.phone || a.digits));
          }
        } catch {
          parsedAlts = [row.alt_numbers];
        }
      }

      records.push({
        id: row.id || `rec-${clean}`,
        phone: row.phone_number || clean,
        cleanPhone: clean,
        isWhatsapp: Boolean(row.is_whatsapp),
        altNumbers: parsedAlts,
        countryCode: row.country_code || 'US',
        countryName: row.country_name || 'United States',
        scamType: row.scam_type || row.category || 'General Tech Support & Refund Scams',
        impersonatedCompany: row.impersonated_company || 'N/A',
        scammerName: row.impersonated_company || undefined,
        invoiceNumber: row.invoice_number || 'N/A',
        amountCharged: row.amount_charged || (row.money_lost ? `$${row.money_lost}` : 'N/A'),
        moneyLost: row.money_lost || undefined,
        howContacted: row.how_contacted || undefined,
        reporterName: row.reporter_name || undefined,
        reporterEmail: row.reporter_email || undefined,
        imageUrl: row.image_url || undefined,
        platform: row.source_name || row.source_platform || 'Threat Intelligence',
        sourceUrl: row.source_url || 'https://endscams.org/report',
        sourceDomain: row.source_domain || 'endscams.org',
        snippet: row.description || row.threat_intel || 'Threat record',
        detailedSummary: row.description || row.threat_intel || 'Threat record',
        detectedAt: row.detected_at ? new Date(row.detected_at).toISOString() : new Date().toISOString(),
        postDate: row.report_date || row.post_date || '2026-09-19',
        isNumberDown: Boolean(row.is_down),
        confidence: 'High',
      });
    }

    return records;
  } catch (err: any) {
    console.warn('[PostgreSQL DB] fetchAllRecordsFromPostgres error:', err.message);
    return [];
  }
}

// Poll new submissions added to tracker_entries or scam_reports (e.g. from https://endscams.org/report)
export async function fetchNewThreatsFromPostgres(existingDigits: Set<string>): Promise<ScamPhoneRecord[]> {
  try {
    const pool = getPgPool();
    const newThreats: ScamPhoneRecord[] = [];
    const newlyDiscoveredDigits = new Set<string>();

    // 1. Check tracker_entries
    const trackerRes = await pool.query(`
      SELECT id, phone_number, phone_digits, country_code, country_name, scam_type, category,
             impersonated_company, invoice_number, amount_charged, source_platform, source_name,
             source_url, source_domain, threat_intel, description, detected_at, report_date,
             post_date, is_down, status, expires_at, updated_at
      FROM tracker_entries
      ORDER BY updated_at DESC NULLS LAST, id DESC
      LIMIT 30;
    `);

    for (const row of trackerRes.rows) {
      const clean = String(row.phone_digits || (row.phone_number ? row.phone_number.replace(/\D/g, '') : '')).trim();
      if (!clean || clean.length < 7) continue;
      if (newlyDiscoveredDigits.has(clean)) continue;

      // Allow if new, OR if updated within the last 30 minutes
      const isRecentlyUpdated = row.updated_at && (Date.now() - new Date(row.updated_at).getTime() < 30 * 60 * 1000);
      if (existingDigits.has(clean) && !isRecentlyUpdated) continue;

      newlyDiscoveredDigits.add(clean);
      newThreats.push({
        id: row.id || `rec-${clean}`,
        phone: row.phone_number || clean,
        cleanPhone: clean,
        countryCode: row.country_code || 'US',
        countryName: row.country_name || 'United States',
        scamType: row.scam_type || row.category || 'General Tech Support & Refund Scams',
        impersonatedCompany: row.impersonated_company || 'Community Submission',
        invoiceNumber: row.invoice_number || 'N/A',
        amountCharged: row.amount_charged || 'N/A',
        platform: row.source_name || row.source_platform || 'EndScams Report (endscams.org/report)',
        sourceUrl: row.source_url || 'https://endscams.org/report',
        sourceDomain: row.source_domain || 'endscams.org',
        snippet: row.description || row.threat_intel || 'Reported via https://endscams.org/report',
        detectedAt: row.detected_at ? new Date(row.detected_at).toISOString() : new Date().toISOString(),
        postDate: row.report_date || row.post_date || new Date().toISOString().slice(0, 10),
        isNumberDown: Boolean(row.is_down),
        confidence: 'High',
      });
    }

    // 2. Check scam_reports table
    try {
      const reportsRes = await pool.query(`
        SELECT id, phone_number, phone_digits, category, description, how_contacted,
               incident_date, reporter_name, money_lost, source, file_url, created_at
        FROM scam_reports
        ORDER BY created_at DESC NULLS LAST
        LIMIT 30;
      `);

      for (const rep of reportsRes.rows) {
        const clean = String(rep.phone_digits || (rep.phone_number ? rep.phone_number.replace(/\D/g, '') : '')).trim();
        if (!clean || clean.length < 7) continue;
        if (existingDigits.has(clean) || newlyDiscoveredDigits.has(clean)) continue;

        newlyDiscoveredDigits.add(clean);
        newThreats.push({
          id: `rep-${rep.id || clean}`,
          phone: rep.phone_number || clean,
          cleanPhone: clean,
          countryCode: 'US',
          countryName: 'United States',
          scamType: rep.category || 'General Tech Support & Refund Scams',
          impersonatedCompany: 'Community Submission',
          invoiceNumber: 'N/A',
          amountCharged: rep.money_lost ? `$${rep.money_lost}` : 'N/A',
          platform: 'EndScams User Report (endscams.org/report)',
          sourceUrl: 'https://endscams.org/report',
          sourceDomain: 'endscams.org',
          snippet: rep.description || 'Reported on endscams.org/report',
          detectedAt: rep.created_at ? new Date(rep.created_at).toISOString() : new Date().toISOString(),
          postDate: rep.incident_date || new Date().toISOString().slice(0, 10),
          isNumberDown: false,
          confidence: 'High',
        });
      }
    } catch {}

    return newThreats;
  } catch (err: any) {
    console.warn('[PostgreSQL DB] fetchNewThreatsFromPostgres error:', err.message);
    return [];
  }
}

// Upsert a single record into tracker_entries and scam_records
export async function syncSingleRecordToPostgres(r: ScamPhoneRecord): Promise<boolean> {
  try {
    const pool = getPgPool();
    const clean = String(r.cleanPhone || r.phone.replace(/\D/g, '')).trim();
    if (!clean) return false;

    const dateStr = r.postDate || (r.detectedAt ? String(r.detectedAt).slice(0, 10) : '2026-09-19');
    const recId = r.id || `rec-${clean}`;
    const sourceName = r.platform || 'EndScams Report (endscams.org/report)';

    // 1. Upsert tracker_entries
    await pool.query(`
      INSERT INTO tracker_entries (
        id, phone_number, phone_digits, country_code, country_name, scam_type, category,
        impersonated_company, invoice_number, amount_charged, source_platform, source_name,
        source_url, source_domain, threat_intel, description, detected_at, report_date,
        post_date, is_down, status, expires_at, updated_at,
        alt_numbers, is_whatsapp, how_contacted, money_lost, reporter_name, reporter_email, image_url
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, NOW(),
        $23, $24, $25, $26, $27, $28, $29
      )
      ON CONFLICT (phone_digits)
      DO UPDATE SET
        phone_number = EXCLUDED.phone_number,
        impersonated_company = EXCLUDED.impersonated_company,
        category = EXCLUDED.category,
        scam_type = EXCLUDED.scam_type,
        invoice_number = EXCLUDED.invoice_number,
        amount_charged = EXCLUDED.amount_charged,
        description = EXCLUDED.description,
        threat_intel = EXCLUDED.threat_intel,
        source_name = EXCLUDED.source_name,
        source_url = EXCLUDED.source_url,
        source_platform = EXCLUDED.source_platform,
        source_domain = EXCLUDED.source_domain,
        report_date = EXCLUDED.report_date,
        post_date = EXCLUDED.post_date,
        detected_at = EXCLUDED.detected_at,
        is_down = EXCLUDED.is_down,
        status = EXCLUDED.status,
        alt_numbers = EXCLUDED.alt_numbers,
        is_whatsapp = EXCLUDED.is_whatsapp,
        how_contacted = EXCLUDED.how_contacted,
        money_lost = EXCLUDED.money_lost,
        reporter_name = EXCLUDED.reporter_name,
        reporter_email = EXCLUDED.reporter_email,
        image_url = EXCLUDED.image_url,
        updated_at = NOW();
    `, [
      recId,
      r.phone,
      clean,
      r.countryCode || 'US',
      r.countryName || 'United States',
      r.scamType || 'General Tech Support & Refund Scams',
      r.scamType || 'General Tech Support & Refund Scams',
      r.scammerName || r.impersonatedCompany || 'N/A',
      r.invoiceNumber || 'N/A',
      r.amountCharged || 'N/A',
      r.platform || 'Threat Intelligence',
      sourceName,
      r.sourceUrl || '',
      r.sourceDomain || '',
      r.detailedSummary || r.snippet || '',
      r.detailedSummary || r.snippet || '',
      r.detectedAt ? new Date(r.detectedAt) : new Date(),
      dateStr,
      dateStr,
      Boolean(r.isNumberDown),
      r.isNumberDown ? 'Out of Service' : 'Active',
      new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      r.altNumbers ? JSON.stringify(r.altNumbers) : null,
      Boolean(r.isWhatsapp),
      r.howContacted || null,
      r.moneyLost ? Number(r.moneyLost) : null,
      r.reporterName || null,
      r.reporterEmail || null,
      r.imageUrl || null,
    ]);

    // 2. Upsert scam_records
    try {
      await pool.query(`
        INSERT INTO scam_records (
          id, phone, phone_number, clean_phone, phone_digits, country_code, country_name,
          scam_type, category, impersonated_company, invoice_number, amount_charged,
          platform, source_platform, source_name, source_url, source_domain, snippet,
          threat_intel, detailed_summary, description, detected_at, report_date, post_date,
          is_down, is_number_down, status, expires_at, updated_at
        )
        VALUES (
          $1, $2, $2, $3, $3, $4, $5, $6, $6, $7, $8, $9, $10, $10, $11, $12, $13, $14,
          $14, $14, $14, $15, $16, $16, $17, $17, $18, $19, NOW()
        )
        ON CONFLICT (phone_digits)
        DO UPDATE SET
          phone = EXCLUDED.phone,
          phone_number = EXCLUDED.phone_number,
          impersonated_company = EXCLUDED.impersonated_company,
          category = EXCLUDED.category,
          scam_type = EXCLUDED.scam_type,
          invoice_number = EXCLUDED.invoice_number,
          amount_charged = EXCLUDED.amount_charged,
          description = EXCLUDED.description,
          snippet = EXCLUDED.snippet,
          threat_intel = EXCLUDED.threat_intel,
          detailed_summary = EXCLUDED.detailed_summary,
          source_name = EXCLUDED.source_name,
          source_url = EXCLUDED.source_url,
          source_platform = EXCLUDED.source_platform,
          source_domain = EXCLUDED.source_domain,
          report_date = EXCLUDED.report_date,
          post_date = EXCLUDED.post_date,
          detected_at = EXCLUDED.detected_at,
          is_down = EXCLUDED.is_down,
          is_number_down = EXCLUDED.is_number_down,
          status = EXCLUDED.status,
          updated_at = NOW();
      `, [
        recId,
        r.phone,
        clean,
        r.countryCode || 'US',
        r.countryName || 'United States',
        r.scamType || 'General Tech Support & Refund Scams',
        r.impersonatedCompany || 'N/A',
        r.invoiceNumber || 'N/A',
        r.amountCharged || 'N/A',
        r.platform || 'Threat Intelligence',
        sourceName,
        r.sourceUrl || '',
        r.sourceDomain || '',
        r.detailedSummary || r.snippet || '',
        r.detectedAt ? new Date(r.detectedAt) : new Date(),
        dateStr,
        Boolean(r.isNumberDown),
        r.isNumberDown ? 'Out of Service' : 'Active',
        new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      ]);
    } catch {}

    // 3. Insert into scam_reports if this came from user/endscams report
    try {
      if (sourceName.toLowerCase().includes('report')) {
        await pool.query(`
          INSERT INTO scam_reports (
            phone_number, phone_digits, category, description, how_contacted,
            incident_date, source, created_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, NOW()
          )
        `, [
          r.phone,
          clean,
          r.scamType || 'General Tech Support & Refund Scams',
          r.detailedSummary || r.snippet || 'Reported on endscams.org/report',
          'Phone Call',
          dateStr,
          'user_report'
        ]);
      }
    } catch {}

    return true;
  } catch (err: any) {
    console.warn('[PostgreSQL DB] syncSingleRecordToPostgres note:', err.message);
    return false;
  }
}

// Bulk upsert records into PostgreSQL
export async function syncRecordsToPostgres(records: ScamPhoneRecord[]): Promise<number> {
  if (!records || records.length === 0) return 0;
  let count = 0;
  for (const r of records.slice(0, 80)) {
    const ok = await syncSingleRecordToPostgres(r);
    if (ok) count++;
  }
  return count;
}

// Delete record from PostgreSQL
export async function deleteRecordFromPostgres(id: string, cleanPhone?: string): Promise<boolean> {
  try {
    const pool = getPgPool();
    await pool.query(`DELETE FROM tracker_entries WHERE id = $1 OR phone_digits = $2`, [id, cleanPhone || id]);
    await pool.query(`DELETE FROM scam_records WHERE id = $1 OR clean_phone = $2 OR phone_digits = $2`, [id, cleanPhone || id]);
    return true;
  } catch (err: any) {
    console.warn('[PostgreSQL DB] deleteRecordFromPostgres note:', err.message);
    return false;
  }
}

// Purge records older than 90 days (standard) or 180 days (prize / lotto scams)
export async function purgeExpiredRecordsFromPostgres(): Promise<number> {
  try {
    const pool = getPgPool();
    const res = await pool.query(`
      SELECT id, phone_digits, clean_phone, report_date, detected_at, impersonated_company, scam_type, category 
      FROM tracker_entries
    `);
    const now = Date.now();
    let deletedCount = 0;
    for (const row of res.rows) {
      const isPrize = isPrizeOrExtendedRetentionRecord({
        impersonatedCompany: row.impersonated_company,
        scamType: row.category || row.scam_type,
      });
      const dStr = row.report_date || row.detected_at;
      if (!dStr) continue;
      const t = new Date(dStr.includes('T') ? dStr : `${dStr}T12:00:00.000Z`).getTime();
      if (isNaN(t) || t === 0) continue;
      const limitMs = isPrize ? SIX_MONTHS_MS : NINETY_DAYS_MS;
      if ((now - t) > limitMs) {
        await pool.query(`DELETE FROM tracker_entries WHERE id = $1`, [row.id]);
        await pool.query(`DELETE FROM scam_records WHERE id = $1`, [row.id]);
        deletedCount++;
      }
    }
    if (deletedCount > 0) {
      console.log(`[PostgreSQL DB] Auto-purged ${deletedCount} expired record(s) (>90d standard / >6mo prize).`);
    }
    return deletedCount;
  } catch (err: any) {
    console.warn('[PostgreSQL DB] purgeExpiredRecordsFromPostgres error:', err.message);
    return 0;
  }
}

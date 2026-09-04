import { Router, Request, Response } from 'express';
import { encryptValue, decryptValue, isEncrypted } from './crypto';

export const apiRouter = Router();

// Master encryption secret strictly from Dokploy environment
const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || '';

// API keys strictly from Dokploy environment settings
const RAW_PHONE_KEY = process.env.ABSTRACT_PHONE_API_KEY || '';
const RAW_EMAIL_KEY = process.env.ABSTRACT_EMAIL_API_KEY || '';
const RAW_IP_KEY = process.env.ABSTRACT_IP_API_KEY || '';
const RAW_SCRAPER_KEY = process.env.ABSTRACT_SCRAPER_API_KEY || '';

/**
 * Helper to get the decrypted key for a service
 */
function getActiveKey(raw: string, secret = ENCRYPTION_SECRET): string {
  if (!raw) return '';
  try {
    return decryptValue(raw, secret);
  } catch (err: any) {
    console.error('Error decrypting key:', err.message);
    return raw; // fallback to raw string
  }
}

// -------------------------------------------------------------
// In-Memory Performance Cache (10-minute TTL)
// -------------------------------------------------------------
interface CacheEntry {
  data: any;
  expiry: number;
}
const apiCache = new Map<string, CacheEntry>();

function getFromCache(key: string): any | null {
  const item = apiCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiry) {
    apiCache.delete(key);
    return null;
  }
  return item.data;
}

function setInCache(key: string, data: any, ttlMs = 10 * 60 * 1000) {
  if (apiCache.size > 200) {
    const first = apiCache.keys().next().value;
    if (first) apiCache.delete(first);
  }
  apiCache.set(key, { data, expiry: Date.now() + ttlMs });
}

function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  let result = str;
  // Multiple passes in case of nested or double encoding (e.g., &amp;#127820;)
  for (let i = 0; i < 3; i++) {
    const prev = result;
    result = result
      // Hex numeric entities &#x1F34C; or &#x1f34c;
      .replace(/&#x([0-9a-fA-F]+);?/g, (_, hex) => {
        try {
          const code = parseInt(hex, 16);
          return code > 0 && code <= 0x10FFFF ? String.fromCodePoint(code) : '';
        } catch {
          return '';
        }
      })
      // Decimal numeric entities &#127820; or &#127820
      .replace(/&#([0-9]+);?/g, (_, dec) => {
        try {
          const code = parseInt(dec, 10);
          return code > 0 && code <= 0x10FFFF ? String.fromCodePoint(code) : '';
        } catch {
          return '';
        }
      })
      // Named entities
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&apos;|&#39;/gi, "'")
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&mdash;/gi, '—')
      .replace(/&ndash;/gi, '–')
      .replace(/&hellip;/gi, '…')
      .replace(/&copy;/gi, '©')
      .replace(/&reg;/gi, '®')
      .replace(/&trade;/gi, '™')
      .replace(/&bull;/gi, '•')
      .replace(/&rsquo;/gi, '’')
      .replace(/&lsquo;/gi, '‘')
      .replace(/&rdquo;/gi, '”')
      .replace(/&ldquo;/gi, '“');

    if (result === prev) break;
  }
  return result;
}

function extractHtmlMetadata(html: string) {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const rawTitle = titleMatch ? titleMatch[1].trim() : '';

  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) ||
                    html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
  const rawDesc = descMatch ? descMatch[1].trim() : '';

  const linksMatch = html.match(/<a\s+[^>]*href=/gi);
  const linksCount = linksMatch ? linksMatch.length : 0;

  const textWithoutScripts = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const decodedTitle = decodeHtmlEntities(rawTitle);
  const decodedDesc = decodeHtmlEntities(rawDesc);
  const decodedCleanText = decodeHtmlEntities(textWithoutScripts.slice(0, 1500));

  return {
    title: decodedTitle || 'Page Content Retrieved',
    description: decodedDesc || 'No meta description tag provided by page.',
    clean_text: decodedCleanText,
    links_count: linksCount
  };
}

// -------------------------------------------------------------
// Health & System Status Endpoint
// -------------------------------------------------------------
apiRouter.get('/status', (req: Request, res: Response) => {
  const secretInUse = !!process.env.ENCRYPTION_SECRET;
  
  res.json({
    status: 'online',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    proxy_mode: 'dokploy_secure_proxy',
    cors_enabled: true,
    security: {
      encryption_algorithm: 'AES-256-GCM',
      custom_secret_configured: secretInUse,
    },
    tools: {
      phone_intelligence: {
        configured: !!RAW_PHONE_KEY,
        encrypted_in_env: isEncrypted(RAW_PHONE_KEY),
        source: 'Dokploy Environment',
        endpoint: 'https://phoneintelligence.abstractapi.com/v1/'
      },
      email_reputation: {
        configured: !!RAW_EMAIL_KEY,
        encrypted_in_env: isEncrypted(RAW_EMAIL_KEY),
        source: 'Dokploy Environment',
        endpoint: 'https://emailreputation.abstractapi.com/v1/'
      },
      ip_intelligence: {
        configured: !!RAW_IP_KEY,
        encrypted_in_env: isEncrypted(RAW_IP_KEY),
        source: 'Dokploy Environment',
        endpoint: 'https://ip-intelligence.abstractapi.com/v1/'
      },
      web_scraper: {
        configured: !!RAW_SCRAPER_KEY,
        encrypted_in_env: isEncrypted(RAW_SCRAPER_KEY),
        source: 'Dokploy Environment',
        endpoint: 'https://scrape.abstractapi.com/v1/'
      }
    }
  });
});

// -------------------------------------------------------------
// Phone Intelligence Proxy (Optimized with In-Memory Caching)
// -------------------------------------------------------------
apiRouter.post('/phone', async (req: Request, res: Response) => {
  const { phone } = req.body;
  if (!phone || typeof phone !== 'string') {
    res.status(400).json({ error: 'Please provide a valid phone number (e.g. +14152007986)' });
    return;
  }

  // Format clean phone number to standard international E.164
  let cleanPhone = phone.trim().replace(/[^\d+]/g, '');
  if (!cleanPhone.startsWith('+')) {
    if (cleanPhone.length === 10) {
      cleanPhone = '+1' + cleanPhone;
    } else {
      cleanPhone = '+' + cleanPhone;
    }
  }

  const cacheKey = `phone:${cleanPhone}`;
  const cached = getFromCache(cacheKey);
  if (cached) {
    res.json({
      ...cached,
      source: 'AbstractAPI Phone Intelligence (Cached • 0ms)'
    });
    return;
  }

  const key = getActiveKey(RAW_PHONE_KEY);
  if (!key) {
    res.status(503).json({
      error: 'ABSTRACT_PHONE_API_KEY is not configured in your Dokploy environment. Please add it to your Dokploy environment variables.'
    });
    return;
  }
  const url = `https://phoneintelligence.abstractapi.com/v1/?api_key=${encodeURIComponent(key)}&phone=${encodeURIComponent(cleanPhone)}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const apiRes = await fetch(url, { 
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(timeoutId);

    const data = await apiRes.json();
    if (!apiRes.ok) {
      if (apiRes.status === 429) {
        res.status(429).json({
          error: 'AbstractAPI rate limit reached (Requests Per Second limit on Free plan). Please wait a few seconds and retry.',
          details: data
        });
        return;
      }
      res.status(apiRes.status).json({
        error: data.error?.message || 'Phone intelligence API returned an error',
        details: data
      });
      return;
    }

    // Normalized phone response compatible with both current v1 nested format and legacy top-level keys
    const normalizedData = {
      phone: data.phone_number || cleanPhone,
      valid: data.phone_validation?.is_valid ?? data.valid ?? (data.phone_carrier?.name ? true : false),
      carrier: data.phone_carrier?.name || data.carrier || 'Unknown Carrier',
      location: [data.phone_location?.city, data.phone_location?.region, data.phone_location?.country_name].filter(Boolean).join(', ') || data.location || 'United States',
      type: data.phone_carrier?.line_type || data.type || (data.phone_validation?.is_voip ? 'VoIP' : 'Mobile'),
      format: {
        international: data.phone_format?.international || cleanPhone,
        local: data.phone_format?.national || cleanPhone
      },
      risk: {
        risk_score: data.phone_risk?.risk_score ?? (data.phone_risk?.risk_level === 'high' ? 85 : 5),
        risk_level: data.phone_risk?.risk_level ? String(data.phone_risk.risk_level).toUpperCase() : 'LOW'
      },
      ...data
    };

    const responsePayload = {
      success: true,
      source: 'AbstractAPI Phone Intelligence',
      data: normalizedData
    };

    setInCache(cacheKey, responsePayload, 10 * 60 * 1000);
    res.json(responsePayload);
  } catch (err: any) {
    console.error('Phone proxy error:', err);
    res.status(500).json({
      error: err.name === 'AbortError' ? 'AbstractAPI request timed out (7s)' : (err.message || 'Internal proxy error')
    });
  }
});

// -------------------------------------------------------------
// Email Reputation Proxy
// -------------------------------------------------------------
apiRouter.post('/email', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    res.status(400).json({ error: 'Please provide a valid email address' });
    return;
  }

  const key = getActiveKey(RAW_EMAIL_KEY);
  if (!key) {
    res.status(503).json({
      error: 'ABSTRACT_EMAIL_API_KEY is not configured in your Dokploy environment. Please add it to your Dokploy environment variables.'
    });
    return;
  }
  const cleanEmail = email.trim().toLowerCase();
  const url = `https://emailreputation.abstractapi.com/v1/?api_key=${encodeURIComponent(key)}&email=${encodeURIComponent(cleanEmail)}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const apiRes = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    const data = await apiRes.json();
    if (!apiRes.ok) {
      if (apiRes.status === 429) {
        res.status(429).json({
          error: 'AbstractAPI rate limit reached (Requests Per Second limit on Free plan). Please wait a few seconds and retry.',
          details: data
        });
        return;
      }
      res.status(apiRes.status).json({
        error: data.error?.message || 'Email reputation API returned an error',
        details: data
      });
      return;
    }

    res.json({
      success: true,
      source: 'AbstractAPI Email Reputation',
      data
    });
  } catch (err: any) {
    console.error('Email proxy error:', err);
    res.status(500).json({
      error: err.name === 'AbortError' ? 'AbstractAPI request timed out (12s)' : (err.message || 'Internal proxy error')
    });
  }
});

// -------------------------------------------------------------
// IP Intelligence Proxy
// -------------------------------------------------------------
apiRouter.post('/ip', async (req: Request, res: Response) => {
  let { ip_address } = req.body;
  
  // If no IP supplied, detect client IP or fallback
  if (!ip_address || ip_address === 'auto' || ip_address.trim() === '') {
    const forwarded = req.headers['x-forwarded-for'];
    const clientIp = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress;
    
    // Ignore internal loopbacks for default preview
    if (!clientIp || clientIp.includes('127.0.0.1') || clientIp === '::1' || clientIp.startsWith('10.') || clientIp.startsWith('192.168.')) {
      ip_address = '8.8.8.8'; // Default informative sample
    } else {
      ip_address = clientIp;
    }
  }

  const key = getActiveKey(RAW_IP_KEY);
  if (!key) {
    res.status(503).json({
      error: 'ABSTRACT_IP_API_KEY is not configured in your Dokploy environment. Please add it to your Dokploy environment variables.'
    });
    return;
  }
  const cleanIp = ip_address.trim();
  const url = `https://ip-intelligence.abstractapi.com/v1/?api_key=${encodeURIComponent(key)}&ip_address=${encodeURIComponent(cleanIp)}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const apiRes = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    const data = await apiRes.json();
    if (!apiRes.ok) {
      if (apiRes.status === 429) {
        res.status(429).json({
          error: 'AbstractAPI rate limit reached. Please wait a few seconds and retry.',
          details: data
        });
        return;
      }
      res.status(apiRes.status).json({
        error: data.error?.message || 'IP intelligence API returned an error',
        details: data
      });
      return;
    }

    res.json({
      success: true,
      source: 'AbstractAPI IP Intelligence',
      data
    });
  } catch (err: any) {
    console.error('IP proxy error:', err);
    res.status(500).json({
      error: err.name === 'AbortError' ? 'AbstractAPI request timed out (12s)' : (err.message || 'Internal proxy error')
    });
  }
});

// -------------------------------------------------------------
// Web Scraper Proxy (with parsed metadata & intelligent fallback)
// -------------------------------------------------------------
apiRouter.post('/scrape', async (req: Request, res: Response) => {
  const { url, render_js = false, country_code } = req.body;
  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    res.status(400).json({ error: 'Please provide a valid URL starting with http:// or https://' });
    return;
  }

  const cleanUrl = url.trim();
  const cacheKey = `scrape:${cleanUrl}:${render_js}:${country_code || 'default'}`;
  const cached = getFromCache(cacheKey);
  if (cached) {
    res.json({
      ...cached,
      source: 'AbstractAPI Web Scraper (Cached • 0ms)'
    });
    return;
  }

  const key = getActiveKey(RAW_SCRAPER_KEY);
  if (!key) {
    try {
      const directRes = await fetch(cleanUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      const directHtml = await directRes.text();
      const directPayload = {
        success: true,
        source: 'Proxy Engine Direct Scrape (Configure ABSTRACT_SCRAPER_API_KEY in Dokploy for JS rendering)',
        target_url: cleanUrl,
        content_type: directRes.headers.get('content-type') || 'text/html',
        html: directHtml,
        size_bytes: Buffer.byteLength(directHtml, 'utf8'),
        fallback_used: true,
        parsed: extractHtmlMetadata(directHtml)
      };
      setInCache(cacheKey, directPayload, 10 * 60 * 1000);
      res.json(directPayload);
      return;
    } catch (fallbackErr: any) {
      res.status(500).json({
        error: `Failed to scrape target URL: ${fallbackErr.message || 'Connection failed'}. (ABSTRACT_SCRAPER_API_KEY is not set in Dokploy environment)`
      });
      return;
    }
  }

  let apiUrl = `https://scrape.abstractapi.com/v1/?api_key=${encodeURIComponent(key)}&url=${encodeURIComponent(cleanUrl)}`;
  if (render_js) {
    apiUrl += '&render_js=true';
  }
  if (country_code) {
    apiUrl += `&country_code=${encodeURIComponent(country_code)}`;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const apiRes = await fetch(apiUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    const contentType = apiRes.headers.get('content-type') || '';
    const bodyText = await apiRes.text();

    if (apiRes.ok) {
      const responsePayload = {
        success: true,
        source: 'AbstractAPI Web Scraper',
        target_url: cleanUrl,
        content_type: contentType,
        html: bodyText,
        size_bytes: Buffer.byteLength(bodyText, 'utf8'),
        fallback_used: false,
        parsed: extractHtmlMetadata(bodyText)
      };
      setInCache(cacheKey, responsePayload, 10 * 60 * 1000);
      res.json(responsePayload);
      return;
    }

    // If AbstractAPI scrape returns 502/504 or server gateway error
    console.warn(`AbstractAPI scrape responded with ${apiRes.status}. Using direct proxy fallback...`);
    
    // Direct safe server-side fetch fallback so user isn't blocked by AbstractAPI upstream outages
    const directRes = await fetch(cleanUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const directHtml = await directRes.text();
    const fallbackPayload = {
      success: true,
      source: 'Proxy Engine (AbstractAPI upstream returned 502, auto-switched to direct server scrape)',
      target_url: cleanUrl,
      content_type: directRes.headers.get('content-type') || 'text/html',
      html: directHtml,
      size_bytes: Buffer.byteLength(directHtml, 'utf8'),
      fallback_used: true,
      upstream_status: apiRes.status,
      parsed: extractHtmlMetadata(directHtml)
    };
    setInCache(cacheKey, fallbackPayload, 10 * 60 * 1000);
    res.json(fallbackPayload);

  } catch (err: any) {
    console.error('Scrape proxy error:', err);
    // Attempt direct fallback if AbstractAPI network failed
    try {
      const directRes = await fetch(cleanUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      const directHtml = await directRes.text();
      const directPayload = {
        success: true,
        source: 'Proxy Engine Direct Scrape (Fallback)',
        target_url: cleanUrl,
        content_type: directRes.headers.get('content-type') || 'text/html',
        html: directHtml,
        size_bytes: Buffer.byteLength(directHtml, 'utf8'),
        fallback_used: true,
        parsed: extractHtmlMetadata(directHtml)
      };
      setInCache(cacheKey, directPayload, 10 * 60 * 1000);
      res.json(directPayload);
    } catch (fallbackErr: any) {
      res.status(500).json({
        error: `Failed to scrape target URL: ${err.message || 'Connection failed'}`
      });
    }
  }
});

// -------------------------------------------------------------
// Dokploy Secrets Encryption & Configuration Helpers
// -------------------------------------------------------------
apiRouter.post('/dokploy/encrypt', (req: Request, res: Response) => {
  const { text, secret } = req.body;
  if (!text || typeof text !== 'string') {
    res.status(400).json({ error: 'Text to encrypt is required' });
    return;
  }

  const encryptionSecret = secret || ENCRYPTION_SECRET;
  if (!encryptionSecret) {
    res.status(400).json({ error: 'Please provide an encryption secret or configure ENCRYPTION_SECRET in Dokploy' });
    return;
  }

  try {
    const encrypted = encryptValue(text.trim(), encryptionSecret);
    res.json({
      success: true,
      encrypted,
      isEncrypted: true,
      format: 'enc:<iv>:<tag>:<ciphertext>',
      algorithm: 'AES-256-GCM'
    });
  } catch (err: any) {
    res.status(500).json({ error: `Encryption failed: ${err.message}` });
  }
});

apiRouter.get('/dokploy/env-template', (req: Request, res: Response) => {
  const envTemplate = [
    '# ========================================================',
    '# Dokploy Environment Configuration',
    '# Configure these directly in your Dokploy "Environment" tab',
    '# ========================================================',
    'ENCRYPTION_SECRET=""',
    'ABSTRACT_PHONE_API_KEY=""',
    'ABSTRACT_EMAIL_API_KEY=""',
    'ABSTRACT_IP_API_KEY=""',
    'ABSTRACT_SCRAPER_API_KEY=""',
    'PORT=3000',
    'NODE_ENV=production'
  ].join('\n');

  res.json({
    status: 'ok',
    configured: {
      phone: !!RAW_PHONE_KEY,
      email: !!RAW_EMAIL_KEY,
      ip: !!RAW_IP_KEY,
      scraper: !!RAW_SCRAPER_KEY,
      encryption_secret: !!ENCRYPTION_SECRET
    },
    env_content: envTemplate
  });
});

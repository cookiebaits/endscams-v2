import type { Request, Response, NextFunction } from 'express';

/**
 * Strict CORS Configuration & Middleware for Scanner Data Source (esscan.ai.studio)
 * Configured specifically to serve the Reporting Portal (endscams.org) and authorized environments.
 */

// Production and staging allowed origins
export const ALLOWED_ORIGIN_PATTERNS: (string | RegExp)[] = [
  'https://endscams.org',
  'https://www.endscams.org',
  /^https:\/\/[a-zA-Z0-9-]+\.endscams\.org$/,
  'https://esscan.ai.studio',
  // Local development origins
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
];

/**
 * Check if a request origin is allowed under the strict CORS policy.
 */
export function isOriginAllowed(origin?: string | null): boolean {
  if (!origin) return false;
  
  // Custom env override if provided (comma-separated list)
  const envOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()) 
    : [];

  if (envOrigins.includes(origin)) {
    return true;
  }

  return ALLOWED_ORIGIN_PATTERNS.some((pattern) => {
    if (typeof pattern === 'string') {
      return pattern.toLowerCase() === origin.toLowerCase();
    }
    return pattern.test(origin);
  });
}

/**
 * Compute the specific Access-Control-Allow-Origin header value.
 * In strict CORS, we echo back the matched allowed origin rather than wildcard '*'.
 */
export function resolveAllowedOriginHeader(requestOrigin?: string | null): string {
  if (requestOrigin && isOriginAllowed(requestOrigin)) {
    return requestOrigin;
  }
  return 'https://endscams.org';
}

/**
 * Generates the strict CORS headers dictionary.
 * Compatible with Express, Next.js API Routes, Web Fetch API, and Cloudflare Workers.
 */
export function getStrictCorsHeaders(requestOrigin?: string | null): Record<string, string> {
  const allowedOrigin = resolveAllowedOriginHeader(requestOrigin);

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, HEAD',
    'Access-Control-Allow-Headers':
      'Origin, X-Requested-With, Content-Type, Accept, Authorization, Range, X-Client-Version, x-api-key, cf-connecting-ip',
    'Access-Control-Expose-Headers':
      'Content-Range, X-Total-Count, X-Page, X-Total-Pages, X-Limit, Content-Length',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400', // 24 hours preflight cache
    'Vary': 'Origin, Accept-Encoding',
  };
}

/**
 * Express Middleware for strict CORS headers on incoming requests.
 * Automatically handles HTTP OPTIONS preflight responses with 204 No Content.
 */
export function strictCorsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestOrigin = (req.headers.origin || req.headers.referer || '').toString().replace(/\/$/, '');
  let extractedOrigin: string | null = null;
  try {
    if (requestOrigin.startsWith('http')) {
      const url = new URL(requestOrigin);
      extractedOrigin = `${url.protocol}//${url.host}`;
    }
  } catch {}

  const corsHeaders = getStrictCorsHeaders(extractedOrigin);
  Object.entries(corsHeaders).forEach(([header, val]) => {
    res.setHeader(header, val);
  });

  // Explicit frame-ancestors allowing iframe embedding strictly on endscams.org if needed
  res.removeHeader('X-Frame-Options');
  res.setHeader(
    'Content-Security-Policy',
    "frame-ancestors 'self' https://endscams.org https://*.endscams.org;"
  );

  // Fast-path OPTIONS preflight requests
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  next();
}

/**
 * Next.js App Router Helper (for /app/api/... route handlers in Next.js)
 */
export function applyNextJsCors(
  req: globalThis.Request,
  responseHeaders: Headers = new Headers()
): Headers {
  const origin = req.headers.get('origin');
  const headers = getStrictCorsHeaders(origin);
  Object.entries(headers).forEach(([k, v]) => {
    responseHeaders.set(k, v);
  });
  return responseHeaders;
}

/**
 * Next.js App Router OPTIONS Handler
 */
export function handleNextJsOptions(req: globalThis.Request): globalThis.Response {
  const headers = applyNextJsCors(req);
  return new globalThis.Response(null, {
    status: 204,
    headers,
  });
}

export default strictCorsMiddleware;
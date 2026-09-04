export type ToolTab = 'overview' | 'phone' | 'email' | 'ip' | 'scraper' | 'dokploy';

export interface ToolStatusInfo {
  configured: boolean;
  encrypted_in_env: boolean;
  source?: string;
  endpoint: string;
}

export interface ServerStatusResponse {
  status: string;
  version: string;
  timestamp: string;
  proxy_mode: string;
  cors_enabled: boolean;
  security: {
    encryption_algorithm: string;
    custom_secret_configured: boolean;
  };
  tools: {
    phone_intelligence: ToolStatusInfo;
    email_reputation: ToolStatusInfo;
    ip_intelligence: ToolStatusInfo;
    web_scraper: ToolStatusInfo;
  };
}

export interface PhoneResult {
  phone?: string;
  valid?: boolean;
  format?: {
    international?: string;
    local?: string;
  };
  country?: {
    code?: string;
    name?: string;
    prefix?: string;
  };
  location?: string;
  type?: string;
  carrier?: string;
  risk?: {
    risk_score?: number;
    risk_level?: string;
  };
  [key: string]: any;
}

export interface EmailBreach {
  domain: string;
  breach_date: string;
}

export interface EmailResult {
  email?: string;
  quality_score?: number | string;
  is_valid_format?: { value: boolean; text?: string };
  is_free_email?: { value: boolean; text?: string };
  is_disposable_email?: { value: boolean; text?: string };
  is_role_email?: { value: boolean; text?: string };
  is_catchall_email?: { value: boolean; text?: string };
  is_mx_found?: { value: boolean; text?: string };
  is_smtp_valid?: { value: boolean; text?: string };
  breaches?: EmailBreach[];
  [key: string]: any;
}

export interface IpResult {
  ip_address?: string;
  security?: {
    is_vpn?: boolean;
    is_proxy?: boolean;
    is_tor?: boolean;
    is_hosting?: boolean;
    is_relay?: boolean;
    is_mobile?: boolean;
    is_abuse?: boolean;
  };
  asn?: {
    asn?: number;
    name?: string;
    domain?: string | null;
    type?: string;
  };
  company?: {
    name?: string;
    domain?: string | null;
    type?: string;
  };
  domains?: {
    domains?: string[];
  };
  location?: {
    city?: string;
    region?: string;
    region_iso_code?: string;
    country?: string;
    country_code?: string;
    postal_code?: string;
    longitude?: number;
    latitude?: number;
  };
  timezone?: {
    name?: string;
    abbreviation?: string;
    utc_offset?: number;
    local_time?: string;
  };
  flag?: {
    emoji?: string;
    png?: string;
    svg?: string;
  };
  currency?: {
    name?: string;
    code?: string;
    symbol?: string;
  };
  [key: string]: any;
}

export interface ScrapeMetadata {
  title?: string;
  description?: string;
  clean_text?: string;
  links_count?: number;
}

export interface ScrapeResult {
  success: boolean;
  source?: string;
  target_url: string;
  content_type?: string;
  html: string;
  size_bytes?: number;
  fallback_used?: boolean;
  upstream_status?: number;
  parsed?: ScrapeMetadata;
}

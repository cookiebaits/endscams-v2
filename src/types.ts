export interface AltNumberEntry {
  phone: string;
  digits: string;
  is_whatsapp?: boolean;
}

export interface ThreatRecord {
  id: string;
  phone_number: string;
  phone_digits: string;
  is_whatsapp?: boolean;
  alt_numbers?: AltNumberEntry[];
  source_name: string;
  source_url: string;
  report_date: string;
  category: string;
  description: string;
  impersonated_company?: string;
  scammer_name?: string;
  invoice_number?: string;
  amount_charged?: string;
  money_lost?: number | string;
  how_contacted?: string;
  reporter_name?: string;
  reporter_email?: string;
  image_url?: string;
  evidence_url?: string;
  is_down?: boolean;
}

export interface ScamPhoneRecord {
  id: string;
  phone: string;
  cleanPhone: string;
  isWhatsapp?: boolean;
  altNumbers?: string[];
  altNumbersWithDetails?: AltNumberEntry[];
  scamType: string;
  impersonatedCompany?: string;
  scammerName?: string;
  invoiceNumber?: string;
  amountCharged?: string;
  moneyLost?: number | string;
  howContacted?: string;
  reporterName?: string;
  reporterEmail?: string;
  imageUrl?: string;
  evidenceUrl?: string;
  sourceUrl?: string;
  sourceDomain?: string;
  platform: string;
  countryCode?: string;
  countryName?: string;
  snippet?: string;
  detailedSummary?: string;
  isNumberDown?: boolean;
  numberDownAt?: string;
  detectedAt?: string;
  postDate?: string;
  searchQuery?: string;
  confidence?: string;
}

export interface SupabaseConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  tableName: 'tracker_entries' | 'scam_records';
}

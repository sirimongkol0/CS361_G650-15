export interface Partner {
  id: number;
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  type?: string | null;
  country?: string | null;
  websiteUrl?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
}

export interface Activity {
  id: number;
  name: string;
  date: string;
  description?: string | null;
  activity_type?: string | null;
  partner?: {
    id: number;
    name: string;
  } | null;
}

export interface DocumentItem {
  id: number;
  name: string;
  docType?: string | null;
  storageKey?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  effectiveDate?: string | null;
  expiryDate?: string | null;
  partnerId?: number | null;
}

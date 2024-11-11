export interface Organization {
  id: string;
  name: string;
  logo_url: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Speaker {
  id: string;
  name: string;
  image_url: string | null;
  organization_id: string | null;
  organization?: Organization;
}

export interface MonitoredURL {
  id: string;
  url: string;
  logo_url: string | null;
  last_crawled_at: string | null;
}

export interface StagedQuote {
  id: string;
  summary: string;
  raw_quote_text: string;
  speaker_name: string;
  article_date: string;
  article_url: string;
  article_headline?: string;
  parent_monitored_url: string;
}

export interface SavedQuote {
  id: string;
  summary: string;
  raw_quote_text: string;
  speaker_name: string;
  article_date: string;
  article_url: string;
  article_headline: string;
  created_at: string;
} 
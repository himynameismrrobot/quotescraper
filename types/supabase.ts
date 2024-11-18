export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      monitored_urls: {
        Row: {
          id: string
          url: string
          active: boolean
          last_crawled_at: string | null
          logo_url: string | null
        }
        Insert: {
          id?: string
          url: string
          active?: boolean
          last_crawled_at?: string | null
          logo_url?: string | null
        }
        Update: {
          id?: string
          url?: string
          active?: boolean
          last_crawled_at?: string | null
          logo_url?: string | null
        }
      }
      staged_articles: {
        Row: {
          id: string
          url: string
          headline: string
          parent_url: string
          article_date: string | null
          discovered_at: string
          processed: boolean
          processed_at: string | null
        }
      }
      // ... other tables
    }
  }
} 
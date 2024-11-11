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
      organizations: {
        Row: {
          id: string
          name: string
          logo_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          logo_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          logo_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      speakers: {
        Row: {
          id: string
          name: string
          image_url: string | null
          organization_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          image_url?: string | null
          organization_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          image_url?: string | null
          organization_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      quotes: {
        Row: {
          id: string
          summary: string
          raw_quote_text: string
          article_date: string
          article_url: string
          article_headline: string
          speaker_id: string
          parent_monitored_url: string
          created_at: string
          updated_at: string
          content_vector: number[] | null
          summary_vector: number[] | null
        }
        Insert: {
          id?: string
          summary: string
          raw_quote_text: string
          article_date: string
          article_url: string
          article_headline: string
          speaker_id: string
          parent_monitored_url: string
          created_at?: string
          updated_at?: string
          content_vector?: number[] | null
          summary_vector?: number[] | null
        }
        Update: {
          id?: string
          summary?: string
          raw_quote_text?: string
          article_date?: string
          article_url?: string
          article_headline?: string
          speaker_id?: string
          parent_monitored_url?: string
          created_at?: string
          updated_at?: string
          content_vector?: number[] | null
          summary_vector?: number[] | null
        }
      }
      quote_reactions: {
        Row: {
          id: string
          emoji: string
          quote_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          emoji: string
          quote_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          emoji?: string
          quote_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      quote_reactions_users: {
        Row: {
          quote_reaction_id: string
          user_id: string
        }
        Insert: {
          quote_reaction_id: string
          user_id: string
        }
        Update: {
          quote_reaction_id?: string
          user_id?: string
        }
      }
      comments: {
        Row: {
          id: string
          text: string
          quote_id: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          text: string
          quote_id: string
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          text?: string
          quote_id?: string
          user_id?: string
          created_at?: string
        }
      }
      users: {
        Row: {
          id: string
          email: string
          name: string | null
          username: string | null
          image: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          name?: string | null
          username?: string | null
          image?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          username?: string | null
          image?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
} 
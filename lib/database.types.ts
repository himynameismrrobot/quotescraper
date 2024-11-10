export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Custom type for pgvector
export type Vector = number[]

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
      users: {
        Row: {
          id: string
          name: string | null
          username: string | null
          email: string | null
          email_verified: string | null
          image: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name?: string | null
          username?: string | null
          email?: string | null
          email_verified?: string | null
          image?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string | null
          username?: string | null
          email?: string | null
          email_verified?: string | null
          image?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      accounts: {
        Row: {
          id: string
          user_id: string
          type: string
          provider: string
          provider_account_id: string
          refresh_token: string | null
          access_token: string | null
          expires_at: number | null
          token_type: string | null
          scope: string | null
          id_token: string | null
          session_state: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          provider: string
          provider_account_id: string
          refresh_token?: string | null
          access_token?: string | null
          expires_at?: number | null
          token_type?: string | null
          scope?: string | null
          id_token?: string | null
          session_state?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          provider?: string
          provider_account_id?: string
          refresh_token?: string | null
          access_token?: string | null
          expires_at?: number | null
          token_type?: string | null
          scope?: string | null
          id_token?: string | null
          session_state?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      sessions: {
        Row: {
          id: string
          session_token: string
          user_id: string
          expires: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          session_token: string
          user_id: string
          expires: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          session_token?: string
          user_id?: string
          expires?: string
          created_at?: string
          updated_at?: string
        }
      }
      following: {
        Row: {
          id: string
          user_id: string
          speaker_id: string | null
          org_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          speaker_id?: string | null
          org_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          speaker_id?: string | null
          org_id?: string | null
          created_at?: string
        }
      }
      quotes: {
        Row: {
          id: string
          summary: string
          raw_quote_text: string
          article_date: string
          article_url: string
          article_headline: string | null
          speaker_id: string
          parent_monitored_url: string
          parent_monitored_url_logo: string | null
          created_at: string
          updated_at: string
          content_vector: Vector | null
          summary_vector: Vector | null
        }
        Insert: {
          id?: string
          summary: string
          raw_quote_text: string
          article_date: string
          article_url: string
          article_headline?: string | null
          speaker_id: string
          parent_monitored_url: string
          parent_monitored_url_logo?: string | null
          created_at?: string
          updated_at?: string
          content_vector?: Vector | null
          summary_vector?: Vector | null
        }
        Update: {
          id?: string
          summary?: string
          raw_quote_text?: string
          article_date?: string
          article_url?: string
          article_headline?: string | null
          speaker_id?: string
          parent_monitored_url?: string
          parent_monitored_url_logo?: string | null
          created_at?: string
          updated_at?: string
          content_vector?: Vector | null
          summary_vector?: Vector | null
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
      monitored_urls: {
        Row: {
          id: string
          url: string
          logo_url: string | null
          last_crawled_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          url: string
          logo_url?: string | null
          last_crawled_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          url?: string
          logo_url?: string | null
          last_crawled_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      quote_staging: {
        Row: {
          id: string
          summary: string
          raw_quote_text: string
          speaker_name: string
          article_date: string
          article_url: string
          article_headline: string | null
          parent_monitored_url: string
          created_at: string
          updated_at: string
          content_vector: Vector | null
          summary_vector: Vector | null
        }
        Insert: {
          id?: string
          summary: string
          raw_quote_text: string
          speaker_name: string
          article_date: string
          article_url: string
          article_headline?: string | null
          parent_monitored_url: string
          created_at?: string
          updated_at?: string
          content_vector?: Vector | null
          summary_vector?: Vector | null
        }
        Update: {
          id?: string
          summary?: string
          raw_quote_text?: string
          speaker_name?: string
          article_date?: string
          article_url?: string
          article_headline?: string | null
          parent_monitored_url?: string
          created_at?: string
          updated_at?: string
          content_vector?: Vector | null
          summary_vector?: Vector | null
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
      comment_reactions: {
        Row: {
          id: string
          emoji: string
          comment_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          emoji: string
          comment_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          emoji?: string
          comment_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      comment_reactions_users: {
        Row: {
          comment_reaction_id: string
          user_id: string
        }
        Insert: {
          comment_reaction_id: string
          user_id: string
        }
        Update: {
          comment_reaction_id?: string
          user_id?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      match_quotes: {
        Args: {
          query_embedding: Vector
          similarity_threshold: number
          match_count: number
        }
        Returns: {
          id: string
          similarity: number
        }[]
      },
      list_tables: {
        Args: Record<string, never>
        Returns: { table_name: string }[]
      },
      check_vector_extension: {
        Args: Record<string, never>
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
} 
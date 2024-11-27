-- Create articles table
CREATE TABLE articles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_url text NOT NULL,
  article_url text NOT NULL UNIQUE,
  article_date timestamp with time zone NOT NULL,
  headline text,
  article_text text,
  total_quotes integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Add indexes for common lookups
CREATE INDEX idx_articles_parent_url ON articles(parent_url);
CREATE INDEX idx_articles_article_url ON articles(article_url);
CREATE INDEX idx_articles_article_date ON articles(article_date);

-- Create trigger for updated_at
CREATE TRIGGER update_articles_updated_at
    BEFORE UPDATE ON articles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

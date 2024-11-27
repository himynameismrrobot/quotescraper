-- Add similarity columns to quotes table
ALTER TABLE quotes
ADD COLUMN IF NOT EXISTS similar_to_quote_id uuid REFERENCES quotes(id),
ADD COLUMN IF NOT EXISTS similarity_score float;

-- Add similarity columns to quote_staging table
ALTER TABLE quote_staging
ADD COLUMN IF NOT EXISTS similar_to_quote_id uuid REFERENCES quotes(id),
ADD COLUMN IF NOT EXISTS similarity_score float;

-- Add indexes for similarity lookups
CREATE INDEX IF NOT EXISTS idx_quotes_similar_to_quote_id ON quotes(similar_to_quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_staging_similar_to_quote_id ON quote_staging(similar_to_quote_id);

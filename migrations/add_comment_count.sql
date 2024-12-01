-- Add comment_count column to quotes table
ALTER TABLE quotes ADD COLUMN comment_count INTEGER DEFAULT 0;

-- Update existing comment counts
UPDATE quotes
SET comment_count = (
  SELECT COUNT(*)
  FROM comments
  WHERE comments.quote_id = quotes.id
);

-- Create function to maintain comment count
CREATE OR REPLACE FUNCTION update_quote_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE quotes
    SET comment_count = comment_count + 1
    WHERE id = NEW.quote_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE quotes
    SET comment_count = comment_count - 1
    WHERE id = OLD.quote_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS update_quote_comment_count ON comments;
CREATE TRIGGER update_quote_comment_count
AFTER INSERT OR DELETE ON comments
FOR EACH ROW
EXECUTE FUNCTION update_quote_comment_count(); 
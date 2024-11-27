-- First, drop the existing function
DROP FUNCTION IF EXISTS find_most_similar_quote(query_embedding vector, match_threshold float, match_count int);

-- Create the new function using negative inner product
CREATE OR REPLACE FUNCTION find_most_similar_quote(
    query_embedding vector,
    match_threshold float,
    match_count int
)
RETURNS TABLE (
    id uuid,
    raw_quote_text text,
    speaker_name text,
    article_headline text,
    article_url text,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        q.id,
        q.raw_quote_text,
        s.name as speaker_name,
        q.article_headline,
        q.article_url,
        -(q.content_vector <#> query_embedding) as similarity
    FROM quotes q
    JOIN speakers s ON q.speaker_id = s.id
    WHERE -(q.content_vector <#> query_embedding) > match_threshold
    ORDER BY q.content_vector <#> query_embedding ASC
    LIMIT match_count;
END;
$$;
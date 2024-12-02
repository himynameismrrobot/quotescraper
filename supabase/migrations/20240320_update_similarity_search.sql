-- Drop the existing function
DROP FUNCTION IF EXISTS find_most_similar_quote(vector, int);

-- Recreate the function with speaker-based filtering
CREATE OR REPLACE FUNCTION find_most_similar_quote(
    query_embedding vector,
    match_count int
)
RETURNS TABLE (
    id uuid,
    raw_quote_text text,
    speaker_name text,
    article_headline text,
    article_url text,
    similar_to_quote_id uuid,
    similar_to_staged_quote_id uuid,
    similarity_score float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH combined_quotes AS (
        -- Get quotes from the main quotes table
        SELECT
            q.id as quote_id,
            q.raw_quote_text,
            s.name as speaker_name,
            q.article_headline,
            q.article_url,
            q.content_vector,
            'quotes' as source_table
        FROM quotes q
        JOIN speakers s ON q.speaker_id = s.id
        
        UNION ALL
        
        -- Get quotes from the staging table
        SELECT
            qs.id as quote_id,
            qs.raw_quote_text,
            qs.speaker_name,
            qs.article_headline,
            qs.article_url,
            qs.content_vector,
            'staging' as source_table
        FROM quote_staging qs
        WHERE qs.content_vector IS NOT NULL
    )
    SELECT
        q.quote_id as id,
        q.raw_quote_text,
        q.speaker_name,
        q.article_headline,
        q.article_url,
        CASE 
            WHEN most_similar.source_table = 'quotes' THEN most_similar.quote_id
            ELSE NULL
        END as similar_to_quote_id,
        CASE 
            WHEN most_similar.source_table = 'staging' THEN most_similar.quote_id
            ELSE NULL
        END as similar_to_staged_quote_id,
        -(q.content_vector <#> query_embedding) as similarity_score
    FROM combined_quotes q
    CROSS JOIN LATERAL (
        SELECT quote_id, source_table
        FROM combined_quotes inner_q
        WHERE inner_q.quote_id != q.quote_id
        -- Add speaker name filter here
        AND inner_q.speaker_name = q.speaker_name
        ORDER BY inner_q.content_vector <#> q.content_vector ASC
        LIMIT 1
    ) most_similar
    ORDER BY q.content_vector <#> query_embedding ASC
    LIMIT match_count;
END;
$$; 
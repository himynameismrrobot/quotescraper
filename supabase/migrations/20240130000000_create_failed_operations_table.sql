-- Create an enum for operation types
CREATE TYPE operation_type AS ENUM ('article_save', 'quote_similarity', 'quote_save', 'speaker_save');

-- Create the failed_operations table
CREATE TABLE IF NOT EXISTS failed_operations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    operation_type operation_type NOT NULL,
    -- Article related fields
    article_url TEXT,
    article_headline TEXT,
    -- Quote related fields
    raw_quote_text TEXT,
    summary TEXT,
    speaker_name TEXT,
    -- General fields
    error_message TEXT NOT NULL,
    retry_count INTEGER DEFAULT 0,
    last_retry_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Additional metadata stored as JSON
    metadata JSONB,
    -- Status tracking
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved', 'failed'))
);

-- Create indexes for common queries
CREATE INDEX failed_operations_status_idx ON failed_operations(status);
CREATE INDEX failed_operations_operation_type_idx ON failed_operations(operation_type);
CREATE INDEX failed_operations_article_url_idx ON failed_operations(article_url) WHERE article_url IS NOT NULL;
CREATE INDEX failed_operations_created_at_idx ON failed_operations(created_at);

-- Add a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create a trigger to automatically update updated_at
CREATE TRIGGER update_failed_operations_updated_at
    BEFORE UPDATE ON failed_operations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create error_logs table for fatal errors
CREATE TABLE IF NOT EXISTS error_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    error_type TEXT NOT NULL,
    error_message TEXT NOT NULL,
    article_url TEXT,
    stack_trace TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for error_logs
CREATE INDEX error_logs_error_type_idx ON error_logs(error_type);
CREATE INDEX error_logs_created_at_idx ON error_logs(created_at);

-- Add a comment to describe the tables
COMMENT ON TABLE failed_operations IS 'Tracks failed database operations for retry and monitoring';
COMMENT ON TABLE error_logs IS 'Logs fatal errors and system-wide issues';

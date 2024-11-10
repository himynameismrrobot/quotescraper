## "NOTE THAT THERE WERE A NUMBER OF ISSUES I HAD TO MANUALLY FIX IN SUPABASE SO THIS FILE IS NOT PERFECT"

-- Enable pgvector extension
create extension if not exists vector;

-- Create organizations table
create table organizations (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  logo_url text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Create speakers table
create table speakers (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  image_url text,
  organization_id uuid references organizations(id),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Create users table
create table users (
  id uuid default gen_random_uuid() primary key,
  name text,
  username text unique,
  email text unique,
  email_verified timestamp with time zone,
  image text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Create accounts table
create table accounts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references users(id) on delete cascade,
  type text not null,
  provider text not null,
  provider_account_id text not null,
  refresh_token text,
  access_token text,
  expires_at bigint,
  token_type text,
  scope text,
  id_token text,
  session_state text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(provider, provider_account_id)
);

-- Create sessions table
create table sessions (
  id uuid default gen_random_uuid() primary key,
  session_token text not null unique,
  user_id uuid not null references users(id) on delete cascade,
  expires timestamp with time zone not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Create following table
create table following (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references users(id) on delete cascade,
  speaker_id uuid references speakers(id),
  org_id uuid references organizations(id),
  created_at timestamp with time zone default now(),
  unique(user_id, speaker_id),
  unique(user_id, org_id)
);

-- Create function to update timestamps
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = current_timestamp;
    return new;
end;
$$ language plpgsql;

-- Create quotes table (updated)
create table quotes (
  id uuid default gen_random_uuid() primary key,
  summary text not null,
  raw_quote_text text not null,
  article_date timestamp with time zone not null,
  article_url text not null,
  article_headline text,
  speaker_id uuid not null references speakers(id) on delete restrict,
  parent_monitored_url text not null,
  parent_monitored_url_logo text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  content_vector vector(1536),
  summary_vector vector(1536)
);

-- Add more indexes for quotes
create index idx_quotes_speaker_id on quotes(speaker_id);
create index idx_quotes_article_url on quotes(article_url);
create index idx_quotes_parent_url on quotes(parent_monitored_url);

-- Create trigger for quotes updated_at
create trigger update_quotes_updated_at
    before update on quotes
    for each row
    execute function update_updated_at_column();

-- Create quote reactions table (updated)
create table quote_reactions (
  id uuid default gen_random_uuid() primary key,
  emoji text not null,
  quote_id uuid not null references quotes(id) on delete cascade,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(quote_id, emoji)
);

-- Add index for quote_reactions
create index idx_quote_reactions_quote_id on quote_reactions(quote_id);

-- Create trigger for quote_reactions updated_at
create trigger update_quote_reactions_updated_at
    before update on quote_reactions
    for each row
    execute function update_updated_at_column();

-- Create quote_reactions_users junction table
create table quote_reactions_users (
  quote_reaction_id uuid references quote_reactions(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  primary key (quote_reaction_id, user_id)
);

-- Create monitored_urls table
create table monitored_urls (
  id uuid default gen_random_uuid() primary key,
  url text not null unique,
  logo_url text,
  last_crawled_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Create quote_staging table
create table quote_staging (
  id uuid default gen_random_uuid() primary key,
  summary text not null,
  raw_quote_text text not null,
  speaker_name text not null,
  article_date timestamp with time zone not null,
  article_url text not null,
  article_headline text,
  parent_monitored_url text not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  content_vector vector(1536),
  summary_vector vector(1536)
);

-- Create comments table
create table comments (
  id uuid default gen_random_uuid() primary key,
  text text not null,
  quote_id uuid not null references quotes(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamp with time zone default now()
);

-- Create comment reactions table
create table comment_reactions (
  id uuid default gen_random_uuid() primary key,
  emoji text not null,
  comment_id uuid not null references comments(id) on delete cascade,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(comment_id, emoji)
);

-- Create comment_reactions_users junction table
create table comment_reactions_users (
  comment_reaction_id uuid references comment_reactions(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  primary key (comment_reaction_id, user_id)
);

-- Create function for finding similar quotes
create or replace function match_quotes (
  query_embedding vector(1536),
  similarity_threshold float,
  match_count int
)
returns table (
  id uuid,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    quotes.id,
    1 - (quotes.content_vector <=> query_embedding) as similarity
  from quotes
  where 1 - (quotes.content_vector <=> query_embedding) > similarity_threshold
  order by quotes.content_vector <=> query_embedding
  limit match_count;
end;
$$;

-- Create indexes for vector similarity search
create index on quotes using ivfflat (content_vector vector_cosine_ops);
create index on quotes using ivfflat (summary_vector vector_cosine_ops);

-- Create indexes for common queries
create index idx_quotes_article_date on quotes(article_date);
create index idx_monitored_urls_last_crawled on monitored_urls(last_crawled_at);

-- Add triggers for all other tables with updated_at
create trigger update_organizations_updated_at
    before update on organizations
    for each row
    execute function update_updated_at_column();

create trigger update_speakers_updated_at
    before update on speakers
    for each row
    execute function update_updated_at_column();

create trigger update_users_updated_at
    before update on users
    for each row
    execute function update_updated_at_column();

create trigger update_monitored_urls_updated_at
    before update on monitored_urls
    for each row
    execute function update_updated_at_column();

create trigger update_quote_staging_updated_at
    before update on quote_staging
    for each row
    execute function update_updated_at_column();

create trigger update_comment_reactions_updated_at
    before update on comment_reactions
    for each row
    execute function update_updated_at_column();

-- Add RLS policies
alter table quotes enable row level security;
alter table quote_reactions enable row level security;
alter table quote_reactions_users enable row level security;
alter table comments enable row level security;
alter table comment_reactions enable row level security;
alter table comment_reactions_users enable row level security;

-- Quotes policies
create policy "Quotes are viewable by everyone"
  on quotes for select
  to public
  using (true);

create policy "Only authenticated users can insert quotes"
  on quotes for insert
  to authenticated
  with check (true);

-- Quote reactions policies
create policy "Quote reactions are viewable by everyone"
  on quote_reactions for select
  to public
  using (true);

create policy "Only authenticated users can manage reactions"
  on quote_reactions for all
  to authenticated
  using (true)
  with check (true);

-- Comments policies
create policy "Comments are viewable by everyone"
  on comments for select
  to public
  using (true);

create policy "Authenticated users can insert comments"
  on comments for insert
  to authenticated
  with check (true);

create policy "Users can only update their own comments"
  on comments for update
  to authenticated
  using (user_id = auth.uid());

create policy "Users can only delete their own comments"
  on comments for delete
  to authenticated
  using (user_id = auth.uid());

-- Need to add indexes for following table
create index idx_following_user_id on following(user_id);
create index idx_following_speaker_id on following(speaker_id);
create index idx_following_org_id on following(org_id);

-- Need to add indexes for accounts
create index idx_accounts_user_id on accounts(user_id);

-- Need to add indexes for sessions
create index idx_sessions_user_id on sessions(user_id);

-- Need to add indexes for comments
create index idx_comments_quote_id on comments(quote_id);
create index idx_comments_user_id on comments(user_id);

-- Need to add indexes for reactions
create index idx_comment_reactions_comment_id on comment_reactions(comment_id);

-- Need to add RLS policies for following
alter table following enable row level security;
create policy "Users can manage their own following"
  on following for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Need to add RLS policies for quote_reactions_users
alter table quote_reactions_users enable row level security;
create policy "Users can manage their own reactions"
  on quote_reactions_users for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Need to add RLS policies for comment_reactions_users
alter table comment_reactions_users enable row level security;
create policy "Users can manage their own comment reactions"
  on comment_reactions_users for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create table if not exists public.staged_articles (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    url text not null,
    headline text,
    parent_url text not null,
    discovered_at timestamp with time zone not null,
    processed boolean default false,
    processed_at timestamp with time zone
);

-- Add indexes
create index staged_articles_url_idx on public.staged_articles(url);
create index staged_articles_parent_url_idx on public.staged_articles(parent_url);
create index staged_articles_processed_idx on public.staged_articles(processed);

-- Add RLS policies
alter table public.staged_articles enable row level security;

create policy "Staged articles are viewable by authenticated users" on public.staged_articles
    for select using (auth.role() = 'authenticated');

create policy "Staged articles are insertable by service role" on public.staged_articles
    for insert with check (auth.jwt()->>'role' = 'service_role');

create policy "Staged articles are updatable by service role" on public.staged_articles
    for update using (auth.jwt()->>'role' = 'service_role'); 
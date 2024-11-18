-- Create monitored_urls table
create table if not exists public.monitored_urls (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    url text not null unique,
    active boolean default true,
    last_crawled_at timestamp with time zone
);

-- Add indexes for monitored_urls
create index monitored_urls_active_idx on public.monitored_urls(active);
create index monitored_urls_last_crawled_at_idx on public.monitored_urls(last_crawled_at);

-- Enable RLS for monitored_urls
alter table public.monitored_urls enable row level security;

-- RLS policies for monitored_urls
create policy "Monitored URLs are viewable by authenticated users" on public.monitored_urls
    for select using (auth.role() = 'authenticated');

create policy "Monitored URLs are insertable by authenticated users" on public.monitored_urls
    for insert with check (auth.role() = 'authenticated');

create policy "Monitored URLs are updatable by authenticated users" on public.monitored_urls
    for update using (auth.role() = 'authenticated');

-- Insert default test URL if not exists
insert into public.monitored_urls (url)
select 'https://www.theverge.com'
where not exists (select 1 from public.monitored_urls where url = 'https://www.theverge.com');

-- Create agent_config table
create table if not exists public.agent_config (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    auto_run_enabled boolean not null default false,
    run_frequency_hours integer not null default 24,
    last_run_time timestamp with time zone,
    similarity_threshold float not null default 0.85,
    max_parallel_extractions integer not null default 3
);

-- Create agent_runs table for tracking workflow executions
create table if not exists public.agent_runs (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    status text not null default 'running',
    thread_id text not null,
    started_at timestamp with time zone not null,
    completed_at timestamp with time zone,
    error_message text,
    total_articles_found integer default 0,
    articles_processed integer default 0,
    quotes_extracted integer default 0,
    quotes_validated integer default 0,
    quotes_stored integer default 0
);

-- Create agent_logs table for detailed logging
create table if not exists public.agent_logs (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    run_id uuid references public.agent_runs(id),
    node_name text not null,
    message text not null,
    level text not null default 'info',
    metadata jsonb
);

-- Add updated_at trigger function if not exists
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$ language plpgsql;

-- Create triggers for updated_at
create trigger update_agent_config_updated_at
    before update on public.agent_config
    for each row
    execute function update_updated_at_column();

create trigger update_agent_runs_updated_at
    before update on public.agent_runs
    for each row
    execute function update_updated_at_column();

-- Add indexes
create index agent_runs_status_idx on public.agent_runs(status);
create index agent_runs_thread_id_idx on public.agent_runs(thread_id);
create index agent_logs_run_id_idx on public.agent_logs(run_id);
create index agent_logs_node_name_idx on public.agent_logs(node_name);
create index agent_logs_level_idx on public.agent_logs(level);

-- Enable RLS
alter table public.agent_config enable row level security;
alter table public.agent_runs enable row level security;
alter table public.agent_logs enable row level security;

-- RLS Policies for agent_config
create policy "Agent config is viewable by authenticated users" on public.agent_config
    for select using (auth.role() = 'authenticated');

create policy "Agent config is updatable by authenticated users" on public.agent_config
    for update using (auth.role() = 'authenticated');

create policy "Agent config is insertable by service role" on public.agent_config
    for insert with check (auth.jwt()->>'role' = 'service_role');

-- RLS Policies for agent_runs
create policy "Agent runs are viewable by authenticated users" on public.agent_runs
    for select using (auth.role() = 'authenticated');

create policy "Agent runs are insertable by service role" on public.agent_runs
    for insert with check (auth.jwt()->>'role' = 'service_role');

create policy "Agent runs are updatable by service role" on public.agent_runs
    for update using (auth.jwt()->>'role' = 'service_role');

-- RLS Policies for agent_logs
create policy "Agent logs are viewable by authenticated users" on public.agent_logs
    for select using (auth.role() = 'authenticated');

create policy "Agent logs are insertable by service role" on public.agent_logs
    for insert with check (auth.jwt()->>'role' = 'service_role');

-- Insert initial agent config if not exists
insert into public.agent_config (id)
select gen_random_uuid()
where not exists (select 1 from public.agent_config);
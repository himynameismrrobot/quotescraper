create table if not exists public.agent_logs (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    agent text not null,
    status text not null,
    details jsonb,
    error text
);

-- Add indexes
create index agent_logs_agent_idx on public.agent_logs(agent);
create index agent_logs_created_at_idx on public.agent_logs(created_at);

-- Add RLS policies
alter table public.agent_logs enable row level security;

create policy "Agent logs are viewable by authenticated users" on public.agent_logs
    for select using (auth.role() = 'authenticated');

create policy "Agent logs are insertable by service role" on public.agent_logs
    for insert with check (auth.jwt()->>'role' = 'service_role'); 
-- Innova CEO Secure Bridge V1 - stage in test before production.
create table if not exists public.innova_server_requests (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('ceo', 'mcp')),
  operation jsonb not null check (jsonb_typeof(operation) = 'object' and octet_length(operation::text) <= 2048),
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired','claimed','completed','failed')),
  requester_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  claimed_at timestamptz,
  completed_at timestamptz,
  result_summary text,
  constraint innova_server_expiry_valid check (expires_at > created_at)
);
create index if not exists innova_server_requests_queue on public.innova_server_requests (status, approved_at) where status = 'approved';
create index if not exists innova_server_requests_recent on public.innova_server_requests(created_at desc);
create table if not exists public.innova_server_audit (
  id bigint generated always as identity primary key,
  request_id uuid references public.innova_server_requests(id),
  event text not null,
  actor_id uuid references auth.users(id),
  recorded_at timestamptz not null default now()
);
create index if not exists innova_server_audit_recent on public.innova_server_audit(recorded_at desc);
alter table public.innova_server_requests enable row level security;
alter table public.innova_server_audit enable row level security;
revoke all on public.innova_server_requests, public.innova_server_audit from public, anon, authenticated;
grant select, insert, update on public.innova_server_requests to service_role;
grant select, insert on public.innova_server_audit to service_role;
grant usage, select on sequence public.innova_server_audit_id_seq to service_role;
-- Atomic claim prevents two workers receiving the same approved operation.
create or replace function public.innova_server_claim_next()
returns setof public.innova_server_requests
language plpgsql security definer set search_path = ''
as $$
begin
  return query
  with pick as (
    select q.id from public.innova_server_requests q
    where q.status = 'approved' and q.expires_at > now()
    order by q.approved_at, q.id
    for update skip locked limit 1
  )
  update public.innova_server_requests r
  set status = 'claimed', claimed_at = now()
  from pick where r.id = pick.id
  returning r.*;
end;
$$;
revoke all on function public.innova_server_claim_next() from public, anon, authenticated;
grant execute on function public.innova_server_claim_next() to service_role;

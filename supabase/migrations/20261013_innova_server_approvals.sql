-- Innova Server Dell: solicitudes aprobadas por Innova CEO (AAL2).
-- Ejecutar UNA VEZ mediante migración auditada de Supabase; no habilitar
-- permisos directos a anon/authenticated ni permitir escritura pública.
create extension if not exists pgcrypto;
create table if not exists public.innova_server_approvals (
  id uuid primary key default gen_random_uuid(),
  action text not null check (action in (
    'workspace.write','workspace.delete','sandbox.execute',
    'docker.restart','systemd.restart','compose.deploy',
    'backup.run','database.migrate','security.rotate',
    'project.deploy','service.configure','files.restore')),
  target text not null check (length(target) between 1 and 160),
  summary text not null check (length(summary) between 8 and 500),
  payload_sha256 text not null check (payload_sha256 ~ '^[a-f0-9]{64}$'),
  request_nonce text not null unique check (length(request_nonce) between 16 and 128),
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','consumed')),
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null,
  approved_at timestamptz,
  approved_by uuid,
  approved_email text,
  consumed_at timestamptz
);
create index if not exists innova_server_approvals_requested_idx
  on public.innova_server_approvals (requested_at desc);
create index if not exists innova_server_approvals_status_idx
  on public.innova_server_approvals (status, expires_at);
alter table public.innova_server_approvals enable row level security;
revoke all on table public.innova_server_approvals from public, anon, authenticated;
grant select, insert, update on table public.innova_server_approvals to service_role;
comment on table public.innova_server_approvals is
  'Aprobaciones CEO de un solo uso para Innova Server Dell; solo backend service_role.';

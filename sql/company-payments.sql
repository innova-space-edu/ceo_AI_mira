-- Innova Pay v1 · Mercado Pago
-- Ejecutar en el proyecto Supabase empresarial alogqktilzgylzomzwem.
-- El frontend NO accede directamente a estas tablas: solo backend con service_role.

create extension if not exists pgcrypto;

create table if not exists public.company_payment_links (
  id uuid primary key default gen_random_uuid(),
  public_token text not null unique,
  provider text not null default 'mercadopago',
  status text not null default 'active'
    check (status in ('active','opened','processing','paid','failed','expired','cancelled','refunded')),
  customer_name text,
  customer_rut text,
  customer_email text,
  customer_phone text,
  description text not null,
  amount bigint not null check (amount > 0),
  currency text not null default 'CLP',
  project_id uuid,
  quotation_id uuid,
  invoice_id uuid,
  expires_at timestamptz,
  provider_order_id text,
  provider_checkout_url text,
  provider_status text,
  view_count integer not null default 0 check (view_count >= 0),
  last_opened_at timestamptz,
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists company_payment_links_provider_order_uidx
  on public.company_payment_links(provider_order_id)
  where provider_order_id is not null;

create index if not exists company_payment_links_status_idx
  on public.company_payment_links(status, created_at desc);
create index if not exists company_payment_links_project_idx
  on public.company_payment_links(project_id);
create index if not exists company_payment_links_quotation_idx
  on public.company_payment_links(quotation_id);

create table if not exists public.company_payment_attempts (
  id uuid primary key default gen_random_uuid(),
  payment_link_id uuid not null references public.company_payment_links(id) on delete cascade,
  provider text not null default 'mercadopago',
  provider_order_id text not null unique,
  provider_payment_id text,
  checkout_url text,
  amount bigint not null check (amount > 0),
  status text not null default 'processing',
  provider_status text,
  raw_response jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists company_payment_attempts_link_idx
  on public.company_payment_attempts(payment_link_id, created_at desc);

create table if not exists public.company_payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_link_id uuid not null references public.company_payment_links(id) on delete cascade,
  event_type text not null,
  provider text,
  provider_event_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists company_payment_events_link_idx
  on public.company_payment_events(payment_link_id, created_at desc);

alter table public.company_payment_links enable row level security;
alter table public.company_payment_attempts enable row level security;
alter table public.company_payment_events enable row level security;

-- Sin políticas para anon/authenticated: el acceso se hace solo desde backend.
revoke all on public.company_payment_links from anon, authenticated;
revoke all on public.company_payment_attempts from anon, authenticated;
revoke all on public.company_payment_events from anon, authenticated;

grant all on public.company_payment_links to service_role;
grant all on public.company_payment_attempts to service_role;
grant all on public.company_payment_events to service_role;

comment on table public.company_payment_links is 'Links de cobro públicos de Innova Pay. Datos privados accesibles solo por backend.';
comment on table public.company_payment_attempts is 'Intentos/checkouts creados en proveedores de pago.';
comment on table public.company_payment_events is 'Bitácora de eventos y webhooks de Innova Pay.';

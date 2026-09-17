-- Innova Space Education — verificación documental pública
-- Ejecutar en el proyecto Supabase usado por INNOVA CEO.
-- La tabla no se expone directamente: toda lectura pública pasa por una RPC SECURITY DEFINER
-- que devuelve solo metadatos seguros y nunca datos personales del cliente.

create extension if not exists pgcrypto;

create table if not exists public.company_document_verifications (
  id uuid primary key default gen_random_uuid(),
  document_type text not null default 'quotation',
  project_id uuid null,
  document_id uuid not null,
  verification_code text not null unique,
  version integer not null default 1 check (version > 0),
  issued_at timestamptz not null default now(),
  issued_by uuid null,
  fingerprint text not null,
  status text not null default 'issued' check (status in ('issued','superseded','revoked')),
  summary_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_document_verifications_doc_version_uk unique (document_type, document_id, version)
);

create index if not exists company_document_verifications_document_idx
  on public.company_document_verifications (document_type, document_id, version desc);
create index if not exists company_document_verifications_code_idx
  on public.company_document_verifications (verification_code);

alter table public.company_document_verifications enable row level security;
revoke all on table public.company_document_verifications from anon, authenticated;

drop function if exists public.issue_company_document_verification(uuid);
create function public.issue_company_document_verification(p_document_id uuid)
returns table (
  verification_code text,
  version integer,
  issued_at timestamptz,
  fingerprint text,
  status text,
  document_type text,
  project_name text,
  net_amount numeric,
  vat_amount numeric,
  total_amount numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote public.company_quotations%rowtype;
  v_project_name text;
  v_fingerprint text;
  v_latest public.company_document_verifications%rowtype;
  v_version integer;
  v_code text;
  v_summary jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from public.company_users u
    where u.user_id = auth.uid() and coalesce(u.status, 'active') = 'active'
  ) then
    raise exception 'No autorizado';
  end if;

  select q.* into v_quote
  from public.company_quotations q
  where q.id = p_document_id;

  if not found then
    raise exception 'Cotización no encontrada';
  end if;

  select coalesce(p.title, p.code, 'Proyecto') into v_project_name
  from public.company_projects p
  where p.id = v_quote.project_id;
  v_project_name := coalesce(v_project_name, 'Proyecto');

  v_fingerprint := encode(
    digest(
      convert_to(
        jsonb_build_object(
          'document_type', 'quotation',
          'document_id', v_quote.id,
          'project_id', v_quote.project_id,
          'project_name', v_project_name,
          'issue_date', v_quote.issue_date,
          'items', coalesce(v_quote.items, '[]'::jsonb),
          'subtotal', coalesce(v_quote.subtotal, 0),
          'net_amount', coalesce(v_quote.net_amount, 0),
          'vat_rate', coalesce(v_quote.vat_rate, 0),
          'vat_amount', coalesce(v_quote.vat_amount, 0),
          'total_amount', coalesce(v_quote.total_amount, 0),
          'notes', coalesce(v_quote.notes, '')
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  select d.* into v_latest
  from public.company_document_verifications d
  where d.document_type = 'quotation' and d.document_id = v_quote.id
  order by d.version desc
  limit 1;

  if found and v_latest.fingerprint = v_fingerprint and v_latest.status = 'issued' then
    return query
      select v_latest.verification_code, v_latest.version, v_latest.issued_at,
             v_latest.fingerprint, v_latest.status, v_latest.document_type,
             v_project_name, coalesce(v_quote.net_amount, 0),
             coalesce(v_quote.vat_amount, 0), coalesce(v_quote.total_amount, 0);
    return;
  end if;

  if v_latest.id is not null and v_latest.status = 'issued' then
    update public.company_document_verifications
       set status = 'superseded', updated_at = now()
     where id = v_latest.id;
  end if;

  v_version := coalesce(v_latest.version, 0) + 1;
  v_code := 'ISE-COT-' || to_char(now(), 'YYYYMMDD') || '-' ||
            upper(substr(replace(v_quote.id::text, '-', ''), 1, 6)) || '-V' ||
            lpad(v_version::text, 2, '0');

  v_summary := jsonb_build_object(
    'project_name', v_project_name,
    'quote_number', v_quote.quote_number,
    'net_amount', coalesce(v_quote.net_amount, 0),
    'vat_rate', coalesce(v_quote.vat_rate, 0),
    'vat_amount', coalesce(v_quote.vat_amount, 0),
    'total_amount', coalesce(v_quote.total_amount, 0),
    'issue_date', v_quote.issue_date,
    'issuer', 'Innova Space Education SpA'
  );

  insert into public.company_document_verifications (
    document_type, project_id, document_id, verification_code, version,
    issued_at, issued_by, fingerprint, status, summary_data
  ) values (
    'quotation', v_quote.project_id, v_quote.id, v_code, v_version,
    now(), auth.uid(), v_fingerprint, 'issued', v_summary
  );

  return query
    select v_code, v_version, now(), v_fingerprint, 'issued'::text, 'quotation'::text,
           v_project_name, coalesce(v_quote.net_amount, 0),
           coalesce(v_quote.vat_amount, 0), coalesce(v_quote.total_amount, 0);
end;
$$;

drop function if exists public.resolve_company_document_verification(text);
create function public.resolve_company_document_verification(p_internal_code text)
returns table (
  verification_code text,
  version integer,
  issued_at timestamptz,
  fingerprint text,
  status text,
  document_type text,
  project_name text,
  net_amount numeric,
  vat_amount numeric,
  total_amount numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_quote_id uuid;
begin
  if auth.uid() is null or not exists (
    select 1 from public.company_users u
    where u.user_id = auth.uid() and coalesce(u.status, 'active') = 'active'
  ) then
    raise exception 'No autorizado';
  end if;

  v_prefix := upper(regexp_replace(coalesce(p_internal_code, ''), '^ISE-COT-', '', 'i'));
  if v_prefix = '' or v_prefix = 'BORRADOR' then
    raise exception 'La cotización debe guardarse antes de emitir un código verificable';
  end if;

  select q.id into v_quote_id
  from public.company_quotations q
  where upper(substr(replace(q.id::text, '-', ''), 1, 10)) = v_prefix
  order by q.updated_at desc nulls last, q.created_at desc nulls last
  limit 1;

  if v_quote_id is null then
    raise exception 'No se pudo resolver la cotización guardada';
  end if;

  return query select * from public.issue_company_document_verification(v_quote_id);
end;
$$;

drop function if exists public.verify_company_document(text);
create function public.verify_company_document(p_code text)
returns table (
  valid boolean,
  verification_code text,
  document_type text,
  project_name text,
  issued_at timestamptz,
  issuer text,
  status text,
  version integer,
  net_amount numeric,
  vat_amount numeric,
  total_amount numeric,
  fingerprint text
)
language sql
security definer
stable
set search_path = public
as $$
  select
    d.status = 'issued' as valid,
    d.verification_code,
    d.document_type,
    coalesce(d.summary_data->>'project_name', 'Proyecto') as project_name,
    d.issued_at,
    coalesce(d.summary_data->>'issuer', 'Innova Space Education SpA') as issuer,
    d.status,
    d.version,
    coalesce((d.summary_data->>'net_amount')::numeric, 0) as net_amount,
    coalesce((d.summary_data->>'vat_amount')::numeric, 0) as vat_amount,
    coalesce((d.summary_data->>'total_amount')::numeric, 0) as total_amount,
    d.fingerprint
  from public.company_document_verifications d
  where upper(d.verification_code) = upper(trim(p_code))
  limit 1;
$$;

revoke all on function public.issue_company_document_verification(uuid) from public;
revoke all on function public.resolve_company_document_verification(text) from public;
revoke all on function public.verify_company_document(text) from public;

grant execute on function public.issue_company_document_verification(uuid) to authenticated;
grant execute on function public.resolve_company_document_verification(text) to authenticated;
grant execute on function public.verify_company_document(text) to anon, authenticated;

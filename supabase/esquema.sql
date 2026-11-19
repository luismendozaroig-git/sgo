-- SGO · Respaldo del esquema (estado actual). Ya está aplicado en Supabase; sirve para recrearlo si hiciera falta.
-- Ejecutar en Supabase → SQL Editor sobre un proyecto vacío.

create function public.set_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;

create table public.sgo_config (id int primary key default 1 check (id = 1), company_name text default 'Mi Constructora', ruc text, address text, phone text, email text, logo_url text,
  vat_rate numeric not null default 10, usd_rate numeric not null default 7500, budget_start jsonb not null default '{}',
  pdf_header_title text default 'PRESUPUESTO EJECUTIVO DE OBRA', pdf_footer_terms text default E'1. Anticipo: 20% a la firma.\n2. Saldos mediante certificados de avance.\n3. Validez de la oferta: 30 días.',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.sgo_users (id uuid primary key references auth.users on delete cascade, username text, name text, email text,
  role text not null default 'Consultas' check (role in ('Admin','Editor','Consultas')), active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.sgo_clients (id uuid primary key default gen_random_uuid(), ruc text, name text not null, contact text, phone text, email text, address text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.sgo_suppliers (id uuid primary key default gen_random_uuid(), ruc text, name text not null, category text check (category in ('Materiales','Mano de Obra','Maquinarias')),
  contact text, phone text, email text, status text not null default 'Activo', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.sgo_insumos (id uuid primary key default gen_random_uuid(), code text unique, name text not null, category text check (category in ('Materiales','Mano de Obra','Maquinarias')),
  unit text, supplier_id uuid references public.sgo_suppliers on delete set null, price_pyg bigint not null default 0, price_updated date not null default current_date, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.sgo_apu (id uuid primary key default gen_random_uuid(), code text unique, description text not null, unit text, items jsonb not null default '[]',
  indirects_pct numeric not null default 0, profit_pct numeric not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.sgo_obras (id uuid primary key default gen_random_uuid(), code text unique, name text not null, client_id uuid references public.sgo_clients on delete set null, address text,
  lat double precision, lng double precision, budget_pyg bigint not null default 0, executed_pyg bigint not null default 0,
  planned_progress numeric not null default 0 check (planned_progress between 0 and 100), real_progress numeric not null default 0 check (real_progress between 0 and 100),
  start_date date, end_date date, status text not null default 'En Proceso' check (status in ('En Proceso','Finalizada','Pausada')), supervisor text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index on public.sgo_obras (client_id);
create table public.sgo_budgets (id uuid primary key default gen_random_uuid(), number text unique, obra_id uuid references public.sgo_obras on delete cascade, date date not null default current_date,
  validity_days int not null default 30, vat_rate numeric not null default 10, items jsonb not null default '[]',
  status text not null default 'Borrador' check (status in ('Borrador','Aprobado')), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index on public.sgo_budgets (obra_id);
create table public.sgo_payments (id uuid primary key default gen_random_uuid(), obra_id uuid not null references public.sgo_obras on delete cascade, concept text not null,
  amount_pyg bigint not null default 0, date date not null default current_date, status text not null default 'Pendiente' check (status in ('Pendiente','Cobrado')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index on public.sgo_payments (obra_id);

-- Roles (función en esquema privado) y alta de usuarios: el primero es Admin y queda activo; los demás quedan pendientes.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
create function private.sgo_role() returns text language sql stable security definer set search_path = public as
$$ select role from public.sgo_users where id = (select auth.uid()) and active $$;
revoke execute on function private.sgo_role() from public, anon;
grant execute on function private.sgo_role() to authenticated;

create function public.sgo_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare first_user boolean := not exists (select 1 from public.sgo_users);
begin
  insert into public.sgo_users (id, username, name, email, role, active) values (new.id, split_part(new.email,'@',1),
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), new.email, case when first_user then 'Admin' else 'Consultas' end, first_user);
  return new;
end $$;
revoke execute on function public.sgo_new_user() from public, anon, authenticated;
create trigger sgo_on_auth_user_created after insert on auth.users for each row execute function public.sgo_new_user();

-- Seguridad (RLS), updated_at y Realtime
do $$ declare t text; begin
  foreach t in array array['sgo_config','sgo_users','sgo_clients','sgo_suppliers','sgo_insumos','sgo_apu','sgo_obras','sgo_budgets','sgo_payments'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
    execute format('alter publication supabase_realtime add table public.%I', t);
    if t = 'sgo_users' then
      execute 'create policy "leer" on public.sgo_users for select to authenticated using (id = (select auth.uid()) or private.sgo_role() = ''Admin'')';
      execute 'create policy "editar" on public.sgo_users for update to authenticated using (private.sgo_role() = ''Admin'')';
    elsif t = 'sgo_config' then
      execute 'create policy "leer" on public.sgo_config for select to authenticated using (private.sgo_role() is not null)';
      execute 'create policy "editar" on public.sgo_config for update to authenticated using (private.sgo_role() = ''Admin'')';
    else
      execute format('create policy "leer" on public.%I for select to authenticated using (private.sgo_role() is not null)', t);
      execute format('create policy "crear" on public.%I for insert to authenticated with check (private.sgo_role() in (''Admin'',''Editor''))', t);
      execute format('create policy "editar" on public.%I for update to authenticated using (private.sgo_role() in (''Admin'',''Editor'')) with check (private.sgo_role() in (''Admin'',''Editor''))', t);
      execute format('create policy "borrar" on public.%I for delete to authenticated using (private.sgo_role() = ''Admin'')', t);
    end if;
  end loop;
end $$;

insert into public.sgo_config (id, company_name) values (1, 'Mi Constructora');

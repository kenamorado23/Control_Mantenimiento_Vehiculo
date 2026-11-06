-- Auto Control: esquema inicial para dos vehículos y un usuario administrador.
-- Ejecutar en Supabase SQL Editor ANTES de cargar datos.
create extension if not exists pgcrypto;

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  year integer not null check (year between 1980 and 2100),
  model text not null,
  plate text,
  current_mileage integer not null default 0 check (current_mileage >= 0),
  mileage_unit text not null default 'millas' check (mileage_unit in ('millas','kilometros')),
  created_at timestamptz not null default now()
);

create table if not exists public.maintenance_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  service_date date not null,
  mileage integer check (mileage is null or mileage >= 0),
  category text not null,
  description text not null,
  brand_reference text,
  quantity numeric(10,2),
  parts_cost numeric(12,2) not null default 0 check (parts_cost >= 0),
  labor_cost numeric(12,2) not null default 0 check (labor_cost >= 0),
  total_cost numeric(12,2) generated always as (parts_cost + labor_cost) stored,
  provider text,
  next_service_date date,
  next_service_mileage integer,
  status text not null default 'Realizado' check (status in ('Realizado','Pendiente','Cancelado')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  system text not null,
  inspection_point text not null,
  recommended_frequency text,
  status text not null default 'Pendiente',
  last_review_date date,
  last_review_mileage integer,
  next_review_date date,
  next_review_mileage integer,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.vehicles enable row level security;
alter table public.maintenance_records enable row level security;
alter table public.checklist_items enable row level security;

create policy "owner manages own vehicles" on public.vehicles
  for all to authenticated using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "owner manages own maintenance" on public.maintenance_records
  for all to authenticated using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "owner manages own checklist" on public.checklist_items
  for all to authenticated using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create index if not exists idx_records_owner_date on public.maintenance_records(owner_id, service_date desc);
create index if not exists idx_records_vehicle on public.maintenance_records(vehicle_id);
create index if not exists idx_checklist_vehicle on public.checklist_items(vehicle_id);

-- No se insertan datos de vehículos automáticamente porque owner_id debe ser el UUID
-- del usuario administrador creado en Supabase Authentication.

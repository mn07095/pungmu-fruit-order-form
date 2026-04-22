create extension if not exists pgcrypto;

create table if not exists public.store_settings (
  id text primary key,
  settings jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  phone text not null,
  apartment_name text not null,
  address_detail text not null,
  gate_code text,
  delivery_type text,
  pay_method text,
  memo text,
  items jsonb not null,
  total_amount integer not null default 0,
  order_text text,
  status text not null default 'new',
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.orders
add column if not exists paid_at timestamptz;

alter table public.store_settings enable row level security;
alter table public.orders enable row level security;

drop policy if exists "public can insert orders" on public.orders;
create policy "public can insert orders"
on public.orders
for insert
to anon, authenticated
with check (true);

drop policy if exists "authenticated can read orders" on public.orders;
create policy "authenticated can read orders"
on public.orders
for select
to authenticated
using (true);

drop policy if exists "authenticated can update orders" on public.orders;
create policy "authenticated can update orders"
on public.orders
for update
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated can delete old orders" on public.orders;
create policy "authenticated can delete old orders"
on public.orders
for delete
to authenticated
using (created_at < now() - interval '3 days');

drop policy if exists "public can read store settings" on public.store_settings;
create policy "public can read store settings"
on public.store_settings
for select
to anon, authenticated
using (true);

drop policy if exists "authenticated can update store settings" on public.store_settings;
create policy "authenticated can update store settings"
on public.store_settings
for insert
to authenticated
with check (true);

drop policy if exists "authenticated can upsert store settings" on public.store_settings;
create policy "authenticated can upsert store settings"
on public.store_settings
for update
to authenticated
using (true)
with check (true);

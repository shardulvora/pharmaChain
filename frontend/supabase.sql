-- PharmaChain Supabase setup (Vite frontend compatible)
-- Run this in Supabase Dashboard -> SQL Editor

create extension if not exists pgcrypto;

create table if not exists scan_logs (
  id uuid default gen_random_uuid() primary key,
  batch_id text not null,
  scanned_at timestamptz default now(),
  lat float,
  lng float,
  city text,
  country text,
  ip_address text,
  user_agent text,
  alert_triggered boolean default false,
  alert_reason text
);

create index if not exists scan_logs_batch_id_idx on scan_logs(batch_id);
create index if not exists scan_logs_scanned_at_idx on scan_logs(scanned_at);

create table if not exists batch_limits (
  batch_id text primary key,
  drug_name text,
  expected_units integer not null,
  manufacturer text,
  created_at timestamptz default now()
);

insert into batch_limits (batch_id, drug_name, expected_units, manufacturer)
values
  ('PCH-2024-001', 'Amoxicillin 500mg', 500, 'BioMed Labs'),
  ('PCH-2024-002', 'Paracetamol 650mg', 200, 'GeneriCure Pharma'),
  ('DEMO-BATCH-001', 'Demo Drug', 100, 'Demo Manufacturer')
on conflict (batch_id) do update
set
  drug_name = excluded.drug_name,
  expected_units = excluded.expected_units,
  manufacturer = excluded.manufacturer;

-- Esegui una sola volta in Supabase > SQL Editor
alter table public."Servizi"
  add column if not exists km_partenza integer,
  add column if not exists km_arrivo integer;

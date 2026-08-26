-- v4.01.25: server-confirmed push opens for a measurable retention funnel.
-- Delivery UUIDs remain opaque; no player data is exposed through the public endpoint.
alter table public.push_delivery_log
  add column if not exists opened_at timestamptz;

create index if not exists idx_push_delivery_log_opened_at
  on public.push_delivery_log (opened_at desc)
  where opened_at is not null;

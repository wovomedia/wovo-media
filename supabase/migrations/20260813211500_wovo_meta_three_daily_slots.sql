-- Three fixed WOVO-owned publishing windows. The hourly server scheduler only
-- acts when the current America/Chicago hour exactly matches a configured
-- slot, so a missed run is never replayed as a catch-up burst.

alter table public.wovo_meta_connections
  add column auto_publish_slots smallint[] not null default array[9, 13, 18]::smallint[],
  add column auto_publish_last_slot_key text;

alter table public.wovo_meta_connections
  add constraint wovo_meta_connections_publish_slots_check
    check (
      array_length(auto_publish_slots, 1) = 3
      and auto_publish_slots[1] between 0 and 23
      and auto_publish_slots[2] between 0 and 23
      and auto_publish_slots[3] between 0 and 23
      and auto_publish_slots[1] < auto_publish_slots[2]
      and auto_publish_slots[2] < auto_publish_slots[3]
    ),
  add constraint wovo_meta_connections_last_slot_key_check
    check (
      auto_publish_last_slot_key is null
      or auto_publish_last_slot_key ~ '^\d{4}-\d{2}-\d{2}:[0-2]\d$'
    );

comment on column public.wovo_meta_connections.auto_publish_slots is
  'Exactly three local-hour WOVO publishing slots. The application interprets them in auto_publish_timezone and never backfills missed slots.';
comment on column public.wovo_meta_connections.auto_publish_last_slot_key is
  'Last local date:hour slot enqueued by the server. Per-destination unique idempotency keys remain the final duplicate guard.';

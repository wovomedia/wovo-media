-- Keep every Meta Page explicitly authorized for a workspace instead of
-- replacing the previous Page. Tokens remain encrypted and service-only.
alter table public.wovo_meta_connections
  drop constraint if exists wovo_meta_connections_account_id_owner_scope_key;

create unique index if not exists wovo_meta_connections_workspace_page_key
  on public.wovo_meta_connections (account_id, owner_scope, page_id) nulls not distinct;

create index if not exists wovo_meta_connections_workspace_idx
  on public.wovo_meta_connections (account_id, owner_scope, status, created_at desc);

comment on index public.wovo_meta_connections_workspace_page_key is
  'Allows multiple officially authorized Pages per tenant while preventing duplicate storage of the same Page.';

-- PostgREST invokes the public metering wrappers as service_role. The wrappers
-- delegate to explicitly granted private functions, so the role also requires
-- schema USAGE to resolve those function names. Browser roles remain blocked.

grant usage on schema private to service_role;
revoke usage on schema private from public, anon, authenticated;

comment on schema private is
  'Internal WOVO routines. Only explicitly granted server roles and functions may resolve objects in this schema.';

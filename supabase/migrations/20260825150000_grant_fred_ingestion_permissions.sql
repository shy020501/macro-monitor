-- FRED ingestion runs through the server-only service_role client. Keep
-- browser roles closed while granting only the writes required by sync:
-- point observation upserts and indicator provider metadata updates.

grant insert, update on table public.observations to service_role;
grant update on table public.indicators to service_role;

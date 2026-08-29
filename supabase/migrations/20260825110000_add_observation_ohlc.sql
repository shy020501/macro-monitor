-- Add optional OHLC values while retaining observations.value as the canonical
-- point value consumed by the rule engine. For candle rows, value equals close.

alter table public.observations
  add column if not exists open_value numeric,
  add column if not exists high_value numeric,
  add column if not exists low_value numeric,
  add column if not exists close_value numeric;

-- Existing point observations become flat candles. Future point-only sources
-- may still leave every OHLC column NULL.
update public.observations
set
  open_value = value,
  high_value = value,
  low_value = value,
  close_value = value
where open_value is null
  and high_value is null
  and low_value is null
  and close_value is null;

alter table public.observations
  add constraint observations_ohlc_all_or_none
    check (
      (open_value is null and high_value is null and low_value is null and close_value is null)
      or
      (open_value is not null and high_value is not null and low_value is not null and close_value is not null)
    ),
  add constraint observations_ohlc_bounds
    check (
      high_value is null
      or (
        high_value >= greatest(open_value, close_value)
        and low_value <= least(open_value, close_value)
        and high_value >= low_value
      )
    ),
  add constraint observations_value_matches_close
    check (close_value is null or value = close_value);

comment on column public.observations.value is
  'Canonical observation value used by rules; equal to close_value for OHLC rows.';

comment on column public.observations.open_value is
  'Optional period open. OHLC columns must be populated together.';

comment on column public.observations.high_value is
  'Optional period high. Must be at least the open and close.';

comment on column public.observations.low_value is
  'Optional period low. Must be at most the open and close.';

comment on column public.observations.close_value is
  'Optional period close. When present, it must equal observations.value.';

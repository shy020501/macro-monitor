-- Optional market-provider fields. Economic point series such as FRED leave
-- these NULL, while future OHLCV providers can populate whichever fields they
-- actually supply.

alter table public.observations
  add column if not exists volume numeric,
  add column if not exists buy_volume numeric;

alter table public.observations
  add constraint observations_volume_nonnegative
    check (volume is null or volume >= 0),
  add constraint observations_buy_volume_nonnegative
    check (buy_volume is null or buy_volume >= 0);

comment on column public.observations.volume is
  'Optional total trading volume for the observation period.';

comment on column public.observations.buy_volume is
  'Optional provider-defined buy-side volume; NULL when unavailable or undefined.';

-- Configure one active source per indicator. Market sync is intentionally
-- daily-only for now; observations.value remains the canonical close/value.

grant delete on table public.observations to service_role;

insert into public.indicators (
  symbol,
  name,
  category,
  source,
  unit,
  frequency,
  metadata
)
values
  (
    'DXY',
    'U.S. Dollar Index',
    'currency',
    'yahoo_finance',
    'index points',
    'daily',
    '{"provider":"yahoo_finance","provider_symbol":"DX-Y.NYB","interval":"1d","sync_start_date":"2000-01-01","instrument_definition":"ice_us_dollar_index"}'::jsonb
  ),
  (
    'US10Y',
    'U.S. 10-Year Treasury Yield',
    'rates',
    'yahoo_finance',
    'percent',
    'daily',
    '{"provider":"yahoo_finance","provider_symbol":"^TNX","interval":"1d","sync_start_date":"2000-01-01","instrument_definition":"cboe_10_year_treasury_yield_index"}'::jsonb
  ),
  (
    'US2Y',
    'U.S. 2-Year Treasury Yield',
    'rates',
    'fred',
    'percent',
    'daily',
    '{"provider":"fred","provider_series_id":"DGS2","interval":"1d","sync_start_date":"1976-06-01","instrument_definition":"treasury_constant_maturity_rate"}'::jsonb
  ),
  (
    'SP500',
    'S&P 500 Index',
    'equity',
    'yahoo_finance',
    'index points',
    'daily',
    '{"provider":"yahoo_finance","provider_symbol":"^GSPC","interval":"1d","sync_start_date":"2000-01-01","instrument_definition":"sp_500_index"}'::jsonb
  ),
  (
    'KOSPI',
    'KOSPI Composite Index',
    'equity',
    'yahoo_finance',
    'index points',
    'daily',
    '{"provider":"yahoo_finance","provider_symbol":"^KS11","interval":"1d","sync_start_date":"2000-01-01","instrument_definition":"kospi_composite_index"}'::jsonb
  ),
  (
    'WTI',
    'WTI Crude Oil Front-Month Futures',
    'commodity',
    'yahoo_finance',
    'USD per barrel',
    'daily',
    '{"provider":"yahoo_finance","provider_symbol":"CL=F","interval":"1d","sync_start_date":"2000-01-01","instrument_definition":"wti_front_month_futures"}'::jsonb
  ),
  (
    'GOLD',
    'Gold Spot Price (XAU/USD)',
    'commodity',
    'alpha_vantage',
    'USD per troy ounce',
    'daily',
    '{"provider":"alpha_vantage","provider_symbol":"XAU","interval":"1d","sync_start_date":"2000-01-01","instrument_definition":"xau_usd_spot"}'::jsonb
  ),
  (
    'USDKRW',
    'U.S. Dollar / South Korean Won',
    'foreign_exchange',
    'yahoo_finance',
    'KRW per USD',
    'daily',
    '{"provider":"yahoo_finance","provider_symbol":"KRW=X","interval":"1d","sync_start_date":"2000-01-01","instrument_definition":"usd_krw_market_fx"}'::jsonb
  ),
  (
    'CPI',
    'U.S. Consumer Price Index',
    'inflation',
    'fred',
    'index 1982-1984=100',
    'monthly',
    '{"provider":"fred","provider_series_id":"CPIAUCSL","interval":"1d","sync_start_date":"1947-01-01","instrument_definition":"us_cpi_all_urban_consumers_seasonally_adjusted"}'::jsonb
  )
on conflict (symbol) do update
set
  name = excluded.name,
  category = excluded.category,
  source = excluded.source,
  unit = excluded.unit,
  frequency = excluded.frequency,
  metadata = excluded.metadata;

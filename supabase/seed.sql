-- Repeatable local seed data for UI development and rule-engine tests.
begin;

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
  ('DXY', 'U.S. Dollar Index', 'currency', 'yahoo_finance', 'index points', 'daily', '{"provider":"yahoo_finance","provider_symbol":"DX-Y.NYB","interval":"1d","sync_start_date":"1900-01-01","instrument_definition":"ice_us_dollar_index"}'::jsonb),
  ('US10Y', 'U.S. 10-Year Treasury Yield', 'rates', 'yahoo_finance', 'percent', 'daily', '{"provider":"yahoo_finance","provider_symbol":"^TNX","interval":"1d","sync_start_date":"1900-01-01","instrument_definition":"cboe_10_year_treasury_yield_index"}'::jsonb),
  ('US2Y', 'U.S. 2-Year Treasury Yield', 'rates', 'fred', 'percent', 'daily', '{"provider":"fred","provider_series_id":"DGS2","interval":"1d","sync_start_date":"1976-06-01","instrument_definition":"treasury_constant_maturity_rate"}'::jsonb),
  ('SP500', 'S&P 500 Index', 'equity', 'yahoo_finance', 'index points', 'daily', '{"provider":"yahoo_finance","provider_symbol":"^GSPC","interval":"1d","sync_start_date":"1900-01-01","instrument_definition":"sp_500_index"}'::jsonb),
  ('NASDAQ', 'NASDAQ Composite Index', 'equity', 'yahoo_finance', 'index points', 'daily', '{"provider":"yahoo_finance","provider_symbol":"^IXIC","interval":"1d","sync_start_date":"1900-01-01","instrument_definition":"nasdaq_composite_index"}'::jsonb),
  ('VIX', 'CBOE Volatility Index', 'volatility', 'yahoo_finance', 'index points', 'daily', '{"provider":"yahoo_finance","provider_symbol":"^VIX","interval":"1d","sync_start_date":"1900-01-01","instrument_definition":"cboe_vix_index"}'::jsonb),
  ('KOSPI', 'KOSPI Composite Index', 'equity', 'yahoo_finance', 'index points', 'daily', '{"provider":"yahoo_finance","provider_symbol":"^KS11","interval":"1d","sync_start_date":"1900-01-01","instrument_definition":"kospi_composite_index"}'::jsonb),
  ('KOSDAQ', 'KOSDAQ Composite Index', 'equity', 'yahoo_finance', 'index points', 'daily', '{"provider":"yahoo_finance","provider_symbol":"^KQ11","interval":"1d","sync_start_date":"1900-01-01","instrument_definition":"kosdaq_composite_index"}'::jsonb),
  ('WTI', 'WTI Crude Oil Front-Month Futures', 'commodity', 'yahoo_finance', 'USD per barrel', 'daily', '{"provider":"yahoo_finance","provider_symbol":"CL=F","interval":"1d","sync_start_date":"1900-01-01","instrument_definition":"wti_front_month_futures"}'::jsonb),
  ('COPPER', 'Copper Front-Month Futures', 'commodity', 'yahoo_finance', 'USD per pound', 'daily', '{"provider":"yahoo_finance","provider_symbol":"HG=F","interval":"1d","sync_start_date":"1900-01-01","instrument_definition":"copper_front_month_futures"}'::jsonb),
  ('GOLD', 'Gold Spot Price (XAU/USD)', 'commodity', 'alpha_vantage', 'USD per troy ounce', 'daily', '{"provider":"alpha_vantage","provider_symbol":"XAU","interval":"1d","sync_start_date":"1900-01-01","instrument_definition":"xau_usd_spot"}'::jsonb),
  ('USDKRW', 'U.S. Dollar / South Korean Won', 'foreign_exchange', 'yahoo_finance', 'KRW per USD', 'daily', '{"provider":"yahoo_finance","provider_symbol":"KRW=X","interval":"1d","sync_start_date":"1900-01-01","instrument_definition":"usd_krw_market_fx"}'::jsonb),
  ('USDJPY', 'U.S. Dollar / Japanese Yen', 'foreign_exchange', 'yahoo_finance', 'JPY per USD', 'daily', '{"provider":"yahoo_finance","provider_symbol":"JPY=X","interval":"1d","sync_start_date":"1900-01-01","instrument_definition":"usd_jpy_market_fx"}'::jsonb),
  ('CPI', 'U.S. Consumer Price Index', 'inflation', 'fred', 'index 1982-1984=100', 'monthly', '{"provider":"fred","provider_series_id":"CPIAUCSL","interval":"1d","sync_start_date":"1947-01-01","instrument_definition":"us_cpi_all_urban_consumers_seasonally_adjusted"}'::jsonb),
  ('CORE_CPI', 'U.S. Core Consumer Price Index', 'inflation', 'fred', 'index 1982-1984=100', 'monthly', '{"provider":"fred","provider_series_id":"CPILFESL","interval":"1d","sync_start_date":"1957-01-01","instrument_definition":"us_cpi_less_food_and_energy_seasonally_adjusted"}'::jsonb),
  ('CORE_PCE', 'U.S. Core PCE Price Index', 'inflation', 'fred', 'index 2017=100', 'monthly', '{"provider":"fred","provider_series_id":"PCEPILFE","interval":"1d","sync_start_date":"1959-01-01","instrument_definition":"us_pce_less_food_and_energy_seasonally_adjusted"}'::jsonb),
  ('UNRATE', 'U.S. Unemployment Rate', 'labor', 'fred', 'percent', 'monthly', '{"provider":"fred","provider_series_id":"UNRATE","interval":"1d","sync_start_date":"1948-01-01","instrument_definition":"us_u3_unemployment_rate_seasonally_adjusted"}'::jsonb),
  ('NFP', 'U.S. Total Nonfarm Payrolls', 'labor', 'fred', 'thousands of persons', 'monthly', '{"provider":"fred","provider_series_id":"PAYEMS","interval":"1d","sync_start_date":"1939-01-01","instrument_definition":"us_total_nonfarm_payroll_employment_level"}'::jsonb),
  ('INITIAL_CLAIMS', 'U.S. Initial Jobless Claims', 'labor', 'fred', 'persons', 'weekly', '{"provider":"fred","provider_series_id":"ICSA","interval":"1d","sync_start_date":"1967-01-01","instrument_definition":"us_initial_unemployment_insurance_claims_seasonally_adjusted"}'::jsonb),
  ('REAL_GDP_GROWTH', 'U.S. Real GDP Growth', 'growth', 'fred', 'percent annualized', 'quarterly', '{"provider":"fred","provider_series_id":"A191RL1Q225SBEA","interval":"1d","sync_start_date":"1947-01-01","instrument_definition":"us_real_gdp_quarterly_growth_saar"}'::jsonb),
  ('INDPRO', 'U.S. Industrial Production Index', 'growth', 'fred', 'index 2017=100', 'monthly', '{"provider":"fred","provider_series_id":"INDPRO","interval":"1d","sync_start_date":"1919-01-01","instrument_definition":"us_total_industrial_production_seasonally_adjusted"}'::jsonb),
  ('EFFR', 'Effective Federal Funds Rate', 'rates', 'fred', 'percent', 'daily', '{"provider":"fred","provider_series_id":"EFFR","interval":"1d","sync_start_date":"2000-07-01","instrument_definition":"effective_federal_funds_rate"}'::jsonb),
  ('US10Y2Y', 'U.S. 10-Year Minus 2-Year Treasury Spread', 'rates', 'fred', 'percentage points', 'daily', '{"provider":"fred","provider_series_id":"T10Y2Y","interval":"1d","sync_start_date":"1976-06-01","instrument_definition":"ten_year_minus_two_year_treasury_spread"}'::jsonb),
  ('US10Y_REAL', 'U.S. 10-Year Real Treasury Yield', 'rates', 'fred', 'percent', 'daily', '{"provider":"fred","provider_series_id":"DFII10","interval":"1d","sync_start_date":"2003-01-01","instrument_definition":"ten_year_inflation_indexed_treasury_yield"}'::jsonb),
  ('US10Y_BEI', 'U.S. 10-Year Breakeven Inflation Rate', 'inflation', 'fred', 'percent', 'daily', '{"provider":"fred","provider_series_id":"T10YIE","interval":"1d","sync_start_date":"2003-01-01","instrument_definition":"ten_year_breakeven_inflation_rate"}'::jsonb),
  ('NFCI', 'Chicago Fed National Financial Conditions Index', 'financial_conditions', 'fred', 'index', 'weekly', '{"provider":"fred","provider_series_id":"NFCI","interval":"1d","sync_start_date":"1971-01-01","instrument_definition":"chicago_fed_national_financial_conditions_index"}'::jsonb),
  ('M2', 'U.S. M2 Money Stock', 'liquidity', 'fred', 'billions of USD', 'monthly', '{"provider":"fred","provider_series_id":"M2SL","interval":"1d","sync_start_date":"1959-01-01","instrument_definition":"us_m2_money_stock_seasonally_adjusted"}'::jsonb)
on conflict (symbol) do update
set
  name = excluded.name,
  category = excluded.category,
  source = excluded.source,
  unit = excluded.unit,
  frequency = excluded.frequency,
  metadata = excluded.metadata;

-- Replace only this project's mock observations so re-running the seed produces
-- the same 141 trading-day candles required to display MA120.
delete from public.observations as observations
using public.indicators as indicators
where observations.indicator_id = indicators.id
  and observations.metadata @> '{"sample": true}'::jsonb;

with market_profiles (
  symbol,
  base_value,
  daily_trend,
  cycle_amplitude,
  candle_spread
) as (
  values
    ('DXY', 104.8::double precision, -0.012::double precision, 0.65::double precision, 0.20::double precision),
    ('US10Y', 4.20::double precision, 0.0032::double precision, 0.08::double precision, 0.035::double precision),
    ('US2Y', 4.75::double precision, -0.0018::double precision, 0.06::double precision, 0.030::double precision),
    ('SP500', 5200::double precision, 4.30::double precision, 70::double precision, 28::double precision),
    ('KOSPI', 2700::double precision, 1.20::double precision, 35::double precision, 16::double precision),
    ('WTI', 78::double precision, 0.015::double precision, 2.20::double precision, 1.10::double precision),
    ('GOLD', 2300::double precision, 1.80::double precision, 30::double precision, 14::double precision),
    ('USDKRW', 1380::double precision, -0.25::double precision, 10::double precision, 5::double precision)
),
trading_days as (
  select
    generated_day::date as trading_day,
    (row_number() over (order by generated_day) - 1)::integer as day_index,
    (row_number() over (order by generated_day desc) - 1)::integer as reverse_index
  from generate_series(
    date '2026-02-09',
    date '2026-08-24',
    interval '1 day'
  ) as generated_days(generated_day)
  where extract(isodow from generated_day) <= 5
),
close_series as (
  select
    profiles.symbol,
    days.trading_day,
    days.day_index,
    profiles.candle_spread,
    round((
      case
        -- Keep the latest six DXY closes strictly decreasing so the seeded
        -- five-period streak condition remains a meaningful demo.
        when profiles.symbol = 'DXY' and days.reverse_index <= 5
          then 102.90 + (days.reverse_index * 0.18)
        else profiles.base_value
          + (profiles.daily_trend * days.day_index)
          + (profiles.cycle_amplitude * sin(days.day_index / 8.0))
          + (profiles.cycle_amplitude * 0.35 * cos(days.day_index / 17.0))
      end
    )::numeric, 4) as close_value
  from market_profiles as profiles
  cross join trading_days as days
),
open_close_series as (
  select
    close_series.*,
    round((
      close_series.close_value::double precision
      + close_series.candle_spread * 0.35 * sin((close_series.day_index + 1) * 1.37)
    )::numeric, 4) as open_value
  from close_series
),
sample_observations as (
  select
    open_close_series.symbol,
    open_close_series.trading_day::timestamp at time zone 'UTC' as observed_at,
    open_close_series.open_value,
    round((
      greatest(open_close_series.open_value, open_close_series.close_value)::double precision
      + open_close_series.candle_spread
        * (0.55 + abs(sin(open_close_series.day_index * 0.83)) * 0.45)
    )::numeric, 4) as high_value,
    round((
      least(open_close_series.open_value, open_close_series.close_value)::double precision
      - open_close_series.candle_spread
        * (0.55 + abs(cos(open_close_series.day_index * 0.71)) * 0.45)
    )::numeric, 4) as low_value,
    open_close_series.close_value
  from open_close_series
)
insert into public.observations (
  indicator_id,
  observed_at,
  value,
  open_value,
  high_value,
  low_value,
  close_value,
  metadata
)
select
  indicators.id,
  sample_observations.observed_at,
  sample_observations.close_value,
  sample_observations.open_value,
  sample_observations.high_value,
  sample_observations.low_value,
  sample_observations.close_value,
  '{"sample": true, "format": "ohlc", "provider": "seed"}'::jsonb
from sample_observations
join public.indicators
  on indicators.symbol = sample_observations.symbol
on conflict (indicator_id, observed_at) do update
set
  value = excluded.value,
  open_value = excluded.open_value,
  high_value = excluded.high_value,
  low_value = excluded.low_value,
  close_value = excluded.close_value,
  metadata = excluded.metadata;

insert into public.condition_sets (
  id,
  owner_id,
  name,
  description,
  enabled,
  metadata
)
values (
  '10000000-0000-4000-8000-000000000001'::uuid,
  null,
  'DXY decline with rebound or high US10Y',
  'DXY falls for 5 consecutive days AND (DXY daily percentage change > 0 OR US10Y > 4.5).',
  true,
  '{"sample": true}'::jsonb
)
on conflict (id) do update
set
  owner_id = excluded.owner_id,
  name = excluded.name,
  description = excluded.description,
  enabled = excluded.enabled,
  metadata = excluded.metadata;

-- Root AND group.
insert into public.condition_groups (
  id,
  condition_set_id,
  parent_group_id,
  logical_operator,
  sort_order
)
values (
  '20000000-0000-4000-8000-000000000001'::uuid,
  '10000000-0000-4000-8000-000000000001'::uuid,
  null,
  'and',
  0
)
on conflict (id) do update
set
  condition_set_id = excluded.condition_set_id,
  parent_group_id = excluded.parent_group_id,
  logical_operator = excluded.logical_operator,
  sort_order = excluded.sort_order;

-- Nested OR group under the root group.
insert into public.condition_groups (
  id,
  condition_set_id,
  parent_group_id,
  logical_operator,
  sort_order
)
values (
  '20000000-0000-4000-8000-000000000002'::uuid,
  '10000000-0000-4000-8000-000000000001'::uuid,
  '20000000-0000-4000-8000-000000000001'::uuid,
  'or',
  1
)
on conflict (id) do update
set
  condition_set_id = excluded.condition_set_id,
  parent_group_id = excluded.parent_group_id,
  logical_operator = excluded.logical_operator,
  sort_order = excluded.sort_order;

insert into public.condition_rules (
  id,
  group_id,
  indicator_id,
  rule_type,
  operator,
  parameters,
  enabled,
  sort_order
)
select
  seed_rule.id,
  seed_rule.group_id,
  indicators.id,
  seed_rule.rule_type,
  seed_rule.operator,
  seed_rule.parameters,
  true,
  seed_rule.sort_order
from (
  values
    (
      '30000000-0000-4000-8000-000000000001'::uuid,
      '20000000-0000-4000-8000-000000000001'::uuid,
      'DXY'::text,
      'streak'::text,
      'decreasing'::text,
      '{"periods": 5, "comparison": "previous_observation"}'::jsonb,
      0
    ),
    (
      '30000000-0000-4000-8000-000000000002'::uuid,
      '20000000-0000-4000-8000-000000000002'::uuid,
      'DXY'::text,
      'percentage_change'::text,
      'gt'::text,
      '{"threshold": 0, "window": 1, "window_unit": "day"}'::jsonb,
      0
    ),
    (
      '30000000-0000-4000-8000-000000000003'::uuid,
      '20000000-0000-4000-8000-000000000002'::uuid,
      'US10Y'::text,
      'threshold'::text,
      'gt'::text,
      '{"value": 4.5}'::jsonb,
      1
    )
) as seed_rule (id, group_id, symbol, rule_type, operator, parameters, sort_order)
join public.indicators
  on indicators.symbol = seed_rule.symbol
on conflict (id) do update
set
  group_id = excluded.group_id,
  indicator_id = excluded.indicator_id,
  rule_type = excluded.rule_type,
  operator = excluded.operator,
  parameters = excluded.parameters,
  enabled = excluded.enabled,
  sort_order = excluded.sort_order;

commit;

-- Expand the active catalog to the agreed daily-market and macro indicator set.
-- A 1900 start date is a max-history sentinel for the yfinance bridge.

insert into public.indicators (
  symbol, name, category, source, unit, frequency, metadata
)
values
  ('CPI', 'U.S. Consumer Price Index', 'inflation', 'fred', 'index 1982-1984=100', 'monthly', '{"provider":"fred","provider_series_id":"CPIAUCSL","interval":"1d","sync_start_date":"1947-01-01","instrument_definition":"us_cpi_all_urban_consumers_seasonally_adjusted"}'::jsonb),
  ('CORE_CPI', 'U.S. Core Consumer Price Index', 'inflation', 'fred', 'index 1982-1984=100', 'monthly', '{"provider":"fred","provider_series_id":"CPILFESL","interval":"1d","sync_start_date":"1957-01-01","instrument_definition":"us_cpi_less_food_and_energy_seasonally_adjusted"}'::jsonb),
  ('CORE_PCE', 'U.S. Core PCE Price Index', 'inflation', 'fred', 'index 2017=100', 'monthly', '{"provider":"fred","provider_series_id":"PCEPILFE","interval":"1d","sync_start_date":"1959-01-01","instrument_definition":"us_pce_less_food_and_energy_seasonally_adjusted"}'::jsonb),
  ('UNRATE', 'U.S. Unemployment Rate', 'labor', 'fred', 'percent', 'monthly', '{"provider":"fred","provider_series_id":"UNRATE","interval":"1d","sync_start_date":"1948-01-01","instrument_definition":"us_u3_unemployment_rate_seasonally_adjusted"}'::jsonb),
  ('NFP', 'U.S. Total Nonfarm Payrolls', 'labor', 'fred', 'thousands of persons', 'monthly', '{"provider":"fred","provider_series_id":"PAYEMS","interval":"1d","sync_start_date":"1939-01-01","instrument_definition":"us_total_nonfarm_payroll_employment_level"}'::jsonb),
  ('INITIAL_CLAIMS', 'U.S. Initial Jobless Claims', 'labor', 'fred', 'persons', 'weekly', '{"provider":"fred","provider_series_id":"ICSA","interval":"1d","sync_start_date":"1967-01-01","instrument_definition":"us_initial_unemployment_insurance_claims_seasonally_adjusted"}'::jsonb),
  ('REAL_GDP_GROWTH', 'U.S. Real GDP Growth', 'growth', 'fred', 'percent annualized', 'quarterly', '{"provider":"fred","provider_series_id":"A191RL1Q225SBEA","interval":"1d","sync_start_date":"1947-01-01","instrument_definition":"us_real_gdp_quarterly_growth_saar"}'::jsonb),
  ('INDPRO', 'U.S. Industrial Production Index', 'growth', 'fred', 'index 2017=100', 'monthly', '{"provider":"fred","provider_series_id":"INDPRO","interval":"1d","sync_start_date":"1919-01-01","instrument_definition":"us_total_industrial_production_seasonally_adjusted"}'::jsonb),
  ('EFFR', 'Effective Federal Funds Rate', 'rates', 'fred', 'percent', 'daily', '{"provider":"fred","provider_series_id":"EFFR","interval":"1d","sync_start_date":"2000-07-01","instrument_definition":"effective_federal_funds_rate"}'::jsonb),
  ('US2Y', 'U.S. 2-Year Treasury Yield', 'rates', 'fred', 'percent', 'daily', '{"provider":"fred","provider_series_id":"DGS2","interval":"1d","sync_start_date":"1976-06-01","instrument_definition":"treasury_constant_maturity_rate"}'::jsonb),
  ('US10Y2Y', 'U.S. 10-Year Minus 2-Year Treasury Spread', 'rates', 'fred', 'percentage points', 'daily', '{"provider":"fred","provider_series_id":"T10Y2Y","interval":"1d","sync_start_date":"1976-06-01","instrument_definition":"ten_year_minus_two_year_treasury_spread"}'::jsonb),
  ('US10Y_REAL', 'U.S. 10-Year Real Treasury Yield', 'rates', 'fred', 'percent', 'daily', '{"provider":"fred","provider_series_id":"DFII10","interval":"1d","sync_start_date":"2003-01-01","instrument_definition":"ten_year_inflation_indexed_treasury_yield"}'::jsonb),
  ('US10Y_BEI', 'U.S. 10-Year Breakeven Inflation Rate', 'inflation', 'fred', 'percent', 'daily', '{"provider":"fred","provider_series_id":"T10YIE","interval":"1d","sync_start_date":"2003-01-01","instrument_definition":"ten_year_breakeven_inflation_rate"}'::jsonb),
  ('NFCI', 'Chicago Fed National Financial Conditions Index', 'financial_conditions', 'fred', 'index', 'weekly', '{"provider":"fred","provider_series_id":"NFCI","interval":"1d","sync_start_date":"1971-01-01","instrument_definition":"chicago_fed_national_financial_conditions_index"}'::jsonb),
  ('M2', 'U.S. M2 Money Stock', 'liquidity', 'fred', 'billions of USD', 'monthly', '{"provider":"fred","provider_series_id":"M2SL","interval":"1d","sync_start_date":"1959-01-01","instrument_definition":"us_m2_money_stock_seasonally_adjusted"}'::jsonb),
  ('DXY', 'U.S. Dollar Index', 'currency', 'yahoo_finance', 'index points', 'daily', '{"provider":"yahoo_finance","provider_symbol":"DX-Y.NYB","interval":"1d","sync_start_date":"1900-01-01","instrument_definition":"ice_us_dollar_index"}'::jsonb),
  ('US10Y', 'U.S. 10-Year Treasury Yield', 'rates', 'yahoo_finance', 'percent', 'daily', '{"provider":"yahoo_finance","provider_symbol":"^TNX","interval":"1d","sync_start_date":"1900-01-01","instrument_definition":"cboe_10_year_treasury_yield_index"}'::jsonb),
  ('SP500', 'S&P 500 Index', 'equity', 'yahoo_finance', 'index points', 'daily', '{"provider":"yahoo_finance","provider_symbol":"^GSPC","interval":"1d","sync_start_date":"1900-01-01","instrument_definition":"sp_500_index"}'::jsonb),
  ('NASDAQ', 'NASDAQ Composite Index', 'equity', 'yahoo_finance', 'index points', 'daily', '{"provider":"yahoo_finance","provider_symbol":"^IXIC","interval":"1d","sync_start_date":"1900-01-01","instrument_definition":"nasdaq_composite_index"}'::jsonb),
  ('VIX', 'CBOE Volatility Index', 'volatility', 'yahoo_finance', 'index points', 'daily', '{"provider":"yahoo_finance","provider_symbol":"^VIX","interval":"1d","sync_start_date":"1900-01-01","instrument_definition":"cboe_vix_index"}'::jsonb),
  ('KOSPI', 'KOSPI Composite Index', 'equity', 'yahoo_finance', 'index points', 'daily', '{"provider":"yahoo_finance","provider_symbol":"^KS11","interval":"1d","sync_start_date":"1900-01-01","instrument_definition":"kospi_composite_index"}'::jsonb),
  ('KOSDAQ', 'KOSDAQ Composite Index', 'equity', 'yahoo_finance', 'index points', 'daily', '{"provider":"yahoo_finance","provider_symbol":"^KQ11","interval":"1d","sync_start_date":"1900-01-01","instrument_definition":"kosdaq_composite_index"}'::jsonb),
  ('USDKRW', 'U.S. Dollar / South Korean Won', 'foreign_exchange', 'yahoo_finance', 'KRW per USD', 'daily', '{"provider":"yahoo_finance","provider_symbol":"KRW=X","interval":"1d","sync_start_date":"1900-01-01","instrument_definition":"usd_krw_market_fx"}'::jsonb),
  ('USDJPY', 'U.S. Dollar / Japanese Yen', 'foreign_exchange', 'yahoo_finance', 'JPY per USD', 'daily', '{"provider":"yahoo_finance","provider_symbol":"JPY=X","interval":"1d","sync_start_date":"1900-01-01","instrument_definition":"usd_jpy_market_fx"}'::jsonb),
  ('WTI', 'WTI Crude Oil Front-Month Futures', 'commodity', 'yahoo_finance', 'USD per barrel', 'daily', '{"provider":"yahoo_finance","provider_symbol":"CL=F","interval":"1d","sync_start_date":"1900-01-01","instrument_definition":"wti_front_month_futures"}'::jsonb),
  ('COPPER', 'Copper Front-Month Futures', 'commodity', 'yahoo_finance', 'USD per pound', 'daily', '{"provider":"yahoo_finance","provider_symbol":"HG=F","interval":"1d","sync_start_date":"1900-01-01","instrument_definition":"copper_front_month_futures"}'::jsonb),
  ('GOLD', 'Gold Spot Price (XAU/USD)', 'commodity', 'alpha_vantage', 'USD per troy ounce', 'daily', '{"provider":"alpha_vantage","provider_symbol":"XAU","interval":"1d","sync_start_date":"1900-01-01","instrument_definition":"xau_usd_spot"}'::jsonb)
on conflict (symbol) do update
set
  name = excluded.name,
  category = excluded.category,
  source = excluded.source,
  unit = excluded.unit,
  frequency = excluded.frequency,
  metadata = excluded.metadata;

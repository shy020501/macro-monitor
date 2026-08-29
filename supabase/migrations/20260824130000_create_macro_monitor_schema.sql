-- Core schema for macro indicator observations and nested composite conditions.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.indicators (
  id uuid primary key default gen_random_uuid(),
  symbol text not null unique,
  name text not null,
  category text not null,
  source text not null,
  unit text not null,
  frequency text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint indicators_symbol_not_blank check (btrim(symbol) <> ''),
  constraint indicators_symbol_uppercase check (symbol = upper(symbol)),
  constraint indicators_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.observations (
  id uuid primary key default gen_random_uuid(),
  indicator_id uuid not null,
  observed_at timestamptz not null,
  value numeric not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint observations_indicator_fk
    foreign key (indicator_id)
    references public.indicators (id)
    on delete cascade,
  constraint observations_indicator_time_unique
    unique (indicator_id, observed_at),
  constraint observations_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.condition_sets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid null,
  name text not null,
  description text,
  enabled boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint condition_sets_owner_fk
    foreign key (owner_id)
    references auth.users (id)
    on delete cascade,
  constraint condition_sets_name_not_blank check (btrim(name) <> ''),
  constraint condition_sets_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.condition_groups (
  id uuid primary key default gen_random_uuid(),
  condition_set_id uuid not null,
  parent_group_id uuid,
  logical_operator text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint condition_groups_set_fk
    foreign key (condition_set_id)
    references public.condition_sets (id)
    on delete cascade,
  constraint condition_groups_id_set_unique unique (id, condition_set_id),
  constraint condition_groups_parent_fk
    foreign key (parent_group_id, condition_set_id)
    references public.condition_groups (id, condition_set_id)
    on delete cascade,
  constraint condition_groups_logical_operator_check
    check (logical_operator in ('and', 'or')),
  constraint condition_groups_sort_order_nonnegative check (sort_order >= 0),
  constraint condition_groups_not_self_parent
    check (parent_group_id is null or parent_group_id <> id)
);

create table if not exists public.condition_rules (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null,
  indicator_id uuid not null,
  rule_type text not null,
  operator text not null,
  parameters jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint condition_rules_group_fk
    foreign key (group_id)
    references public.condition_groups (id)
    on delete cascade,
  constraint condition_rules_indicator_fk
    foreign key (indicator_id)
    references public.indicators (id)
    on delete restrict,
  constraint condition_rules_rule_type_not_blank check (btrim(rule_type) <> ''),
  constraint condition_rules_operator_not_blank check (btrim(operator) <> ''),
  constraint condition_rules_parameters_is_object check (jsonb_typeof(parameters) = 'object'),
  constraint condition_rules_sort_order_nonnegative check (sort_order >= 0)
);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  condition_set_id uuid,
  triggered_at timestamptz not null default now(),
  message text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint alerts_condition_set_fk
    foreign key (condition_set_id)
    references public.condition_sets (id)
    on delete set null,
  constraint alerts_message_not_blank check (btrim(message) <> ''),
  constraint alerts_payload_is_object check (jsonb_typeof(payload) = 'object')
);

-- The unique constraint already supports indicator-specific range scans. This
-- covering index favors the common "latest observations for one indicator" query.
create index if not exists observations_indicator_observed_at_desc_idx
  on public.observations (indicator_id, observed_at desc)
  include (value);

create index if not exists observations_observed_at_desc_idx
  on public.observations (observed_at desc);

create index if not exists condition_sets_owner_id_idx
  on public.condition_sets (owner_id)
  where owner_id is not null;

-- This enforces at most one root group per condition set. The application must
-- create exactly one root and keep every group reachable from it.
create unique index if not exists condition_groups_one_root_per_set_idx
  on public.condition_groups (condition_set_id)
  where parent_group_id is null;

create index if not exists condition_groups_parent_group_id_idx
  on public.condition_groups (parent_group_id)
  where parent_group_id is not null;

create index if not exists condition_rules_group_id_idx
  on public.condition_rules (group_id);

create index if not exists condition_rules_indicator_id_idx
  on public.condition_rules (indicator_id);

create index if not exists alerts_condition_set_triggered_at_desc_idx
  on public.alerts (condition_set_id, triggered_at desc);

drop trigger if exists indicators_set_updated_at on public.indicators;
create trigger indicators_set_updated_at
before update on public.indicators
for each row execute function public.set_updated_at();

drop trigger if exists observations_set_updated_at on public.observations;
create trigger observations_set_updated_at
before update on public.observations
for each row execute function public.set_updated_at();

drop trigger if exists condition_sets_set_updated_at on public.condition_sets;
create trigger condition_sets_set_updated_at
before update on public.condition_sets
for each row execute function public.set_updated_at();

drop trigger if exists condition_groups_set_updated_at on public.condition_groups;
create trigger condition_groups_set_updated_at
before update on public.condition_groups
for each row execute function public.set_updated_at();

drop trigger if exists condition_rules_set_updated_at on public.condition_rules;
create trigger condition_rules_set_updated_at
before update on public.condition_rules
for each row execute function public.set_updated_at();

drop trigger if exists alerts_set_updated_at on public.alerts;
create trigger alerts_set_updated_at
before update on public.alerts
for each row execute function public.set_updated_at();

-- Keep Data API access closed until explicit anon/authenticated policies are
-- designed together with authentication and application authorization.
alter table public.indicators enable row level security;
alter table public.observations enable row level security;
alter table public.condition_sets enable row level security;
alter table public.condition_groups enable row level security;
alter table public.condition_rules enable row level security;
alter table public.alerts enable row level security;

comment on column public.condition_sets.owner_id is
  'Optional Supabase Auth owner. NULL is allowed for system and seed condition sets.';

comment on column public.condition_groups.parent_group_id is
  'NULL identifies the root. The application must guarantee exactly one root and prevent multi-level parent cycles.';

comment on column public.condition_rules.parameters is
  'Rule-type-specific settings. The database only requires a JSON object; the application and Rule Engine must validate each rule-type schema.';

comment on column public.alerts.condition_set_id is
  'Nullable historical reference. It becomes NULL when the originating condition set is deleted.';

comment on column public.alerts.payload is
  'Trigger-time snapshot container for condition name, nested group/rule structure, and evaluation metadata; population is the trigger/application responsibility.';

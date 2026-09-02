-- Persistent condition evaluation state and an atomic alert transition boundary.

create table if not exists public.condition_runtime_states (
  condition_set_id uuid primary key,
  last_matched boolean,
  last_evaluated_at timestamptz not null,
  last_transition_at timestamptz,
  last_alerted_at timestamptz,
  last_error text,
  last_error_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint condition_runtime_states_condition_set_fk
    foreign key (condition_set_id)
    references public.condition_sets (id)
    on delete cascade
);

drop trigger if exists condition_runtime_states_set_updated_at
  on public.condition_runtime_states;
create trigger condition_runtime_states_set_updated_at
before update on public.condition_runtime_states
for each row execute function public.set_updated_at();

alter table public.condition_runtime_states enable row level security;

grant select on table public.condition_runtime_states to service_role;
grant delete on table public.alerts to service_role;

comment on table public.condition_runtime_states is
  'Latest monitoring state for one condition set. This is disposable runtime state, not alert history.';

comment on column public.condition_runtime_states.last_matched is
  'NULL means no successful evaluation has completed yet. Evaluation errors never change this value.';

create or replace function public.process_condition_evaluation(
  p_condition_set_id uuid,
  p_matched boolean,
  p_evaluated_at timestamptz,
  p_error text default null,
  p_message text default null,
  p_payload jsonb default '{}'::jsonb
)
returns table (
  alert_created boolean,
  alert_id uuid,
  previous_matched boolean,
  current_matched boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous_matched boolean;
  v_alert_created boolean := false;
  v_alert_id uuid;
  v_error text := nullif(btrim(p_error), '');
begin
  if p_evaluated_at is null then
    raise exception 'p_evaluated_at is required';
  end if;

  if v_error is not null then
    insert into public.condition_runtime_states (
      condition_set_id,
      last_matched,
      last_evaluated_at,
      last_error,
      last_error_at
    )
    values (
      p_condition_set_id,
      null,
      p_evaluated_at,
      v_error,
      p_evaluated_at
    )
    on conflict (condition_set_id) do update
    set
      last_evaluated_at = excluded.last_evaluated_at,
      last_error = excluded.last_error,
      last_error_at = excluded.last_error_at
    returning last_matched into v_previous_matched;

    return query
    select false, null::uuid, v_previous_matched, v_previous_matched;
    return;
  end if;

  if p_matched is null then
    raise exception 'p_matched is required for a successful evaluation';
  end if;
  if jsonb_typeof(p_payload) <> 'object' then
    raise exception 'p_payload must be a JSON object';
  end if;

  -- The insert establishes the row for a first evaluation. On conflict it
  -- waits for any concurrent transaction that is currently creating it.
  insert into public.condition_runtime_states (
    condition_set_id,
    last_matched,
    last_evaluated_at
  )
  values (
    p_condition_set_id,
    null,
    p_evaluated_at
  )
  on conflict (condition_set_id) do nothing;

  select states.last_matched
  into v_previous_matched
  from public.condition_runtime_states as states
  where states.condition_set_id = p_condition_set_id
  for update;

  v_alert_created := p_matched and coalesce(v_previous_matched, false) = false;

  if v_alert_created then
    if p_message is null or btrim(p_message) = '' then
      raise exception 'p_message is required when an alert is created';
    end if;

    insert into public.alerts (
      condition_set_id,
      triggered_at,
      message,
      payload
    )
    values (
      p_condition_set_id,
      p_evaluated_at,
      p_message,
      p_payload
    )
    returning id into v_alert_id;
  end if;

  update public.condition_runtime_states
  set
    last_matched = p_matched,
    last_evaluated_at = p_evaluated_at,
    last_transition_at = case
      when v_alert_created
        or (
          v_previous_matched is not null
          and v_previous_matched is distinct from p_matched
        )
      then p_evaluated_at
      else last_transition_at
    end,
    last_alerted_at = case
      when v_alert_created then p_evaluated_at
      else last_alerted_at
    end,
    last_error = null,
    last_error_at = null
  where condition_set_id = p_condition_set_id;

  return query
  select
    v_alert_created,
    v_alert_id,
    v_previous_matched,
    p_matched;
end;
$$;

revoke all on function public.process_condition_evaluation(
  uuid,
  boolean,
  timestamptz,
  text,
  text,
  jsonb
) from public, anon, authenticated;

grant execute on function public.process_condition_evaluation(
  uuid,
  boolean,
  timestamptz,
  text,
  text,
  jsonb
) to service_role;

comment on function public.process_condition_evaluation(
  uuid,
  boolean,
  timestamptz,
  text,
  text,
  jsonb
) is
  'Locks one runtime state, creates at most one false-to-true alert, and updates state in the same transaction.';

-- Rule/group meaning changes reset runtime state. Name and description edits do
-- not. Toggling the condition enabled flag also resets it, so reactivation is
-- treated as a first evaluation.
create or replace function public.reset_condition_runtime_state_for_set()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.condition_runtime_states
  where condition_set_id = new.id;
  return new;
end;
$$;

create or replace function public.reset_condition_runtime_state_for_group()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.condition_runtime_states
  where condition_set_id in (
    case when tg_op <> 'INSERT' then old.condition_set_id end,
    case when tg_op <> 'DELETE' then new.condition_set_id end
  );
  return coalesce(new, old);
end;
$$;

create or replace function public.reset_condition_runtime_state_for_rule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.condition_runtime_states as states
  using public.condition_groups as groups
  where states.condition_set_id = groups.condition_set_id
    and groups.id in (
      case when tg_op <> 'INSERT' then old.group_id end,
      case when tg_op <> 'DELETE' then new.group_id end
    );
  return coalesce(new, old);
end;
$$;

drop trigger if exists condition_sets_reset_runtime_on_enabled_change
  on public.condition_sets;
create trigger condition_sets_reset_runtime_on_enabled_change
after update of enabled on public.condition_sets
for each row
when (old.enabled is distinct from new.enabled)
execute function public.reset_condition_runtime_state_for_set();

drop trigger if exists condition_groups_reset_runtime_state
  on public.condition_groups;
create trigger condition_groups_reset_runtime_state
after insert or update or delete on public.condition_groups
for each row execute function public.reset_condition_runtime_state_for_group();

drop trigger if exists condition_rules_reset_runtime_state
  on public.condition_rules;
create trigger condition_rules_reset_runtime_state
after insert or update or delete on public.condition_rules
for each row execute function public.reset_condition_runtime_state_for_rule();

revoke all on function public.reset_condition_runtime_state_for_set()
  from public, anon, authenticated;
revoke all on function public.reset_condition_runtime_state_for_group()
  from public, anon, authenticated;
revoke all on function public.reset_condition_runtime_state_for_rule()
  from public, anon, authenticated;

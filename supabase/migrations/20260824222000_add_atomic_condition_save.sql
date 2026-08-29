-- Atomic persistence boundary for a validated application-layer condition tree.
-- Validation of exactly one root, no cycles/orphans, non-empty groups, and
-- rule-type-specific parameters remains the responsibility of the application.

create or replace function public.save_condition_tree(
  p_condition_set_id uuid,
  p_name text,
  p_description text,
  p_enabled boolean,
  p_groups jsonb,
  p_rules jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_condition_set_id uuid := coalesce(p_condition_set_id, gen_random_uuid());
  v_group jsonb;
  v_rule jsonb;
begin
  if jsonb_typeof(p_groups) <> 'array' or jsonb_array_length(p_groups) = 0 then
    raise exception 'p_groups must be a non-empty JSON array';
  end if;
  if jsonb_typeof(p_rules) <> 'array' then
    raise exception 'p_rules must be a JSON array';
  end if;

  insert into public.condition_sets (
    id,
    name,
    description,
    enabled
  )
  values (
    v_condition_set_id,
    p_name,
    p_description,
    p_enabled
  )
  on conflict (id) do update
  set
    name = excluded.name,
    description = excluded.description,
    enabled = excluded.enabled;

  -- Replacing the tree inside one function call is atomic. Any invalid child,
  -- rule, or foreign key rolls the whole function call back.
  delete from public.condition_groups
  where condition_set_id = v_condition_set_id;

  -- The application flattens groups in preorder so each referenced parent is
  -- inserted before its child under the existing immediate self-reference FK.
  for v_group in
    select value from jsonb_array_elements(p_groups)
  loop
    insert into public.condition_groups (
      id,
      condition_set_id,
      parent_group_id,
      logical_operator,
      sort_order
    )
    values (
      (v_group ->> 'id')::uuid,
      v_condition_set_id,
      nullif(v_group ->> 'parent_group_id', '')::uuid,
      v_group ->> 'logical_operator',
      (v_group ->> 'sort_order')::integer
    );
  end loop;

  for v_rule in
    select value from jsonb_array_elements(p_rules)
  loop
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
    values (
      (v_rule ->> 'id')::uuid,
      (v_rule ->> 'group_id')::uuid,
      (v_rule ->> 'indicator_id')::uuid,
      v_rule ->> 'rule_type',
      v_rule ->> 'operator',
      coalesce(v_rule -> 'parameters', '{}'::jsonb),
      (v_rule ->> 'enabled')::boolean,
      (v_rule ->> 'sort_order')::integer
    );
  end loop;

  return v_condition_set_id;
end;
$$;

revoke all on function public.save_condition_tree(
  uuid,
  text,
  text,
  boolean,
  jsonb,
  jsonb
) from public, anon, authenticated;

grant execute on function public.save_condition_tree(
  uuid,
  text,
  text,
  boolean,
  jsonb,
  jsonb
) to service_role;

-- Tables are not auto-exposed by this project's Supabase configuration. The
-- server-only repository uses service_role; browser roles receive no grants.
grant usage on schema public to service_role;
grant select on table
  public.indicators,
  public.observations,
  public.condition_sets,
  public.condition_groups,
  public.condition_rules,
  public.alerts
to service_role;

grant insert, update, delete on table
  public.condition_sets,
  public.condition_groups,
  public.condition_rules
to service_role;

comment on function public.save_condition_tree(uuid, text, text, boolean, jsonb, jsonb) is
  'Atomically replaces a condition set tree after application-layer validation.';

-- Shared player state only; never import GM notes here.
begin;
create table if not exists public.cards (
 id text primary key check(id in ('neko','human')),
 state jsonb not null check(jsonb_typeof(state)='object' and octet_length(state::text)<65536),
 revision integer not null default 1,
 updated_at timestamptz not null default now()
);
create table if not exists public.card_editors (
 email text not null check(email=lower(email)),
 card_id text not null references public.cards(id),
 primary key(email,card_id)
);
alter table public.cards enable row level security;
alter table public.card_editors enable row level security;
revoke all on public.cards,public.card_editors from anon,authenticated;
grant select on public.cards,public.card_editors to authenticated;
grant select on public.cards to anon;
create policy read_cards on public.cards for select to anon,authenticated using(true);
create policy read_own_access on public.card_editors for select to authenticated
 using(email=lower((select auth.jwt()->>'email')));
insert into public.cards(id,state) values
('neko', '{"id":"neko","gear":{"armorName":"Туника","armorHp":0,"weaponName":"Длинный лук из дуба","damage":"2–3","range":"16 клеток","bonuses":[0,0,0,0,0,0,0,0,0,0]},"revision":1,"hp":5,"coins":296,"items":[{"name":"Длинный лук из дуба","quantity":1},{"name":"Туника","quantity":1},{"name":"Стрелы","quantity":9}]}'::jsonb),
('human', '{"id":"human","gear":{"armorName":"Туника","armorHp":0,"weaponName":"Глефа из железа","damage":"1–3","range":"Ближний бой","bonuses":[0,0,0,0,0,0,0,0,0,0]},"revision":1,"hp":5,"coins":386,"items":[{"name":"Глефа из железа","quantity":1},{"name":"Туника","quantity":1},{"name":"Кинжалы","quantity":3}]}'::jsonb)
on conflict(id) do nothing;
create or replace function public.save_card(p_id text,p_revision integer,p_state jsonb)
returns setof public.cards language plpgsql security definer set search_path='' as $$
begin
 if not exists(
  select 1 from public.card_editors e join auth.users u on lower(u.email)=e.email
  where u.id=auth.uid() and u.email_confirmed_at is not null and e.card_id=p_id
 ) then raise exception 'Editing not allowed' using errcode='42501'; end if;
 if jsonb_typeof(p_state)<>'object' or octet_length(p_state::text)>65535
 or p_state->>'id' is distinct from p_id
 or jsonb_typeof(p_state->'items') is distinct from 'array'
 or jsonb_typeof(p_state->'gear') is distinct from 'object'
 or not coalesce((p_state->>'hp') ~ '^[0-9]+$',false)
 or not coalesce((p_state->>'coins') ~ '^[0-9]+$',false)
 or (p_state->>'hp')::numeric>100000 or (p_state->>'coins')::numeric>999999999
 then raise exception 'Invalid card state' using errcode='22023'; end if;
 return query update public.cards set state=p_state,revision=revision+1,updated_at=now()
 where id=p_id and revision=p_revision returning *;
 if not found then raise exception 'Card changed' using errcode='PT409'; end if;
end;
$$;
revoke all on function public.save_card(text,integer,jsonb) from public,anon;
grant execute on function public.save_card(text,integer,jsonb) to authenticated;
commit;

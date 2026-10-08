begin;
alter table public.card_editors add column if not exists can_manage_skills boolean not null default false;
alter table public.cards add column if not exists skills jsonb;
update public.cards set skills='[{"name":"Уклонение","level":2,"description":"Пассивный навык. Мастер учитывает уровень при попадании противника."}]'::jsonb where id='neko' and skills is null;
update public.cards set skills='[{"name":"Уклонение","level":2,"description":"Пассивный навык. Мастер учитывает уровень при попадании противника."},{"name":"Жестокость","level":2,"description":"Эффект определяет мастер."},{"name":"Медитация","level":2,"description":"Позволяет развивать навыки; успех и повышение определяет мастер."}]'::jsonb where id='human' and skills is null;
alter table public.cards alter column skills set default '[]'::jsonb;
alter table public.cards alter column skills set not null;
create or replace function public.save_card_skills(p_id text,p_revision integer,p_skills jsonb)
returns setof public.cards language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.card_editors e join auth.users u on lower(u.email)=e.email where u.id=auth.uid() and u.email_confirmed_at is not null and e.card_id=p_id and e.can_manage_skills) then raise exception 'Only GM can manage skills' using errcode='42501'; end if;
 if p_skills is null or jsonb_typeof(p_skills)<>'array' or octet_length(p_skills::text)>60000 then raise exception 'Invalid skills' using errcode='22023'; end if;
 if jsonb_array_length(p_skills)>100 then raise exception 'Too many skills' using errcode='22023'; end if;
 if exists(select 1 from jsonb_array_elements(p_skills) s where jsonb_typeof(s)<>'object' or jsonb_typeof(s->'name') is distinct from 'string' or length(trim(s->>'name')) not between 1 and 80 or jsonb_typeof(s->'description') is distinct from 'string' or length(s->>'description')>1000 or jsonb_typeof(s->'level') is distinct from 'number' or not coalesce((s->>'level') ~ '^[0-9]{1,3}$',false) or (s->>'level')::numeric<1) then raise exception 'Invalid skill fields' using errcode='22023'; end if;
 if (select count(*) from jsonb_array_elements(p_skills))<>(select count(distinct lower(trim(s->>'name'))) from jsonb_array_elements(p_skills) s) then raise exception 'Duplicate skills' using errcode='22023'; end if;
 return query update public.cards set skills=p_skills,revision=revision+1,updated_at=now() where id=p_id and revision=p_revision returning *;
 if not found then raise exception 'Card changed' using errcode='PT409'; end if;
end; $$;
revoke all on function public.save_card_skills(text,integer,jsonb) from public,anon;
grant execute on function public.save_card_skills(text,integer,jsonb) to authenticated;
commit;

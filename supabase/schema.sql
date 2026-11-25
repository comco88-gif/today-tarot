-- 오늘의 타로: Supabase SQL Editor에 통째로 붙여넣고 Run 한 번.
-- 여러 번 실행해도 안전하다.

-- 1) 타로 기록(일기). 한 사람이 자기 기록만 읽고 쓸 수 있다(RLS).
create table if not exists public.readings (
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  key        text not null,                 -- 예: 2026-11-25|today|one
  data       jsonb not null,                -- 카드·풀이·메모
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.readings enable row level security;

drop policy if exists "readings: read own"   on public.readings;
drop policy if exists "readings: insert own" on public.readings;
drop policy if exists "readings: update own" on public.readings;
drop policy if exists "readings: delete own" on public.readings;
create policy "readings: read own"   on public.readings for select using (auth.uid() = user_id);
create policy "readings: insert own" on public.readings for insert with check (auth.uid() = user_id);
create policy "readings: update own" on public.readings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "readings: delete own" on public.readings for delete using (auth.uid() = user_id);

-- 로그인한 사람에게 표 사용 권한을 준다(행은 위 RLS 규칙으로 본인 것만). 로그인 안 한 사람(anon)은 접근 불가.
revoke all on public.readings from anon;
grant select, insert, update, delete on public.readings to authenticated;

-- 2) AI 풀이 하루 사용 횟수(한국 날짜 기준). 표는 직접 못 읽고, 아래 함수로만 1씩 올린다.
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users on delete cascade,
  day     date not null,
  count   int  not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated; -- 표는 직접 못 건드리고 아래 함수로만

-- 로그인한 본인의 오늘 횟수를 1 올리고, 한도 안이면 true. 서버(api/reading.js)가 부른다.
create or replace function public.use_ai_quota(max_per_day int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  if auth.uid() is null then return false; end if;
  insert into public.ai_usage (user_id, day, count)
  values (auth.uid(), (now() at time zone 'Asia/Seoul')::date, 1)
  on conflict (user_id, day) do update set count = public.ai_usage.count + 1
  returning count into n;
  return n <= max_per_day;
end $$;

revoke all on function public.use_ai_quota(int) from public, anon;
grant execute on function public.use_ai_quota(int) to authenticated;

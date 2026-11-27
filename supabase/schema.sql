-- ============================================================
--  «Наши капсулы» — схема Supabase (PostgreSQL)
--  Запусти весь файл в Supabase Dashboard → SQL Editor → New query.
--  Скрипт идемпотентный: можно запускать повторно.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1. Таблицы
-- ------------------------------------------------------------

-- Настройки пары: ключ-значение (target_date, target_from, start_date и т.д.)
create table if not exists public.settings (
	key         text primary key,
	value       text not null,
	updated_at  timestamptz not null default now()
);

-- Дневник настроения (чек-ины)
create table if not exists public.mood_logs (
	id          uuid primary key default gen_random_uuid(),
	mood        text not null,
	note        text,
	created_at  timestamptz not null default now()
);

-- Каждое нажатие «Скучаю» — отдельная строка (считаем за день)
create table if not exists public.miss_clicks (
	id          uuid primary key default gen_random_uuid(),
	clicked_at  timestamptz not null default now()
);

-- Заметки и фразы поддержки: kind = 'note' | 'support'
create table if not exists public.notes (
	id          uuid primary key default gen_random_uuid(),
	kind        text not null default 'note',
	body        text not null,
	created_at  timestamptz not null default now()
);

-- Тематические капсулы «Открой, когда...»
create table if not exists public.capsules (
	id          uuid primary key default gen_random_uuid(),
	slug        text not null unique,          -- sad | missing | sleep | motivation | smile
	title       text not null,
	subtitle    text,
	body        text,
	audio_path  text,                          -- путь в бакете media, например 'audio/sad.m4a'
	sort_order  integer not null default 0
);

-- Капсула времени: письмо, которое открывается в назначенную дату
create table if not exists public.time_capsules (
	id          uuid primary key default gen_random_uuid(),
	title       text not null,
	body        text,
	audio_path  text,
	unlock_at   timestamptz not null,
	opened_at   timestamptz
);

-- Колода «100 причин, почему я тебя люблю»
create table if not exists public.reasons (
	id          uuid primary key default gen_random_uuid(),
	position    integer not null unique,
	text        text not null
);

-- Купонник: status = 'active' | 'used'
create table if not exists public.coupons (
	id          uuid primary key default gen_random_uuid(),
	title       text not null,
	subtitle    text,
	icon        text not null default '🎟️',
	status      text not null default 'active' check (status in ('active', 'used')),
	used_at     timestamptz,
	created_at  timestamptz not null default now()
);

-- Общий вишлист планов после возвращения
create table if not exists public.wishlist (
	id          uuid primary key default gen_random_uuid(),
	title       text not null,
	category    text not null default 'idea'
	            check (category in ('place', 'movie', 'food', 'activity', 'idea')),
	done        boolean not null default false,
	created_at  timestamptz not null default now(),
	done_at     timestamptz
);

-- Наши моменты (фотогалерея): файлы лежат в бакете media
create table if not exists public.photos (
	id           uuid primary key default gen_random_uuid(),
	storage_path text not null,
	caption      text,
	taken_at     date,
	created_at   timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2. RLS: данные видит и меняет только авторизованный пользователь
--    (у пары один общий аккаунт, поэтому «authenticated» = «мы»)
-- ------------------------------------------------------------

do $$
declare
	t text;
begin
	foreach t in array array[
		'settings', 'mood_logs', 'miss_clicks', 'notes', 'capsules',
		'time_capsules', 'reasons', 'coupons', 'wishlist', 'photos'
	] loop
		execute format('alter table public.%I enable row level security', t);
		execute format('drop policy if exists "pair_access" on public.%I', t);
		execute format(
			'create policy "pair_access" on public.%I for all to authenticated using (true) with check (true)',
			t
		);
	end loop;
end $$;

-- ------------------------------------------------------------
-- 3. Приватный Storage-бакет «media» (фото и аудио)
-- ------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
	'media',
	'media',
	false,
	26214400, -- 25 МБ
	array[
		'image/png', 'image/jpeg', 'image/webp', 'image/gif',
		'audio/mpeg', 'audio/mp4', 'audio/mp4a-latm', 'audio/x-m4a',
		'audio/wav', 'audio/ogg', 'audio/webm'
	]
)
on conflict (id) do nothing;

drop policy if exists "media read"   on storage.objects;
drop policy if exists "media insert" on storage.objects;
drop policy if exists "media update" on storage.objects;
drop policy if exists "media delete" on storage.objects;

create policy "media read"
	on storage.objects for select
	to authenticated
	using (bucket_id = 'media');

create policy "media insert"
	on storage.objects for insert
	to authenticated
	with check (bucket_id = 'media');

create policy "media update"
	on storage.objects for update
	to authenticated
	using (bucket_id = 'media')
	with check (bucket_id = 'media');

create policy "media delete"
	on storage.objects for delete
	to authenticated
	using (bucket_id = 'media');

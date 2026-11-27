-- Миграция для Части 2: избранное в колоде «100 причин».
-- Запусти в Supabase Dashboard → SQL Editor (после schema.sql/seed.sql).
alter table public.reasons
	add column if not exists favorite boolean not null default false;

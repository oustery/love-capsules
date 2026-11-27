-- ============================================================
--  SECURITY FIX — защита данных пары от посторонних аккаунтов
--  Запусти в Supabase Dashboard → SQL Editor → New query → Run.
--  Идемпотентный: можно запускать повторно.
--
--  Что делает:
--   1. Меняет политики RLS всех таблиц: доступ только у аккаунта
--      пары (auth.uid() = UUID ниже), а не у ЛЮБОГО authenticated.
--      Раньше любой зарегистрировавшийся посторонний мог читать
--      письма, настройки и фото — сейчас не может.
--   2. То же самое для бакета media (фото и аудио).
--   3. Забирает у роли anon все гранты на таблицы (она всё равно
--      не используется: до входа приложение ходит только в auth).
--
--  ⚠️ UUID ниже — аккаунт love@capsule.app. Если пересоздашь
--  аккаунт — поменяй UUID здесь и в schema.sql.
-- ============================================================

do $$
declare
	pair uuid := '8d8eec8a-0b88-4983-a62a-36e8b522ddc8';
	t text;
begin
	foreach t in array array[
		'settings', 'mood_logs', 'miss_clicks', 'notes', 'capsules',
		'time_capsules', 'reasons', 'coupons', 'wishlist', 'photos'
	] loop
		execute format('alter table public.%I enable row level security', t);
		execute format('drop policy if exists "pair_access" on public.%I', t);
		execute format(
			'create policy "pair_access" on public.%I for all to authenticated using (auth.uid() = %L) with check (auth.uid() = %L)',
			t, pair, pair
		);
	end loop;
end $$;

-- Storage: только аккаунт пары работает с бакетом media
drop policy if exists "media read"   on storage.objects;
drop policy if exists "media insert" on storage.objects;
drop policy if exists "media update" on storage.objects;
drop policy if exists "media delete" on storage.objects;

create policy "media read"
	on storage.objects for select
	to authenticated
	using (bucket_id = 'media' and auth.uid() = '8d8eec8a-0b88-4983-a62a-36e8b522ddc8');

create policy "media insert"
	on storage.objects for insert
	to authenticated
	with check (bucket_id = 'media' and auth.uid() = '8d8eec8a-0b88-4983-a62a-36e8b522ddc8');

create policy "media update"
	on storage.objects for update
	to authenticated
	using (bucket_id = 'media' and auth.uid() = '8d8eec8a-0b88-4983-a62a-36e8b522ddc8')
	with check (bucket_id = 'media' and auth.uid() = '8d8eec8a-0b88-4983-a62a-36e8b522ddc8');

create policy "media delete"
	on storage.objects for delete
	to authenticated
	using (bucket_id = 'media' and auth.uid() = '8d8eec8a-0b88-4983-a62a-36e8b522ddc8');

-- anon до входа ни к каким данным не должен иметь грантов вовсе
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

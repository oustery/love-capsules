-- Права на схему public для API-ролей.
-- Supabase выдаёт их автоматически при запуске SQL через Dashboard → SQL Editor,
-- но НЕ выдаёт при запуске через Management API — поэтому фиксим явно.
-- Скрипт идемпотентный.

grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;
grant all on all functions in schema public to anon, authenticated;

alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;

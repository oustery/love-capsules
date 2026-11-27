#!/usr/bin/env node
// Создаёт общий аккаунт Supabase Auth для пары.
//
// Пароль аккаунта детерминированно выводится из кодового слова —
// ровно так же, как это делает приложение в браузере,
// поэтому вход по слову «Любовь» совпадает с этим пользователем.
//
// Использование (в терминале, из папки проекта):
//   SUPABASE_URL=https://ТВОЙ-ПРОЕКТ.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=ТВОЙ-SERVICE-ROLE-КЛЮЧ \
//   node supabase/create-auth-user.mjs [кодовое_слово] [email]
//
// По умолчанию: слово «любовь», email love@capsule.app
// Ключи берутся из Supabase Dashboard → Project Settings → API.

import crypto from 'node:crypto';

const SALT = 'love-capsule::v1';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
	console.error('Задай переменные окружения SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY.');
	console.error('Пример: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node supabase/create-auth-user.mjs');
	process.exit(1);
}

const word = process.argv[2] ?? 'любовь';
const email = process.argv[3] ?? 'love@capsule.app';

// Нормализация — та же, что в src/lib/auth.svelte.ts
const normalized = word.trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');

const password = crypto.createHash('sha256').update(`${SALT}::${normalized}`).digest('hex');

const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
	method: 'POST',
	headers: {
		apikey: SERVICE_ROLE_KEY,
		Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
		'Content-Type': 'application/json'
	},
	body: JSON.stringify({ email, password, email_confirm: true })
});

const body = await res.json();

if (res.ok) {
	console.log(`✅ Пользователь создан: ${email}`);
	console.log(`   Кодовое слово для входа в приложение: «${word.trim()}»`);
} else {
	console.error(`❌ Ошибка ${res.status}:`, JSON.stringify(body, null, 2));
	console.error('Подсказка: если пользователь уже существует — удали его в Authentication → Users и запусти скрипт снова.');
	process.exit(1);
}

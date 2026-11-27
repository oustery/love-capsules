# Наши капсулы 💗

Уютное приватное PWA на двоих: таймеры до возвращения, дневник настроения,
баночка поддержки, капсулы «Открой, когда...», колода «100 причин», купонник и галерея.

**Стек:** SvelteKit (Svelte 5 runes) · TypeScript · Tailwind CSS 4 · Supabase (Auth + PostgreSQL + Storage/RLS) · Cloudflare Pages · PWA (`@vite-pwa/sveltekit`).

---

## 1. Supabase: настроить базу (10 минут)

1. Создай проект на [supabase.com](https://supabase.com).
2. **SQL Editor → New query** → вставь содержимое `supabase/schema.sql` → **Run**.
   (создаются все таблицы, RLS-политики и приватный бакет `media`)
3. **SQL Editor → New query** → вставь `supabase/seed.sql` → **Run**.
   (настройки, 18 фраз поддержки, 5 капсул, купоны, вишлист, 100 причин)
4. ⚠️ **Поменяй две даты** в таблице `settings`:
   - `target_date` — когда возвращаешься домой;
   - `start_date` — когда вы начали отношения.
5. Создай **общий аккаунт** для пары (вход в приложении — по кодовому слову):

```bash
SUPABASE_URL=https://ТВОЙ-ПРОЕКТ.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=ТВОЙ-SERVICE-ROLE-КЛЮЧ \
node supabase/create-auth-user.mjs
```

   По умолчанию: слово «любовь», email `love@capsule.app` (можно указать свои аргументы:
   `node supabase/create-auth-user.mjs любовь us@love.app`).

## 2. Локальный запуск

```bash
cp .env.example .env   # вставь Project URL и anon key из Supabase → Settings → API
npm install
npm run dev
```

## 3. Деплой на Cloudflare Pages

1. Запушь репозиторий на GitHub и подключи в **Cloudflare Pages**.
2. Настройки сборки:
   - Build command: `npm run build`
   - Build output: `.svelte-kit/cloudflare` (adapter-cloudflare укажет сам)
3. **Variables and Secrets** (до сборки — они нужны на этапе build):
   - `PUBLIC_SUPABASE_URL`
   - `PUBLIC_SUPABASE_ANON_KEY`
   - `PUBLIC_AUTH_EMAIL=love@capsule.app`

## 4. Как установить на телефон

Открой сайт в Safari/Chrome → «Добавить на экран “Домой”».
Приложение запустится без рамки браузера, будет работать офлайн (service worker кэширует
оболочку и медиа) и покажет иконку с сердечком.

## 5. Что лежит в базе

| Таблица | Что хранит |
| --- | --- |
| `settings` | ключ-значение: `target_date`, `target_from`, `start_date` |
| `mood_logs` | чек-ины настроения (мood + заметка) |
| `miss_clicks` | строка на каждое нажатие «Скучаю» |
| `notes` | `kind='support'` — фразы баночки; `kind='note'` — свободные заметки |
| `capsules` | капсулы «Открой, когда...» (slug: sad/missing/sleep/motivation/smile) |
| `time_capsules` | письма в будущее с `unlock_at` |
| `reasons` | колода «100 причин» (position + text) |
| `coupons` | купонник (`status: active/used`) |
| `wishlist` | общий список планов (`done`) |
| `photos` | метаданные фотогалереи (файлы в бакете `media`) |

Бакет `media` приватный: фото — в `photos/`, голосовые — в `audio/` (например
`audio/sad.m4a`, путь записать в `capsules.audio_path`). Доступ — только
авторизованному пользователю (RLS-политики на `storage.objects`).

## 6. Как работает вход по слову

Кодовое слово нормализуется (без регистра, пробелов и «ё»), из него SHA-256 выводится
пароль общего аккаунта (`src/lib/keyword.ts` — та же формула, что в
`supabase/create-auth-user.mjs`). Приложение делает `signInWithPassword` в Supabase Auth:
верное слово → сессия + доступ через RLS, неверное → тряска замка. Поменять слово =
создать пользователя с новым словом скриптом из шага 1.4.

## Структура

```
src/
├─ app.css                  # дизайн-токены: палитра, тени, шрифты, keyframes
├─ app.html                 # шапка PWA + шрифты Nunito/Caveat
├─ lib/
│  ├─ supabase.ts           # клиент Supabase
│  ├─ auth.svelte.ts        # состояние входа (runes)
│  ├─ keyword.ts            # нормализация слова + вывод пароля
│  ├─ jar.svelte.ts         # баночка поддержки (общее состояние)
│  ├─ toast.svelte.ts       # всплывающие подсказки
│  ├─ storage.ts            # подписанные ссылки + загрузка в бакет media
│  ├─ image.ts              # сжатие фото до 1400px → WebP через canvas
│  ├─ recorder.svelte.ts    # диктофон на MediaRecorder
│  ├─ config.ts             # настроения, слаги капсул, категории вишлиста
│  ├─ format.ts             # русские плюрализмы и даты
│  ├─ haptics.ts            # вибрация
│  └─ components/
│     ├─ HeartLock.svelte   # SVG-замок с анимацией открытия
│     ├─ PetalRain.svelte   # лепестки/сердечки «Скучаю»
│     ├─ CountdownCard.svelte       # таймер до возвращения + прогресс
│     ├─ TogetherCounter.svelte     # «мы вместе уже»
│     ├─ MoodDiary.svelte           # дневник настроения
│     ├─ SupportJar.svelte          # баночка поддержки
│     ├─ AudioPlayer.svelte         # тактильный плеер: play/pause, перемотка, 1x/1.25x/1.5x
│     ├─ Modal.svelte               # нижний лист-модалка
│     ├─ BottomNav.svelte           # стеклянная нижняя навигация
│     └─ Toasts.svelte
└─ routes/
   ├─ +layout.ts            # SPA-режим (ssr=false)
   ├─ +layout.svelte        # PWA-регистрация + страж входа
   ├─ login/+page.svelte    # экран замка «Любовь»
   ├─ +page.svelte          # Главный экран
   ├─ capsules/+page.svelte # «Открой, когда...» + капсула времени с отсчётом
   ├─ reasons/+page.svelte  # свайп-колода «100 причин» + избранное
   ├─ coupons/+page.svelte  # купонник-билетики с надрывом + вишлист
   ├─ moments/+page.svelte  # полароиды + лайтбокс
   └─ admin/+page.svelte    # мобильная админ-панель
```

## Часть 2: экраны

| Маршрут | Что внутри |
| --- | --- |
| `/capsules` | карточки «Открой, когда...» с письмом и аудиоплеером в модалке; капсула времени: замочек, живой обратный отсчёт до `unlock_at`, после даты — открытие письма (с пометкой `opened_at`) |
| `/reasons` | свайп-колода: pointer-события + `spring` (наклон при перетаскивании), кнопки «Предыдущая / Случайная / Следующая», сердечко «В избранное» (колонка `favorite`) |
| `/coupons` | билетики с пунктирной перфорацией и полукруглыми вырезами, диалог подтверждения, анимация «надрыва» + штамп «Использован», статус в `coupons`; общий вишлист с добавлением пунктов и отметкой выполненных |
| `/moments` | сетка полароидов (подпись, дата, ленивая загрузка), фото по `createSignedUrl`, полноэкранный лайтбокс |
| `/admin` | даты возвращения/начала отношений + статистика («скучаю» сегодня, последние чек-ины, погашенные купоны); диктофон (MediaRecorder, таймер, прослушивание, публикация в капсулу или капсулу времени); загрузка фото с автосжатием до 1400px/WebP 0.82; быстрые формы: фразы в баночку, причины списком, новый купон |

## Миграция для Части 2

```bash
# В Supabase SQL Editor выполни:
supabase/migration_favorites.sql   # колонка favorite для reasons
```

## Демо без Supabase (локальный mock)

В репозитории есть `scripts/supabase_mock.mjs` — сервер, изображающий Supabase
(REST + Auth + Storage) с демо-данными. Удобно посмотреть приложение без настройки базы:

```bash
node scripts/supabase_mock.mjs    # поднимет http://127.0.0.1:8788
# затем в .env: PUBLIC_SUPABASE_URL=http://127.0.0.1:8788
npm run build && npm run preview
# кодовое слово для входа в демо — любое (mock принимает всё)
```

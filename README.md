# Для тебя 💗

**Два адреса приложения** (вход по кодовому слову — «любовь», админка — по паролю из settings `admin_password_hash`):

- https://love-capsules.pages.dev — Cloudflare Pages. Из России часто не открывается
  (`ERR_CERT_AUTHORITY_INVALID`): домен `pages.dev` блокируется операторами на уровне TLS —
  сам сайт жив, обойти можно только VPN.
- https://oustery.github.io/love-capsules/ — GitHub Pages, открывается из России.
  Включается один раз: **Settings → Pages → Source: Deploy from a branch → `gh-pages` / `(root)`**.
  Обновление: `bash scripts/deploy-gh.sh`.

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
   Если запускаешь SQL не в дашборде, а через API или psql — выполни ещё и
   `supabase/grant.sql` (дашборд выдаёт права ролям `anon`/`authenticated` автоматически,
   API — нет).
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
cp .env.example .env   # останется вписать только Project URL из Supabase → Settings → API
npm install
npm run dev
```

Про ключи Supabase (новый формат):

- `sb_publishable_...` — открытый ключ для клиента, вставляется в `PUBLIC_SUPABASE_ANON_KEY`
  (он попадает в бандл — так и задумано; в `.env.example` он уже вписан);
- `sb_secret_...` — серверный ключ, приложению не нужен. Понадобится только один раз:
  при создании пользователя скриптом `scripts/create_user.mjs` (значение для `SUPABASE_SERVICE_ROLE_KEY`).
  Нигде не коммить и не публиковать.
- Не хватает только адреса проекта — `PUBLIC_SUPABASE_URL=https://xxxx.supabase.co`.

## 3. Деплой на Cloudflare Pages

Вариант А — одной командой, если есть API-токен с правом **Cloudflare Pages: Edit**:

```bash
CLOUDFLARE_API_TOKEN=<токен> bash scripts/deploy.sh
```

Вариант Б — через дашборд:

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

## 6а. Безопасность (прочитай обязательно)

**Что уже защищено в проекте:**

- приватный бакет `media` (фото/аудио не отдаются без входа), лимит 25 МБ и белый список MIME;
- вход по кодовому слову, пароль аккаунта не хранится в коде (выводится SHA-256 из слова);
- админка под паролем (в БД лежит только SHA-256 хеш, `settings.admin_password_hash`);
- CSP и защитные заголовки для Cloudflare (`static/_headers`), `noindex` от поисковиков.
  Нюанс: инлайн-`<script>` в CSP разрешён (`'unsafe-inline'`) — без него не стартует
  гидрация SvelteKit. Инъекционных векторов в коде нет ({@html}/eval не используются,
  весь пользовательский текст Svelte экранирует), а ограничения `connect-src`/`img-src`/
  `media-src`/`object-src` работают и мешают утечке данных на чужие домены.
- в репозитории и бандле нет секретов: только публичный `sb_publishable_`-ключ.

**⚠️ Что нужно сделать руками один раз (5 минут) в Supabase Dashboard:**

1. **SQL Editor → New query** → вставь `supabase/security-fix.sql` → **Run**.
   Раньше политики RLS пускали **любого** зарегистрированного пользователя ко всем данным
   (`using (true)`), а регистрация в проекте открыта: посторонний мог создать аккаунт,
   подтвердить почту и читать письма/фото/настройки. Скрипт ограничивает доступ только
   аккаунтом пары (`auth.uid() = UUID`) — для всех остальных RLS закрыт.
2. **Authentication → Sign In / Providers** → выключи **«Allow new users to sign up»**.
   (ваш аккаунт уже создан — регистрация больше не нужна; новым пользователям вход станет
   невозможен, что и требуется)
3. **Authentication → Users** → удали пробный аккаунт `security.audit.probe.2026@gmail.com`
   (он создан при проверке безопасности и доступов не имеет).

GitHub Pages не умеет отдавать HTTP-заголовки — CSP работает только на Cloudflare.
Само содержимое и там защищено RLS (данные ходят через Supabase, а не через хостинг).

**Рекомендации:**

- Кодовое слово «любовь» — словарное. Сменить: создай пользователя с новым словом скриптом
  из шага 1 (`node supabase/create-auth-user.mjs НОВОЕ-СЛОВО us@love.app`) и обнови UUID в
  `schema.sql`/`security-fix.sql`, если аккаунт пересоздаёшь под другим email.
- Подписанные ссылки на фото живут 1 час (`createSignedUrl` в `src/lib/storage.ts`) —
  случайно переданный линк устаревает сам.
- Если деплой-токены (GitHub/Cloudflare) когда-нибудь попадут в чужие руки — отзови и
  перевыпусти их в настройках соответствующего сервиса.

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
| `/coupons` | билетики с пунктирной перфорацией и полукруглыми вырезами, диалог подтверждения, анимация «надрыва» + штамп «Использован», статус в `coupons`; **новый купон может напечатать каждый из нас прямо со страницы** (эмодзи + название + условия); режим управления (✏️): выбросить купон, вернуть погашенный в строй (↺), убрать пункт из планов; общий вишлист с добавлением пунктов и отметкой выполненных |
| `/moments` | сетка полароидов (подпись, дата, ленивая загрузка), фото по `createSignedUrl`, полноэкранный лайтбокс |
| `/admin` | даты возвращения/начала отношений + статистика 2×2 («скучаю» сегодня/всего, погашенные купоны, капсулы времени); **капсулы времени**: список запланированных (дата, 🎧/📜, «уже открыта») с удалением; **купонник**: полный список, ↺ вернуть погашенный, ✕ удалить; **фразы баночки** и **причины колоды**: списки с удалением; диктофон (MediaRecorder, таймер, прослушивание, публикация в капсулу или капсулу времени); загрузка фото с автосжатием до 1400px/WebP 0.82 + **список загруженных фото с удалением**; **смена пароля админки** (старый → новый, хеш в `settings.admin_password_hash`) |

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

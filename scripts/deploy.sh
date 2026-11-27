#!/usr/bin/env bash
# Сборка и деплой «Наших капсул» на Cloudflare Pages.
#
# Использование:
#   CLOUDFLARE_API_TOKEN=<токен с правом Cloudflare Pages: Edit> \
#   CLOUDFLARE_ACCOUNT_ID=<account id из правого сайдбара дашборда> \
#   bash scripts/deploy.sh
#
# Если CLOUDFLARE_ACCOUNT_ID не задан, скрипт попробует получить его сам по токену.

set -euo pipefail

: "${CLOUDFLARE_API_TOKEN:?Задай CLOUDFLARE_API_TOKEN=<токен Cloudflare с правом Pages:Edit>}"

if [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
	echo "Ищу Account ID по токену…"
	ACC=$(curl -s -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
		https://api.cloudflare.com/client/v4/accounts \
		| grep -o '"id":"[a-f0-9]*"' | head -1 | cut -d'"' -f4)
	if [ -z "$ACC" ]; then
		echo "Не удалось получить Account ID — задай CLOUDFLARE_ACCOUNT_ID вручную." >&2
		exit 1
	fi
	export CLOUDFLARE_ACCOUNT_ID="$ACC"
	echo "Account ID: ${CLOUDFLARE_ACCOUNT_ID}"
fi

# Создаём проект, если его ещё нет (повторный запуск пропустит)
npx wrangler pages project create love-capsules --production-branch=main 2>/dev/null \
	|| echo "Проект love-capsules уже существует — ок"

# Переменные окружения сборки (URL Supabase возьмётся из .env)
npm run build

echo "Деплою…"
npx wrangler pages deploy .svelte-kit/cloudflare --project-name=love-capsules --branch=main

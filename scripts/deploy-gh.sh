#!/usr/bin/env bash
# Сборка и публикация «Наших капсул» на GitHub Pages (ветка gh-pages).
# Адрес: https://oustery.github.io/love-capsules/
#
# Использование (из корня проекта или откуда угодно):
#   bash scripts/deploy-gh.sh
#
# Требуется, чтобы в GitHub репозитории (Settings → Pages) источником
# была выбрана ветка gh-pages.

set -euo pipefail

# Работаем из корня проекта, откуда бы ни запускали скрипт
cd "$(dirname "$0")/.."

# SPA-сборка для подпапки /love-capsules/
BASE_PATH=/love-capsules ADAPTER=static npm run build

# GitHub Pages: корень открываем через копию SPA-фолбэка, Jekyll выключаем
cp build/404.html build/index.html
touch build/.nojekyll

# Публикуем ветку gh-pages (используется remote origin)
npx -y gh-pages -d build --dotfiles -m "Деплой на GitHub Pages: $(date -u +%Y-%m-%dT%H:%MZ)"

echo "Готово. Сайт: https://oustery.github.io/love-capsules/ (первые сборки появляются через 1–2 минуты)"

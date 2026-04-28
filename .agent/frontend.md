# Sabor-App — фронтенд (что важно знать)

## Источники меню в dev
`frontend/src/services/api.js` поддерживает режимы (через `.env` или `localStorage`):
- `REACT_APP_MENU_DB_SOURCE=auto` (по умолчанию): API → static JSON → localStorage
- `REACT_APP_MENU_DB_SOURCE=static`: всегда брать `/data/menu-*.json`
- `REACT_APP_MENU_DB_SOURCE=backend-json`: всегда брать `/api/menu-json` (бэкенд читает split‑JSON напрямую, без SQLite)

## Прокси в dev
`frontend/package.json`: `"proxy": "http://127.0.0.1:5000"`

## Тренажёр / загрузка данных
`frontend/src/utils/menuDataLoader.js`:
- подтягивает `menu-config.json` и фильтрует элементы по разрешённым `menu` для выбранной группы
- исключает элементы со статусом `в архиве` / `неактивно`
- для режима `english` берёт элементы с заполненным `i18n.en['title-en']` и исключает некоторые меню


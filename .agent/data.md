# Sabor-App — данные и схемы JSON

## Базы данных (SQLite)
- Локальная dev‑копия: `backend/database.dev.db` (скачивается с прода скриптом `tools/sync_prod_db.ps1`)
- Локальная “обычная”: `backend/database.db` (может существовать, но обычно не нужна)
- Прод: `/var/lib/sabor-app/database.db`

Миграция/синхронизация данных (JSON → SQLite):
- Скрипт: `backend/migrate_to_db.py` (`--yes` для неинтерактивного режима)
- В миграции есть дедупликация по `id` (оставляется последняя запись)

## JSON в `data/` — Source of Truth

Почти всё “контентное” (меню/подсказки/тренажёр) хранится в JSON в корне репозитория `data/`. Эти файлы на деплое копируются в `frontend/public/data/` и раздаются как статика.

### Общие правила
- `id` должен быть **уникальным** в пределах соответствующего набора данных (иначе миграция в SQLite сломается).
- `status` влияет на отображение в тренажёре: `в архиве` и `неактивно` отфильтровываются.
- `image.src` должен указывать на существующий файл в `images/` (на деплое → `frontend/public/images/`).
- В полях `contains`, `reference_info`, `description[]` встречается HTML — важно не ломать разметку.

### `data/menu-kitchen.json` (кухня/еда) — `Array<FoodItem>`
Обязательное ядро:
- `id: string`, `object_type: "food"`, `status: string`, `menu: string`, `section: string`
- `title: string`, `description: string`
- `tags: string[]`, `allergens: string[]`, `ingredients: string[]`
- `image: { src: string, alt: string }`
- `reference_info: string`
- `pairings: { wines: string[], drinks: string[], dishes: string[], notes?: string[] }`
- `i18n: { en: KitchenI18nEn }`

Часто дополнительно:
- `contains?: string` (часто HTML)
- `features?: string`
- `comments?: string[]`

`KitchenI18nEn` (ключи строковые, с дефисами):
- `menu-en`, `section-en`, `title-en`, `description-en`, `contains-en`, `allergens-en`, `tags-en`, `audio-en`, `comments-en`
- `useful phrases & words: string[]` (часто есть)

### `data/menu-wine.json` (вино) — `Array<WineItem>`
- `id: string`, `object_type: "wine"`, `status: string`, `menu: "Вино"`, `section: string`, `category: string`
- `title: string`, `description: string`, `features: string`
- `origin: string`, `region: string`, `producer: string`
- `grapeVarieties: string[]`
- `tags: string[]`, `sweetness: string`, `alcoholContent: string|null`
- `comments: string[]`
- `pairings: { dishes: string[], notes: string[], drinks?: string[], wines?: string[] }`
- `reference_info: string`
- `image: { src: string, alt: string }` (в данных встречается `src: "null"` строкой)
- `i18n: { en: WineI18nEn }`

### `data/menu-bar.json` (бар) — `Array<BarItem>`
Ядро:
- `id: string`, `object_type: "bar"`, `status: string`, `menu: "Барное меню"`, `section: string`
- `title: string`, `description: string`, `tags: string[]`
- `image: { src, alt }`
- `reference_info: string`

Часто/иногда:
- `contains?: string`, `cardIngredients?: string`, `ingredients?: string[]`
- `allergens?: string[] | string`
- `sweetness?: string`, `comments?: string[]`
- `origin?: string`, `producer?: string`
- `features?: string`, `alcoholContent?: string`, `category?: string`, `colour?: string`
- `pairings?: { dishes: string[], notes: string[] }`
- `i18n?: { en: BarI18nEn }` (встречается редко)

### `data/menu-tea.json` (чай) — `Array<TeaItem>`
- `id: string`, `object_type: "tea"`, `status: string`, `menu: "Чай"`, `section: string`
- `title: string`, `description: string`, `origin: string`, `features: string`
- `tags: string[]`, `caffeine: string`, `allergens: string | string[]`
- `brewing: { temperature_c: number, time_minutes: string }`
- `image: { src, alt }`
- `i18n: { en: TeaI18nEn }`
- `comments: string[]`, `reference_info: string`

### `data/artworks.json` — `Array<Artwork>`
- `id: string`, `object_type: "art"`, `source: string`
- `title/author/origin/artMovement/location: string`
- `year: number|null`
- `tags: string[]`
- `description/features/brandRelevance: string`
- `comments: string|null`
- `image: { src: string, alt: string }`

### `data/menu-config.json` — `Record<string, MenuConfigGroup>`
Ключи верхнего уровня: `kitchen`, `breakfast`, `kids`, `fest`, `season`, `bar`, `wine`, `tea`, `general`.

`MenuConfigGroup`:
- `items: string[]` (какие значения `menu` разрешены в группе)
- `description?: string`, `icon?: string`
- `image?: string`
- `images?: Record<string,string>` (обложка по названию меню)

Использование: `frontend/src/utils/menuDataLoader.js`, `frontend/src/pages/HomePage.js`, `frontend/src/components/GlobalSearch.js`.

### `data/questions-general.json` — `Array<GeneralQuestion>`
- `id: string`, `menu: "Сервис и знания"`, `section: string`, `title: string`
- `description: string[]` (часто HTML‑строки)
- `hint: string`, `status: string`
- `imageFront/audioFront/imageBack/audioBack: string` (часто пустые строки)

### `data/wine-comparison.json` — `Array<WineComparisonGroup>`
`WineComparisonGroup`:
- `id: string`, `group: string`, `icon: string`
- `sections: string[]` (какие `section` из `menu-wine.json` входят)
- `wines: Array<{ id, title, style, comment, pairing_profile? }>`

Использование: `frontend/src/pages/WineDetailPage.js`.

### `data/tea-comparison.json` — `Array<TeaComparisonGroup>`
- `id`, `group`, `icon`, `caffeine`, `general_features`, `recommendation`
- `image?`
- `sections: string[]` (какие секции из `menu-tea.json` относятся к типу)

Использование: `frontend/src/pages/DishDetailPage.js`.

### `data/extras-breakfast.json` — `{ categories: ExtrasCategory[] }`
`ExtrasCategory`:
- `object_type: "extras"`, `name: string`, `icon: string`
- `items: Array<{ name: string, weight: string }>`

### `data/tools-registry.json` и `data/manifest.json`
- `data/tools-registry.json` сейчас пустой массив (`[]`).
- `data/manifest.json` сейчас пустой файл (0 байт). Если начнёт использоваться — добавьте сюда схему и места использования.


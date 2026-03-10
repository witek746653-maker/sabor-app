# Изменения в wine-comparison.json

## Что было сделано

### 1. Удалены поля

**`comparison_label`** — удалено с уровня каждой группы вин.
Было: `"comparison_label": "К насыщенным и жирным блюдам"`
Стало: поле отсутствует

**`label`** — удалено с уровня каждого вина.
Было: `"label": "✅ Да"` / `"label": "⚠️ Условно"` / `"label": "❌ Нет"`
Стало: поле отсутствует, значение вычисляется на фронтенде из `pairing_profile`

---

### 2. Добавлено новое поле `pairing_profile` к каждому вину

Структура поля:

```json
"pairing_profile": {
  "acidity": "low" | "medium" | "high",
  "body": "light" | "medium" | "full",
  "tannins": "none" | "soft" | "firm" | "grippy",
  "labels": {
    "fat": "строка или null",
    "rich_sauce": "строка или null",
    "fatty_meat": "строка или null"
  }
}
```

**Описание параметров:**

| Параметр | Что означает |
|---|---|
| `acidity` | Насколько кислотность вина режет жирность продукта |
| `body` | Насколько вино выдержит насыщенный/сливочный соус |
| `tannins` | Способность красного вина работать с жирным мясом. Для белых всегда `"none"` |
| `labels.fat` | Подходит ли к жирному продукту (рыба, мясо) без соуса |
| `labels.rich_sauce` | Подходит ли к насыщенному/сливочному соусу |
| `labels.fatty_meat` | Только для красных — подходит ли к жирному мясу за счёт танинов |

**Правила заполнения:**
- Для белых и игристых вин: `tannins` всегда `"none"`, `fatty_meat` всегда `null`
- Для красных вин: `fat` обычно `null`
- Строки в `labels` начинаются с эмодзи: `✅` (подходит), `⚠️` (условно), `❌` (не подходит)

**Пример для белого вина:**
```json
"pairing_profile": {
  "acidity": "high",
  "body": "light",
  "tannins": "none",
  "labels": {
    "fat": "✅ Жирная рыба без соуса",
    "rich_sauce": "❌ Сливочный соус перебьёт",
    "fatty_meat": null
  }
}
```

**Пример для красного вина:**
```json
"pairing_profile": {
  "acidity": "medium",
  "body": "full",
  "tannins": "firm",
  "labels": {
    "fat": null,
    "rich_sauce": "✅ Насыщенные соусы ок",
    "fatty_meat": "✅ Стейк, баранина, дичь"
  }
}
```

---

## Как вычислять label на фронтенде

`label` больше не хранится в JSON. Вычисляется динамически из `pairing_profile.labels`.

**JavaScript:**
```javascript
function computeLabel(pairing_profile) {
  const labels = Object.values(pairing_profile.labels).filter(v => v !== null)
  if (labels.some(l => l.startsWith('✅'))) return '✅ Да'
  if (labels.every(l => l.startsWith('❌'))) return '❌ Нет'
  return '⚠️ Условно'
}
```

**Логика:**
- Есть хотя бы одно `✅` → `"✅ Да"`
- Все значения `❌` → `"❌ Нет"`
- Всё остальное → `"⚠️ Условно"`

---

## Как вычислять comparison_label на фронтенде

`comparison_label` больше не хранится в JSON. Заменить на фиксированный заголовок или вычислять из группы:

**Вариант 1 — фиксированный заголовок для всех групп:**
```javascript
const comparison_label = "Подбор к блюду"
```

**Вариант 2 — показывать три параметра вместо одного заголовка:**
```javascript
// Рендерить pairing_profile.labels как список тегов под вином
// вместо одного поля ДА/НЕТ
```

---

## Итоговая структура объекта вина

```json
{
  "id": "0604",
  "title": "«Le Clou Chablis», Domaine Passy",
  "style": "Сухое, минеральное, кислотное",
  "comment": "...",
  "pairing_profile": {
    "acidity": "high",
    "body": "light",
    "tannins": "none",
    "labels": {
      "fat": "✅ Жирная рыба, устрицы",
      "rich_sauce": "❌ Сливочный соус перебьёт",
      "fatty_meat": null
    }
  }
}
```

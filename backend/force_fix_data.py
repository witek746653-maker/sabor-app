
import json
import sqlite3

# Карта ID -> Имя файла
fixing_map = {
    "0418": "postnoe-menyu-hummus.jpg",
    "0419": "postnoe-menyu-tsvetnaya-kapusta-s-sousom-chimichuri.jpg",
    "0421": "postnoe-menyu-barhatnyj-sup-iz-seldereya-s-gribami.jpg",
    "0423": "postnoe-menyu-grechnevaya-kasha-po-receptu-babushki.jpg"
}

# 1. Исправляем JSON
json_path = 'd:/GitHub/sabor-app/data/menu-kitchen.json'
with open(json_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

for item in data:
    if item.get('id') in fixing_map:
        item['image'] = {
            "src": f"../images/{fixing_map[item['id']]}",
            "alt": item.get('title', '')
        }

with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

# 2. Исправляем БД
db_path = 'd:/GitHub/sabor-app/backend/database.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

for item_id, filename in fixing_map.items():
    img_json = json.dumps({"src": f"../images/{filename}", "alt": ""}, ensure_ascii=False)
    cursor.execute("UPDATE kitchen_items SET image = ? WHERE id = ?", (img_json, item_id))

conn.commit()
conn.close()

print("✅ Данные в JSON и БД исправлены для 4-х блюд.")


import json
from collections import Counter

with open('d:/GitHub/sabor-app/data/menu-kitchen.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

ids = [item.get('id') for item in data if item.get('id')]
counts = Counter(ids)
duplicates = {k: v for k, v in counts.items() if v > 1}

for id_val, count in duplicates.items():
    print(f"ID {id_val} occurs {count} times")
    # Выведем названия и пути картинок для этого ID
    for item in data:
        if item.get('id') == id_val:
            print(f"  Menu: {item.get('menu')}, Title: {item.get('title')}, Image: {item.get('image', {}).get('src')}")

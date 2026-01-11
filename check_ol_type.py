import json
import re

with open('data/menu-database.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

ol_without_type = 0
ol_with_type = 0
total_ol = 0

for item in data:
    if 'contains' in item and item['contains']:
        contains = item['contains']
        # Проверяем, есть ли теги <ol>
        if '<ol' in contains:
            total_ol += contains.count('<ol')
            # Проверяем, есть ли <ol> без type
            if '<ol>' in contains or re.search(r'<ol\s+>', contains):
                ol_without_type += 1
            # Проверяем, есть ли <ol type="1">
            if 'type="1"' in contains or "type='1'" in contains:
                ol_with_type += contains.count('type="1"') + contains.count("type='1'")

print(f'Всего тегов <ol>: {total_ol}')
print(f'<ol> без type: {ol_without_type}')
print(f'<ol type="1"> найдено: {ol_with_type}')

if ol_without_type == 0 and ol_with_type > 0:
    print('\n✓ Отлично! Все нумерованные списки имеют type="1"')
elif ol_without_type > 0:
    print(f'\n⚠ Найдено {ol_without_type} списков без type="1"')

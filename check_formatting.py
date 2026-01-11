import json

with open('data/menu-database.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Находим элемент с "Черную булочку"
for item in data:
    if 'contains' in item and 'Черную булочку' in item['contains']:
        print("Найден элемент:", item.get('title', 'N/A'))
        print("\nСодержит \\n:", '\n' in item['contains'])
        print("\nДлина строки:", len(item['contains']))
        print("\nПервые 500 символов с заменой \\n на [NEWLINE]:")
        print(item['contains'][:500].replace('\n', ' [NEWLINE] '))
        print("\n\nПервые 500 символов как есть (с \\n):")
        print(repr(item['contains'][:500]))
        break

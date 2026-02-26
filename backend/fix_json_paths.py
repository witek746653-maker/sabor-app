
import json
import os

files = [
    'd:/GitHub/sabor-app/data/menu-kitchen.json',
    'd:/GitHub/sabor-app/frontend/public/data/menu-kitchen.json'
]

mapping = {
    "hummus.jpg": "postnoe-menyu-hummus.jpg",
    "tsvetnaya-kapusta-s-sousom-chimichuri.jpg": "postnoe-menyu-tsvetnaya-kapusta-s-sousom-chimichuri.jpg",
    "zapechenyj-baklazhan-v-aziatskom-souse.jpg": "postnoe-menyu-zapechenyj-baklazhan-v-aziatskom-souse.jpg",
    "barhatnyj-sup-iz-seldereya-s-gribami.jpg": "postnoe-menyu-barhatnyj-sup-iz-seldereya-s-gribami.jpg",
    "arrabbiata.jpg": "postnoe-menyu-arrabbiata.jpg",
    "grechnevaya-kasha-po-receptu-babushki.jpg": "postnoe-menyu-grechnevaya-kasha-po-receptu-babushki.jpg",
    "draniki-iz-kinoa-s-mussom-tofu.jpg": "postnoe-menyu-draniki-iz-kinoa-s-mussom-tofu.jpg",
    "morkovnyj-pirog-s-vishnevym-sousom.jpg": "postnoe-menyu-morkovnyj-pirog-s-vishnevym-sousom.jpg"
}

for file_path in files:
    if not os.path.exists(file_path): continue
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    changed = False
    for item in data:
        if item.get('menu') == 'Постное меню':
            img = item.get('image', {})
            if isinstance(img, dict) and 'src' in img:
                src = img['src']
                for old, new in mapping.items():
                    if old in src and new not in src:
                        img['src'] = src.replace(old, new)
                        changed = True
    
    if changed:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"Fixed paths in {file_path}")
    else:
        print(f"No changes needed in {file_path}")

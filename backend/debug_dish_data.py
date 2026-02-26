
from backend.app import app
from backend.services.menu_service import MenuService
import json

with app.app_context():
    items = MenuService.get_all_dishes_dicts_with_json_fallback()
    # Ищем Хумус (0418)
    hummus = next((it for it in items if it.get('id') == '0418'), None)
    if hummus:
        print(f"Blyudo: {hummus.get('title')}")
        print(f"Data: {json.dumps(hummus, indent=2, ensure_ascii=False)}")
    else:
        print("Huumus not found")

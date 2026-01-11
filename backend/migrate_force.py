"""
Принудительная миграция данных из JSON в SQLite базу данных.
Удаляет старые данные и загружает заново.
"""

import json
from pathlib import Path
from app import app
from models import db, Dish

# Путь к файлу с данными
ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_PATH = ROOT_DIR / "data" / "menu-database.json"
JSON_BACKUP_PATH = ROOT_DIR / "frontend" / "public" / "data" / "menu-database.json"

def migrate_force():
    """Принудительная миграция - удаляет старые данные и загружает заново"""
    
    print("Начинаем ПРИНУДИТЕЛЬНУЮ миграцию данных из JSON в SQLite...")
    
    # Находим файл с данными
    json_file = None
    if DATA_PATH.exists():
        json_file = DATA_PATH
        print(f"[OK] Найден файл: {DATA_PATH}")
    elif JSON_BACKUP_PATH.exists():
        json_file = JSON_BACKUP_PATH
        print(f"[OK] Найден файл: {JSON_BACKUP_PATH}")
    else:
        print(f"[ERROR] Файл menu-database.json не найден!")
        print(f"   Искали в: {DATA_PATH}")
        print(f"   Искали в: {JSON_BACKUP_PATH}")
        return
    
    # Создаём контекст приложения Flask (нужен для работы с базой данных)
    with app.app_context():
        # Создаём все таблицы в базе данных
        print("\n[INFO] Создаём структуру базы данных...")
        db.create_all()
        print("[OK] Таблицы созданы!")
        
        # УДАЛЯЕМ все старые данные
        print("\n[INFO] Удаляем все старые данные из базы...")
        Dish.query.delete()
        db.session.commit()
        print("[OK] Старые данные удалены!")
        
        # Читаем данные из JSON
        print(f"\n[INFO] Читаем данные из {json_file}...")
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                dishes_data = json.load(f)
            print(f"[OK] Прочитано {len(dishes_data)} блюд")
            
            # Проверяем, сколько блюд с Вино и Барное меню
            wines = [d for d in dishes_data if d.get('menu') == 'Вино']
            bars = [d for d in dishes_data if d.get('menu') == 'Барное меню']
            print(f"   - Вино: {len(wines)} блюд")
            print(f"   - Барное меню: {len(bars)} блюд")
        except Exception as e:
            print(f"[ERROR] Ошибка при чтении JSON: {e}")
            return
        
        # Добавляем данные в базу
        print(f"\n[INFO] Загружаем данные в базу данных...")
        success_count = 0
        error_count = 0
        errors = []
        
        # Словарь для отслеживания уже обработанных ID
        processed_ids = set()
        
        for i, dish_data in enumerate(dishes_data, 1):
            try:
                dish_id = dish_data.get('id')
                if not dish_id:
                    error_msg = f"Блюдо без ID (позиция {i})"
                    errors.append(error_msg)
                    error_count += 1
                    continue
                
                # Пропускаем дубликаты
                if dish_id in processed_ids:
                    error_msg = f"Дублирующийся ID: {dish_id} (позиция {i})"
                    errors.append(error_msg)
                    error_count += 1
                    continue
                
                processed_ids.add(dish_id)
                
                # Проверяем, есть ли уже в базе
                existing = Dish.query.get(dish_id)
                if existing:
                    # Обновляем существующее блюдо
                    updated_dish = Dish.from_dict(dish_data)
                    existing.menu = updated_dish.menu
                    existing.section = updated_dish.section
                    existing.title = updated_dish.title
                    existing.description = updated_dish.description
                    existing.contains = updated_dish.contains
                    existing.allergens = updated_dish.allergens
                    existing.tags = updated_dish.tags
                    existing.pairings = updated_dish.pairings
                    existing.image = updated_dish.image
                    existing.i18n = updated_dish.i18n
                else:
                    # Создаём новое блюдо
                    dish = Dish.from_dict(dish_data)
                    db.session.add(dish)
                
                # Выводим прогресс каждые 50 записей
                if i % 50 == 0:
                    print(f"   Обработано: {i}/{len(dishes_data)}")
                    db.session.commit()  # Сохраняем каждые 50 записей
                
                success_count += 1
            except Exception as e:
                error_msg = f"Ошибка при обработке блюда {dish_data.get('id', 'unknown')}: {str(e)}"
                if error_count < 5:  # Показываем только первые 5 ошибок
                    print(f"[ERROR] {error_msg[:200]}")  # Ограничиваем длину вывода
                errors.append(error_msg)
                error_count += 1
                # Откатываем текущую транзакцию и продолжаем
                db.session.rollback()
        
        # Сохраняем оставшиеся записи
        print("[INFO] Сохраняем остальные данные...")
        db.session.commit()
        
        print(f"\n[OK] Миграция завершена!")
        print(f"   Успешно загружено: {success_count} блюд")
        if error_count > 0:
            print(f"   Ошибок: {error_count}")
            if len(errors) <= 10:
                for err in errors:
                    print(f"     - {err}")
        
        # Проверяем результат
        total_in_db = Dish.query.count()
        print(f"\n[INFO] В базе данных теперь: {total_in_db} блюд")
        
        # Проверяем меню
        menus = db.session.query(Dish.menu).distinct().all()
        menu_list = [m[0] for m in menus if m[0]]
        print(f"\n[INFO] Меню в базе данных ({len(menu_list)}):")
        for menu in sorted(menu_list):
            count = Dish.query.filter(Dish.menu == menu).count()
            print(f"   - {menu}: {count} блюд")
        
        # Проверяем конкретно Вино и Барное меню
        wine_count = Dish.query.filter(Dish.menu == 'Вино').count()
        bar_count = Dish.query.filter(Dish.menu == 'Барное меню').count()
        print(f"\n[INFO] Проверка важных меню:")
        print(f"   - Вино: {wine_count} блюд {'[OK]' if wine_count > 0 else '[ERROR]'}")
        print(f"   - Барное меню: {bar_count} блюд {'[OK]' if bar_count > 0 else '[ERROR]'}")

if __name__ == '__main__':
    migrate_force()

"""
Скрипт для миграции данных из JSON в SQLite базу данных.

Что делает этот скрипт:
1. Создаёт базу данных SQLite
2. Создаёт таблицы kitchen_items / wine_items / bar_items / artworks
3. Читает данные из разделённых JSON (или legacy menu-database.json)
4. Переносит все данные в базу данных

Запуск:
  python migrate_to_db.py
  python migrate_to_db.py --yes   (автоматически перезатирает данные, без вопросов)
"""

import argparse
from pathlib import Path
from backend.app import app
from backend.services.menu_service import MenuService
from backend.models import db, KitchenItem, WineItem, BarItem, TeaItem, Artwork

# Путь к файлам с данными
ROOT_DIR = Path(__file__).resolve().parent.parent

def migrate():
    """Основная функция миграции"""
    
    print("Starting migration JSON -> SQLite...")
    
    parser = argparse.ArgumentParser(description="Миграция JSON -> SQLite (kitchen/wine/bar/artworks)")
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Автоматически удалить старые данные и загрузить заново (без интерактивных вопросов).",
    )
    args = parser.parse_args()

    # Создаём контекст приложения Flask (нужен для работы с базой данных)
    with app.app_context():
        # Создаём все таблицы в базе данных
        print("\nCreating database structure...")
        db.create_all()
        print("✅ Таблицы созданы!")
        
        # Читаем данные из JSON (split/legacy)
        print(f"\nReading data from JSON...")
        dishes_data = MenuService.load_menu_db_items()
        art_data = MenuService.load_art_db_items()
        if not isinstance(dishes_data, list):
            print("❌ JSON меню должен быть списком объектов (list). Миграция остановлена.")
            return
        if not isinstance(art_data, list):
            art_data = []
        print(f"✅ Прочитано меню: {len(dishes_data)} записей")
        print(f"✅ Прочитано картин: {len(art_data)} записей")

        # ========== ДЕДУПЛИКАЦИЯ ==========
        # Важно: в menu-database.json иногда встречаются повторяющиеся id (или id с пробелами).
        # В SQLite поле id — PRIMARY KEY, поэтому дубликаты ломают миграцию (UNIQUE constraint failed).
        # Решение KISS: нормализуем id (str + trim) и оставляем ПОСЛЕДНЮЮ запись для каждого id.
        dishes_data, duplicates, skipped_no_id = MenuService.dedupe_menu_items(dishes_data)
        if duplicates or skipped_no_id:
            print(f"Info: Deduplication: removed {duplicates} duplicates, skipped {skipped_no_id} without id")
        print(f"✅ К загрузке в БД меню: {len(dishes_data)} уникальных позиций")
        
        # Проверяем, есть ли уже данные в базе
        existing_count = KitchenItem.query.count() + WineItem.query.count() + BarItem.query.count() + TeaItem.query.count() + Artwork.query.count()
        if existing_count > 0:
            print(f"\nWarning: DB already contains {existing_count} records")
            if args.yes:
                print("Cleaning old data...")
                KitchenItem.query.delete()
                WineItem.query.delete()
                BarItem.query.delete()
                TeaItem.query.delete()
                Artwork.query.delete()
                db.session.expunge_all()
                db.session.commit()
                print("✅ Старые данные удалены")
            else:
                response = input("Удалить старые данные и загрузить заново? (y/n): ")
                if response.lower() != 'y':
                    print("❌ Миграция отменена")
                    return
        
        # Добавляем данные в базу
        print(f"\nSaving data to DB...")
        success_count = 0
        error_count = 0
        
        parts = MenuService.split_menu_items(dishes_data)
        ordered_groups = [
            ("кухня", KitchenItem, parts.get("kitchen", [])),
            ("вино", WineItem, parts.get("wine", [])),
            ("бар", BarItem, parts.get("bar", [])),
            ("чай", TeaItem, parts.get("tea", [])),
        ]

        processed = 0
        total_items = sum(len(g[2]) for g in ordered_groups)
        for _, model, group_items in ordered_groups:
            for dish_data in group_items:
                try:
                    dish = model.from_dict(dish_data)
                    db.session.merge(dish)
                    processed += 1
                    if processed % 50 == 0:
                        print(f"   Обработано: {processed}/{total_items}")
                        db.session.commit()
                    success_count += 1
                except Exception as e:
                    print(f"❌ Ошибка при обработке позиции {dish_data.get('id', 'unknown')}: {e}")
                    error_count += 1
                    db.session.rollback()
        
        # Сохраняем оставшиеся записи
        print("Finalizing save...")
        db.session.commit()
        
        # Картины
        for art in art_data:
            try:
                db.session.merge(Artwork.from_dict(art))
            except Exception as e:
                print(f"❌ Ошибка при обработке картины {art.get('id', 'unknown')}: {e}")
                db.session.rollback()

        print(f"\n✅ Миграция завершена!")
        print(f"   Успешно загружено меню: {success_count} позиций")
        if error_count > 0:
            print(f"   Ошибок: {error_count}")
        
        # Проверяем результат
        total_in_db = KitchenItem.query.count() + WineItem.query.count() + BarItem.query.count() + TeaItem.query.count() + Artwork.query.count()
        print(f"\n📊 В базе данных теперь: {total_in_db} записей")

if __name__ == '__main__':
    migrate()

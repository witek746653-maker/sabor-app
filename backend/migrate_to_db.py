"""
Скрипт для миграции данных из JSON в SQLite базу данных.

Что делает этот скрипт:
1. Создаёт базу данных SQLite
2. Создаёт таблицу dishes
3. Читает данные из menu-database.json
4. Переносит все данные в базу данных

Запуск:
  python migrate_to_db.py
  python migrate_to_db.py --yes   (автоматически перезатирает данные, без вопросов)
"""

import json
import argparse
from pathlib import Path
from app import app
from models import db, Dish

# Путь к файлу с данными
ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_PATH = ROOT_DIR / "data" / "menu-database.json"
JSON_BACKUP_PATH = ROOT_DIR / "frontend" / "public" / "data" / "menu-database.json"

def migrate():
    """Основная функция миграции"""
    
    print("🚀 Начинаем миграцию данных из JSON в SQLite...")
    
    # Находим файл с данными
    json_file = None
    if DATA_PATH.exists():
        json_file = DATA_PATH
        print(f"✅ Найден файл: {DATA_PATH}")
    elif JSON_BACKUP_PATH.exists():
        json_file = JSON_BACKUP_PATH
        print(f"✅ Найден файл: {JSON_BACKUP_PATH}")
    else:
        print(f"❌ Файл menu-database.json не найден!")
        print(f"   Искали в: {DATA_PATH}")
        print(f"   Искали в: {JSON_BACKUP_PATH}")
        return
    
    parser = argparse.ArgumentParser(description="Миграция menu-database.json -> SQLite (таблица dishes)")
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Автоматически удалить старые данные и загрузить заново (без интерактивных вопросов).",
    )
    args = parser.parse_args()

    # Создаём контекст приложения Flask (нужен для работы с базой данных)
    with app.app_context():
        # Создаём все таблицы в базе данных
        print("\n📦 Создаём структуру базы данных...")
        db.create_all()
        print("✅ Таблицы созданы!")
        
        # Читаем данные из JSON
        print(f"\n📖 Читаем данные из {json_file}...")
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                dishes_data = json.load(f)
            print(f"✅ Прочитано {len(dishes_data)} записей")
        except Exception as e:
            print(f"❌ Ошибка при чтении JSON: {e}")
            return

        # ========== ДЕДУПЛИКАЦИЯ ==========
        # Важно: в menu-database.json иногда встречаются повторяющиеся id (или id с пробелами).
        # В SQLite поле id — PRIMARY KEY, поэтому дубликаты ломают миграцию (UNIQUE constraint failed).
        # Решение KISS: нормализуем id (str + trim) и оставляем ПОСЛЕДНЮЮ запись для каждого id.
        if not isinstance(dishes_data, list):
            print("❌ JSON должен быть списком объектов (list). Миграция остановлена.")
            return

        unique_by_id = {}
        skipped_no_id = 0
        duplicates = 0

        for item in dishes_data:
            if not isinstance(item, dict):
                continue
            raw_id = item.get('id')
            if raw_id is None:
                skipped_no_id += 1
                continue
            norm_id = str(raw_id).strip()
            if not norm_id:
                skipped_no_id += 1
                continue
            # Принудительно записываем нормализованный id обратно
            item['id'] = norm_id
            if norm_id in unique_by_id:
                duplicates += 1
            unique_by_id[norm_id] = item

        dishes_data = list(unique_by_id.values())
        if duplicates or skipped_no_id:
            print(f"ℹ️  Дедупликация: убрано дублей id = {duplicates}, пропущено без id = {skipped_no_id}")
        print(f"✅ К загрузке в БД: {len(dishes_data)} уникальных блюд")
        
        # Проверяем, есть ли уже данные в базе
        existing_count = Dish.query.count()
        if existing_count > 0:
            print(f"\n⚠️  В базе уже есть {existing_count} блюд")
            if args.yes:
                print("🗑️  Удаляем старые данные...")
                Dish.query.delete()
                db.session.commit()
                print("✅ Старые данные удалены")
            else:
                response = input("Удалить старые данные и загрузить заново? (y/n): ")
                if response.lower() != 'y':
                    print("❌ Миграция отменена")
                    return
        
        # Добавляем данные в базу
        print(f"\n💾 Загружаем данные в базу данных...")
        success_count = 0
        error_count = 0
        
        for i, dish_data in enumerate(dishes_data, 1):
            try:
                # Создаём объект блюда из словаря
                dish = Dish.from_dict(dish_data)

                # merge() — это "upsert" по первичному ключу (id):
                # если запись с таким id уже есть, она обновится; если нет — добавится.
                # Это делает миграцию устойчивой даже к странным дублям в исходных данных.
                db.session.merge(dish)
                
                # Выводим прогресс каждые 50 записей
                if i % 50 == 0:
                    print(f"   Обработано: {i}/{len(dishes_data)}")
                    db.session.commit()  # Сохраняем каждые 50 записей
                
                success_count += 1
            except Exception as e:
                print(f"❌ Ошибка при обработке блюда {dish_data.get('id', 'unknown')}: {e}")
                error_count += 1
                # Важно: после ошибки SQLAlchemy помечает транзакцию как "сломанная".
                # rollback() позволяет продолжить миграцию дальше.
                db.session.rollback()
        
        # Сохраняем оставшиеся записи
        print("💾 Сохраняем остальные данные...")
        db.session.commit()
        
        print(f"\n✅ Миграция завершена!")
        print(f"   Успешно загружено: {success_count} блюд")
        if error_count > 0:
            print(f"   Ошибок: {error_count}")
        
        # Проверяем результат
        total_in_db = Dish.query.count()
        print(f"\n📊 В базе данных теперь: {total_in_db} блюд")

if __name__ == '__main__':
    migrate()

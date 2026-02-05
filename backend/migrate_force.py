"""
Принудительная миграция данных из JSON в SQLite базу данных.
Удаляет старые данные и загружает заново (kitchen/wine/bar/artworks).
"""

from backend.app import app
from backend.services.menu_service import MenuService
from backend.models import db, KitchenItem, WineItem, BarItem, TeaItem, Artwork

def migrate_force():
    """Принудительная миграция - удаляет старые данные и загружает заново"""

    print("Начинаем ПРИНУДИТЕЛЬНУЮ миграцию данных из JSON в SQLite...")

    with app.app_context():
        print("\n[INFO] Создаём структуру базы данных...")
        db.create_all()
        print("[OK] Таблицы созданы!")

        print("\n[INFO] Удаляем все старые данные из базы...")
        KitchenItem.query.delete()
        WineItem.query.delete()
        BarItem.query.delete()
        TeaItem.query.delete()
        Artwork.query.delete()
        db.session.commit()
        print("[OK] Старые данные удалены!")

        print("\n[INFO] Читаем данные из JSON...")
        dishes_data = MenuService.load_menu_db_items()
        art_data = MenuService.load_art_db_items()
        if not isinstance(dishes_data, list):
            print("[ERROR] Меню JSON не найден или не list")
            return
        if not isinstance(art_data, list):
            art_data = []
        print(f"[OK] Прочитано меню: {len(dishes_data)}")
        print(f"[OK] Прочитано картин: {len(art_data)}")

        print("\n[INFO] Загружаем данные в базу данных...")
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
                    print(f"[ERROR] Ошибка при обработке позиции {dish_data.get('id', 'unknown')}: {str(e)}")
                    error_count += 1
                    db.session.rollback()

        for art in art_data:
            try:
                db.session.merge(Artwork.from_dict(art))
            except Exception as e:
                print(f"[ERROR] Ошибка при обработке картины {art.get('id', 'unknown')}: {str(e)}")
                db.session.rollback()

        print("[INFO] Сохраняем остальные данные...")
        db.session.commit()

        print(f"\n[OK] Миграция завершена!")
        print(f"   Успешно загружено меню: {success_count} позиций")
        if error_count > 0:
            print(f"   Ошибок: {error_count}")

        total_in_db = KitchenItem.query.count() + WineItem.query.count() + BarItem.query.count() + TeaItem.query.count() + Artwork.query.count()
        print(f"\n[INFO] В базе данных теперь: {total_in_db} записей")

        print(f"\n[INFO] Проверка важных меню:")
        print(f"   - Вино: {WineItem.query.count()} позиций")
        print(f"   - Барное меню: {BarItem.query.count()} позиций")
        print(f"   - Чай: {TeaItem.query.count()} позиций")

if __name__ == '__main__':
    migrate_force()

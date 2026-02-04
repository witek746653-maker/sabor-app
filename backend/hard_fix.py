import sqlite3
import os
from pathlib import Path

# Определяем путь к базе данных
# На сервере она обычно лежит в папке backend
DB_PATH = Path("database.db")

def fix():
    if not DB_PATH.exists():
        print(f"[ERROR] База данных не найдена по пути: {DB_PATH.absolute()}")
        return

    print(f"[INFO] Работаем с базой: {DB_PATH.absolute()}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # 1. Починка таблицы feedback_messages (добавляем все новые колонки)
        columns_to_add = [
            ("type", "VARCHAR(50) DEFAULT 'question'"),
            ("tags_json", "TEXT DEFAULT '[]'"),
            ("meta_json", "TEXT DEFAULT '{}'"),
            ("attachments_json", "TEXT DEFAULT '[]'")
        ]

        # Получаем текущие колонки
        cursor.execute("PRAGMA table_info(feedback_messages)")
        existing_columns = [col[1] for col in cursor.fetchall()]

        for col_name, col_type in columns_to_add:
            if col_name not in existing_columns:
                print(f"[OK] Добавляем колонку {col_name}...")
                cursor.execute(f"ALTER TABLE feedback_messages ADD COLUMN {col_name} {col_type}")
            else:
                print(f"[SKIP] Колонка {col_name} уже есть.")

        # 2. Удаляем колонку email, если она осталась (SQLite не умеет DROP COLUMN просто так, 
        # но для начала просто убедимся, что новые на месте)
        
        conn.commit()
        print("\n[SUCCESS] База успешно обновлена!")
        
    except Exception as e:
        print(f"[FATAL] Ошибка при миграции: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    fix()

"""
Скрипт для миграции таблицы feedback_messages.
Добавляет колонку 'type' и удаляет колонку 'email'.

Запуск: python migrate_feedback_table.py
"""

import sqlite3
from pathlib import Path
from app import app
from models import db, FeedbackMessage

ROOT_DIR = Path(__file__).resolve().parent.parent
DB_PATH = ROOT_DIR / "backend" / "database.db"

def migrate_feedback_table():
    """Добавляет колонку type и удаляет email из таблицы feedback_messages"""
    
    print("[INFO] Начинаем миграцию таблицы feedback_messages...")
    
    if not DB_PATH.exists():
        print("[OK] База данных не существует, будет создана при первом запуске app.py")
        print("     Колонка 'type' будет добавлена автоматически")
        return
    
    # Подключаемся к базе данных напрямую через sqlite3
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    
    try:
        # Проверяем, существует ли таблица feedback_messages
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='feedback_messages'
        """)
        
        if not cursor.fetchone():
            print("[OK] Таблица feedback_messages не существует")
            print("     Она будет создана автоматически при первом использовании")
            conn.close()
            return
        
        # Проверяем, какие колонки уже есть
        cursor.execute("PRAGMA table_info(feedback_messages)")
        columns = {row[1]: row[2] for row in cursor.fetchall()}
        
        print(f"\n[INFO] Текущие колонки: {list(columns.keys())}")
        
        # Проверяем, есть ли колонка 'type'
        if 'type' in columns:
            print("[OK] Колонка 'type' уже существует")
        else:
            print("\n[INFO] Добавляем колонку 'type'...")
            cursor.execute("""
                ALTER TABLE feedback_messages 
                ADD COLUMN type VARCHAR(50) DEFAULT 'question'
            """)
            # Обновляем существующие записи
            cursor.execute("""
                UPDATE feedback_messages 
                SET type = 'question' 
                WHERE type IS NULL
            """)
            print("[OK] Колонка 'type' добавлена")
        
        # Проверяем, есть ли колонка 'email' (её нужно удалить)
        if 'email' in columns:
            print("\n[INFO] Колонка 'email' найдена, пересоздаем таблицу без неё...")
            
            # Создаём временную таблицу с новой структурой
            cursor.execute("""
                CREATE TABLE feedback_messages_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name VARCHAR(200),
                    type VARCHAR(50) DEFAULT 'question',
                    message TEXT NOT NULL,
                    read BOOLEAN DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Копируем данные (без email)
            cursor.execute("""
                INSERT INTO feedback_messages_new (id, name, type, message, read, created_at)
                SELECT id, name, COALESCE(type, 'question'), message, read, created_at
                FROM feedback_messages
            """)
            
            # Удаляем старую таблицу
            cursor.execute("DROP TABLE feedback_messages")
            
            # Переименовываем новую таблицу
            cursor.execute("ALTER TABLE feedback_messages_new RENAME TO feedback_messages")
            
            print("[OK] Таблица пересоздана без колонки 'email'")
        
        conn.commit()
        print("\n[OK] Миграция завершена успешно!")
        
    except Exception as e:
        conn.rollback()
        print(f"\n[ERROR] Ошибка при миграции: {e}")
        raise
    finally:
        conn.close()

if __name__ == '__main__':
    with app.app_context():
        migrate_feedback_table()

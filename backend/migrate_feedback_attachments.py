"""
Скрипт для миграции таблицы feedback_messages (вложения/мета).
Запуск: python migrate_feedback_attachments.py
"""

import os
os.environ.setdefault("SABOR_SKIP_BOOTSTRAP", "true")

from models import db
from app import app

def migrate_feedback_attachments():
    print("[INFO] Миграция feedback_messages: attachments/meta/tags")
    with app.app_context():
        conn = db.engine.raw_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='feedback_messages'
        """)
        if cursor.fetchone() is None:
            print("[OK] Таблица feedback_messages не существует")
            return

        cursor.execute("PRAGMA table_info(feedback_messages)")
        columns = [row[1] for row in cursor.fetchall()]

        if "tags_json" not in columns:
            cursor.execute("ALTER TABLE feedback_messages ADD COLUMN tags_json TEXT")
            print("[OK] Добавлена колонка tags_json")
        if "meta_json" not in columns:
            cursor.execute("ALTER TABLE feedback_messages ADD COLUMN meta_json TEXT")
            print("[OK] Добавлена колонка meta_json")
        if "attachments_json" not in columns:
            cursor.execute("ALTER TABLE feedback_messages ADD COLUMN attachments_json TEXT")
            print("[OK] Добавлена колонка attachments_json")

        conn.commit()
        print("[DONE] Миграция завершена")

if __name__ == "__main__":
    migrate_feedback_attachments()

import sqlite3

# Путь к базе SQLite
DB_PATH = r"D:\GitHub\sabor-app\backend\database.db"
# Что ищем в названии (можешь менять)
SEARCH = "Castellare"

con = sqlite3.connect(DB_PATH)
cur = con.cursor()

# Покажем таблицы
tables = cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
print("Tables:", tables)

# Если есть таблица dishes — узнаем реальные колонки и выберем только существующие
if ("dishes",) in tables:
    columns = cur.execute("PRAGMA table_info(dishes);").fetchall()
    column_names = [c[1] for c in columns]
    print("Dishes columns:", column_names)

    # Оставляем только те поля, которые реально существуют
    wanted = ["id", "title", "image", "image_src", "image_url", "imageUrl"]
    existing = [c for c in wanted if c in column_names]
    if not existing:
        # Если ничего не совпало — покажем хотя бы id и title, если есть
        existing = [c for c in ["id", "title"] if c in column_names]

    fields = ", ".join(existing) if existing else "*"
    query = f"SELECT {fields} FROM dishes WHERE title LIKE ?"
    rows = cur.execute(query, (f"%{SEARCH}%",)).fetchall()
    print("Rows:", rows)
else:
    print("Table 'dishes' not found. Use PRAGMA table_info for actual table name.")

con.close()
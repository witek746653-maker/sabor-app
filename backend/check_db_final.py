
import sqlite3
import json

conn = sqlite3.connect('d:/GitHub/sabor-app/backend/database.db')
cursor = conn.cursor()
cursor.execute("SELECT id, title, image FROM kitchen_items WHERE menu='Постное меню'")
rows = cursor.fetchall()
for row in rows:
    print(f"ID: {row[0]}, Title: {row[1]}, Image: {row[2]}")
conn.close()

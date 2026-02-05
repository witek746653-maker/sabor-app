"""
Скрипт для создания первого администратора в системе.

Что делает этот скрипт:
1. Создаёт таблицу users (если её ещё нет)
2. Проверяет, есть ли уже администратор в системе
3. Создаёт первого администратора с указанными данными

Запуск: python create_admin.py
"""

from backend.app import app
from backend.models import db, User

def create_admin():
    """Создание первого администратора"""
    
    print("🚀 Создание первого администратора...")
    
    # Создаём контекст приложения Flask (нужен для работы с базой данных)
    with app.app_context():
        # Создаём все таблицы в базе данных (если их ещё нет)
        print("\n📦 Создаём структуру базы данных...")
        db.create_all()
        print("✅ Таблицы созданы!")
        
        # Проверяем, есть ли уже администратор в системе
        admin_exists = User.query.filter_by(role='администратор').first()
        
        if admin_exists:
            print(f"\n⚠️  В системе уже есть администратор: {admin_exists.username}")
            response = input("Создать ещё одного администратора? (y/n): ")
            if response.lower() != 'y':
                print("❌ Отменено")
                return
        
        # Запрашиваем данные для нового администратора
        print("\n📝 Введите данные нового администратора:")
        name = input("Имя: ").strip()
        username = input("Логин: ").strip()
        password = input("Пароль: ").strip()
        
        # Проверяем, что все поля заполнены
        if not name or not username or not password:
            print("❌ Ошибка: все поля обязательны!")
            return
        
        # Проверяем, что логин уникален
        existing_user = User.query.filter_by(username=username).first()
        if existing_user:
            print(f"❌ Ошибка: пользователь с логином '{username}' уже существует!")
            return
        
        # Создаём нового администратора
        admin = User(
            name=name,
            username=username,
            role='администратор'
        )
        # Устанавливаем пароль (он автоматически хешируется)
        admin.set_password(password)
        
        # Сохраняем в базу данных
        try:
            db.session.add(admin)
            db.session.commit()
            print(f"\n✅ Администратор '{username}' успешно создан!")
            print(f"   Имя: {name}")
            print(f"   Логин: {username}")
            print(f"   Роль: администратор")
        except Exception as e:
            db.session.rollback()
            print(f"❌ Ошибка при создании администратора: {e}")
            return

if __name__ == '__main__':
    create_admin()

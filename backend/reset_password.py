"""
Скрипт для сброса пароля пользователя (в том числе администратора).

Зачем нужен:
- Если пользователь/админ существует, но вы не можете войти (забыли пароль / опечатка),
  можно безопасно задать новый пароль прямо в базе данных.

Запуск:
  cd backend
  py reset_password.py
"""

from app import app
from models import db, User


def reset_password():
    print("🔑 Сброс пароля пользователя")
    print("Важно: пароль НЕ показывается и хранится в базе как хеш (это безопаснее).")

    username = input("\nЛогин пользователя (username): ").strip()
    if not username:
        print("❌ Ошибка: логин пустой")
        return

    new_password = input("Новый пароль: ").strip()
    if not new_password:
        print("❌ Ошибка: пароль пустой")
        return

    make_admin_raw = input("Сделать роль 'администратор'? (y/n, Enter = n): ").strip().lower()
    make_admin = make_admin_raw == "y"

    with app.app_context():
        user = User.query.filter_by(username=username).first()
        if not user:
            print(f"❌ Пользователь '{username}' не найден.")
            return

        try:
            user.set_password(new_password)
            if make_admin:
                user.role = "администратор"
            db.session.commit()
            print("\n✅ Готово!")
            print(f"   Логин: {user.username}")
            print(f"   Роль: {user.role}")
            print("   Пароль обновлён.")
        except Exception as e:
            db.session.rollback()
            print(f"❌ Ошибка при обновлении: {e}")


if __name__ == "__main__":
    reset_password()


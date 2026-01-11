# ПРИМЕР WSGI файла для PythonAnywhere
# 
# ВАЖНО: Этот файл НЕ готов к использованию!
# 
# Инструкция:
# 1. Откройте WSGI файл на PythonAnywhere (Web → WSGI configuration file)
# 2. Замените 'yourusername' на ваш реальный PythonAnywhere username
# 3. Скопируйте содержимое этого файла в WSGI файл на PythonAnywhere
#
# Как узнать свой username:
# - В верхней части страницы PythonAnywhere написано: "Logged in as yourusername"
# - Или в консоли выполните: whoami

import sys

# Добавляем путь к проекту
# ЗАМЕНИТЕ 'yourusername' на ваш реальный username!
path = '/home/yourusername/sabor-app/backend'
if path not in sys.path:
    sys.path.insert(0, path)

# Активируем виртуальное окружение
# ЗАМЕНИТЕ 'yourusername' на ваш реальный username!
activate_this = '/home/yourusername/sabor-app/backend/venv/bin/activate_this.py'
try:
    with open(activate_this) as file_:
        exec(file_.read(), dict(__file__=activate_this))
except FileNotFoundError:
    # Если activate_this.py не найден, попробуем другой способ
    import os
    venv_path = '/home/yourusername/sabor-app/backend/venv'
    if os.path.exists(venv_path):
        # Добавляем путь к виртуальному окружению
        sys.path.insert(0, os.path.join(venv_path, 'lib', 'python3.10', 'site-packages'))

# Импортируем приложение
from app import app as application

if __name__ == "__main__":
    application.run()

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
WSGI файл для развертывания на Beget.

WSGI (Web Server Gateway Interface) - это стандарт взаимодействия между веб-сервером 
и Python приложением. Beget использует WSGI для запуска Flask приложений.

Инструкция по настройке на Beget:
1. Загрузите проект на сервер (через git или FTP)
2. В панели Beget создайте Python приложение
3. Укажите путь к этому файлу (wsgi.py)
4. Настройте виртуальное окружение (venv) и установите зависимости
5. Убедитесь, что переменные окружения (.env) настроены
"""

import sys
from pathlib import Path

# Добавляем путь к проекту в sys.path
# ЗАМЕНИТЕ '/home/u1234567/sabor-app' на реальный путь к вашему проекту на Beget!
PROJECT_ROOT = Path(__file__).resolve().parent
BACKEND_DIR = PROJECT_ROOT / "backend"

# Добавляем путь к backend в sys.path, чтобы можно было импортировать модули
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Активируем виртуальное окружение (если оно используется)
# ЗАМЕНИТЕ '/home/u1234567/sabor-app/venv' на реальный путь к вашему venv на Beget!
# Обычно на Beget путь к venv: /home/uXXXXXXX/sabor-app/venv
VENV_PATH = PROJECT_ROOT / "venv"
if VENV_PATH.exists():
    activate_this = VENV_PATH / "bin" / "activate_this.py"
    if activate_this.exists():
        with open(activate_this) as file_:
            exec(file_.read(), dict(__file__=activate_this))
    else:
        # Если activate_this.py не найден, добавляем путь к пакетам вручную
        site_packages = VENV_PATH / "lib" / "python3.10" / "site-packages"
        if site_packages.exists() and str(site_packages) not in sys.path:
            sys.path.insert(0, str(site_packages))

# Импортируем приложение Flask
# application - это стандартное имя для WSGI приложения (Beget ожидает именно его)
from backend.app import app as application

# Если нужно настроить переменные окружения здесь (вместо .env файла):
# import os
# os.environ['SECRET_KEY'] = 'your-secret-key-here'
# os.environ['FLASK_DEBUG'] = 'False'

if __name__ == "__main__":
    # Это используется только для локального тестирования
    application.run(host='0.0.0.0', port=5000, debug=False)

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

# Корень проекта (папка, где лежит этот wsgi.py)
PROJECT_ROOT = Path(__file__).resolve().parent
# Папка с бэкендом (нужна, потому что в backend/app.py есть импорты вида `from models import ...`)
BACKEND_DIR = PROJECT_ROOT / "backend"

# ВАЖНО: Beget запускает WSGI уже внутри выбранного venv (который вы укажете в панели).
# Здесь мы НЕ "активируем" venv вручную — мы только добавляем пути к коду проекта.
for path in (PROJECT_ROOT, BACKEND_DIR):
    path_str = str(path)
    if path_str not in sys.path:
        sys.path.insert(0, path_str)

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

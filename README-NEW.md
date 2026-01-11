# Menu App - Меню ресторана

Современное клиент-серверное приложение для управления меню ресторана.

## Технологии

- **Backend**: Python + Flask
- **Frontend**: React
- **Данные**: JSON (menu-database.json)

## Установка и запуск

### Backend

1. Перейдите в папку backend:
```bash
cd backend
```

2. Создайте виртуальное окружение:
```bash
python -m venv venv
```

3. Активируйте виртуальное окружение:
- Windows: `venv\Scripts\activate`
- Linux/Mac: `source venv/bin/activate`

4. Установите зависимости:
```bash
pip install -r requirements.txt
```

5. Создайте файл `.env` (скопируйте из `.env.example` и измените значения):
```bash
copy .env.example .env
```

6. Скопируйте `menu-database.json` из старого проекта в папку `data/`

7. Запустите сервер:
```bash
python app.py
```

Сервер запустится на `http://localhost:5000`

### Frontend

1. Перейдите в папку frontend:
```bash
cd frontend
```

2. Установите зависимости:
```bash
npm install
```

3. Создайте файл `.env` (опционально, если нужно изменить URL API):
```bash
copy .env.example .env
```

4. Запустите приложение:
```bash
npm start
```

Приложение откроется на `http://localhost:3000`

## Использование

- **Главная страница**: Список всех меню
- **Страница меню**: Блюда выбранного меню с фильтрацией
- **Страница блюда**: Подробная информация о блюде
- **Админ-панель**: `/admin` - управление блюдами (пароль по умолчанию: `admin123`)

## Структура проекта

```
Menu-New/
├── backend/          # Flask API
│   ├── app.py
│   ├── requirements.txt
│   └── .env.example
├── frontend/         # React приложение
│   ├── src/
│   │   ├── pages/
│   │   ├── services/
│   │   └── App.js
│   └── package.json
├── data/             # JSON данные
│   └── menu-database.json
└── README.md
```

## API Endpoints

### Публичные (без авторизации)

- `GET /api/dishes` - Получить все блюда
- `GET /api/dishes/<id>` - Получить блюдо по ID
- `GET /api/menus` - Получить список всех меню
- `GET /api/sections?menu=<name>` - Получить разделы меню

### Админские (требуют авторизации)

- `POST /api/admin/login` - Вход в админ-панель
- `POST /api/admin/logout` - Выход
- `GET /api/admin/check` - Проверка авторизации
- `POST /api/admin/dishes` - Сохранить все блюда
- `PUT /api/admin/dishes/<id>` - Обновить блюдо
- `PUT /api/admin/dishes` - Добавить новое блюдо
- `DELETE /api/admin/dishes/<id>` - Удалить блюдо

## Безопасность

⚠️ **Важно**: В продакшене обязательно измените:
- `SECRET_KEY` в `.env`
- `ADMIN_PASSWORD` в `.env`
- Используйте HTTPS
- Настройте CORS для конкретного домена


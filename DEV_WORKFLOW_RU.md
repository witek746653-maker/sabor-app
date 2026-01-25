# Безопасная разработка и выкладка (пошагово)

Этот файл — простая инструкция «как делают в индустрии»: локальная разработка на копии базы и выкладка через GitHub + deploy.

## 0) Термины (очень просто)
- **Продакшн (prod)** — живой сервер для пользователей.
- **Dev‑база** — копия базы для локальных тестов.
- **SSH** — удалённый доступ к серверу через консоль.
- **Deploy (деплой)** — загрузка новой версии на сервер.
- **Бэкап** — резервная копия файла.

---

## 1) Один раз настроить deploy.config.ps1
Файл **не коммитится** и хранит доступы.

Путь: `D:\GitHub\sabor-app\deploy.config.ps1`

Пример содержимого:
```
1:5:d:\GitHub\sabor-app\deploy.config.ps1
$HostName = "ваш_домен_или_IP"
$UserName = "root"
$RemoteRoot = "/var/www/sabor-app"
$ServiceName = "sabor.service"
```

---

## 2) Один раз скачать прод‑базу в локальную dev‑копию
Мы сделаем безопасный бэкап на сервере и скачиваем его локально.

Команда (PowerShell):
```
cd D:\GitHub\sabor-app
powershell -ExecutionPolicy Bypass -File .\tools\sync_prod_db.ps1
```

Скрипт берёт настройки из `deploy.config.ps1` и сохраняет базу в:
`D:\GitHub\sabor-app\backend\database.dev.db`

Файл скрипта:
```
1:16:d:\GitHub\sabor-app\tools\sync_prod_db.ps1
param(
  # Куда сохранить локальную dev-базу
  [string]$LocalDbPath = ""
)
...
$RemoteDbPath = "$RemoteRoot/backend/database.db"
```

Если на сервере нет `sqlite3`, скрипт попросит сделать бэкап вручную.

---

## 3) Запуск локального backend с dev‑базой
Команда (PowerShell):
```
cd D:\GitHub\sabor-app
powershell -ExecutionPolicy Bypass -File .\tools\run_backend_dev.ps1
```

Файл скрипта:
```
1:14:d:\GitHub\sabor-app\tools\run_backend_dev.ps1
param(
  # Путь к dev-базе
  [string]$DbPath = ""
)
...
$env:SABOR_DB_PATH = $DbPath
```

Это заставляет бэкенд использовать dev‑базу, а не прод‑данные.

---

## 4) Локальная разработка и проверка
1) Запускай backend (см. шаг 3).  
2) Запускай frontend:
```
cd D:\GitHub\sabor-app\frontend
npm start
```
3) Проверяй изменения на `http://localhost:3000`.

---

## 5) Выкладка на сервер (deploy)
Когда всё проверено локально:

1) Сделай `git push` в GitHub.  
2) Запусти деплой:
```
cd D:\GitHub\sabor-app
powershell -ExecutionPolicy Bypass -File .\deploy.ps1
```

Файл деплоя:
```
34:49:d:\GitHub\sabor-app\deploy.ps1
# --- Настройки по умолчанию (можно переопределить через deploy.config.ps1) ---
$HostName = "85.198.98.16"
$UserName = "root"
$RemoteRoot = "/var/www/sabor-app"
$ServiceName = "sabor.service"
```

После деплоя проверяй сайт в **инкогнито** или с `Ctrl+F5` (чтобы сбросить кеш).

---

## 6) Правила безопасности
- Не коммитить `.env` и `*.db`.
- Не работать напрямую с прод‑базой.
- Если нужно «освежить» данные — повтори шаг 2 (скачать копию).

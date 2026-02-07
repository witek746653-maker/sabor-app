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

Если используете **Sentry для фронтенда** (только ошибки), добавьте туда же:
```
$FrontendSentryEnabled = "true"
$FrontendSentryDsn = "ВАШ_FRONTEND_DSN_ИЗ_SENTRY"
```
Важно:
- `deploy.config.ps1` **не коммитится**, поэтому DSN не попадёт в git.
- DSN вшивается во frontend **на этапе сборки** (`npm run build`), поэтому после изменения DSN нужен новый deploy.

---

## 2) Запуск окружения одной командой (БЫСТРО)

Самый быстрый способ начать работу. Эта команда сделает всё сама:
1. Скачает свежую базу с прода.
2. Запустит локальный Backend.
3. Запустит локальный Frontend.

**Команда:**
```powershell
.\dev
```

*(Совет: нажимайте `.\dev`, затем `Tab` — консоль сама допишет команду)*

Если всё успешно, вы увидите два цветных лога в одном окне (Backend + Frontend).
Приложение откроется на `http://localhost:3000`.


## 3) Ручной запуск (как это работает под капотом)
Если `.\dev` не работает или нужно запустить что-то отдельно:

### А. Скачать прод‑базу
```powershell
powershell -ExecutionPolicy Bypass -File .\tools\sync_prod_db.ps1
```

### Б. Запустить Backend
```powershell
powershell -ExecutionPolicy Bypass -File .\tools\run_backend_dev.ps1
```

### В. Запустить Frontend
```powershell
cd frontend
npm start
```


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

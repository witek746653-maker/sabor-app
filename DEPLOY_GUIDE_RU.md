## Памятка деплоя и обновлений (Sabor App)

Этот файл — короткая и надёжная инструкция “что делать, чтобы изменения попали на сервер и их увидели пользователи”.

---

## Быстрая логика (самое важное)

Пользователь увидит изменения только когда выполнены **все 3 пункта**:

- **Файлы обновились на сервере** (не только у вас на ПК)
- **Бэкенд перезапущен**, если менялись данные/бэкенд (Flask/Wsgi)
- **Браузер не показывает кеш** (проверяем инкогнито или Ctrl+F5)

Термины:
- **Кеш**: “память браузера”, которая может показывать старую версию сайта/файлов.
- **build**: “собранная” версия фронтенда для сервера (`frontend/build`).
- **endpoint / роут**: URL на сервере, который делает действие (например, отдать файл).
- **cookie**: “пропуск” авторизации, который браузер автоматически отправляет серверу.

---

## Как понять, что вы меняли (выберите сценарий)

- **A) Меню (JSON)**: меняли `data/menu-database.json`
- **B) Фронтенд (React)**: меняли `frontend/src/...`
- **C) Бэкенд (Flask)**: меняли `backend/*.py`
- **D) Приватный PDF (только для авторизованных)**: добавляли/обновляли внутренний PDF

Если меняли несколько пунктов — делайте по порядку из раздела “Порядок, если менялось всё”.

---

## Рекомендуемый способ: “одной кнопкой” через `deploy.ps1`

У вас уже есть скрипт `deploy.ps1`, который делает правильный деплой:
- проверяет JSON
- копирует JSON в `frontend/public/data/` (фолбэк, если API упадёт)
- собирает фронт `npm run build`
- заливает файлы на сервер
- (опционально) мигрирует JSON → SQLite на сервере
- перезапускает сервис

### 0) Один раз настроить `deploy.config.ps1` (на вашем ПК)

Файл с настройками НЕ должен попадать в Git.

1) Скопируйте:
- `deploy.config.example.ps1` → `deploy.config.ps1`

2) Откройте `deploy.config.ps1` и задайте:
- **`$HostName`**: IP/домен сервера
- **`$UserName`**: пользователь SSH (часто `root`)
- **`$RemoteRoot`**: путь проекта на сервере (где лежит `wsgi.py`)
- **`$ServiceName`**: имя systemd‑сервиса (например, `sabor.service`)
- (опционально) **`$SshKeyPath`**: путь к SSH‑ключу, чтобы не вводить пароль

### 1) Каждый раз обновлять сервер

Из корня проекта:

```powershell
cd D:\GitHub\sabor-app
powershell -ExecutionPolicy Bypass -File .\deploy.ps1
```

### Быстрее, если фронт НЕ менялся

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy.ps1 -SkipBuild
```

### Полезные режимы (осторожно)

- **Проверка без загрузки** (удобно проверить, что JSON валиден и build собирается):

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy.ps1 -SkipUpload
```

- **DryRun** (покажет команды, но не выполнит):

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy.ps1 -DryRun
```

---

## A) Меню (JSON): `data/menu-database.json`

### Мини‑правило
Обновили `data/menu-database.json` → запускайте `deploy.ps1`.

Почему: скрипт также обновляет фолбэк‑копию в `frontend/public/data/menu-database.json` и (при необходимости) мигрирует данные в SQLite.

### Если делаете вручную (без скрипта)

1) Загрузите файл на сервер:
- локально: `data/menu-database.json`
- сервер: `$RemoteRoot/data/menu-database.json`

2) Если у вас включена миграция JSON → SQLite, выполните миграцию на сервере:

```powershell
ssh <USER>@<HOST> "cd <REMOTE_ROOT>/backend && ../venv/bin/python3 migrate_to_db.py --yes"
```

3) Перезапустите сервис:

```powershell
ssh <USER>@<HOST> "systemctl restart <SERVICE_NAME>"
```

4) Проверка:
- откройте сайт в инкогнито
- Ctrl+F5

---

## B) Фронтенд (React): `frontend/src/...`

### Если используете `deploy.ps1`
Просто запускайте `deploy.ps1` (он сам сделает `npm ci` и `npm run build`, затем загрузит `frontend/build`).

### Если делаете вручную

1) Соберите фронт локально:

```powershell
cd D:\GitHub\sabor-app\frontend
npm ci
npm run build
```

2) Загрузите папку `frontend/build/` на сервер в `$RemoteRoot/frontend/`.

Пример через scp:

```powershell
cd D:\GitHub\sabor-app
scp -r .\frontend\build <USER>@<HOST>:<REMOTE_ROOT>/frontend/
```

3) Проверка: инкогнито + Ctrl+F5.

---

## C) Бэкенд (Flask): `backend/*.py`

### Если используете `deploy.ps1`
Запускайте `deploy.ps1` — он заливает нужные `.py` и перезапускает сервис.

### Если делаете вручную

1) Загрузите изменённые файлы в `$RemoteRoot/backend/` (например `app.py`, `models.py`).

2) Перезапустите сервис:

```powershell
ssh <USER>@<HOST> "systemctl restart <SERVICE_NAME>"
```

3) Проверка: откройте API‑страницы (ниже) и сайт (Ctrl+F5).

---

## D) Приватный PDF “только для авторизованных” (НЕ по прямой ссылке)

### Почему нельзя класть PDF в `frontend/public/...`
`public` — это “витрина”: любой, кто знает URL, сможет скачать файл.

### Как правильно (KISS‑вариант “только последний актуальный”)

1) Храним один файл локально:
- `backend/private/menus/latest.pdf`

2) Добавляем в `.gitignore`, чтобы PDF не попал в репозиторий:

Файл: `.gitignore`

```gitignore
# Private internal files (do not commit)
backend/private/
```

Термин **tracked**: файл уже “под контролем Git”. Тогда нужно убрать его из индекса:

```powershell
# Если вы ещё НИКОГДА не добавляли этот файл в Git — эту команду делать не надо.
git rm --cached "backend/private/menus/latest.pdf"
```

3) Бэкенд: делаем защищённый endpoint, который:
- проверяет `current_user.is_authenticated`
- отдаёт `latest.pdf` через `send_file`

4) Фронтенд: берём PDF только по этому endpoint.
Важно для fetch:
- используйте `credentials: 'include'`, иначе cookies авторизации не отправятся и будет 401.

### Как загрузить приватный PDF на сервер
Скрипт `deploy.ps1` его НЕ заливает, поэтому делаем отдельно:

```powershell
ssh <USER>@<HOST> "mkdir -p <REMOTE_ROOT>/backend/private/menus"
scp "backend\private\menus\latest.pdf" <USER>@<HOST>:<REMOTE_ROOT>/backend/private/menus/latest.pdf
ssh <USER>@<HOST> "systemctl restart <SERVICE_NAME>"
```

Готовая ссылка в браузере (работает только после входа):
- `/api/private/menus/latest.pdf`

---

## Порядок, если менялось всё (JSON + фронт + бэкенд)

Самый надёжный порядок:
- запустить `deploy.ps1`
- (если есть приватный PDF) залить его отдельной командой из раздела D
- проверка в инкогнито + Ctrl+F5

---

## Проверка после деплоя (делать всегда)

Откройте в браузере (инкогнито):
- `/api/menus`
- `/api/wines`
- `/api/bar-items`
- главную страницу сайта (Ctrl+F5)

Если API отдаёт ошибки — значит бэкенд/миграция/файлы на сервере не совпали.

---

## Если “обновил, а не видно” (4 типовые причины)

- **Кеш**: Ctrl+F5 или инкогнито
- **Не перезапустили сервис** (после бэкенда/данных)
- **Не собрали/не залили `frontend/build`**
- **Две копии меню**: `data/menu-database.json` и фолбэк `frontend/public/data/menu-database.json` (скрипт `deploy.ps1` синхронизирует сам)

---

## Безопасность (важно)

- **Не коммитьте секреты**: `.env`, `deploy.config.ps1`, токены/пароли.
- Если документ должен быть “только для сотрудников” — храните его приватно (раздел D), а не в `public`.


### “Одна кнопка” обновления (Windows PowerShell → сервер)

Идея простая: вы меняете `data/menu-database.json` локально → запускаете один скрипт → он сам:
- проверит, что JSON не сломан
- соберёт фронтенд (`npm run build`)
- зальёт на сервер: JSON + `backend/*.py` + `frontend/build`
- перельёт JSON в базу (миграция)
- перезапустит сервис `sabor.service`

### 0) Один раз настроить

#### Шаг 0.1 — создать локальный конфиг (НЕ коммитится)

Скопируйте файл:
- `deploy.config.example.ps1` → `deploy.config.ps1`

И при необходимости поправьте значения (IP/путь/имя сервиса).

#### Шаг 0.2 — (рекомендуется) настроить SSH‑ключ, чтобы не вводить пароль каждый раз

**SSH‑ключ** — это “электронный ключ” вместо пароля.

На Windows (PowerShell):

```powershell
ssh-keygen -t ed25519
type $env:USERPROFILE\.ssh\id_ed25519.pub
```

Скопируйте вывод (публичный ключ) и добавьте его на сервер в:
`~/.ssh/authorized_keys` для пользователя (у вас сейчас `root`).

После этого `ssh/scp` перестанут спрашивать пароль.

### 1) Как обновлять меню “одной кнопкой”

#### Шаг 1 — правим меню локально
- редактируете: `data/menu-database.json`

#### Шаг 2 — запускаем деплой

В корне проекта:

```powershell
cd D:\GitHub\sabor-app
powershell -ExecutionPolicy Bypass -File .\deploy.ps1
```

### Полезные флаги

- **Пропустить сборку фронта** (если не меняли `frontend/src`):

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy.ps1 -SkipBuild
```

- **Пропустить миграцию БД** (редко нужно; обычно лучше НЕ пропускать):

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy.ps1 -SkipMigrate
```

- **Проверить скрипт без загрузки на сервер** (не будет scp/ssh, удобно для теста):

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy.ps1 -SkipUpload
```

- **DryRun** (покажет команды, но не будет их выполнять):

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy.ps1 -DryRun
```

### 2) Как проверить, что всё обновилось

Откройте:
- `https://sabor-dlv.ru/api/menus`
- `https://sabor-dlv.ru/api/wines`
- `https://sabor-dlv.ru/api/bar-items`
- `https://sabor-dlv.ru/` (Ctrl+F5)

### Важно про безопасность

- **Не храните пароли/секреты в репозитории.**  
  Файл `deploy.config.ps1` специально добавлен в `.gitignore`.

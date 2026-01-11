# 🔧 Быстрая настройка Git

## Изменение Git remote на репозиторий sabor-app

Текущий remote указывает на старый репозиторий. Нужно изменить его на `sabor-app`.

### Шаг 1: Узнайте ваш GitHub username

Если вы не помните ваш GitHub username:
1. Зайдите на https://github.com
2. Войдите в аккаунт
3. Ваш username будет в правом верхнем углу или в URL: `https://github.com/ВАШ_USERNAME`

### Шаг 2: Измените remote

Откройте PowerShell или Command Prompt в папке проекта (`d:\GitHub\sabor-app`) и выполните:

```powershell
git remote set-url origin https://github.com/witek746653-maker/sabor-app.git
```

**Замените `ВАШ_USERNAME` на ваш реальный GitHub username!**

Например, если ваш username `john`, команда будет:
```powershell
git remote set-url origin https://github.com/john/sabor-app.git
```

### Шаг 3: Проверьте, что remote изменился

```powershell
git remote -v
```

Должно показать что-то вроде:
```
origin  https://github.com/ВАШ_USERNAME/sabor-app.git (fetch)
origin  https://github.com/ВАШ_USERNAME/sabor-app.git (push)
```

### Шаг 4: Убедитесь, что репозиторий создан на GitHub

1. Зайдите на https://github.com
2. Проверьте, есть ли репозиторий с именем `sabor-app`
3. Если нет - создайте его:
   - Нажмите "New repository"
   - Назовите `sabor-app`
   - НЕ добавляйте README, .gitignore или лицензию (они уже есть в проекте)
   - Создайте репозиторий

### Шаг 5: Загрузите код в GitHub

```powershell
git add .
git commit -m "Initial commit for deployment setup"
git push -u origin main
```

Если возникнет ошибка, возможно ветка называется `master` вместо `main`:

```powershell
git push -u origin master
```

Или переименуйте ветку:

```powershell
git branch -M main
git push -u origin main
```

---

После этого можно переходить к развертыванию на Beget (см. файл BEGET_DEPLOY.md)

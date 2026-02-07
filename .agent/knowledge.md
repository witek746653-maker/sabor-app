# Знания проекта Sabor-App

## Автономные агенты и инструменты тестирования

### WebTester
**Описание:** Агент для проведения Playwright-тестов (проверка интерфейса, винного генератора и админки).
**Точка входа:** `tools/tests/test_agent.py`

**Доступные команды:**
- `run_ui_tests`: `pytest tools/tests/test_agent.py` — запуск браузерных тестов.
- `inspect_db`: `python tools/inspect_db.py` — проверка БД перед тестами.

**Правила работы:**
1. При падении теста — скриншот в `tools/tests/screenshots/`.
2. Валидация UI на основе данных из `inspect_db.py`.

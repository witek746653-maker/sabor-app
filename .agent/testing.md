# Sabor-App — тестирование и инструменты

## WebTester (UI tests)
- Описание: Playwright/pytest‑тесты UI (интерфейс, админка и т.п.).
- Точка входа: `tools/tests/test_agent.py`
- Команды:
  - `pytest tools/tests/test_agent.py`
  - `python tools/inspect_db.py` (проверка/инспекция БД перед тестами)
- Правила:
  1) При падении теста — скриншот в `tools/tests/screenshots/`.
  2) Валидация UI на основе данных из `tools/inspect_db.py`.


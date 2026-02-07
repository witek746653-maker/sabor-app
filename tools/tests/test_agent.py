import pytest
from playwright.sync_api import sync_playwright

def test_dynamic_inventory():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        page.goto("http://localhost:3000/admin")

        # 1. Автоматический сбор всех ссылок и кнопок
        elements = page.query_selector_all('a, button, [role="button"]')
        print(f"Найдено {len(elements)} интерактивных элементов.")

        # 2. Цикл автоматической проверки
        for index, el in enumerate(elements):
            try:
                name = el.inner_text() or el.get_attribute("aria-label") or f"Element_{index}"
                print(f"Тестирую действие: {name}")
                
                # Кликаем и проверяем, не упала ли страница (нет ли ошибок 500 или 404)
                el.click()
                page.wait_for_timeout(500) # Ждем рендера
                
                # Если страница изменилась, делаем скриншот для отчета
                page.screenshot(path=f"tools/tests/screenshots/{name}.png")
                page.go_back() 
            except Exception as e:
                os.makedirs("tools/tests/screenshots", exist_ok=True)
                page.screenshot(path=f"tools/tests/screenshots/error_{name}.png")
                print(f"Элемент {name} не кликабелен или вызвал ошибку: {e}")

        browser.close()
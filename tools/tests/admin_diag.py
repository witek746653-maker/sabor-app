import asyncio
import os
from playwright.async_api import async_playwright

async def run_diagnostic():
    async with async_playwright() as p:
        # Запуск браузера
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1280, 'height': 800})
        page = await context.new_page()

        print("--- Начинаю вход в админку ---")
        await page.goto("https://sabor-dlv.ru/admin/login")
        
        # Логин
        await page.fill('input[placeholder*="логин"]', "78")
        await page.fill('input[placeholder*="••••••••"]', "roma5878")
        await page.click('button:has-text("Войти")')
        
        # Ждем загрузки основной страницы админки
        await page.wait_for_url("**/admin**")
        # Логин (используем более точные селекторы)
        await page.wait_for_selector('input')
        inputs = await page.query_selector_all('input')
        await inputs[0].fill("78") # Первый инпут - логин
        await inputs[1].fill("roma5878") # Второй - пароль
        
        print("Нажимаю кнопку...")
        await page.click('button:has-text("Войти")')
        
        # Ждем именно успешного перехода
        try:
            await page.wait_for_url(lambda url: "/admin" in url and "/login" not in url, timeout=10000)
            print("Переход в админку выполнен.")
        except:
            print("ОШИБКА: Не удалось войти. Сохраняю скриншот ошибки.")
            await page.screenshot(path="tools/tests/screenshots/login_error.png")
            return

        # Список страниц для скриншотов
        pages = [
            ("kitchen", "/admin/kitchen"),
            ("wine", "/admin/wine"),
            ("bar", "/admin/bar"),
            ("tea", "/admin/tea"),
            ("paintings", "/admin/paintings"),
            ("users", "/admin/users"),
            ("feedback", "/admin/feedback"),
            ("notifications", "/admin/notifications"),
            ("media", "/admin/media"),
            ("deploy", "/admin/deploy"),
            ("visibility", "/admin/visibility"),
            ("help", "/admin/help"),
        ]

        os.makedirs("tools/tests/screenshots", exist_ok=True)

        for name, url in pages:
            full_url = f"https://sabor-dlv.ru{url}"
            print(f"Переход на: {full_url}")
            try:
                await page.goto(full_url, wait_until="networkidle")
                await page.wait_for_timeout(1000) # Даем время на рендер
                screenshot_path = f"tools/tests/screenshots/{name}.png"
                await page.screenshot(path=screenshot_path, full_page=True)
                print(f"Скриншот сохранен: {screenshot_path}")
            except Exception as e:
                print(f"Ошибка на странице {name}: {e}")

        await browser.close()
        print("--- Диагностика завершена ---")

if __name__ == "__main__":
    asyncio.run(run_diagnostic())

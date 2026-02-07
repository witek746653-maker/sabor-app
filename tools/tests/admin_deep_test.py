import asyncio
import os
from playwright.async_api import async_playwright

async def run_deep_test():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # Увеличиваем таймаут для медленных страниц
        context = await browser.new_context(viewport={'width': 1280, 'height': 800})
        page = await context.new_page()
        
        current_errors = []
        
        def handle_request_failed(req):
            try:
                err_text = req.failure.error_text if (req.failure and hasattr(req.failure, 'error_text')) else "Unknown Error"
                current_errors.append(f"[NETFAIL] {req.url}: {err_text}")
            except:
                current_errors.append(f"[NETFAIL] {req.url}: Failed to get error text")

        page.on("requestfailed", handle_request_failed)
        page.on("response", lambda res: current_errors.append(f"[HTTP {res.status}] {res.url}") if res.status >= 400 else None)

        print("--- Старт глубокой диагностики ---")
        
        try:
            await page.goto("https://sabor-dlv.ru/admin/login", wait_until="networkidle")
            inputs = await page.query_selector_all('input')
            if len(inputs) < 2:
                print("Ошибка: не найдены поля ввода на странице логина.")
                return
            await inputs[0].fill("78")
            await inputs[1].fill("roma5878")
            await page.click('button:has-text("Войти")')
            await page.wait_for_url(lambda url: "/admin" in url and "/login" not in url, timeout=10000)
            print("Авторизация: OK")
        except Exception as e:
            print(f"Сбой при входе: {e}")
            return

        pages = [
            "kitchen", "wine", "bar", "tea", "paintings", 
            "users", "feedback", "notifications", "media", 
            "deploy", "visibility", "help"
        ]
        
        report_dir = "tools/tests/reports"
        os.makedirs(report_dir, exist_ok=True)

        for name in pages:
            url = f"https://sabor-dlv.ru/admin/{name}"
            print(f"Проверка {name}...", end=" ", flush=True)
            
            # Очищаем ошибки перед каждой страницей
            current_errors.clear()
            
            try:
                await page.goto(url, wait_until="networkidle", timeout=20000)
                await page.wait_for_timeout(2000) # Даем время на загрузку данных в таблицы
                
                # Базовая проверка: не пустая ли страница
                content = await page.content()
                if len(content) < 1000:
                    current_errors.append("Страница выглядит пустой (менее 1000 символов кода)")

                if current_errors:
                    print("❌ ОШИБКИ!")
                    with open(f"{report_dir}/{name}_logs.txt", "w", encoding="utf-8") as f:
                        f.write("\n".join(current_errors))
                    await page.screenshot(path=f"{report_dir}/BAD_{name}.png", full_page=True)
                else:
                    print("✅ OK")

            except Exception as e:
                print(f"🔥 КРАШ! {e}")
                await page.screenshot(path=f"{report_dir}/CRASH_{name}.png", full_page=True)

        await browser.close()
        print(f"--- Диагностика завершена. Отчеты в {report_dir} ---")

if __name__ == "__main__":
    asyncio.run(run_deep_test())

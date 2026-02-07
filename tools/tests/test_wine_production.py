import asyncio
import os
from playwright.async_api import async_playwright

async def test_wine_production():
    async with async_playwright() as p:
        # Запуск браузера
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1280, 'height': 800})
        page = await context.new_page()

        os.makedirs("tools/tests/screenshots", exist_ok=True)

        print("--- Проверка винного каталога ---")
        try:
            await page.goto("https://sabor-dlv.ru/wine-catalog", wait_until="networkidle")
            await page.wait_for_timeout(2000)
            
            # Проверяем наличие вина (хотя бы одна карточка)
            wine_cards = await page.query_selector_all('a[href*="/wine/"]')
            print(f"Найдено вин в каталоге: {len(wine_cards)}")
            
            await page.screenshot(path="tools/tests/screenshots/prod_wine_catalog.png", full_page=True)
            if len(wine_cards) == 0:
                print("ВНИМАНИЕ: Винный каталог кажется пустым!")
        except Exception as e:
            print(f"Ошибка при проверке каталога: {e}")

        print("\n--- Проверка винного генератора (Wine List Builder) ---")
        try:
            await page.goto("https://sabor-dlv.ru/wine-list-builder", wait_until="networkidle")
            await page.wait_for_timeout(1000)

            # 1. Вводим название
            await page.fill('input[placeholder*="Например: Riesling Estate"]', "Test Production Wine")
            
            # 2. Выбираем страну (через инпут с datalist)
            await page.fill('input[placeholder*="Выберите страну"]', "Италия")
            
            # 3. Выбираем тип (находим кнопку 'Белое')
            await page.click('button:has-text("Белое")')
            
            # 4. Добавляем в список
            await page.click('button:has-text("Добавить в список")')
            await page.wait_for_timeout(500)
            
            # 5. Проверяем, появилось ли в списке
            list_items = await page.query_selector_all('article')
            print(f"Элементов в списке генератора: {len(list_items)}")
            
            await page.screenshot(path="tools/tests/screenshots/prod_wine_builder.png", full_page=True)
            
            if len(list_items) > 0:
                item_text = await list_items[0].inner_text()
                if "Test Production Wine" in item_text:
                    print("УСПЕХ: Вино успешно добавлено в список генератора.")
                else:
                    print("ОШИБКА: Текст вина не найден в списке.")
            else:
                print("ОШИБКА: Список генератора пуст после добавления.")

        except Exception as e:
            print(f"Ошибка при проверке генератора: {e}")

        await browser.close()
        print("\n--- Проверка завершена. Скриншоты в tools/tests/screenshots/ ---")

if __name__ == "__main__":
    asyncio.run(test_wine_production())

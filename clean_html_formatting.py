"""
Скрипт для очистки HTML-разметки в menu-database.json
Удаляет лишние атрибуты (class, id, start, type) из всех HTML-тегов
Объединяет несколько <ol> в один и форматирует красиво
Удаляет пустые теги <p>
"""

import json
import re


def clean_html_content(html_text):
    """
    Очищает HTML-разметку: убирает атрибуты из всех тегов, объединяет списки, форматирует
    """
    if not html_text or not isinstance(html_text, str):
        return html_text
    
    # Если нет HTML-тегов, возвращаем как есть
    if '<' not in html_text:
        return html_text
    
    # Шаг 1: Удаляем атрибуты class, id, start, type из всех HTML-тегов
    # Обрабатываем все теги, не только <ol> и <li>
    
    # Сначала исправляем обрезанные теги типа "p>" на "<p>"
    html_text = re.sub(r'(\s|^)p>', r'\1<p>', html_text)
    
    # Удаляем class="" или class="..." из любых тегов (включая пустые кавычки)
    html_text = re.sub(r'\s+class="[^"]*"', '', html_text)
    html_text = re.sub(r'\s+class=\'[^\']*\'', '', html_text)
    
    # Удаляем id="..." из любых тегов
    html_text = re.sub(r'\s+id="[^"]*"', '', html_text)
    html_text = re.sub(r'\s+id=\'[^\']*\'', '', html_text)
    
    # Удаляем start="..." из <ol> тегов (start не нужен, нумерация начинается с 1)
    html_text = re.sub(r'\s+start="[^"]*"', '', html_text)
    html_text = re.sub(r'\s+start=\'[^\']*\'', '', html_text)
    
    # НЕ удаляем type из <ol> тегов - он нужен для явного указания нумерации арабскими цифрами
    # type="1" означает арабские цифры (1, 2, 3...)
    
    # Убираем лишние пробелы в открывающих тегах (например, "<p >" -> "<p>")
    html_text = re.sub(r'<(\w+)\s+>', r'<\1>', html_text)
    
    # Шаг 2: Удаляем пустые теги <p></p> или <p><strong></strong></p>
    html_text = re.sub(r'<p>\s*</p>', '', html_text)
    html_text = re.sub(r'<p>\s*<strong>\s*</strong>\s*</p>', '', html_text)
    html_text = re.sub(r'<p>\s*<strong></strong>\s*</p>', '', html_text)
    
    # Шаг 3: Если есть только теги <p> без содержимого, удаляем их
    html_text = re.sub(r'<p>\s*(\n\s*)?</p>', '', html_text)
    
    # Шаг 4: Объединяем несколько <ol> в один (обрабатываем списки)
    if '<ol' in html_text:
        # Находим все <ol>...</ol> блоки
        ol_pattern = r'<ol[^>]*>(.*?)</ol>'
        ol_blocks = re.findall(ol_pattern, html_text, re.DOTALL)
        
        if ol_blocks:
            # Извлекаем все <li> элементы из всех <ol> блоков
            all_li_items = []
            for block in ol_blocks:
                li_pattern = r'<li[^>]*>(.*?)</li>'
                li_items = re.findall(li_pattern, block, re.DOTALL)
                for li_content in li_items:
                    all_li_items.append(li_content.strip())
            
            if all_li_items:
                # Формируем новый чистый <ol> список с type="1" для нумерации арабскими цифрами
                clean_li_list = []
                for li_content in all_li_items:
                    clean_li_list.append(f'  <li>{li_content}</li>')
                
                formatted_list = '<ol type="1">\n' + '\n'.join(clean_li_list) + '\n</ol>'
                
                # Сохраняем текст до первого <ol>
                text_before = ''
                first_ol_pos = html_text.find('<ol')
                if first_ol_pos > 0:
                    text_before = html_text[:first_ol_pos].strip()
                
                # Сохраняем текст после последнего </ol>
                text_after = ''
                last_ol_end = html_text.rfind('</ol>')
                if last_ol_end >= 0:
                    text_after = html_text[last_ol_end + 6:].strip()  # 6 = длина '</ol>'
                    
                    # Убираем оставшиеся теги <p> из text_after, если они есть
                    text_after = re.sub(r'<p>\s*</p>', '', text_after)
                    text_after = re.sub(r'<p>\s*<strong>\s*</strong>\s*</p>', '', text_after)
                
                # Собираем результат
                result_parts = []
                if text_before:
                    # Убираем пустые <p> из text_before
                    text_before = re.sub(r'<p>\s*</p>', '', text_before)
                    text_before = re.sub(r'<p>\s*<strong>\s*</strong>\s*</p>', '', text_before)
                    if text_before.strip():
                        result_parts.append(text_before.strip())
                
                result_parts.append(formatted_list)
                
                if text_after and text_after.strip():
                    result_parts.append(text_after.strip())
                
                html_text = '\n\n'.join(result_parts)
    
    # Шаг 5: Очищаем оставшиеся пустые теги <p> по всему тексту
    html_text = re.sub(r'<p>\s*</p>', '', html_text)
    html_text = re.sub(r'<p>\s*<strong>\s*</strong>\s*</p>', '', html_text)
    html_text = re.sub(r'<p>\s*\n\s*</p>', '', html_text)
    
    # Шаг 6: Убираем пустые строки в начале и конце
    html_text = html_text.strip()
    
    # Шаг 7: Если остались только теги <p> с содержимым (но не <ol>), обрабатываем их
    if '<p' in html_text and '<ol' not in html_text:
        # Убираем теги <p>, оставляя только содержимое
        html_text = re.sub(r'<p[^>]*>', '', html_text)
        html_text = re.sub(r'</p>', '', html_text)
        html_text = html_text.strip()
    
    # Шаг 8: Добавляем type="1" ко всем тегам <ol>, которые его не имеют
    # Это нужно для явного указания нумерации арабскими цифрами (1, 2, 3...)
    def add_type_to_ol(match):
        ol_tag = match.group(0)
        # Если type уже есть, не добавляем
        if 'type=' in ol_tag:
            return ol_tag
        # Иначе добавляем type="1" после <ol
        return ol_tag.replace('<ol', '<ol type="1"', 1)
    
    html_text = re.sub(r'<ol(?:\s+[^>]*)?>', add_type_to_ol, html_text)
    
    return html_text


def process_json_file(file_path):
    """
    Обрабатывает JSON файл, очищая HTML в полях contains
    """
    print(f"Загрузка файла: {file_path}")
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print(f"Найдено записей: {len(data)}")
    processed_count = 0
    
    # Обрабатываем каждую запись
    for idx, item in enumerate(data, 1):
        changed = False
        
        # Обрабатываем поле contains
        if 'contains' in item and item['contains']:
            old_value = item['contains']
            new_value = clean_html_content(old_value)
            if old_value != new_value:
                item['contains'] = new_value
                changed = True
        
        # Обрабатываем поле features (тоже может содержать HTML с атрибутами)
        if 'features' in item and item['features']:
            old_value = item['features']
            new_value = clean_html_content(old_value)
            if old_value != new_value:
                item['features'] = new_value
                changed = True
        
        # Обрабатываем поле i18n.en.contains-en
        if 'i18n' in item and isinstance(item['i18n'], dict):
            if 'en' in item['i18n'] and isinstance(item['i18n']['en'], dict):
                if 'contains-en' in item['i18n']['en'] and item['i18n']['en']['contains-en']:
                    old_value = item['i18n']['en']['contains-en']
                    new_value = clean_html_content(old_value)
                    if old_value != new_value:
                        item['i18n']['en']['contains-en'] = new_value
                        changed = True
        
        if changed:
            processed_count += 1
            if processed_count % 50 == 0:
                print(f"  Обработано записей: {processed_count}...")
    
    print(f"\nВсего обработано записей: {processed_count}")
    
    # Сохраняем результат
    output_path = file_path
    print(f"Сохранение в файл: {output_path}")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print("Готово!")
    print("\nПримечание: В JSON файле строковые значения всегда отображаются как одна строка")
    print("в кавычках, даже если внутри есть \\n. Это нормально - символы \\n будут работать")
    print("при отображении HTML в браузере.")


if __name__ == '__main__':
    file_path = 'data/menu-database.json'
    process_json_file(file_path)

"""
Скрипт для форматирования JSON с визуальным разбиением HTML строк
Использует кастомный форматтер для разбиения длинных HTML строк на несколько строк
"""

import json
import re


def format_json_with_html_multiline(obj, indent=2, current_indent=0):
    """
    Форматирует JSON с визуальным разбиением HTML строк на несколько строк
    """
    spaces = ' ' * current_indent
    next_indent = current_indent + indent
    
    if isinstance(obj, dict):
        if not obj:
            return '{}'
        items = []
        for key, value in obj.items():
            key_str = f'"{key}": '
            
            if isinstance(value, str) and ('<ol' in value or '<li' in value or '\\n' in json.dumps(value)):
                # Для HTML строк используем многострочный формат
                formatted_value = format_html_string_for_json(value, next_indent)
                items.append(f'{spaces}  {key_str}{formatted_value}')
            elif isinstance(value, (dict, list)):
                formatted_value = format_json_with_html_multiline(value, indent, next_indent)
                items.append(f'{spaces}  {key_str}{formatted_value}')
            else:
                value_str = json.dumps(value, ensure_ascii=False)
                items.append(f'{spaces}  {key_str}{value_str}')
        
        return '{\n' + ',\n'.join(items) + '\n' + spaces + '}'
    
    elif isinstance(obj, list):
        if not obj:
            return '[]'
        items = []
        for item in obj:
            if isinstance(item, str) and ('<ol' in item or '<li' in item or '\\n' in json.dumps(item)):
                formatted_item = format_html_string_for_json(item, next_indent)
                items.append(f'{spaces}  {formatted_item}')
            elif isinstance(item, (dict, list)):
                formatted_item = format_json_with_html_multiline(item, indent, next_indent)
                items.append(f'{spaces}  {formatted_item}')
            else:
                item_str = json.dumps(item, ensure_ascii=False)
                items.append(f'{spaces}  {item_str}')
        return '[\n' + ',\n'.join(items) + '\n' + spaces + ']'
    
    else:
        return json.dumps(obj, ensure_ascii=False)


def format_html_string_for_json(html_str, base_indent):
    """
    Форматирует HTML строку для JSON, разбивая её визуально
    Использует массив строк, который затем объединяется
    """
    if '\n' in html_str:
        # Разбиваем строку по \n
        lines = html_str.split('\n')
        indent_str = ' ' * base_indent
        
        # Создаем массив строк в JSON
        # Это нестандартный подход, но позволяет визуально разбить HTML
        # Вместо этого используем простое форматирование с экранированием
        
        # Экранируем каждую строку
        escaped_lines = []
        for line in lines:
            # Экранируем специальные символы для JSON
            escaped = line.replace('\\', '\\\\').replace('"', '\\"').replace('\t', '\\t')
            escaped_lines.append(f'"{escaped}"')
        
        # Объединяем строки с переносами
        result = '[\n'
        for i, escaped_line in enumerate(escaped_lines):
            if i < len(escaped_lines) - 1:
                result += f'{indent_str}  {escaped_line} + "\\n" +\n'
            else:
                result += f'{indent_str}  {escaped_line}\n'
        result += f'{indent_str}].join("")'
        
        return result
    else:
        # Если нет переносов, просто экранируем стандартно
        return json.dumps(html_str, ensure_ascii=False)


# На самом деле, стандартный JSON не поддерживает конкатенацию строк
# Поэтому используем более простой подход - просто убеждаемся, что \n правильно вставлены

if __name__ == '__main__':
    print("Этот скрипт показывает, что стандартный JSON не поддерживает визуальное разбиение строк.")
    print("В JSON файле строковые значения всегда в кавычках на одной строке.")
    print("Символы \\n внутри строки работают правильно при отображении HTML.")

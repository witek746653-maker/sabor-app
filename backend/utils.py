
import os
from datetime import datetime
import json

def env_bool(name: str, default_val: bool = False) -> bool:
    raw = (os.getenv(name) or "").strip().lower()
    if raw == "":
        return default_val
    return raw in ("1", "true", "yes", "y", "on")

def env_int(name: str, default_val: int) -> int:
    try:
        return int(str(os.getenv(name, str(default_val))).strip())
    except Exception:
        return default_val

def deep_merge_dicts(base: dict, override: dict) -> dict:
    """
    KISS deep merge для словарей.
    - base: "скелет"
    - override: "источник правды"
    """
    if not isinstance(base, dict):
        base = {}
    if not isinstance(override, dict):
        override = {}
    out = dict(base)
    for k, v in override.items():
        if isinstance(out.get(k), dict) and isinstance(v, dict):
            out[k] = deep_merge_dicts(out[k], v)
        else:
            out[k] = v
    return out

def safe_json_load(raw, fallback):
    try:
        return json.loads(raw) if raw else fallback
    except Exception:
        return fallback

def parse_datetime_local(value):
    """
    Преобразует строку вида '2026-01-28T10:30' в datetime.
    """
    if not value:
        return None
    if not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError:
        return None

def text_contains(value: str, keywords: list[str]) -> bool:
    """
    Проверяет, что строка содержит одно из ключевых слов.
    """
    if not value:
        return False
    value_lower = str(value).lower()
    return any(k in value_lower for k in keywords if k)

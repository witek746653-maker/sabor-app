import re
from flask import Flask, jsonify, request, send_from_directory, send_file
from flask_cors import CORS
from flask_login import LoginManager, login_required, login_user, logout_user, UserMixin
from pathlib import Path
from datetime import timedelta, datetime
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
import json
import os
import mimetypes
import threading
import time
import subprocess
import signal
import logging
import urllib.request
import urllib.error
import uuid
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
from models import (
    db,
    Dish,
    KitchenItem,
    WineItem,
    BarItem,
    TeaItem,
    Artwork,
    FeedbackMessage,
    Notification,
    User,
    VisibilityConfig,
    MediaLike,
    FavoriteItem,
)

try:
    # Sentry — сервис для сбора ошибок с сервера.
    # Важно: мы включаем ТОЛЬКО ошибки (без performance).
    import sentry_sdk
    from sentry_sdk.integrations.flask import FlaskIntegration
    from sentry_sdk.integrations.logging import LoggingIntegration
except Exception:  # pragma: no cover (sentry может быть не установлен локально)
    sentry_sdk = None



# На некоторых системах (особенно Windows) mimetypes может не знать про .webp
mimetypes.add_type("image/webp", ".webp")

def _text_contains(value: str, keywords: list[str]) -> bool:
    """
    Проверяет, что строка содержит одно из ключевых слов.
    Это нужно, потому что в данных "вино/бар" может быть записано не в menu,
    а в section, и названия могут отличаться.
    """
    if not value:
        return False
    value_lower = str(value).lower()
    return any(k in value_lower for k in keywords if k)

ALLOWED_MENUS_ORDER = [
    "Авторские завтраки",
    "Барное меню",
    "Вино",
    "Детское меню",
    "Зимнее меню",
    "Летние каникулы",
    "Основное меню",
    "Постное меню",
    "Специальное меню",
]

def _normalize_menu_value(val) -> str | None:
    """
    Нормализует значение menu.
    Важно: SQLAlchemy часто возвращает rows как кортежи вида ('Вино',),
    а нам нужна просто строка "Вино".
    """
    if val is None:
        return None
    # row tuple case: ('Вино',)
    if isinstance(val, (list, tuple)):
        if not val:
            return None
        val = val[0]
    if val is None:
        return None
    s = str(val).strip()
    if not s:
        return None
    # Нормализация (приведение к единому виду): поддерживаем старое имя.
    s_lower = s.lower()
    if "основное" in s_lower and "sabor de la vida" in s_lower:
        return "Основное меню"
    return s

ART_SOURCE_NAME = "Искусство в Sabor de la Vida"
WINE_KEYWORDS = ["вин", "wine"]
BAR_MENU_KEYWORDS = ["бар", "bar", "напит", "drink"]
BAR_SECTION_KEYWORDS = ["коктейл", "cocktail", "пиво", "beer", "кофе", "coffee", "напит", "drink"]
TEA_KEYWORDS = ["чай", "tea"]

def _is_art_item(item: dict) -> bool:
    if not isinstance(item, dict):
        return False
    source = str(item.get("source") or "").strip()
    if source == ART_SOURCE_NAME:
        return True
    item_id = str(item.get("id") or "").strip()
    return item_id.startswith("09")

def _classify_menu_item(item: dict) -> str:
    if _is_art_item(item):
        return "art"
    menu = item.get("menu")
    section = item.get("section")
    if _text_contains(menu, TEA_KEYWORDS) or _text_contains(section, TEA_KEYWORDS):
        return "tea"
    if _text_contains(menu, WINE_KEYWORDS) or _text_contains(section, WINE_KEYWORDS):
        return "wine"
    if _text_contains(menu, BAR_MENU_KEYWORDS) or _text_contains(section, BAR_SECTION_KEYWORDS):
        return "bar"
    return "kitchen"

def _split_menu_items(items: list[dict]) -> dict:
    out = {"kitchen": [], "wine": [], "bar": [], "tea": [], "art": []}
    for it in items or []:
        if not isinstance(it, dict):
            continue
        out[_classify_menu_item(it)].append(it)
    return out

def _load_json_list(path: Path) -> list[dict]:
    try:
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, list):
                return [x for x in data if isinstance(x, dict)]
    except Exception as e:
        app.logger.warning(f"Не удалось загрузить {path}: {e}")
    return []

def _load_items_from_paths(primary: Path, backup: Path) -> list[dict]:
    data = _load_json_list(primary)
    if data:
        return data
    return _load_json_list(backup)

def _ensure_split_menu_files():
    """
    Если новых файлов ещё нет, а legacy menu-database.json есть — разложим по файлам.
    """
    if MENU_KITCHEN_PATH.exists() or MENU_WINE_PATH.exists() or MENU_BAR_PATH.exists() or MENU_TEA_PATH.exists() or ART_DB_PATH.exists():
        return
    legacy = _load_items_from_paths(MENU_DB_PATH, MENU_DB_BACKUP_PATH)
    if not legacy:
        return
    parts = _split_menu_items(legacy)
    _atomic_write_json(MENU_KITCHEN_PATH, parts["kitchen"])
    _atomic_write_json(MENU_WINE_PATH, parts["wine"])
    _atomic_write_json(MENU_BAR_PATH, parts["bar"])
    _atomic_write_json(MENU_TEA_PATH, parts["tea"])
    _atomic_write_json(ART_DB_PATH, parts["art"])
    _atomic_write_json(MENU_KITCHEN_BACKUP_PATH, parts["kitchen"])
    _atomic_write_json(MENU_WINE_BACKUP_PATH, parts["wine"])
    _atomic_write_json(MENU_BAR_BACKUP_PATH, parts["bar"])
    _atomic_write_json(MENU_TEA_BACKUP_PATH, parts["tea"])
    _atomic_write_json(ART_DB_BACKUP_PATH, parts["art"])

def _load_menu_db_items() -> list[dict]:
    """
    Загружает список меню (кухня + вино + бар) из разделённых файлов.
    Фолбэк: legacy menu-database.json.
    """
    _ensure_split_menu_files()
    items = []
    kitchen = _load_items_from_paths(MENU_KITCHEN_PATH, MENU_KITCHEN_BACKUP_PATH)
    wine = _load_items_from_paths(MENU_WINE_PATH, MENU_WINE_BACKUP_PATH)
    bar = _load_items_from_paths(MENU_BAR_PATH, MENU_BAR_BACKUP_PATH)
    tea = _load_items_from_paths(MENU_TEA_PATH, MENU_TEA_BACKUP_PATH)
    if kitchen or wine or bar or tea:
        items.extend(kitchen)
        items.extend(wine)
        items.extend(bar)
        items.extend(tea)
        return items

    legacy = _load_items_from_paths(MENU_DB_PATH, MENU_DB_BACKUP_PATH)
    return [x for x in legacy if isinstance(x, dict) and not _is_art_item(x)]

def _load_art_db_items() -> list[dict]:
    """
    Загружает список картин из artworks.json.
    Фолбэк: фильтрация из legacy menu-database.json.
    """
    _ensure_split_menu_files()
    art = _load_items_from_paths(ART_DB_PATH, ART_DB_BACKUP_PATH)
    if art:
        return art
    legacy = _load_items_from_paths(MENU_DB_PATH, MENU_DB_BACKUP_PATH)
    return [x for x in legacy if isinstance(x, dict) and _is_art_item(x)]

def _load_wine_db_items() -> list[dict]:
    _ensure_split_menu_files()
    items = _load_items_from_paths(MENU_WINE_PATH, MENU_WINE_BACKUP_PATH)
    if items:
        return items
    return [x for x in _load_menu_db_items() if _text_contains(x.get("menu"), WINE_KEYWORDS) or _text_contains(x.get("section"), WINE_KEYWORDS)]

def _load_bar_db_items() -> list[dict]:
    _ensure_split_menu_files()
    items = _load_items_from_paths(MENU_BAR_PATH, MENU_BAR_BACKUP_PATH)
    if items:
        return items
    return [
        x
        for x in _load_menu_db_items()
        if _text_contains(x.get("menu"), BAR_MENU_KEYWORDS) or _text_contains(x.get("section"), BAR_SECTION_KEYWORDS)
    ]

def _load_tea_db_items() -> list[dict]:
    _ensure_split_menu_files()
    items = _load_items_from_paths(MENU_TEA_PATH, MENU_TEA_BACKUP_PATH)
    if items:
        return items
    return [
        x
        for x in _load_menu_db_items()
        if _text_contains(x.get("menu"), TEA_KEYWORDS) or _text_contains(x.get("section"), TEA_KEYWORDS)
    ]

def _menu_item_models():
    return (KitchenItem, WineItem, BarItem, TeaItem)

def _model_for_menu_item(item: dict):
    kind = _classify_menu_item(item)
    if kind == "wine":
        return WineItem
    if kind == "bar":
        return BarItem
    if kind == "tea":
        return TeaItem
    return KitchenItem

def _menu_item_exists(item_id: str) -> bool:
    norm_id = str(item_id or "").strip()
    if not norm_id:
        return False
    for model in _menu_item_models():
        if model.query.get(norm_id):
            return True
    return False

def _apply_menu_item_update(target, updated):
    target.menu = updated.menu
    target.section = updated.section
    target.title = updated.title
    target.description = updated.description
    target.contains = updated.contains
    target.allergens = updated.allergens
    target.tags = updated.tags
    target.pairings = updated.pairings
    target.image = updated.image
    target.i18n = updated.i18n

def _get_wines_dicts() -> list[dict]:
    """
    Возвращает список вин как список dict.
    Сначала пробуем БД; если пусто — берём из JSON.
    """
    try:
        # 1) Пытаемся взять из БД
        wines = WineItem.query.all()
        if wines:
            json_by_id = _load_menu_db_by_id()
            out = []
            for w in wines:
                base = w.to_dict()
                full = json_by_id.get(base.get("id")) if isinstance(json_by_id, dict) else None
                merged = _deep_merge_dicts(full or {}, base)
                out.append(_enrich_wine_dict(merged))
            return out

        # 2) Фолбэк: из JSON
        items = _load_wine_db_items()
        return [item for item in items]
    except Exception as e:
        app.logger.exception(f"Ошибка получения вин: {e}")
        return []

def _get_bar_items_dicts() -> list[dict]:
    """
    Возвращает список барных позиций как список dict.
    Сначала пробуем БД; если пусто — берём из JSON.
    """
    try:
        bar_items = BarItem.query.all()
        if bar_items:
            json_by_id = _load_menu_db_by_id()
            out = []
            for b in bar_items:
                base = b.to_dict()
                full = json_by_id.get(base.get("id")) if isinstance(json_by_id, dict) else None
                out.append(_deep_merge_dicts(full or {}, base))
            return out

        items = _load_bar_db_items()
        return [item for item in items]
    except Exception as e:
        app.logger.exception(f"Ошибка получения бара: {e}")
        return []

# Загружаем переменные окружения
load_dotenv()

# ==========================
# Sentry (backend): только ошибки
# ==========================
# Термины очень просто:
# - **переменная окружения** — настройка, которую задают на сервере “снаружи кода”.
# - **DSN** — адрес/идентификатор проекта Sentry, куда отправлять ошибки.
def _env_bool(name: str, default_val: bool = False) -> bool:
    raw = (os.getenv(name) or "").strip().lower()
    if raw == "":
        return default_val
    return raw in ("1", "true", "yes", "y", "on")


def _sentry_before_send(event, hint):
    """
    Убираем потенциально чувствительные поля (на всякий случай).
    Плюс защищаемся от случайной отправки токенов/паролей.
    """
    try:
        req = event.get("request") if isinstance(event, dict) else None
        if isinstance(req, dict):
            headers = req.get("headers")
            if isinstance(headers, dict):
                for key in list(headers.keys()):
                    if str(key).lower() in ("authorization", "cookie", "set-cookie"):
                        headers[key] = "[REDACTED]"

            data = req.get("data")
            if isinstance(data, dict):
                for key in list(data.keys()):
                    lk = str(key).lower()
                    if "password" in lk or "token" in lk or "secret" in lk:
                        data[key] = "[REDACTED]"
    except Exception:
        # Никогда не ломаем приложение из-за фильтра Sentry
        pass
    return event


def init_sentry_for_backend():
    """
    Инициализация Sentry для бэкенда.
    По умолчанию: если задан SENTRY_DSN — включаем.
    Можно явно выключить: SENTRY_ENABLED=false
    """
    if sentry_sdk is None:
        return

    dsn = (os.getenv("SENTRY_DSN") or "").strip()
    if not dsn:
        return

    enabled = _env_bool("SENTRY_ENABLED", True)
    if not enabled:
        return

    # Ловим:
    # - необработанные исключения Flask (500)
    # - ошибки, которые вы логируете как app.logger.error/exception (уровень ERROR)
    logging_integration = LoggingIntegration(level=None, event_level=logging.ERROR)

    sentry_sdk.init(
        dsn=dsn,
        integrations=[FlaskIntegration(), logging_integration],
        # Важно: Performance/трейсы выключаем полностью
        traces_sample_rate=0.0,
        # Не отправляем PII (личные данные) по умолчанию
        send_default_pii=False,
        # Окружение и релиз можно задать на сервере (необязательно)
        environment=(os.getenv("SENTRY_ENV") or os.getenv("FLASK_ENV") or "production").strip(),
        release=(os.getenv("SENTRY_RELEASE") or "").strip() or None,
        before_send=_sentry_before_send,
    )


init_sentry_for_backend()

# Создаём приложение Flask
app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'change-this-in-production-12345')
app.config['MAX_CONTENT_LENGTH'] = int(os.getenv('MAX_UPLOAD_MB', '50')) * 1024 * 1024  # Лимит увеличен до 50МБ

# Настройки для работы cookies (единый домен на Beget)
# На Beget фронтенд и бэкенд работают на одном домене, поэтому cross-domain не нужен
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'  # Защита от CSRF атак
# Важно:
# - True  = cookie будет отправляться ТОЛЬКО по HTTPS (это правильно для продакшена)
# - False = можно временно тестировать по http://IP (например, пока нет домена/SSL)
app.config['SESSION_COOKIE_SECURE'] = os.getenv('SESSION_COOKIE_SECURE', 'true').lower() == 'true'
app.config['SESSION_COOKIE_HTTPONLY'] = True    # Защита от XSS атак

# ===== "Долгая" авторизация (чтобы не выкидывало) =====
# Тех-термины:
# - "Сессия" (session): cookie, которая хранит состояние входа.
# - "Remember cookie": отдельная cookie от Flask-Login, которая позволяет восстановить вход даже после закрытия браузера.
#
# Важно: абсолютного "никогда" не бывает — пользователь может очистить cookies/сменить браузер и т.д.
def _env_int(name: str, default_val: int) -> int:
    try:
        return int(str(os.getenv(name, str(default_val))).strip())
    except Exception:
        return default_val

AUTH_SESSION_DAYS = _env_int("AUTH_SESSION_DAYS", 3650)    # 10 лет
AUTH_REMEMBER_DAYS = _env_int("AUTH_REMEMBER_DAYS", 3650)  # 10 лет

# Делаем "постоянную" сессию (permanent session) с большим временем жизни
app.permanent_session_lifetime = timedelta(days=max(AUTH_SESSION_DAYS, 1))
app.config["SESSION_REFRESH_EACH_REQUEST"] = True  # продлевает срок действия при активности

# Настройки remember-cookie (Flask-Login)
app.config["REMEMBER_COOKIE_DURATION"] = timedelta(days=max(AUTH_REMEMBER_DAYS, 1))
app.config["REMEMBER_COOKIE_HTTPONLY"] = True
app.config["REMEMBER_COOKIE_SECURE"] = app.config["SESSION_COOKIE_SECURE"]
app.config["REMEMBER_COOKIE_SAMESITE"] = app.config["SESSION_COOKIE_SAMESITE"]
app.config["REMEMBER_COOKIE_REFRESH_EACH_REQUEST"] = True

# Настройка базы данных SQLite
ROOT_DIR = Path(__file__).resolve().parent.parent

def _resolve_db_path() -> Path:
    """
    Возвращает путь к файлу SQLite.

    Почему это важно:
    - Если база лежит ВНУТРИ репозитория, её легко случайно удалить/пересоздать
      (например, при "чистой" пересборке/переносе/деплое).
    - Поэтому мы позволяем вынести базу в отдельную папку через переменную окружения.

    Переменные:
    - SABOR_DB_PATH (рекомендуется): полный путь к database.db (можно вне проекта)
    - DB_PATH (fallback): то же самое, если привычнее короткое имя
    """
    raw = (os.getenv("SABOR_DB_PATH") or os.getenv("DB_PATH") or "").strip()
    if raw:
        p = Path(raw)
        # Если путь относительный — считаем его относительно корня проекта
        if not p.is_absolute():
            p = (ROOT_DIR / p).resolve()
        return p
    # Дефолт (как было раньше)
    return ROOT_DIR / "backend" / "database.db"

DB_PATH = _resolve_db_path()
# Создаём папку для базы, если её ещё нет (иначе SQLite не сможет создать файл)
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

# ===== KISS-защита: понятная ошибка, если SQLite "read-only" =====
# Тех-термин: **SQLite** — это база данных “в одном файле”.
# Если этот файл (или папка, где он лежит) без прав на запись — любые операции сохранения будут падать.
def _is_readonly_db_error(err: Exception) -> bool:
    """
    Возвращает True, если похоже, что SQLite открыта "только для чтения".
    SQLAlchemy оборачивает ошибки, поэтому проверяем текст.
    """
    try:
        msg = str(err).lower()
    except Exception:
        return False
    return (
        "attempt to write a readonly database" in msg
        or "readonly database" in msg
        or ("read-only" in msg and "database" in msg)
    )


def _readonly_db_response():
    """
    Единый ответ для фронта, чтобы сразу было понятно, что чинить на сервере.
    """
    hint = (
        "База данных SQLite сейчас доступна только для чтения (нет прав на запись).\n"
        "Самый простой фикс: вынести файл базы в writable-папку и задать переменную окружения SABOR_DB_PATH.\n"
        f"Текущий путь к базе: {DB_PATH}"
    )
    return jsonify({"error": "DB_READONLY", "message": hint}), 503


def _log_db_writable_status():
    """
    Логируем статус прав на запись (чтобы это было видно в логах хостинга).
    """
    try:
        if DB_PATH.exists():
            can_write = os.access(str(DB_PATH), os.W_OK)
        else:
            can_write = os.access(str(DB_PATH.parent), os.W_OK)
        if not can_write:
            app.logger.warning(
                "SQLite DB path is NOT writable. Writes will fail. "
                "Set SABOR_DB_PATH to a writable location. "
                f"DB_PATH={DB_PATH}"
            )
    except Exception:
        # Не ломаем запуск, если что-то пошло не так при проверке прав
        pass
app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{DB_PATH}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False  # Отключаем отслеживание изменений (не нужно для SQLite)

# Инициализируем базу данных
db.init_app(app)
_log_db_writable_status()

# Разрешаем запросы с фронтенда (CORS)
# CORS — это правило "с каких адресов браузеру можно обращаться к вашему API".
# Важно: supports_credentials=True нужно для cookies (сессии Flask-Login).
#
# Рекомендуется явно перечислить домены через переменную окружения CORS_ORIGINS:
#   CORS_ORIGINS=https://example.ru,https://www.example.ru,http://localhost:3000
cors_origins_raw = os.getenv('CORS_ORIGINS', '').strip()
if cors_origins_raw:
    cors_origins = [o.strip() for o in cors_origins_raw.split(',') if o.strip()]
else:
    # Безопасный дефолт для разработки (и не мешает продакшену на одном домене)
    cors_origins = ['http://localhost:3000', 'http://127.0.0.1:3000']

CORS(
    app,
    supports_credentials=True,
    resources={r"/api/*": {"origins": cors_origins}},
    allow_headers=["Content-Type", "Authorization"],
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
)

# Настройка Flask-Login для аутентификации
login_manager = LoginManager()
login_manager.init_app(app)
# Для API не используем login_view (перенаправления не нужны)
# login_manager.login_view = 'admin_login'  # Если нужно, используйте имя функции

# Пути к директориям
IMAGES_DIR = ROOT_DIR / "images"
AUDIO_DIR = ROOT_DIR / "audio"
# Добавляем пути к директориям с HTML файлами и PDF
MENUS_DIR = ROOT_DIR / "frontend" / "public" / "menus"
TRAINER_DIR = ROOT_DIR / "frontend" / "public" / "trainer"
# Скрипты для статических HTML (поиск и т.п.)
SCRIPTS_DIR = ROOT_DIR / "frontend" / "public" / "scripts"
# Путь к собранному фронтенду (React build)
FRONTEND_BUILD_DIR = ROOT_DIR / "frontend" / "build"
FRONTEND_STATIC_DIR = FRONTEND_BUILD_DIR / "static"
FRONTEND_INDEX = FRONTEND_BUILD_DIR / "index.html"

# Путь к исходным данным меню (разделённые файлы + legacy для совместимости)
MENU_DB_DIR = ROOT_DIR / "data"
MENU_DB_PUBLIC_DIR = ROOT_DIR / "frontend" / "public" / "data"
MENU_KITCHEN_PATH = MENU_DB_DIR / "menu-kitchen.json"
MENU_WINE_PATH = MENU_DB_DIR / "menu-wine.json"
MENU_BAR_PATH = MENU_DB_DIR / "menu-bar.json"
MENU_TEA_PATH = MENU_DB_DIR / "menu-tea.json"
ART_DB_PATH = MENU_DB_DIR / "artworks.json"
MENU_KITCHEN_BACKUP_PATH = MENU_DB_PUBLIC_DIR / "menu-kitchen.json"
MENU_WINE_BACKUP_PATH = MENU_DB_PUBLIC_DIR / "menu-wine.json"
MENU_BAR_BACKUP_PATH = MENU_DB_PUBLIC_DIR / "menu-bar.json"
MENU_TEA_BACKUP_PATH = MENU_DB_PUBLIC_DIR / "menu-tea.json"
ART_DB_BACKUP_PATH = MENU_DB_PUBLIC_DIR / "artworks.json"
# Legacy (старый единый файл)
MENU_DB_PATH = MENU_DB_DIR / "menu-database.json"
MENU_DB_BACKUP_PATH = MENU_DB_PUBLIC_DIR / "menu-database.json"
_MENU_DB_BY_ID_CACHE = None
_MENU_DB_BY_ID_CACHE_PATH = None
_MENU_DB_BY_ID_CACHE_MTIME = None

FEEDBACK_UPLOAD_DIR = ROOT_DIR / "backend" / "static" / "uploads" / "feedback"

# Настройки "деплоя из админки" (по умолчанию выключено — это опасная операция)
ADMIN_DEPLOY_ENABLED = os.getenv("ADMIN_DEPLOY_ENABLED", "false").lower() == "true"
DEPLOY_ADMIN_TOKEN = os.getenv("DEPLOY_ADMIN_TOKEN", "").strip()
TELEGRAM_ENABLED = _env_bool("TELEGRAM_ENABLED", False)
TELEGRAM_BOT_TOKEN = (os.getenv("TELEGRAM_BOT_TOKEN") or "").strip()
TELEGRAM_CHAT_ID = (os.getenv("TELEGRAM_CHAT_ID") or "").strip()
_DEPLOY_STATE = {
    "status": "idle",  # idle | running | done | error
    "started_at": None,
    "finished_at": None,
    "step": None,
    "log": [],
    "error": None,
}

def _deploy_log(line: str):
    try:
        _DEPLOY_STATE["log"].append(str(line))
        # ограничим лог, чтобы не раздувался
        _DEPLOY_STATE["log"] = _DEPLOY_STATE["log"][-200:]
    except Exception:
        pass


def _send_telegram_message(text: str) -> bool:
    if not TELEGRAM_ENABLED:
        return False
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        return False
    try:
        payload = {
            "chat_id": TELEGRAM_CHAT_ID,
            "text": text,
            "disable_web_page_preview": True,
        }
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        req = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=6) as resp:
            _ = resp.read()
        return True
    except Exception as e:
        app.logger.warning(f"Telegram send failed: {e}")
        return False

def _safe_json_load(raw, fallback):
    try:
        return json.loads(raw) if raw else fallback
    except Exception:
        return fallback

def _get_file_size(file_storage) -> int:
    try:
        pos = file_storage.stream.tell()
        file_storage.stream.seek(0, os.SEEK_END)
        size = file_storage.stream.tell()
        file_storage.stream.seek(pos)
        return int(size)
    except Exception:
        return 0

def _save_feedback_attachments(files: list):
    allowed_ext = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
    saved = []
    FEEDBACK_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    files_list = list(files or [])
    if len(files_list) > 5:
        raise ValueError("Слишком много вложений")
    for f in files_list:
        if not f or not getattr(f, "filename", ""):
            continue
        raw_name = secure_filename(f.filename)
        ext = Path(raw_name).suffix.lower()
        if ext not in allowed_ext:
            raise ValueError("Неподдерживаемый тип файла")
        if not (f.mimetype or "").startswith("image/"):
            raise ValueError("Неподдерживаемый тип файла")
        size = _get_file_size(f)
        unique = f"{uuid.uuid4().hex}{ext or '.png'}"
        save_path = FEEDBACK_UPLOAD_DIR / unique
        f.save(save_path)
        saved.append({
            "url": f"/static/uploads/feedback/{unique}",
            "name": raw_name or unique,
            "size": size,
            "type": f.mimetype or "image/*",
        })
    return saved

def _require_admin():
    """
    Проверка прав: только авторизованный администратор.
    Возвращает (json, status) при ошибке, иначе None.
    """
    from flask_login import current_user
    if not current_user.is_authenticated:
        return jsonify({"error": "Not authenticated"}), 401
    user = User.query.get(current_user.id) if current_user.id not in (0, "guest") else None
    if not user or user.role != "администратор":
        return jsonify({"error": "Доступ запрещен"}), 403
    return None


VISIBILITY_ALLOWED_SCOPES = {
    "route",
    "menuItem",
    "menuSection",
    "pageBlock",
    "featureAction",
    "contentItem",
}

VISIBILITY_ALLOWED_ACTIONS = {"allow", "deny"}


def _get_visibility_actor_label():
    """
    Возвращает короткое имя того, кто меняет конфиг.
    """
    from flask_login import current_user
    try:
        user = User.query.get(current_user.id)
        if not user:
            return None
        username = (user.username or "").strip()
        name = (user.name or "").strip()
        if username and name and username != name:
            return f"{username} ({name})"
        return username or name or None
    except Exception:
        return None


def _validate_visibility_config(payload):
    """
    Минимальная ручная валидация JSON-конфига видимости.
    """
    if not isinstance(payload, dict):
        return "Payload must be an object"
    rules = payload.get("rules")
    if not isinstance(rules, list):
        return "rules must be an array"
    for idx, rule in enumerate(rules):
        if not isinstance(rule, dict):
            return f"rules[{idx}] must be an object"
        rule_id = rule.get("id")
        scope = rule.get("scope")
        target = rule.get("target")
        action = rule.get("action")
        enabled = rule.get("enabled", True)
        when = rule.get("when") if isinstance(rule.get("when"), dict) else None

        if not isinstance(rule_id, str) or not rule_id.strip():
            return f"rules[{idx}].id must be a non-empty string"
        if scope not in VISIBILITY_ALLOWED_SCOPES:
            return f"rules[{idx}].scope must be one of: {sorted(VISIBILITY_ALLOWED_SCOPES)}"
        if not isinstance(target, str) or not target.strip():
            return f"rules[{idx}].target must be a non-empty string"
        if action not in VISIBILITY_ALLOWED_ACTIONS:
            return f"rules[{idx}].action must be one of: {sorted(VISIBILITY_ALLOWED_ACTIONS)}"
        if not isinstance(enabled, bool):
            return f"rules[{idx}].enabled must be boolean"

        if when is not None:
            allowed_when_keys = {
                "roles",
                "isGuest",
                "isAdmin",
                "canWrite",
                "isAuthenticated",
                "userIds",
                "everyone",
            }
            for key in when.keys():
                if key not in allowed_when_keys:
                    return f"rules[{idx}].when has unknown key: {key}"
            roles = when.get("roles")
            user_ids = when.get("userIds")
            if roles is not None and (not isinstance(roles, list) or not all(isinstance(r, str) for r in roles)):
                return f"rules[{idx}].when.roles must be array of strings"
            if user_ids is not None and (not isinstance(user_ids, list) or not all(isinstance(u, (str, int)) for u in user_ids)):
                return f"rules[{idx}].when.userIds must be array of strings or numbers"
            for bool_key in ["isGuest", "isAdmin", "canWrite", "isAuthenticated", "everyone"]:
                if bool_key in when and not isinstance(when.get(bool_key), bool):
                    return f"rules[{idx}].when.{bool_key} must be boolean"
    return None


def _normalize_visibility_config(payload, version_override=None):
    """
    Проставляет дефолты и нормализует конфиг.
    """
    config = dict(payload or {})
    rules = config.get("rules") if isinstance(config.get("rules"), list) else []
    features = config.get("features") if isinstance(config.get("features"), dict) else {}
    normalized_rules = []
    for rule in rules:
        if not isinstance(rule, dict):
            continue
        normalized = dict(rule)
        normalized["id"] = str(normalized.get("id") or "").strip()
        normalized["scope"] = str(normalized.get("scope") or "").strip()
        normalized["target"] = str(normalized.get("target") or "").strip()
        normalized["action"] = str(normalized.get("action") or "").strip()
        normalized["enabled"] = bool(normalized.get("enabled", True))
        when = normalized.get("when")
        if isinstance(when, dict):
            normalized["when"] = dict(when)
        elif when is None:
            normalized["when"] = None
        else:
            normalized["when"] = None
        normalized_rules.append(normalized)
    # Нормализуем "фичи" (ярлык "в разработке" + разрешение доступа).
    # Формат:
    #   features: {
    #     workSchedule: { comingSoon: true, allowAccess: false },
    #     ...
    #   }
    normalized_features = {}
    for key, raw in (features or {}).items():
        try:
            feature_key = str(key).strip()
        except Exception:
            continue
        if not feature_key:
            continue
        raw_obj = raw if isinstance(raw, dict) else {}
        normalized_features[feature_key] = {
            "comingSoon": bool(raw_obj.get("comingSoon", False)),
            "allowAccess": bool(raw_obj.get("allowAccess", False)),
        }

    normalized_config = {
        "rules": normalized_rules,
        "features": normalized_features,
    }
    if isinstance(version_override, int):
        normalized_config["version"] = version_override
    elif isinstance(config.get("version"), int):
        normalized_config["version"] = config.get("version")
    return normalized_config

def _atomic_write_json(path: Path, data_obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    # Важно: сохраняем JSON "по-человечески" (с отступами), иначе он схлопывается в одну строку
    # и его становится сложно править руками.
    tmp.write_text(json.dumps(data_obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)

def _dedupe_menu_items(items: list[dict]):
    """
    Нормализует id (str + strip) и убирает дубликаты по id (оставляет последнюю запись).
    """
    unique_by_id = {}
    duplicates = 0
    skipped_no_id = 0
    for item in items:
        if not isinstance(item, dict):
            continue
        raw_id = item.get("id")
        if raw_id is None:
            skipped_no_id += 1
            continue
        norm_id = str(raw_id).strip()
        if not norm_id:
            skipped_no_id += 1
            continue
        item["id"] = norm_id
        if norm_id in unique_by_id:
            duplicates += 1
        unique_by_id[norm_id] = item
    return list(unique_by_id.values()), duplicates, skipped_no_id


def _deep_merge_dicts(base: dict, override: dict) -> dict:
    """
    KISS deep merge для словарей.
    - base: "скелет" (например, JSON с винными/барными доп. полями)
    - override: "источник правды" (например, БД/то, что прислал фронт)
    Правило: override всегда выигрывает; вложенные dict мёрджим рекурсивно.
    """
    if not isinstance(base, dict):
        base = {}
    if not isinstance(override, dict):
        override = {}
    out = dict(base)
    for k, v in override.items():
        if isinstance(out.get(k), dict) and isinstance(v, dict):
            out[k] = _deep_merge_dicts(out[k], v)
        else:
            out[k] = v
    return out


def _save_menu_db_items(items: list[dict], preserve_art: bool = True) -> tuple[int, int, int]:
    """
    Сохраняет меню в разделённых файлах + legacy menu-database.json.
    Возвращает (deduped_len, duplicates_removed, skipped_no_id).
    """
    items, duplicates, skipped_no_id = _dedupe_menu_items(items or [])
    parts = _split_menu_items(items)
    if preserve_art:
        parts["art"] = _load_art_db_items()

    _atomic_write_json(MENU_KITCHEN_PATH, parts["kitchen"])
    _atomic_write_json(MENU_WINE_PATH, parts["wine"])
    _atomic_write_json(MENU_BAR_PATH, parts["bar"])
    _atomic_write_json(MENU_TEA_PATH, parts["tea"])
    _atomic_write_json(ART_DB_PATH, parts["art"])
    _atomic_write_json(MENU_KITCHEN_BACKUP_PATH, parts["kitchen"])
    _atomic_write_json(MENU_WINE_BACKUP_PATH, parts["wine"])
    _atomic_write_json(MENU_BAR_BACKUP_PATH, parts["bar"])
    _atomic_write_json(MENU_TEA_BACKUP_PATH, parts["tea"])
    _atomic_write_json(ART_DB_BACKUP_PATH, parts["art"])

    combined = parts["kitchen"] + parts["wine"] + parts["bar"] + parts["tea"] + parts["art"]
    _atomic_write_json(MENU_DB_PATH, combined)
    _atomic_write_json(MENU_DB_BACKUP_PATH, combined)

    global _MENU_DB_BY_ID_CACHE, _MENU_DB_BY_ID_CACHE_PATH, _MENU_DB_BY_ID_CACHE_MTIME
    _MENU_DB_BY_ID_CACHE = None
    _MENU_DB_BY_ID_CACHE_PATH = None
    _MENU_DB_BY_ID_CACHE_MTIME = None
    return len(items), duplicates, skipped_no_id


def _upsert_menu_db_item(incoming: dict) -> bool:
    """
    Upsert (обновить/добавить) один элемент меню.
    """
    if not isinstance(incoming, dict):
        raise ValueError("incoming must be a dict")
    item_id = str(incoming.get("id") or "").strip()
    if not item_id:
        raise ValueError("incoming must have non-empty id")

    incoming = dict(incoming)
    incoming["id"] = item_id

    items = _load_menu_db_items()
    existed = False
    replaced = False

    for idx, it in enumerate(items):
        if not isinstance(it, dict):
            continue
        it_id = str(it.get("id") or "").strip()
        if it_id == item_id:
            items[idx] = _deep_merge_dicts(it, incoming)
            existed = True
            replaced = True
            break

    if not replaced:
        items.append(incoming)

    _save_menu_db_items(items, preserve_art=True)
    return existed


def _delete_menu_db_item(item_id: str) -> bool:
    """
    Удаляет элемент по id из меню.
    """
    norm_id = str(item_id or "").strip()
    if not norm_id:
        return False
    items = [it for it in _load_menu_db_items() if isinstance(it, dict)]
    before = len(items)
    items = [it for it in items if str(it.get("id") or "").strip() != norm_id]
    if len(items) == before:
        return False
    _save_menu_db_items(items, preserve_art=True)
    return True


def _get_all_dishes_dicts_with_json_fallback() -> list[dict]:
    """
    Возвращает ВСЕ позиции:
    - что есть в БД (источник правды для редактирования)
    - плюс то, что есть в JSON, но по какой-то причине отсутствует в БД (KISS-фолбэк)

    Важно: порядок берём из JSON, чтобы меню выглядело стабильно.
    """
    # 1) Берём всё из БД
    db_items = []
    db_items.extend(KitchenItem.query.all())
    db_items.extend(WineItem.query.all())
    db_items.extend(BarItem.query.all())
    db_items.extend(TeaItem.query.all())
    db_by_id = {}
    for d in db_items:
        try:
            dd = d.to_dict()
            if dd.get("id"):
                db_by_id[str(dd["id"]).strip()] = dd
        except Exception:
            continue

    # 2) Карту "полных" JSON-объектов по id (для доп. полей вина/бара)
    json_by_id = _load_menu_db_by_id()

    # 3) Идём по JSON в его порядке и собираем результат
    result = []
    seen = set()
    for it in _load_menu_db_items():
        if not isinstance(it, dict):
            continue
        item_id = str(it.get("id") or "").strip()
        if not item_id:
            continue
        # Если в JSON по ошибке есть дубликаты id — показываем только первый,
        # иначе в админке будут "двойники" одного и того же объекта.
        if item_id in seen:
            continue
        seen.add(item_id)
        if item_id in db_by_id:
            full = json_by_id.get(item_id) if isinstance(json_by_id, dict) else None
            result.append(_deep_merge_dicts(full or {}, db_by_id[item_id]))
        else:
            result.append(it)

    # 4) Добавляем то, что есть в БД, но отсутствует в JSON (например, добавили в админке)
    for item_id, db_item in db_by_id.items():
        if item_id in seen:
            continue
        full = json_by_id.get(item_id) if isinstance(json_by_id, dict) else None
        result.append(_deep_merge_dicts(full or {}, db_item))

    return result

def _rebuild_dishes_table_from_items(items: list[dict]):
    """
    Полностью перезаписывает таблицы кухни/вина/бара из списка items.
    """
    parts = _split_menu_items(items or [])

    KitchenItem.query.delete()
    WineItem.query.delete()
    BarItem.query.delete()
    TeaItem.query.delete()
    db.session.commit()

    success = 0
    for item in parts.get("kitchen", []):
        try:
            db.session.merge(KitchenItem.from_dict(item))
            success += 1
        except Exception:
            db.session.rollback()
    for item in parts.get("wine", []):
        try:
            db.session.merge(WineItem.from_dict(item))
            success += 1
        except Exception:
            db.session.rollback()
    for item in parts.get("bar", []):
        try:
            db.session.merge(BarItem.from_dict(item))
            success += 1
        except Exception:
            db.session.rollback()
    for item in parts.get("tea", []):
        try:
            db.session.merge(TeaItem.from_dict(item))
            success += 1
        except Exception:
            db.session.rollback()
    db.session.commit()
    return success

def _rebuild_artworks_table_from_items(items: list[dict]):
    parts = _split_menu_items(items or [])
    Artwork.query.delete()
    db.session.commit()
    success = 0
    for item in parts.get("art", []):
        try:
            db.session.merge(Artwork.from_dict(item))
            success += 1
        except Exception:
            db.session.rollback()
    db.session.commit()
    return success

def _load_menu_db_by_id():
    """
    Загружает меню (кухня/вино/бар) и строит словарь {id: full_item}.
    """
    db_map = {}
    for item in _load_menu_db_items():
        try:
            item_id = item.get("id")
            if item_id:
                db_map[item_id] = item
        except Exception:
            continue
    return db_map

def _enrich_wine_dict(wine_dict: dict) -> dict:
    """
    Подмешивает в ответ поля из menu-*.json, которых может не быть в БД.
    БД остаётся источником правды; мы добавляем только отсутствующие ключи.
    """
    if not wine_dict or not wine_dict.get("id"):
        return wine_dict

    full = _load_menu_db_by_id().get(wine_dict["id"])
    if not full:
        return wine_dict

    # Поля, которые нужны фронту для карточки вина
    extra_keys = [
        "origin",
        "region",
        "producer",
        "grapeVarieties",
        "features",
        "category",
        "alcoholContent",
    ]

    for k in extra_keys:
        if k not in wine_dict and k in full:
            wine_dict[k] = full.get(k)

    return wine_dict

# Класс для гостевого пользователя (не сохраняется в базе данных)
class GuestUser(UserMixin):
    """
    Гостевой пользователь для demo-режима.
    
    Это специальный класс, который не связан с базой данных.
    Используется только в рамках текущей сессии.
    
    UserMixin автоматически предоставляет свойства is_authenticated, is_active, is_anonymous
    как свойства только для чтения. Мы не переопределяем их, чтобы избежать конфликтов.
    """
    def __init__(self):
        # Используем специальный ID 'guest' вместо 0, чтобы избежать проблем с сериализацией
        self.id = 'guest'  # Специальный ID для гостя
        self.name = 'Гость'
        self.username = 'guest'
        self.role = 'guest'
        # НЕ устанавливаем is_authenticated, is_active, is_anonymous здесь!
        # UserMixin предоставляет их как свойства только для чтения
    
    def get_id(self):
        """Возвращает ID гостя как строку"""
        return str(self.id)
    
    # Переопределяем методы UserMixin для правильной работы с Flask-Login
    @property
    def is_authenticated(self):
        """Гость всегда считается аутентифицированным в рамках сессии"""
        return True
    
    @property
    def is_active(self):
        """Гость всегда активен"""
        return True
    
    @property
    def is_anonymous(self):
        """Гость не является анонимным (он авторизован как гость)"""
        return False
    
    def to_dict(self):
        """Преобразует объект гостя в словарь (для JSON ответа)"""
        return {
            'id': 0,  # Для фронтенда возвращаем 0, чтобы совпадало с ожидаемым форматом
            'name': self.name,
            'username': self.username,
            'role': self.role
        }

# Загрузка пользователя (для Flask-Login)
@login_manager.user_loader
def load_user(user_id):
    """Загружает пользователя по ID из базы данных"""
    try:
        # Проверяем, что user_id не пустой
        if not user_id:
            return None
        # Если ID = 'guest' или '0', это гость
        if str(user_id) == 'guest' or str(user_id) == '0':
            return GuestUser()
        # Иначе пытаемся преобразовать в int и загрузить из базы данных
        user_id_int = int(user_id)
        return User.query.get(user_id_int)
    except (ValueError, TypeError):
        # Если user_id не является числом, возвращаем None
        return None

# Вспомогательная функция для проверки прав доступа
def check_not_guest():
    """
    Проверяет, что текущий пользователь НЕ является гостем.
    
    Вызывает ошибку 403, если пользователь - гость.
    Используется для защиты эндпоинтов, которые требуют записи/изменения данных.
    """
    from flask_login import current_user
    if current_user.is_authenticated and (current_user.id == 0 or current_user.id == 'guest'):
        return jsonify({'error': 'Доступ запрещён. Гостевой режим поддерживает только просмотр данных.'}), 403
    return None

def check_admin_role():
    """
    Проверяет, что текущий пользователь - администратор.
    """
    from flask_login import current_user
    current_user_obj = User.query.get(current_user.id)
    if not current_user_obj or current_user_obj.role != 'администратор':
        return jsonify({'error': 'Доступ запрещен', 'message': 'Только администратор'}), 403
    return None


FAVORITE_ALLOWED_TYPES = {"catalog", "media", "article"}
FAVORITE_TYPE_ALIASES = {
    "catalog": "catalog",
    "dish": "catalog",
    "dishes": "catalog",
    "menu": "catalog",
    "media": "media",
    "article": "article",
    "articles": "article",
}


def _normalize_favorite_type(raw):
    key = str(raw or "").strip().lower()
    return FAVORITE_TYPE_ALIASES.get(key)


def _normalize_favorite_id(raw):
    value = str(raw or "").strip()
    return value or None


def _favorites_response(items):
    payload = {"catalog": [], "media": [], "articles": []}
    for fav in items:
        if fav.item_type == "catalog":
            payload["catalog"].append(fav.item_id)
        elif fav.item_type == "media":
            payload["media"].append(fav.item_id)
        elif fav.item_type == "article":
            payload["articles"].append(fav.item_id)
    return payload

def _parse_datetime_local(value):
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

# ========== ПУБЛИЧНЫЕ API (для посетителей) ==========

@app.route('/api/health', methods=['GET'])
def health_check():
    """
    Health check — простая проверка “жив ли сервис”.

    Зачем нужно:
    - для мониторинга (UptimeRobot и аналоги)
    - чтобы быстро понять: проблема в бэкенде, базе или данных

    Правило для вашего кейса (“меню должно быть всегда”):
    - 200 OK если можем отдать меню ХОТЯ БЫ из одного источника: БД или JSON
    - 503 если сервис жив, но данных меню нет нигде
    """
    db_ok = False
    json_ok = False
    db_count = None
    json_count = None

    # 1) Проверяем БД (лёгкий запрос)
    try:
        db_count = KitchenItem.query.count() + WineItem.query.count() + BarItem.query.count() + TeaItem.query.count()
        db_ok = True
    except Exception:
        db_ok = False

    # 2) Проверяем JSON fallback
    try:
        items = _load_menu_db_items()
        json_count = len(items) if isinstance(items, list) else 0
        json_ok = True
    except Exception:
        json_ok = False

    has_menu_data = (db_ok and (db_count or 0) > 0) or (json_ok and (json_count or 0) > 0)

    payload = {
        "status": "ok" if has_menu_data else "degraded",
        "menu_data": {
            "db_ok": db_ok,
            "db_count": db_count,
            "json_ok": json_ok,
            "json_count": json_count,
        },
    }

    return jsonify(payload), (200 if has_menu_data else 503)


@app.route('/api/config/visibility', methods=['GET'])
def get_visibility_config_public():
    """
    Публичный конфиг видимости (минимальная версия для UI).
    """
    try:
        published = (
            VisibilityConfig.query.filter_by(status="published")
            .order_by(VisibilityConfig.version.desc(), VisibilityConfig.updated_at.desc())
            .first()
        )
        if not published:
            response = jsonify({"version": 0, "rules": [], "features": {}})
        else:
            payload = published.to_dict()
            config = payload.get("config") if isinstance(payload.get("config"), dict) else {}
            response = jsonify({
                "version": int(payload.get("version") or 0),
                "rules": config.get("rules") or [],
                "features": config.get("features") or {},
                "updatedAt": payload.get("updated_at"),
            })
        response.headers["Cache-Control"] = "public, max-age=60"
        return response
    except Exception as e:
        return jsonify({"error": "VISIBILITY_CONFIG_ERROR", "message": str(e)}), 500

@app.route('/api/menu-json', methods=['GET'])
def get_menu_json():
    """
    DEV/KISS: отдаём split-меню напрямую (без базы данных).
    Это нужно для режима "правлю data/menu-*.json → F5 → сразу вижу в UI",
    даже если бэкенд запущен.
    """
    try:
        return jsonify(_load_menu_db_items())
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/dishes', methods=['GET'])
def get_dishes():
    """Возвращает все позиции (БД + JSON fallback)"""
    try:
        # Важно: в проде бывает ситуация, когда menu-*.json уже обновлён,
        # а БД ещё не мигрирована. Тогда админка видит "обрезанный" список.
        # KISS-решение: отдаём объединённый список (БД как источник правды + JSON как фолбэк).
        return jsonify(_get_all_dishes_dicts_with_json_fallback())
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/dishes/<dish_id>', methods=['GET'])
def get_dish(dish_id):
    """Возвращает одну позицию по ID (с fallback на JSON)"""
    try:
        dish_id_norm = str(dish_id or "").strip()
        if not dish_id_norm:
            return jsonify({'error': 'Dish not found'}), 404

        # 1) Пытаемся найти в БД
        dish = KitchenItem.query.get(dish_id_norm)
        if not dish:
            dish = WineItem.query.get(dish_id_norm)
        if not dish:
            dish = BarItem.query.get(dish_id_norm)
        if dish:
            base = dish.to_dict()
            full = _load_menu_db_by_id().get(dish_id_norm)
            return jsonify(_deep_merge_dicts(full or {}, base))

        # 2) Фолбэк: ищем в JSON по id
        from_json = _load_menu_db_by_id().get(dish_id_norm)
        if isinstance(from_json, dict):
            return jsonify(from_json)

        return jsonify({'error': 'Dish not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/menus', methods=['GET'])
def get_menus():
    """Возвращает список всех меню (уникальные значения поля 'menu')"""
    try:
        menu_set = set()

        # Берём всё из объединённого списка (БД + JSON)
        for item in _get_all_dishes_dicts_with_json_fallback():
            norm = _normalize_menu_value(item.get("menu"))
            if norm:
                menu_set.add(norm)

        # 3) Возвращаем ТОЛЬКО нужные меню и в нужном порядке
        filtered_ordered = [m for m in ALLOWED_MENUS_ORDER if m in menu_set]
        return jsonify(filtered_ordered)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/sections', methods=['GET'])
def get_sections():
    """Возвращает список всех разделов"""
    try:
        menu_name = request.args.get('menu')
        
        items = _get_all_dishes_dicts_with_json_fallback()
        if menu_name:
            items = [it for it in items if it.get("menu") == menu_name]
        section_list = [it.get("section") for it in items if it.get("section")]
        return jsonify(sorted(section_list))
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/images/<path:filename>')
def serve_image(filename):
    """Отдаёт изображения из папки images"""
    try:
        guessed_mime, _ = mimetypes.guess_type(filename)

        # 1) Сначала берём из React сборки (frontend/build/images/*).
        # Так обложки меню обновляются вместе с build и не залипают старые файлы.
        build_images_dir = FRONTEND_BUILD_DIR / "images"
        if build_images_dir.exists() and (build_images_dir / filename).exists():
            return send_from_directory(str(build_images_dir), filename, mimetype=guessed_mime)

        # 2) Фолбэк: корневая папка проекта /images (изображения блюд и т.п.)
        if IMAGES_DIR.exists() and (IMAGES_DIR / filename).exists():
            return send_from_directory(str(IMAGES_DIR), filename, mimetype=guessed_mime)

        return jsonify({'error': 'Image not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/audio/<path:filename>')
def serve_audio(filename):
    """Отдаёт аудиофайлы из папки audio"""
    try:
        audio_file = AUDIO_DIR / filename
        if AUDIO_DIR.exists() and audio_file.exists() and audio_file.is_file():
            return send_from_directory(str(audio_file.parent), audio_file.name)
        else:
            return jsonify({'error': f'Audio file not found: {filename}'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/private/menus/latest.pdf', methods=['GET'])
def get_latest_private_menu_pdf():
    from flask_login import current_user

    if not current_user.is_authenticated:
        return jsonify({"error": "Not authenticated"}), 401

    # Гостевой режим — это тоже "авторизация", но только для чтения публичных данных.
    # Поэтому гостя сюда НЕ пускаем.
    guest_check = check_not_guest()
    if guest_check:
        return guest_check

    # KISS: на сервере всегда хранится один актуальный файл.
    # Вы просто заменяете его при обновлении.
    pdf_path = ROOT_DIR / "backend" / "private" / "menus" / "latest.pdf"
    
    if not pdf_path.exists():
        return jsonify({"error": "File not found"}), 404

    # Термин **Content-Disposition**: заголовок, который говорит браузеру,
    # "Открывать в вкладке" (inline) или "Скачать" (attachment).
    # По умолчанию делаем скачивание (надежнее), а для кнопки "Открыть" передаем ?disposition=inline
    disposition = (request.args.get("disposition") or "").strip().lower()
    open_inline = disposition == "inline"

    # --- НАЧАЛО ВСТАВКИ: Формирование красивого имени ---
    
    # Исходное имя файла: "latest.pdf" (или любое, если вы решите хранить иначе)
    filename = pdf_path.name 
    
    # 1. Ищем дату (2026-01-02)
    match = re.search(r'(\d{4}-\d{2}-\d{2})', filename)
    
    if match:
        # 2. Превращаем строку в объект даты
        date_obj = datetime.strptime(match.group(1), "%Y-%m-%d")
        # 3. Форматируем в DD.MM.YYYY (02.01.2026)
        formatted_date = date_obj.strftime("%d.%m.%Y")
        # 4. Вставляем в название
        final_name = f"Комплекс для новых сотрудников (актуальный от {formatted_date}).pdf"
    else:
        # Запасной вариант, если дата в имени файла вдруг не найдется
        final_name = "Комплекс для новых сотрудников (актуальный).pdf"
        
    # --- КОНЕЦ ВСТАВКИ ---

    # Важно: запрещаем кеширование, иначе браузер/прокси могут "залипнуть" на старом PDF,
    # даже если вы уже заменили файл на сервере.
    response = send_file(
        str(pdf_path),
        mimetype="application/pdf",
        as_attachment=not open_inline,
        download_name=final_name,  # Подставляем сформированное имя
        conditional=False,
        etag=False,
        max_age=0,
    )
    response.headers["Cache-Control"] = "private, no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    response.headers["Vary"] = "Cookie"
    return response

@app.route('/menus/<path:filename>')
def serve_menu_html(filename):
    """Отдаёт HTML файлы и PDF из папки frontend/public/menus"""
    try:
        # Проверяем, что файл существует в директории меню
        file_path = MENUS_DIR / filename
        if MENUS_DIR.exists() and file_path.exists() and file_path.is_file():
            # Определяем MIME-тип на основе расширения файла
            if filename.endswith('.pdf'):
                return send_from_directory(str(MENUS_DIR), filename, mimetype='application/pdf')
            elif filename.endswith('.html'):
                return send_from_directory(str(MENUS_DIR), filename, mimetype='text/html')
            else:
                return send_from_directory(str(MENUS_DIR), filename)
        else:
            return jsonify({'error': f'File not found: {filename}'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/trainer/<path:filename>')
def serve_trainer_html(filename):
    """Отдаёт HTML файлы из папки frontend/public/trainer"""
    try:
        # Проверяем, что файл существует в директории тренажера
        file_path = TRAINER_DIR / filename
        if TRAINER_DIR.exists() and file_path.exists() and file_path.is_file():
            if filename.endswith('.html'):
                return send_from_directory(str(TRAINER_DIR), filename, mimetype='text/html')
            else:
                return send_from_directory(str(TRAINER_DIR), filename)
        else:
            return jsonify({'error': f'File not found: {filename}'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/scripts/<path:filename>')
def serve_public_scripts(filename):
    """Отдаёт статические скрипты для HTML страниц"""
    try:
        file_path = SCRIPTS_DIR / filename
        if SCRIPTS_DIR.exists() and file_path.exists() and file_path.is_file():
            return send_from_directory(str(SCRIPTS_DIR), filename)
        return jsonify({'error': f'File not found: {filename}'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ========== API ДЛЯ ВИН ==========

@app.route('/api/wines', methods=['GET'])
def get_wines():
    """Возвращает все вина (меню содержит 'вино' / 'wine' и т.п.)"""
    try:
        return jsonify(_get_wines_dicts())
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/wines/category/<category>', methods=['GET'])
def get_wines_by_category(category):
    """Возвращает вина по категории (by-glass/coravin/half-bottles)"""
    try:
        wines = _get_wines_dicts()
        filtered = [w for w in wines if isinstance(w, dict) and w.get("category") == category]
        return jsonify(filtered)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/wines/<wine_id>', methods=['GET'])
def get_wine(wine_id):
    """Возвращает одно вино по ID"""
    try:
        # 1) Пытаемся найти в БД
        wine_id_norm = str(wine_id or "").strip()
        wine = WineItem.query.get(wine_id_norm)
        if wine:
            base = wine.to_dict()
            full = _load_menu_db_by_id().get(base.get("id"))
            merged = _deep_merge_dicts(full or {}, base)
            return jsonify(_enrich_wine_dict(merged))

        # 2) Фолбэк: ищем в JSON по id
        wine_dict = _load_menu_db_by_id().get(wine_id_norm)
        if wine_dict and (_text_contains(wine_dict.get("menu"), WINE_KEYWORDS) or _text_contains(wine_dict.get("section"), WINE_KEYWORDS)):
            return jsonify(wine_dict)

        return jsonify({'error': 'Wine not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ========== API ДЛЯ БАРНОГО МЕНЮ ==========

@app.route('/api/bar-items', methods=['GET'])
def get_bar_items():
    """Возвращает все барные напитки (меню содержит 'бар' / 'напит' и т.п.)"""
    try:
        return jsonify(_get_bar_items_dicts())
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ========== ЛАЙКИ ДЛЯ МЕДИА ==========

@app.route('/api/media/likes', methods=['GET'])
@login_required
def get_media_likes():
    """
    Возвращает лайки по списку media_id.

    Пример: /api/media/likes?ids=media-001,media-002
    Ответ: { counts: {id: count}, likedByMe: {id: bool} }
    """
    try:
        ids_raw = request.args.get('ids', '')
        ids = [str(x).strip() for x in ids_raw.split(',') if str(x).strip()]
        # Сохраняем порядок и убираем дубли
        seen = set()
        ids = [x for x in ids if not (x in seen or seen.add(x))]

        if not ids:
            return jsonify({'counts': {}, 'likedByMe': {}})

        # Считаем лайки по каждому media_id
        rows = (
            db.session.query(MediaLike.media_id, func.count(MediaLike.id))
            .filter(MediaLike.media_id.in_(ids))
            .group_by(MediaLike.media_id)
            .all()
        )
        counts = {row[0]: int(row[1] or 0) for row in rows}

        # likedByMe для текущего пользователя (если это не гость)
        from flask_login import current_user
        user_id = current_user.id
        liked_by_me = {}
        if user_id not in (0, 'guest'):
            liked_rows = (
                db.session.query(MediaLike.media_id)
                .filter(MediaLike.media_id.in_(ids), MediaLike.user_id == int(user_id))
                .all()
            )
            liked_ids = {row[0] for row in liked_rows}
            liked_by_me = {media_id: (media_id in liked_ids) for media_id in ids}
        else:
            liked_by_me = {media_id: False for media_id in ids}

        # Заполняем нули для отсутствующих
        for media_id in ids:
            counts.setdefault(media_id, 0)
            liked_by_me.setdefault(media_id, False)

        return jsonify({'counts': counts, 'likedByMe': liked_by_me})
    except Exception as e:
        return jsonify({'error': 'MEDIA_LIKES_ERROR', 'message': str(e)}), 500


@app.route('/api/media/<media_id>/like-toggle', methods=['POST'])
@login_required
def toggle_media_like(media_id):
    """
    Переключает лайк текущего пользователя для media_id.
    Возвращает {count, likedByMe}.
    """
    # Запрещаем гостям
    guest_check = check_not_guest()
    if guest_check:
        return guest_check

    media_id_norm = str(media_id or '').strip()
    if not media_id_norm:
        return jsonify({'error': 'MEDIA_ID_REQUIRED', 'message': 'media_id обязателен'}), 400

    try:
        from flask_login import current_user
        user_id = int(current_user.id)

        existing = MediaLike.query.filter_by(media_id=media_id_norm, user_id=user_id).first()
        if existing:
            db.session.delete(existing)
            db.session.commit()
            liked_by_me = False
        else:
            db.session.add(MediaLike(media_id=media_id_norm, user_id=user_id))
            try:
                db.session.commit()
                liked_by_me = True
            except IntegrityError:
                # Если случилась гонка — просто перечитаем состояние
                db.session.rollback()
                still_exists = MediaLike.query.filter_by(
                    media_id=media_id_norm, user_id=user_id
                ).first()
                liked_by_me = bool(still_exists)

        count = MediaLike.query.filter_by(media_id=media_id_norm).count()
        return jsonify({'count': int(count), 'likedByMe': liked_by_me})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'MEDIA_LIKE_TOGGLE_ERROR', 'message': str(e)}), 500


# ========== ИЗБРАННОЕ ==========

@app.route('/api/favorites', methods=['GET'])
@login_required
def get_favorites():
    """
    Возвращает избранное текущего пользователя.
    Формат: { catalog: [], media: [], articles: [] }
    """
    guest_check = check_not_guest()
    if guest_check:
        return guest_check
    try:
        from flask_login import current_user
        user_id = int(current_user.id)
        items = FavoriteItem.query.filter_by(user_id=user_id).all()
        return jsonify(_favorites_response(items))
    except Exception as e:
        return jsonify({'error': 'FAVORITES_READ_ERROR', 'message': str(e)}), 500


@app.route('/api/favorites', methods=['POST'])
@login_required
def update_favorite():
    """
    Добавить/удалить/переключить один элемент избранного.
    Payload: { type, id, action } action: add | remove | toggle
    """
    guest_check = check_not_guest()
    if guest_check:
        return guest_check
    payload = request.json if isinstance(request.json, dict) else {}
    fav_type = _normalize_favorite_type(payload.get("type"))
    item_id = _normalize_favorite_id(payload.get("id"))
    action = str(payload.get("action") or "toggle").strip().lower()

    if not fav_type or fav_type not in FAVORITE_ALLOWED_TYPES:
        return jsonify({'error': 'FAVORITES_BAD_REQUEST', 'message': 'type обязателен'}), 400
    if not item_id:
        return jsonify({'error': 'FAVORITES_BAD_REQUEST', 'message': 'id обязателен'}), 400
    if action not in {"add", "remove", "toggle"}:
        return jsonify({'error': 'FAVORITES_BAD_REQUEST', 'message': 'action должен быть add/remove/toggle'}), 400

    try:
        from flask_login import current_user
        user_id = int(current_user.id)

        existing = FavoriteItem.query.filter_by(
            user_id=user_id, item_type=fav_type, item_id=item_id
        ).first()

        if action == "remove" or (action == "toggle" and existing):
            if existing:
                db.session.delete(existing)
                db.session.commit()
            return jsonify({'status': 'ok', 'type': fav_type, 'id': item_id, 'favorite': False})

        if not existing:
            db.session.add(FavoriteItem(user_id=user_id, item_type=fav_type, item_id=item_id))
            try:
                db.session.commit()
            except IntegrityError:
                db.session.rollback()
        return jsonify({'status': 'ok', 'type': fav_type, 'id': item_id, 'favorite': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'FAVORITES_UPDATE_ERROR', 'message': str(e)}), 500


@app.route('/api/favorites', methods=['PUT'])
@login_required
def replace_favorites():
    """
    Полностью заменить избранное пользователя.
    Payload: { catalog: [], media: [], articles: [] }
    """
    guest_check = check_not_guest()
    if guest_check:
        return guest_check
    payload = request.json if isinstance(request.json, dict) else {}

    def _parse_list(key):
        raw = payload.get(key)
        if raw is None:
            return []
        if not isinstance(raw, list):
            raise ValueError(f"{key} must be array")
        out = []
        for v in raw:
            norm = _normalize_favorite_id(v)
            if norm:
                out.append(norm)
        return out

    try:
        catalog = _parse_list("catalog")
        media = _parse_list("media")
        articles = _parse_list("articles")
    except ValueError as e:
        return jsonify({'error': 'FAVORITES_BAD_REQUEST', 'message': str(e)}), 400

    try:
        from flask_login import current_user
        user_id = int(current_user.id)

        FavoriteItem.query.filter_by(user_id=user_id).delete()

        for item_id in catalog:
            db.session.add(FavoriteItem(user_id=user_id, item_type="catalog", item_id=item_id))
        for item_id in media:
            db.session.add(FavoriteItem(user_id=user_id, item_type="media", item_id=item_id))
        for item_id in articles:
            db.session.add(FavoriteItem(user_id=user_id, item_type="article", item_id=item_id))

        db.session.commit()
        return jsonify({
            'status': 'ok',
            'counts': {
                'catalog': len(catalog),
                'media': len(media),
                'articles': len(articles),
            },
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'FAVORITES_REPLACE_ERROR', 'message': str(e)}), 500

# ========== АДМИНСКИЕ API (требуют авторизации) ==========

@app.route('/api/admin/login', methods=['POST'])
def admin_login():
    """Вход в систему с логином и паролем"""
    data = request.json
    username = data.get('username')
    password = data.get('password')
    # "Запомнить меня" (remember me): если True — вход сохранится надолго (remember cookie).
    # Если False — вход будет жить только в рамках текущей сессии браузера.
    remember = bool(data.get('remember')) if isinstance(data, dict) else False
    
    # Проверяем, что переданы оба поля
    if not username or not password:
        return jsonify({'error': 'Логин и пароль обязательны'}), 400
    
    # Ищем пользователя в базе данных по логину
    user = User.query.filter_by(username=username).first()
    
    # Проверяем, существует ли пользователь и правильный ли пароль
    if user and user.check_password(password):
        # Если remember=True — делаем сессию "permanent" и ставим remember-cookie.
        # Если remember=False — сессия будет "до закрытия браузера".
        from flask import session
        session.permanent = remember
        login_user(
            user,
            remember=remember,
            duration=app.config["REMEMBER_COOKIE_DURATION"] if remember else None,
        )
        return jsonify({'status': 'ok', 'message': 'Успешный вход', 'user': user.to_dict()})
    else:
        return jsonify({'error': 'Неверный логин или пароль'}), 401

@app.route('/api/admin/login/guest', methods=['POST'])
def guest_login():
    """Вход в гостевой (demo) режим без логина и пароля"""
    try:
        # Создаём гостевого пользователя
        guest = GuestUser()
        # Устанавливаем сессию для гостя
        # Используем remember=False, чтобы сессия была временной
        login_user(guest, remember=False)
        return jsonify({
            'status': 'ok',
            'message': 'Вход в гостевой режим',
            'user': guest.to_dict()
        })
    except Exception as e:
        # Логируем ошибку для отладки
        app.logger.error(f'Ошибка при входе гостя: {str(e)}')
        return jsonify({'error': f'Ошибка входа в гостевой режим: {str(e)}'}), 500

@app.route('/api/admin/logout', methods=['POST'])
def admin_logout():
    """
    Выход из системы.
    
    Работает как для обычных пользователей, так и для гостей.
    Декоратор @login_required не нужен, так как logout можно вызвать без авторизации.
    """
    logout_user()
    return jsonify({'status': 'ok'})

@app.route('/api/admin/check', methods=['GET'])
def check_auth():
    """Проверка авторизации и получение информации о текущем пользователе"""
    from flask_login import current_user
    if current_user.is_authenticated:
        # Если это гость (ID = 'guest' или 0)
        if current_user.id == 'guest' or current_user.id == 0:
            return jsonify({
                'authenticated': True,
                'user': current_user.to_dict()
            })
        # Иначе загружаем из базы данных
        user = User.query.get(current_user.id)
        return jsonify({
            'authenticated': True,
            'user': user.to_dict() if user else None
        })
    else:
        return jsonify({'authenticated': False})

@app.route('/api/admin/media/likes-counts', methods=['GET'])
@login_required
def admin_media_likes_counts():
    """
    Админ: вернуть количество лайков по списку media_id.
    Пример: /api/admin/media/likes-counts?ids=media-001,media-002
    """
    admin_check = _require_admin()
    if admin_check:
        return admin_check

    try:
        ids_raw = request.args.get('ids', '')
        ids = [str(x).strip() for x in ids_raw.split(',') if str(x).strip()]
        seen = set()
        ids = [x for x in ids if not (x in seen or seen.add(x))]

        if not ids:
            return jsonify({'counts': {}})

        rows = (
            db.session.query(MediaLike.media_id, func.count(MediaLike.id))
            .filter(MediaLike.media_id.in_(ids))
            .group_by(MediaLike.media_id)
            .all()
        )
        counts = {row[0]: int(row[1] or 0) for row in rows}
        for media_id in ids:
            counts.setdefault(media_id, 0)
        return jsonify({'counts': counts})
    except Exception as e:
        return jsonify({'error': 'ADMIN_MEDIA_LIKES_ERROR', 'message': str(e)}), 500

@app.route('/api/admin/dishes', methods=['POST'])
@login_required
def save_dishes():
    """Сохранение всех блюд (для админа)"""
    # Проверяем, что это не гость
    guest_check = check_not_guest()
    if guest_check:
        return guest_check
    try:
        data = request.json

        if not isinstance(data, list):
            return jsonify({'error': 'Payload must be a list'}), 400

        # Валидация: проверяем, что у каждого элемента есть ID
        for dish in data:
            if not isinstance(dish, dict) or not str(dish.get('id') or '').strip():
                return jsonify({'error': 'Each dish must have an id'}), 400

        # Дедупликация по id (в исходных данных иногда бывают дубли)
        items, duplicates, skipped_no_id = _dedupe_menu_items(data)

        # 1) Пишем split-JSON (и legacy для совместимости)
        deduped_len, _, _ = _save_menu_db_items(items)

        # 2) Пересобираем БД из этого же списка (KISS: удалить и заново залить)
        imported = _rebuild_dishes_table_from_items(items)

        return jsonify({
            'status': 'ok',
            'message': 'Данные сохранены',
            'received': len(data),
            'deduped': deduped_len,
            'duplicates_removed': duplicates,
            'skipped_no_id': skipped_no_id,
            'imported_to_db': imported,
        })
    except Exception as e:
        db.session.rollback()  # Откатываем изменения в случае ошибки
        if _is_readonly_db_error(e):
            return _readonly_db_response()
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/dishes/<dish_id>', methods=['PUT'])
@login_required
def update_dish(dish_id):
    """Обновление одной позиции (upsert)"""
    # Проверяем, что это не гость
    guest_check = check_not_guest()
    if guest_check:
        return guest_check
    try:
        dish_id_norm = str(dish_id or '').strip()
        if not dish_id_norm:
            return jsonify({'error': 'Dish not found'}), 404

        data = request.json
        if not isinstance(data, dict):
            return jsonify({'error': 'Payload must be an object'}), 400

        # Доверяем id из URL, чтобы не было “переименований” id через тело запроса
        data = dict(data)
        data['id'] = dish_id_norm

        # 1) Сохраняем в JSON (не теряя специфичных полей)
        _upsert_menu_db_item(data)

        # 2) Upsert в БД по нужной таблице
        target_model = _model_for_menu_item(data)
        updated_item = target_model.from_dict(data)

        # Удаляем запись из других таблиц, если категория изменилась
        for model in _menu_item_models():
            if model is target_model:
                continue
            existing_other = model.query.get(dish_id_norm)
            if existing_other:
                db.session.delete(existing_other)

        dish = target_model.query.get(dish_id_norm)
        if not dish:
            dish = updated_item
            db.session.add(dish)
        else:
            _apply_menu_item_update(dish, updated_item)

        db.session.commit()

        full = _load_menu_db_by_id().get(dish_id_norm)
        return jsonify({'status': 'ok', 'dish': _deep_merge_dicts(full or {}, dish.to_dict())})
    except Exception as e:
        db.session.rollback()
        if _is_readonly_db_error(e):
            return _readonly_db_response()
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/dishes', methods=['PUT'])
@login_required
def add_dish():
    """Добавление нового блюда"""
    # Проверяем, что это не гость
    guest_check = check_not_guest()
    if guest_check:
        return guest_check
    try:
        new_dish_data = request.json
        if not isinstance(new_dish_data, dict):
            return jsonify({'error': 'Payload must be an object'}), 400

        new_dish_data = dict(new_dish_data)
        dish_id_norm = str(new_dish_data.get('id') or '').strip()
        if not dish_id_norm:
            return jsonify({'error': 'Dish must have an id'}), 400
        new_dish_data['id'] = dish_id_norm

        # Проверяем, нет ли уже позиции с таким ID (и в БД, и в JSON)
        if _menu_item_exists(dish_id_norm) or _load_menu_db_by_id().get(dish_id_norm):
            return jsonify({'error': 'Dish with this id already exists'}), 400

        # 1) Сохраняем в JSON
        _upsert_menu_db_item(new_dish_data)

        # 2) Создаём в БД
        target_model = _model_for_menu_item(new_dish_data)
        new_dish = target_model.from_dict(new_dish_data)
        db.session.add(new_dish)
        db.session.commit()

        full = _load_menu_db_by_id().get(dish_id_norm)
        return jsonify({'status': 'ok', 'dish': _deep_merge_dicts(full or {}, new_dish.to_dict())})
    except Exception as e:
        db.session.rollback()
        if _is_readonly_db_error(e):
            return _readonly_db_response()
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/dishes/<dish_id>', methods=['DELETE'])
@login_required
def delete_dish(dish_id):
    """Удаление блюда"""
    # Проверяем, что это не гость
    guest_check = check_not_guest()
    if guest_check:
        return guest_check
    try:
        dish_id_norm = str(dish_id or '').strip()
        if not dish_id_norm:
            return jsonify({'error': 'Dish not found'}), 404

        deleted_any = False

        # 1) Удаляем из БД, если есть
        for model in _menu_item_models():
            dish = model.query.get(dish_id_norm)
            if dish:
                db.session.delete(dish)
                deleted_any = True

        # 2) Удаляем из JSON, если есть
        if _delete_menu_db_item(dish_id_norm):
            deleted_any = True

        if not deleted_any:
            return jsonify({'error': 'Dish not found'}), 404

        db.session.commit()
        return jsonify({'status': 'ok'})
    except Exception as e:
        db.session.rollback()
        if _is_readonly_db_error(e):
            return _readonly_db_response()
        return jsonify({'error': str(e)}), 500

# ========== API ДЛЯ ОБРАТНОЙ СВЯЗИ ==========

@app.route('/api/feedback', methods=['POST'])
def submit_feedback():
    """Отправка сообщения обратной связи"""
    # Проверяем, что это не гость
    from flask_login import current_user
    if current_user.is_authenticated and (current_user.id == 0 or current_user.id == 'guest'):
        return jsonify({'error': 'Доступ запрещён. Гостевой режим поддерживает только просмотр данных.'}), 403
    try:
        is_multipart = request.content_type and "multipart/form-data" in request.content_type
        if is_multipart:
            form = request.form or {}
            data = {
                "name": form.get("name"),
                "type": form.get("type"),
                "message": form.get("message"),
                "tags": _safe_json_load(form.get("tags"), []),
                "url": form.get("url"),
                "ts": form.get("ts"),
                "userAgent": form.get("userAgent"),
                "viewport": _safe_json_load(form.get("viewport"), {}),
                "build": form.get("build"),
            }
            attachments = _save_feedback_attachments(request.files.getlist("attachments"))
        else:
            # Если не мультипарт, всё равно пробуем взять из form (на всякий случай) или из json
            data = request.json or request.form or {}
            attachments = []

        # Проверяем, что есть текст сообщения
        if not data.get('message'):
            return jsonify({'error': 'Message is required', 'message': 'Message is required'}), 400

        meta = {
            "url": data.get("url", ""),
            "ts": data.get("ts", ""),
            "userAgent": data.get("userAgent", ""),
            "viewport": data.get("viewport", {}),
            "build": data.get("build", ""),
        }
        tags = data.get("tags") if isinstance(data.get("tags"), list) else []

        # Попытка определить имя пользователя на сервере
        user_name = data.get('name')
        if not user_name or user_name in ['Гость', '', None]:
            from flask_login import current_user
            if current_user.is_authenticated:
                # Проверяем все возможные варианты полей, которые могут быть в твоей модели User
                user_name = (
                    getattr(current_user, 'name', None) or 
                    getattr(current_user, 'fio', None) or 
                    getattr(current_user, 'username', None) or 
                    getattr(current_user, 'login', None) or 
                    f"Пользователь ID: {current_user.id}"
                )
        
        # Создаём новое сообщение
        feedback = FeedbackMessage(
            name=str(user_name) if user_name else 'Гость',
            type=data.get('type', 'question'),
            message=data.get('message'),
            tags_json=json.dumps(tags, ensure_ascii=False),
            meta_json=json.dumps(meta, ensure_ascii=False),
            attachments_json=json.dumps(attachments, ensure_ascii=False),
            read=False
        )

        # Сохраняем в базу данных
        db.session.add(feedback)
        db.session.commit()

        # Отправляем в Telegram (если включено)
        try:
            # Маппинг типов для красивого отображения в ТГ
            types_map = {
                'bug': '🔴 Не работает',
                'error': '📝 Ошибка текста',
                'wrong': '⚠️ Работает неправильно',
                'idea': '💡 Предложить улучшение',
                'question': '❓ Задать вопрос'
            }
            # Если тип не пришел или он пустой, пусть будет bug (🔴 Не работает)
            raw_type = data.get('type') or 'bug'
            display_type = types_map.get(raw_type, raw_type)

            message_lines = [
                "📩 Новое сообщение от пользователя",
                f"ID: {feedback.id}",
                f"Тип: {display_type}",
                f"Имя: {feedback.name or '—'}",
                f"URL: {meta.get('url') or '—'}",
                "Сообщение:",
                feedback.message or '',
            ]
            if attachments:
                message_lines.append(f"Вложения: {len(attachments)}")
                base_url = request.host_url.rstrip('/')
                for a in attachments:
                    file_url = a.get("url") or ""
                    if file_url:
                        # Меняем путь на /api/..., чтобы фронтенд-роутер не перехватывал ссылку
                        api_file_url = file_url.replace('/static/uploads/feedback/', '/api/feedback/attachments/')
                        full_url = f"{base_url}{api_file_url}"
                        message_lines.append(full_url)

            _send_telegram_message("\n".join(message_lines).strip())
        except Exception as e:
            app.logger.warning(f"Telegram notify failed: {e}")

        return jsonify({'status': 'ok', 'message': 'Сообщение отправлено', 'id': feedback.id})
    except ValueError as e:
        return jsonify({'error': str(e), 'message': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        if _is_readonly_db_error(e):
            return _readonly_db_response()
        return jsonify({'error': str(e), 'message': str(e)}), 500

@app.route('/api/admin/feedback', methods=['GET'])
@login_required
def get_feedback_messages():
    """Получение всех сообщений обратной связи (только для админа)"""
    # Проверяем, что это не гость
    guest_check = check_not_guest()
    if guest_check:
        return guest_check
    try:
        # Получаем все сообщения, отсортированные по дате (новые сначала)
        messages = FeedbackMessage.query.order_by(FeedbackMessage.created_at.desc()).all()
        
        # Преобразуем в список словарей
        return jsonify([msg.to_dict() for msg in messages])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/feedback/<int:message_id>/read', methods=['PUT'])
@login_required
def mark_feedback_read(message_id):
    """Отметить сообщение как прочитанное"""
    # Проверяем, что это не гость
    guest_check = check_not_guest()
    if guest_check:
        return guest_check
    try:
        # Ищем сообщение в базе данных
        message = FeedbackMessage.query.get(message_id)
        
        if not message:
            return jsonify({'error': 'Message not found'}), 404
        
        # Отмечаем как прочитанное
        message.read = True
        db.session.commit()
        
        return jsonify({'status': 'ok', 'message': message.to_dict()})
    except Exception as e:
        db.session.rollback()
        if _is_readonly_db_error(e):
            return _readonly_db_response()
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/feedback/<int:message_id>', methods=['DELETE'])
@login_required
def delete_feedback_message(message_id):
    """Удаление сообщения обратной связи"""
    # Проверяем, что это не гость
    guest_check = check_not_guest()
    if guest_check:
        return guest_check
    try:
        # Ищем сообщение в базе данных
        message = FeedbackMessage.query.get(message_id)
        
        if not message:
            return jsonify({'error': 'Message not found'}), 404
        
        # Удаляем сообщение
        db.session.delete(message)
        db.session.commit()
        
        return jsonify({'status': 'ok'})
    except Exception as e:
        db.session.rollback()
        if _is_readonly_db_error(e):
            return _readonly_db_response()
        return jsonify({'error': str(e)}), 500

# ========== ОТДАЧА ФАЙЛОВ ОБРАТНОЙ СВЯЗИ ==========

@app.route('/api/feedback/attachments/<path:filename>')
def serve_feedback_uploads(filename):
    """Отдача загруженных файлов (скриншоты, фото)"""
    return send_from_directory(FEEDBACK_UPLOAD_DIR, filename)

# ========== API ДЛЯ УВЕДОМЛЕНИЙ ==========

@app.route('/api/notifications', methods=['GET'])
def get_public_notifications():
    """
    Получение активных уведомлений для всех пользователей и гостей.
    """
    try:
        now = datetime.now()
        items = Notification.query.filter_by(status='active').order_by(Notification.created_at.desc()).all()
        result = []
        for item in items:
            # Если уведомление с датой истекло — не показываем
            if item.lifetime_type == 'date' and item.expires_at and item.expires_at <= now:
                continue
            result.append(item.to_dict())
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': 'Failed to load notifications', 'message': str(e)}), 500


@app.route('/api/admin/notifications', methods=['GET'])
@login_required
def get_admin_notifications():
    """
    Получение всех уведомлений (только для админа).
    """
    guest_check = check_not_guest()
    if guest_check:
        return guest_check
    admin_check = check_admin_role()
    if admin_check:
        return admin_check
    try:
        items = Notification.query.order_by(Notification.created_at.desc()).all()
        return jsonify([item.to_dict() for item in items])
    except Exception as e:
        return jsonify({'error': 'Failed to load notifications', 'message': str(e)}), 500


@app.route('/api/admin/notifications', methods=['POST'])
@login_required
def create_admin_notification():
    """
    Создание уведомления (только для админа).
    """
    guest_check = check_not_guest()
    if guest_check:
        return guest_check
    admin_check = check_admin_role()
    if admin_check:
        return admin_check
    try:
        data = request.json or {}
        title = data.get('title')
        message = data.get('message')
        lifetime_type = data.get('lifetimeType') or data.get('lifetime_type')
        expires_raw = data.get('expiresAt') or data.get('expires_at')
        status = data.get('status') or 'draft'

        if not title or not message:
            return jsonify({'error': 'Title and message are required', 'message': 'Заполните заголовок и текст'}), 400
        if not lifetime_type:
            return jsonify({'error': 'Lifetime type is required', 'message': 'Нужен срок жизни'}), 400
        if lifetime_type == 'date' and not expires_raw:
            return jsonify({'error': 'Expires date is required for date lifetime', 'message': 'Нужна дата окончания'}), 400

        expires_at = _parse_datetime_local(expires_raw) if lifetime_type == 'date' else None
        if lifetime_type == 'date' and not expires_at:
            return jsonify({'error': 'Invalid expiresAt format', 'message': 'Неверный формат даты'}), 400

        notification = Notification(
            title=title,
            message=message,
            category=data.get('category') or '',
            type=data.get('type') or 'announcement',
            lifetime_type=lifetime_type,
            expires_at=expires_at,
            author=data.get('author') or '',
            status=status
        )
        db.session.add(notification)
        db.session.commit()
        return jsonify({'status': 'ok', 'notification': notification.to_dict()})
    except Exception as e:
        db.session.rollback()
        if _is_readonly_db_error(e):
            return _readonly_db_response()
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/notifications/<int:notification_id>', methods=['PUT'])
@login_required
def update_admin_notification(notification_id):
    """
    Обновление уведомления (только для админа).
    """
    guest_check = check_not_guest()
    if guest_check:
        return guest_check
    admin_check = check_admin_role()
    if admin_check:
        return admin_check
    try:
        data = request.json or {}
        notification = Notification.query.get(notification_id)
        if not notification:
            return jsonify({'error': 'Notification not found', 'message': 'Уведомление не найдено'}), 404

        if 'title' in data:
            notification.title = data.get('title') or ''
        if 'message' in data:
            notification.message = data.get('message') or ''
        if 'category' in data:
            notification.category = data.get('category') or ''
        if 'type' in data:
            notification.type = data.get('type') or 'announcement'
        if 'author' in data:
            notification.author = data.get('author') or ''
        if 'status' in data:
            notification.status = data.get('status') or 'draft'

        if 'lifetimeType' in data or 'lifetime_type' in data:
            notification.lifetime_type = data.get('lifetimeType') or data.get('lifetime_type')

        if 'expiresAt' in data or 'expires_at' in data:
            expires_raw = data.get('expiresAt') or data.get('expires_at')
            notification.expires_at = _parse_datetime_local(expires_raw)

        if notification.lifetime_type == 'date' and not notification.expires_at:
            return jsonify({'error': 'Expires date is required for date lifetime', 'message': 'Нужна дата окончания'}), 400
        if notification.lifetime_type != 'date':
            notification.expires_at = None

        db.session.commit()
        return jsonify({'status': 'ok', 'notification': notification.to_dict()})
    except Exception as e:
        db.session.rollback()
        if _is_readonly_db_error(e):
            return _readonly_db_response()
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/notifications/<int:notification_id>', methods=['DELETE'])
@login_required
def delete_admin_notification(notification_id):
    """
    Удаление уведомления (только для админа).
    """
    guest_check = check_not_guest()
    if guest_check:
        return guest_check
    admin_check = check_admin_role()
    if admin_check:
        return admin_check
    try:
        notification = Notification.query.get(notification_id)
        if not notification:
            return jsonify({'error': 'Notification not found', 'message': 'Уведомление не найдено'}), 404
        db.session.delete(notification)
        db.session.commit()
        return jsonify({'status': 'ok'})
    except Exception as e:
        db.session.rollback()
        if _is_readonly_db_error(e):
            return _readonly_db_response()
        return jsonify({'error': str(e)}), 500

# ========== АДМИН: СТАТИСТИКА ДЛЯ САЙДБАРА ==========

@app.route('/api/admin/sidebar-stats', methods=['GET'])
@login_required
def get_admin_sidebar_stats():
    """
    Сводные счетчики для админ-сайдбара.
    """
    admin_check = _require_admin()
    if admin_check:
        return admin_check
    try:
        # Пользователи
        users_total = User.query.count()

        # Непрочитанная обратная связь
        feedback_unread = FeedbackMessage.query.filter_by(read=False).count()

        # Актуальные уведомления (active и не истекли)
        now = datetime.now()
        notifications_active = (
            Notification.query.filter_by(status='active')
            .filter(
                (Notification.lifetime_type != 'date')
                | (Notification.expires_at.is_(None))
                | (Notification.expires_at > now)
            )
            .count()
        )

        # Общее число лайков
        media_likes_total = MediaLike.query.count()

        # Действующие правила видимости (published + enabled)
        visibility_rules_active = 0
        published = (
            VisibilityConfig.query.filter_by(status="published")
            .order_by(VisibilityConfig.version.desc(), VisibilityConfig.updated_at.desc())
            .first()
        )
        if published:
            try:
                payload = json.loads(published.config_json) if published.config_json else {}
            except Exception:
                payload = {}
            rules = payload.get("rules") if isinstance(payload.get("rules"), list) else []
            visibility_rules_active = sum(
                1 for rule in rules
                if isinstance(rule, dict) and rule.get("enabled", True) is not False
            )

        # Вино/Бар/Кухня (по БД)
        wine_items = WineItem.query.count()
        bar_items = BarItem.query.count()
        tea_items = TeaItem.query.count()
        kitchen_items = KitchenItem.query.count()

        # Фолбэк: если какой-то раздел пуст в БД — берём из JSON
        if wine_items == 0 or bar_items == 0 or tea_items == 0 or kitchen_items == 0:
            items = _load_menu_db_items()
            if items:
                parts = _split_menu_items(items)
                if wine_items == 0:
                    wine_items = len(parts.get("wine") or [])
                if bar_items == 0:
                    bar_items = len(parts.get("bar") or [])
                if tea_items == 0:
                    tea_items = len(parts.get("tea") or [])
                if kitchen_items == 0:
                    kitchen_items = len(parts.get("kitchen") or [])

        return jsonify({
            "users": users_total,
            "feedbackUnread": feedback_unread,
            "notificationsActive": notifications_active,
            "mediaLikesTotal": media_likes_total,
            "visibilityRulesActive": visibility_rules_active,
            "kitchenItems": kitchen_items,
            "wineItems": wine_items,
            "barItems": bar_items,
            "teaItems": tea_items,
        })
    except Exception as e:
        return jsonify({"error": "ADMIN_SIDEBAR_STATS_ERROR", "message": str(e)}), 500

# ========== API ДЛЯ УПРАВЛЕНИЯ ПОЛЬЗОВАТЕЛЯМИ ==========

@app.route('/api/admin/users', methods=['GET'])
@login_required
def get_users():
    """Получение списка всех пользователей (только для админа)"""
    # Проверяем, что это не гость
    guest_check = check_not_guest()
    if guest_check:
        return guest_check
    try:
        # Проверяем, что текущий пользователь - администратор
        from flask_login import current_user
        current_user_obj = User.query.get(current_user.id)
        
        if not current_user_obj or current_user_obj.role != 'администратор':
            return jsonify({'error': 'Доступ запрещен'}), 403
        
        # Получаем всех пользователей, отсортированных по дате создания (новые сначала)
        users = User.query.order_by(User.created_at.desc()).all()
        
        # Преобразуем в список словарей (без паролей!)
        return jsonify([user.to_dict() for user in users])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/users', methods=['POST'])
@login_required
def create_user():
    """Создание нового пользователя (только для администратора)"""
    # Проверяем, что это не гость
    guest_check = check_not_guest()
    if guest_check:
        return guest_check
    try:
        # Проверяем, что текущий пользователь - администратор
        from flask_login import current_user
        current_user_obj = User.query.get(current_user.id)
        
        if not current_user_obj or current_user_obj.role != 'администратор':
            return jsonify({'error': 'Доступ запрещен. Только администратор может создавать пользователей'}), 403
        
        # Получаем данные из запроса
        data = request.json
        
        # Проверяем обязательные поля
        name = data.get('name')
        username = data.get('username')
        password = data.get('password')
        role = data.get('role', 'официант')  # По умолчанию - официант
        
        if not name or not username or not password:
            return jsonify({'error': 'Имя, логин и пароль обязательны'}), 400
        
        # Проверяем, что роль допустима
        allowed_roles = ['официант', 'администратор', 'хостес']
        if role not in allowed_roles and role:
            # Если роль не из списка, но указана, разрешаем произвольную роль
            pass
        
        # Проверяем, что логин уникален
        existing_user = User.query.filter_by(username=username).first()
        if existing_user:
            return jsonify({'error': 'Пользователь с таким логином уже существует'}), 400
        
        # Создаём нового пользователя
        new_user = User(
            name=name,
            username=username,
            role=role if role else 'официант'  # Если роль пустая, ставим официант
        )
        # Устанавливаем пароль (он автоматически хешируется)
        new_user.set_password(password)
        
        # Сохраняем в базу данных
        db.session.add(new_user)
        db.session.commit()
        
        return jsonify({'status': 'ok', 'message': 'Пользователь создан', 'user': new_user.to_dict()})
    except Exception as e:
        db.session.rollback()
        if _is_readonly_db_error(e):
            return _readonly_db_response()
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/users/<int:user_id>', methods=['PUT'])
@login_required
def update_user(user_id):
    """Обновление пользователя (только для администратора)"""
    # Проверяем, что это не гость
    guest_check = check_not_guest()
    if guest_check:
        return guest_check
    try:
        # Проверяем, что текущий пользователь - администратор
        from flask_login import current_user
        current_user_obj = User.query.get(current_user.id)
        
        if not current_user_obj or current_user_obj.role != 'администратор':
            return jsonify({'error': 'Доступ запрещен. Только администратор может редактировать пользователей'}), 403
        
        # Ищем пользователя в базе данных
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'Пользователь не найден'}), 404
        
        # Получаем данные из запроса
        data = request.json
        
        # Обновляем поля, если они переданы
        if 'name' in data:
            user.name = data['name']
        
        if 'username' in data:
            # Проверяем, что новый логин уникален (если он изменился)
            new_username = data['username']
            if new_username != user.username:
                existing_user = User.query.filter_by(username=new_username).first()
                if existing_user:
                    return jsonify({'error': 'Пользователь с таким логином уже существует'}), 400
                user.username = new_username
        
        if 'password' in data and data['password']:
            # Обновляем пароль только если он указан
            user.set_password(data['password'])
        
        if 'role' in data:
            role = data['role']
            # Разрешаем любую роль (включая произвольную)
            user.role = role if role else 'официант'
        
        # Сохраняем изменения
        db.session.commit()
        
        return jsonify({'status': 'ok', 'message': 'Пользователь обновлен', 'user': user.to_dict()})
    except Exception as e:
        db.session.rollback()
        if _is_readonly_db_error(e):
            return _readonly_db_response()
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
@login_required
def delete_user(user_id):
    """Удаление пользователя (только для администратора)"""
    # Проверяем, что это не гость
    guest_check = check_not_guest()
    if guest_check:
        return guest_check
    try:
        # Проверяем, что текущий пользователь - администратор
        from flask_login import current_user
        current_user_obj = User.query.get(current_user.id)
        
        if not current_user_obj or current_user_obj.role != 'администратор':
            return jsonify({'error': 'Доступ запрещен. Только администратор может удалять пользователей'}), 403
        
        # Не позволяем удалить самого себя
        if current_user.id == user_id:
            return jsonify({'error': 'Нельзя удалить самого себя'}), 400
        
        # Ищем пользователя в базе данных
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'Пользователь не найден'}), 404
        
        # Удаляем пользователя
        db.session.delete(user)
        db.session.commit()
        
        return jsonify({'status': 'ok', 'message': 'Пользователь удален'})
    except Exception as e:
        db.session.rollback()
        if _is_readonly_db_error(e):
            return _readonly_db_response()
        return jsonify({'error': str(e)}), 500


# ========== АДМИН: ВИДИМОСТЬ / FEATURE FLAGS ==========

@app.route('/api/admin/visibility', methods=['GET'])
@login_required
def get_visibility_config_admin():
    """
    Возвращает текущие черновики/публикации и историю версий.
    """
    admin_check = _require_admin()
    if admin_check:
        return admin_check
    try:
        published = (
            VisibilityConfig.query.filter_by(status="published")
            .order_by(VisibilityConfig.version.desc(), VisibilityConfig.updated_at.desc())
            .first()
        )
        draft = (
            VisibilityConfig.query.filter_by(status="draft")
            .order_by(VisibilityConfig.version.desc(), VisibilityConfig.updated_at.desc())
            .first()
        )
        history = (
            VisibilityConfig.query.order_by(VisibilityConfig.version.desc(), VisibilityConfig.updated_at.desc())
            .all()
        )
        return jsonify({
            "published": published.to_dict() if published else None,
            "draft": draft.to_dict() if draft else None,
            "versions": [
                {
                    "id": item.id,
                    "version": item.version,
                    "status": item.status,
                    "updated_at": item.updated_at.isoformat() if item.updated_at else None,
                    "updated_by": item.updated_by,
                }
                for item in history
            ],
        })
    except Exception as e:
        return jsonify({"error": "VISIBILITY_ADMIN_ERROR", "message": str(e)}), 500


@app.route('/api/admin/visibility/draft', methods=['POST'])
@login_required
def save_visibility_draft():
    """
    Сохраняет черновик конфигурации видимости.
    """
    admin_check = _require_admin()
    if admin_check:
        return admin_check
    try:
        payload = request.json if isinstance(request.json, dict) else {}
        config = payload.get("config") if isinstance(payload.get("config"), dict) else payload

        error = _validate_visibility_config(config)
        if error:
            return jsonify({"error": "INVALID_VISIBILITY_CONFIG", "message": error}), 400

        published = (
            VisibilityConfig.query.filter_by(status="published")
            .order_by(VisibilityConfig.version.desc())
            .first()
        )
        draft = (
            VisibilityConfig.query.filter_by(status="draft")
            .order_by(VisibilityConfig.version.desc())
            .first()
        )
        next_version = draft.version if draft else ((published.version if published else 0) + 1)
        normalized = _normalize_visibility_config(config, version_override=next_version)
        actor = _get_visibility_actor_label()

        if draft:
            draft.config_json = json.dumps(normalized, ensure_ascii=False)
            draft.updated_by = actor
        else:
            draft = VisibilityConfig(
                status="draft",
                version=next_version,
                config_json=json.dumps(normalized, ensure_ascii=False),
                updated_by=actor,
            )
            db.session.add(draft)
        db.session.commit()

        return jsonify({
            "status": "ok",
            "draft": draft.to_dict(),
        })
    except Exception as e:
        db.session.rollback()
        if _is_readonly_db_error(e):
            return _readonly_db_response()
        return jsonify({"error": "VISIBILITY_DRAFT_ERROR", "message": str(e)}), 500


@app.route('/api/admin/visibility/publish', methods=['POST'])
@login_required
def publish_visibility_config():
    """
    Публикует черновик или версию по номеру.
    """
    admin_check = _require_admin()
    if admin_check:
        return admin_check
    try:
        payload = request.json if isinstance(request.json, dict) else {}
        version = payload.get("version")

        target = None
        if isinstance(version, int):
            target = VisibilityConfig.query.filter_by(version=version).first()
        if not target:
            target = (
                VisibilityConfig.query.filter_by(status="draft")
                .order_by(VisibilityConfig.version.desc())
                .first()
            )
        if not target:
            return jsonify({"error": "NO_DRAFT", "message": "Нет черновика для публикации"}), 400

        error = _validate_visibility_config(target.to_dict().get("config"))
        if error:
            return jsonify({"error": "INVALID_VISIBILITY_CONFIG", "message": error}), 400

        VisibilityConfig.query.filter_by(status="published").update({"status": "archived"})
        VisibilityConfig.query.filter_by(status="draft").update({"status": "archived"})
        target.status = "published"
        target.updated_by = _get_visibility_actor_label()
        db.session.commit()

        return jsonify({
            "status": "ok",
            "published": target.to_dict(),
        })
    except Exception as e:
        db.session.rollback()
        if _is_readonly_db_error(e):
            return _readonly_db_response()
        return jsonify({"error": "VISIBILITY_PUBLISH_ERROR", "message": str(e)}), 500


@app.route('/api/admin/visibility/rollback', methods=['POST'])
@login_required
def rollback_visibility_config():
    """
    Откат на выбранную версию.
    """
    admin_check = _require_admin()
    if admin_check:
        return admin_check
    try:
        payload = request.json if isinstance(request.json, dict) else {}
        version = payload.get("version")
        if not isinstance(version, int):
            return jsonify({"error": "INVALID_VERSION", "message": "version must be integer"}), 400

        if version == 0:
            # Версия 0 = "чистое" состояние без правил
            empty_config = {"version": 0, "rules": [], "features": {}}
            actor = _get_visibility_actor_label()
            VisibilityConfig.query.filter_by(status="published").update({"status": "archived"})
            VisibilityConfig.query.filter_by(status="draft").update({"status": "archived"})
            target = VisibilityConfig(
                status="published",
                version=0,
                config_json=json.dumps(empty_config, ensure_ascii=False),
                updated_by=actor,
            )
            db.session.add(target)
            db.session.commit()
        else:
            target = VisibilityConfig.query.filter_by(version=version).first()
            if not target:
                return jsonify({"error": "NOT_FOUND", "message": "Version not found"}), 404

            VisibilityConfig.query.filter_by(status="published").update({"status": "archived"})
            VisibilityConfig.query.filter_by(status="draft").update({"status": "archived"})
            target.status = "published"
            target.updated_by = _get_visibility_actor_label()
            db.session.commit()

        return jsonify({
            "status": "ok",
            "published": target.to_dict(),
        })
    except Exception as e:
        db.session.rollback()
        if _is_readonly_db_error(e):
            return _readonly_db_response()
        return jsonify({"error": "VISIBILITY_ROLLBACK_ERROR", "message": str(e)}), 500

# ========== АДМИН: ОБНОВЛЕНИЕ МЕНЮ И (ОПЦ.) ДЕПЛОЙ ==========

@app.route("/api/admin/menu/import", methods=["POST"])
@login_required
def admin_import_menu_json():
    """
    Загружает JSON через админку и применяет:
    - сохраняет split-файлы в data/menu-*.json (и backup в frontend/public/data)
    - перезаписывает таблицы кухни/вина/бара в SQLite
    """
    admin_check = _require_admin()
    if admin_check:
        return admin_check

    if "file" not in request.files:
        return jsonify({"error": "Файл не найден (поле 'file')"}), 400

    f = request.files["file"]
    filename = secure_filename(f.filename or "")
    if not filename.lower().endswith(".json"):
        return jsonify({"error": "Нужен файл .json"}), 400

    try:
        raw = f.read()
        text = raw.decode("utf-8")
        data = json.loads(text)
    except Exception as e:
        return jsonify({"error": f"Не удалось прочитать JSON: {e}"}), 400

    if not isinstance(data, list):
        return jsonify({"error": "JSON должен быть списком объектов (list)"}), 400

    items, duplicates, skipped_no_id = _dedupe_menu_items(data)
    kinds = { _classify_menu_item(it) for it in items if isinstance(it, dict) }
    is_partial = len(kinds) == 1
    only_kind = next(iter(kinds)) if is_partial else None

    try:
        if is_partial:
            if only_kind == "art":
                existing_menu = _load_menu_db_items()
                combined = existing_menu + items
                _save_menu_db_items(combined, preserve_art=False)
            else:
                existing_menu = _load_menu_db_items()
                parts = _split_menu_items(existing_menu)
                parts[only_kind] = items
                combined_menu = parts["kitchen"] + parts["wine"] + parts["bar"]
                _save_menu_db_items(combined_menu, preserve_art=True)
        else:
            _save_menu_db_items(items, preserve_art=False)
    except Exception as e:
        return jsonify({"error": f"Не удалось сохранить файл на сервере: {e}"}), 500

    try:
        # Сбрасываем кэш
        global _MENU_DB_BY_ID_CACHE
        _MENU_DB_BY_ID_CACHE = None

        if is_partial:
            if only_kind == "art":
                imported = _rebuild_dishes_table_from_items(_load_menu_db_items())
                imported_art = _rebuild_artworks_table_from_items(items)
            else:
                imported = _rebuild_dishes_table_from_items(_load_menu_db_items())
                imported_art = 0
        else:
            imported = _rebuild_dishes_table_from_items(items)
            imported_art = _rebuild_artworks_table_from_items(items)
        menus = sorted({(it.get("menu") or "").strip() for it in items if it.get("menu")})
        return jsonify({
            "status": "ok",
            "received": len(data),
            "deduped": len(items),
            "duplicates_removed": duplicates,
            "skipped_no_id": skipped_no_id,
            "imported_to_db": imported,
            "imported_artworks": imported_art,
            "menus_found": menus,
        })
    except Exception as e:
        db.session.rollback()
        if _is_readonly_db_error(e):
            return _readonly_db_response()
        return jsonify({"error": f"Ошибка применения меню: {e}"}), 500


@app.route("/api/admin/deploy/status", methods=["GET"])
@login_required
def admin_deploy_status():
    admin_check = _require_admin()
    if admin_check:
        return admin_check
    return jsonify({
        "enabled": ADMIN_DEPLOY_ENABLED and bool(DEPLOY_ADMIN_TOKEN),
        "state": _DEPLOY_STATE,
    })


def _run_cmd(cmd: list[str], cwd: Path | None = None):
    _deploy_log(f"$ {' '.join(cmd)}")
    res = subprocess.run(
        cmd,
        cwd=str(cwd) if cwd else None,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    out = (res.stdout or "").strip()
    if out:
        for line in out.splitlines()[-50:]:
            _deploy_log(line)
    if res.returncode != 0:
        raise RuntimeError(f"Command failed ({res.returncode}): {' '.join(cmd)}")


def _deploy_worker():
    _DEPLOY_STATE["status"] = "running"
    _DEPLOY_STATE["started_at"] = time.time()
    _DEPLOY_STATE["finished_at"] = None
    _DEPLOY_STATE["error"] = None
    _DEPLOY_STATE["log"] = []
    try:
        _DEPLOY_STATE["step"] = "git pull"
        _run_cmd(["git", "-C", str(ROOT_DIR), "pull"])

        _DEPLOY_STATE["step"] = "frontend build"
        _run_cmd(["npm", "ci"], cwd=ROOT_DIR / "frontend")
        _run_cmd(["npm", "run", "build"], cwd=ROOT_DIR / "frontend")

        _DEPLOY_STATE["step"] = "migrate db"
        _run_cmd([str(ROOT_DIR / "venv" / "bin" / "python3"), str(ROOT_DIR / "backend" / "migrate_to_db.py"), "--yes"])

        _DEPLOY_STATE["step"] = "restart (self-terminate master)"
        _DEPLOY_STATE["status"] = "done"
        _DEPLOY_STATE["finished_at"] = time.time()

        # Аккуратно убиваем gunicorn master (родитель процесса), systemd поднимет заново.
        def _kill_parent():
            time.sleep(0.5)
            try:
                os.kill(os.getppid(), signal.SIGTERM)
            except Exception:
                pass

        threading.Thread(target=_kill_parent, daemon=True).start()
    except Exception as e:
        _DEPLOY_STATE["status"] = "error"
        _DEPLOY_STATE["error"] = str(e)
        _DEPLOY_STATE["finished_at"] = time.time()
        _deploy_log(f"ERROR: {e}")


@app.route("/api/admin/deploy/run", methods=["POST"])
@login_required
def admin_deploy_run():
    admin_check = _require_admin()
    if admin_check:
        return admin_check

    if not (ADMIN_DEPLOY_ENABLED and DEPLOY_ADMIN_TOKEN):
        return jsonify({"error": "Deploy disabled"}), 403

    token = request.headers.get("X-Deploy-Token", "").strip()
    if token != DEPLOY_ADMIN_TOKEN:
        return jsonify({"error": "Bad deploy token"}), 403

    if _DEPLOY_STATE.get("status") == "running":
        return jsonify({"error": "Deploy already running", "state": _DEPLOY_STATE}), 409

    threading.Thread(target=_deploy_worker, daemon=True).start()
    return jsonify({"status": "started", "state": _DEPLOY_STATE})


@app.route("/api/admin/deploy/job", methods=["GET"])
@login_required
def admin_deploy_job():
    admin_check = _require_admin()
    if admin_check:
        return admin_check
    return jsonify(_DEPLOY_STATE)

# ========== ОТДАЧА СТАТИКИ ФРОНТЕНДА (React) ==========

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    """
    Отдаёт index.html для всех маршрутов, кроме API и статики.
    Это нужно для работы React Router (client-side routing).
    
    Важно: этот маршрут должен быть последним, чтобы не перехватывать API запросы!
    """
    # Проверяем, что это не API или статические маршруты
    if path.startswith('api/') or path.startswith('images/') or \
       path.startswith('audio/') or path.startswith('menus/') or path.startswith('trainer/'):
        return jsonify({'error': 'Not found'}), 404
    
    # Если запрошен РЕАЛЬНЫЙ файл из сборки (например /icons/logo.png, /manifest.webmanifest, /asset-manifest.json),
    # отдаём его как есть. Иначе React Router сломается, потому что файл заменится на index.html.
    if path:
        requested_file = FRONTEND_BUILD_DIR / path
        if requested_file.exists() and requested_file.is_file():
            guessed_mime, _ = mimetypes.guess_type(str(requested_file))
            return send_from_directory(str(FRONTEND_BUILD_DIR), path, mimetype=guessed_mime)
    
    # Для всех остальных маршрутов отдаём index.html (React Router)
    if FRONTEND_INDEX.exists():
        return send_file(str(FRONTEND_INDEX))
    else:
        return jsonify({
            'error': 'Frontend not built',
            'message': 'Please build the frontend first: cd frontend && npm run build'
        }), 503

# ========== ИНИЦИАЛИЗАЦИЯ БАЗЫ ДАННЫХ ==========

# Создаём таблицы при первом запуске (если их ещё нет)
with app.app_context():
    db.create_all()
    # Автоматически разложим legacy menu-database.json на split-файлы
    _ensure_split_menu_files()
    skip_bootstrap = _env_bool("SABOR_SKIP_BOOTSTRAP", False)

    def _bootstrap_admin_if_configured():
        """
        KISS-предохранитель: если база пустая/сброшена и админа нет,
        то можем создать первого администратора из переменных окружения.

        Важно (безопасность):
        - НИКОГДА не хардкодим пароль в коде.
        - Пароль храните в .env (и не коммитьте его в Git).
        """
        username = (os.getenv("BOOTSTRAP_ADMIN_USERNAME") or "").strip()
        password = (os.getenv("BOOTSTRAP_ADMIN_PASSWORD") or "").strip()
        name = (os.getenv("BOOTSTRAP_ADMIN_NAME") or "Администратор").strip() or "Администратор"

        # Если не настроили переменные — ничего не делаем
        if not username or not password:
            return

        # Если админ уже есть — ничего не делаем
        if User.query.filter_by(role="администратор").first() is not None:
            return

        # Если пользователь с таким логином уже существует (но не админ) — не меняем роли автоматически
        if User.query.filter_by(username=username).first() is not None:
            app.logger.warning(
                "BOOTSTRAP_ADMIN_* задан, но пользователь с таким username уже существует. "
                "Админ НЕ создан автоматически (чтобы не менять роли неожиданно)."
            )
            return

        try:
            admin = User(name=name, username=username, role="администратор")
            admin.set_password(password)
            db.session.add(admin)
            db.session.commit()
            app.logger.info("✅ Создан администратор из BOOTSTRAP_ADMIN_* (первый запуск/сброс базы).")
        except Exception as e:
            db.session.rollback()
            app.logger.exception(f"❌ Не удалось создать bootstrap-админа: {e}")

    if not skip_bootstrap:
        _bootstrap_admin_if_configured()

    def _bootstrap_dishes_from_json_if_empty():
        """
        Если база данных пустая (нет ни одного блюда), пробуем один раз загрузить блюда из menu-database.json.
        Это помогает на хостинге, когда база создана, но данных ещё нет (и на главной видно "Меню пока нет").
        """
        try:
            # Если меню уже есть — ничего не делаем (не перезатираем работу админки!)
            if KitchenItem.query.first() is not None or WineItem.query.first() is not None or BarItem.query.first() is not None or TeaItem.query.first() is not None:
                return

            dishes_data = _load_menu_db_items()
            if not isinstance(dishes_data, list) or not dishes_data:
                app.logger.warning("Меню не найдено (split/legacy). База пустая, меню не загрузится автоматически.")
                return

            parts = _split_menu_items(dishes_data)
            for item in parts.get("kitchen", []):
                db.session.add(KitchenItem.from_dict(item))
            for item in parts.get("wine", []):
                db.session.add(WineItem.from_dict(item))
            for item in parts.get("bar", []):
                db.session.add(BarItem.from_dict(item))
            for item in parts.get("tea", []):
                db.session.add(TeaItem.from_dict(item))
            db.session.commit()
            app.logger.info(f"✅ Загружено в БД меню: {len(dishes_data)} (split)")
        except Exception as e:
            db.session.rollback()
            app.logger.exception(f"❌ Ошибка автозагрузки меню в БД: {e}")

    if not skip_bootstrap:
        _bootstrap_dishes_from_json_if_empty()

    def _bootstrap_artworks_from_json_if_empty():
        """
        Если таблица картин пустая — пробуем загрузить artworks.json.
        """
        try:
            if Artwork.query.first() is not None:
                return
            artworks = _load_art_db_items()
            if not artworks:
                return
            for art in artworks:
                db.session.add(Artwork.from_dict(art))
            db.session.commit()
            app.logger.info(f"✅ Загружено в БД картин: {len(artworks)}")
        except Exception as e:
            db.session.rollback()
            app.logger.exception(f"❌ Ошибка автозагрузки картин: {e}")

    if not skip_bootstrap:
        _bootstrap_artworks_from_json_if_empty()

# ========== ЗАПУСК СЕРВЕРА ==========

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', 'True').lower() == 'true'
    app.run(debug=debug, port=port, host='0.0.0.0')


from flask import Flask, jsonify, request, send_from_directory, send_file
from flask_cors import CORS
from flask_login import LoginManager, login_required, login_user, logout_user, UserMixin
from pathlib import Path
from datetime import timedelta
import json
import os
import mimetypes
import threading
import time
import subprocess
import signal
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
from models import db, Dish, FeedbackMessage, User

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
    "Основное меню (Sabor de la Vida)",
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
    return s or None

def _load_menu_db_items() -> list[dict]:
    """
    Загружает список элементов из menu-database.json.
    KISS-страховка: если БД заполнена частично (например, миграция упала на дубле id),
    то вина/бар можно временно отдать прямо из JSON.
    """
    for path in (MENU_DB_PATH, MENU_DB_BACKUP_PATH):
        try:
            if path.exists():
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                if isinstance(data, list):
                    # Фильтруем только словари
                    return [x for x in data if isinstance(x, dict)]
        except Exception as e:
            app.logger.warning(f"Не удалось загрузить {path}: {e}")
    return []

def _get_wines_dicts() -> list[dict]:
    """
    Возвращает список вин как список dict.
    Сначала пробуем БД; если пусто — берём из JSON.
    """
    try:
        # 1) Пытаемся взять из БД
        dishes = Dish.query.all()
        wines = [
            d for d in dishes
            if (_text_contains(d.menu, ['вин', 'wine']) or _text_contains(d.section, ['вин', 'wine']))
        ]
        if wines:
            # Важно: в БД нет части полей (например status/origin/producer/region/...).
            # Поэтому подмешиваем "полную" запись из menu-database.json по id.
            json_by_id = _load_menu_db_by_id()
            out = []
            for w in wines:
                base = w.to_dict()
                full = json_by_id.get(base.get("id")) if isinstance(json_by_id, dict) else None
                merged = _deep_merge_dicts(full or {}, base)
                out.append(_enrich_wine_dict(merged))
            return out

        # 2) Фолбэк: из JSON
        items = _load_menu_db_items()
        json_wines = [
            item for item in items
            if _text_contains(item.get("menu"), ['вин', 'wine']) or _text_contains(item.get("section"), ['вин', 'wine'])
        ]
        return [item for item in json_wines]
    except Exception as e:
        app.logger.exception(f"Ошибка получения вин: {e}")
        return []

def _get_bar_items_dicts() -> list[dict]:
    """
    Возвращает список барных позиций как список dict.
    Сначала пробуем БД; если пусто — берём из JSON.
    """
    try:
        dishes = Dish.query.all()
        bar_items = [
            d for d in dishes
            if (
                _text_contains(d.menu, ['бар', 'bar', 'напит', 'drink'])
                or _text_contains(d.section, ['коктейл', 'cocktail', 'чай', 'tea', 'пиво', 'beer', 'кофе', 'coffee', 'напит', 'drink'])
            )
        ]
        if bar_items:
            # Важно: в БД нет некоторых полей (например status, cardIngredients, и т.п.)
            # Поэтому подмешиваем "полную" запись из menu-database.json по id.
            json_by_id = _load_menu_db_by_id()
            out = []
            for b in bar_items:
                base = b.to_dict()
                full = json_by_id.get(base.get("id")) if isinstance(json_by_id, dict) else None
                out.append(_deep_merge_dicts(full or {}, base))
            return out

        items = _load_menu_db_items()
        json_bar = [
            item for item in items
            if (
                _text_contains(item.get("menu"), ['бар', 'bar', 'напит', 'drink'])
                or _text_contains(item.get("section"), ['коктейл', 'cocktail', 'чай', 'tea', 'пиво', 'beer', 'кофе', 'coffee', 'напит', 'drink'])
            )
        ]
        return [item for item in json_bar]
    except Exception as e:
        app.logger.exception(f"Ошибка получения бара: {e}")
        return []

# Загружаем переменные окружения
load_dotenv()

# Создаём приложение Flask
app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'change-this-in-production-12345')
app.config['MAX_CONTENT_LENGTH'] = int(os.getenv('MAX_UPLOAD_MB', '20')) * 1024 * 1024  # Защита от больших файлов

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
# Путь к собранному фронтенду (React build)
FRONTEND_BUILD_DIR = ROOT_DIR / "frontend" / "build"
FRONTEND_STATIC_DIR = FRONTEND_BUILD_DIR / "static"
FRONTEND_INDEX = FRONTEND_BUILD_DIR / "index.html"

# Путь к исходным данным меню (нужно, чтобы подмешивать поля, которых нет в БД)
MENU_DB_PATH = ROOT_DIR / "data" / "menu-database.json"
MENU_DB_BACKUP_PATH = ROOT_DIR / "frontend" / "public" / "data" / "menu-database.json"
_MENU_DB_BY_ID_CACHE = None
_MENU_DB_BY_ID_CACHE_PATH = None
_MENU_DB_BY_ID_CACHE_MTIME = None

# Настройки "деплоя из админки" (по умолчанию выключено — это опасная операция)
ADMIN_DEPLOY_ENABLED = os.getenv("ADMIN_DEPLOY_ENABLED", "false").lower() == "true"
DEPLOY_ADMIN_TOKEN = os.getenv("DEPLOY_ADMIN_TOKEN", "").strip()
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


def _save_menu_db_items(items: list[dict]) -> tuple[int, int, int]:
    """
    Сохраняет menu-database.json (и backup), с дедупликацией по id.
    Возвращает (deduped_len, duplicates_removed, skipped_no_id).
    """
    items, duplicates, skipped_no_id = _dedupe_menu_items(items or [])
    _atomic_write_json(MENU_DB_PATH, items)
    _atomic_write_json(MENU_DB_BACKUP_PATH, items)
    # Сбрасываем кэш, чтобы чтение по id сразу увидело изменения
    global _MENU_DB_BY_ID_CACHE, _MENU_DB_BY_ID_CACHE_PATH, _MENU_DB_BY_ID_CACHE_MTIME
    _MENU_DB_BY_ID_CACHE = None
    _MENU_DB_BY_ID_CACHE_PATH = None
    _MENU_DB_BY_ID_CACHE_MTIME = None
    return len(items), duplicates, skipped_no_id


def _upsert_menu_db_item(incoming: dict) -> bool:
    """
    Upsert (обновить/добавить) один элемент в menu-database.json.
    Важно: не теряем специфичные поля (вино/бар), т.к. мёрджим поверх существующего.
    Возвращает True если элемент уже существовал, иначе False.
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
            # override обновляет только то, что прислали, остальное сохраняем
            items[idx] = _deep_merge_dicts(it, incoming)
            existed = True
            replaced = True
            break

    if not replaced:
        items.append(incoming)

    _save_menu_db_items(items)
    return existed


def _delete_menu_db_item(item_id: str) -> bool:
    """
    Удаляет элемент по id из menu-database.json.
    Возвращает True если что-то удалили, иначе False.
    """
    norm_id = str(item_id or "").strip()
    if not norm_id:
        return False
    items = [it for it in _load_menu_db_items() if isinstance(it, dict)]
    before = len(items)
    items = [it for it in items if str(it.get("id") or "").strip() != norm_id]
    if len(items) == before:
        return False
    _save_menu_db_items(items)
    return True


def _get_all_dishes_dicts_with_json_fallback() -> list[dict]:
    """
    Возвращает ВСЕ позиции:
    - что есть в БД (источник правды для редактирования)
    - плюс то, что есть в JSON, но по какой-то причине отсутствует в БД (KISS-фолбэк)

    Важно: порядок берём из JSON, чтобы меню выглядело стабильно.
    """
    # 1) Берём всё из БД
    db_items = Dish.query.all()
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
    Полностью перезаписывает таблицу dishes из списка items.
    KISS: удаляем всё и заново заливаем.
    """
    Dish.query.delete()
    db.session.commit()
    success = 0
    for item in items:
        try:
            db.session.merge(Dish.from_dict(item))
            success += 1
        except Exception:
            db.session.rollback()
    db.session.commit()
    return success

def _load_menu_db_by_id():
    """
    Загружает menu-database.json и строит словарь {id: full_item}.
    Это нужно, потому что в таблице dishes сейчас хранятся не все поля вина
    (например origin/producer/grapeVarieties/region).
    """
    global _MENU_DB_BY_ID_CACHE, _MENU_DB_BY_ID_CACHE_PATH, _MENU_DB_BY_ID_CACHE_MTIME

    # Если файл на диске НЕ менялся — возвращаем кэш.
    # Если вы поменяли JSON руками — mtime изменится, и мы перечитаем файл автоматически.
    if _MENU_DB_BY_ID_CACHE is not None and _MENU_DB_BY_ID_CACHE_PATH:
        try:
            cached_path = Path(_MENU_DB_BY_ID_CACHE_PATH)
            if cached_path.exists():
                mtime = cached_path.stat().st_mtime
                if _MENU_DB_BY_ID_CACHE_MTIME == mtime:
                    return _MENU_DB_BY_ID_CACHE
        except Exception:
            # если что-то пошло не так — просто перечитаем файл ниже
            pass

    db_map = {}
    for path in (MENU_DB_PATH, MENU_DB_BACKUP_PATH):
        try:
            if path.exists():
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                if isinstance(data, list):
                    for item in data:
                        item_id = item.get("id")
                        if item_id:
                            db_map[item_id] = item
                # Запоминаем, какой файл успешно использовали
                _MENU_DB_BY_ID_CACHE_PATH = str(path)
                try:
                    _MENU_DB_BY_ID_CACHE_MTIME = path.stat().st_mtime
                except Exception:
                    _MENU_DB_BY_ID_CACHE_MTIME = None
                break
        except Exception as e:
            app.logger.warning(f"Не удалось загрузить {path}: {e}")

    _MENU_DB_BY_ID_CACHE = db_map
    return _MENU_DB_BY_ID_CACHE

def _enrich_wine_dict(wine_dict: dict) -> dict:
    """
    Подмешивает в ответ поля из menu-database.json, которых может не быть в БД.
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
        db_count = Dish.query.count()
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

@app.route('/api/menu-json', methods=['GET'])
def get_menu_json():
    """
    DEV/KISS: отдаём menu-database.json напрямую (без базы данных).
    Это нужно для режима "правлю data/menu-database.json → F5 → сразу вижу в UI",
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
        # Важно: в проде бывает ситуация, когда menu-database.json уже обновлён,
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
        dish = Dish.query.get(dish_id_norm)
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

        # 1) Уникальные значения меню из базы данных
        menus = db.session.query(Dish.menu).distinct().all()
        for row in menus:
            norm = _normalize_menu_value(row)
            if norm:
                menu_set.add(norm)

        # 2) Фолбэк/добавка: меню из JSON (на случай, если БД заполнена частично)
        for item in _load_menu_db_items():
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
        
        # Строим запрос к базе данных
        query = db.session.query(Dish.section).distinct()
        
        # Фильтруем по меню, если указано
        if menu_name:
            query = query.filter(Dish.menu == menu_name)
        
        sections = query.all()
        # Преобразуем в список строк и фильтруем пустые
        section_list = [s[0] for s in sections if s[0]]
        return jsonify(sorted(section_list))
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/images/<path:filename>')
def serve_image(filename):
    """Отдаёт изображения из папки images"""
    try:
        guessed_mime, _ = mimetypes.guess_type(filename)

        # 1) Основной источник: корневая папка проекта /images (используется для изображений блюд и т.п.)
        if IMAGES_DIR.exists() and (IMAGES_DIR / filename).exists():
            return send_from_directory(str(IMAGES_DIR), filename, mimetype=guessed_mime)

        # 2) Фолбэк: изображения из React сборки (frontend/build/images/*)
        # Это нужно, потому что в UI есть обложки меню (main-menu-head.webp и др.), которые лежат именно там.
        build_images_dir = FRONTEND_BUILD_DIR / "images"
        if build_images_dir.exists() and (build_images_dir / filename).exists():
            return send_from_directory(str(build_images_dir), filename, mimetype=guessed_mime)

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
        wine = Dish.query.filter(Dish.id == wine_id_norm).first()
        if wine and (_text_contains(wine.menu, ['вин', 'wine']) or _text_contains(wine.section, ['вин', 'wine'])):
            base = wine.to_dict()
            full = _load_menu_db_by_id().get(base.get("id"))
            merged = _deep_merge_dicts(full or {}, base)
            return jsonify(_enrich_wine_dict(merged))

        # 2) Фолбэк: ищем в JSON по id
        wine_dict = _load_menu_db_by_id().get(wine_id_norm)
        if wine_dict and (_text_contains(wine_dict.get("menu"), ['вин', 'wine']) or _text_contains(wine_dict.get("section"), ['вин', 'wine'])):
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

        # 1) Пишем в menu-database.json (это решает “почему вино/бар отдельно” — всё в одном файле)
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

        # 2) Upsert в БД (чтобы админка могла редактировать даже то, чего не было в БД)
        dish = Dish.query.get(dish_id_norm)
        updated_dish = Dish.from_dict(data)

        if not dish:
            dish = updated_dish
            db.session.add(dish)
        else:
            dish.menu = updated_dish.menu
            dish.section = updated_dish.section
            dish.title = updated_dish.title
            dish.description = updated_dish.description
            dish.contains = updated_dish.contains
            dish.allergens = updated_dish.allergens
            dish.tags = updated_dish.tags
            dish.pairings = updated_dish.pairings
            dish.image = updated_dish.image
            dish.i18n = updated_dish.i18n

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
        if Dish.query.get(dish_id_norm) or _load_menu_db_by_id().get(dish_id_norm):
            return jsonify({'error': 'Dish with this id already exists'}), 400

        # 1) Сохраняем в JSON
        _upsert_menu_db_item(new_dish_data)

        # 2) Создаём в БД
        new_dish = Dish.from_dict(new_dish_data)
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
        dish = Dish.query.get(dish_id_norm)
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
        data = request.json
        
        # Проверяем, что есть текст сообщения
        if not data.get('message'):
            return jsonify({'error': 'Message is required'}), 400
        
        # Создаём новое сообщение
        feedback = FeedbackMessage(
            name=data.get('name', ''),
            type=data.get('type', 'question'),
            message=data.get('message'),
            read=False
        )
        
        # Сохраняем в базу данных
        db.session.add(feedback)
        db.session.commit()
        
        return jsonify({'status': 'ok', 'message': 'Сообщение отправлено', 'id': feedback.id})
    except Exception as e:
        db.session.rollback()
        if _is_readonly_db_error(e):
            return _readonly_db_response()
        return jsonify({'error': str(e)}), 500

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

# ========== АДМИН: ОБНОВЛЕНИЕ МЕНЮ И (ОПЦ.) ДЕПЛОЙ ==========

@app.route("/api/admin/menu/import", methods=["POST"])
@login_required
def admin_import_menu_json():
    """
    Загружает menu-database.json через админку и применяет:
    - сохраняет файл в data/menu-database.json (и backup в frontend/public/data)
    - перезаписывает таблицу dishes в SQLite
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

    try:
        _atomic_write_json(MENU_DB_PATH, items)
        _atomic_write_json(MENU_DB_BACKUP_PATH, items)
    except Exception as e:
        return jsonify({"error": f"Не удалось сохранить файл на сервере: {e}"}), 500

    try:
        # Сбрасываем кэш
        global _MENU_DB_BY_ID_CACHE
        _MENU_DB_BY_ID_CACHE = None

        imported = _rebuild_dishes_table_from_items(items)
        menus = sorted({(it.get("menu") or "").strip() for it in items if it.get("menu")})
        return jsonify({
            "status": "ok",
            "received": len(data),
            "deduped": len(items),
            "duplicates_removed": duplicates,
            "skipped_no_id": skipped_no_id,
            "imported_to_db": imported,
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

    _bootstrap_admin_if_configured()

    def _bootstrap_dishes_from_json_if_empty():
        """
        Если база данных пустая (нет ни одного блюда), пробуем один раз загрузить блюда из menu-database.json.
        Это помогает на хостинге, когда база создана, но данных ещё нет (и на главной видно "Меню пока нет").
        """
        try:
            # Если блюда уже есть — ничего не делаем (не перезатираем работу админки!)
            if Dish.query.first() is not None:
                return

            json_file = None
            if MENU_DB_PATH.exists():
                json_file = MENU_DB_PATH
            elif MENU_DB_BACKUP_PATH.exists():
                json_file = MENU_DB_BACKUP_PATH

            if not json_file:
                app.logger.warning("menu-database.json не найден. База пустая, меню не загрузится автоматически.")
                return

            with open(json_file, "r", encoding="utf-8") as f:
                dishes_data = json.load(f)

            if not isinstance(dishes_data, list):
                app.logger.warning(f"Ожидали список блюд в {json_file}, но получили {type(dishes_data)}")
                return

            for dish_data in dishes_data:
                db.session.add(Dish.from_dict(dish_data))
            db.session.commit()
            app.logger.info(f"✅ Загружено в БД блюд: {len(dishes_data)} (источник: {json_file})")
        except Exception as e:
            db.session.rollback()
            app.logger.exception(f"❌ Ошибка автозагрузки menu-database.json в БД: {e}")

    _bootstrap_dishes_from_json_if_empty()

# ========== ЗАПУСК СЕРВЕРА ==========

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', 'True').lower() == 'true'
    app.run(debug=debug, port=port, host='0.0.0.0')


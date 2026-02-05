
import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class Config:
    # Project Root
    # assuming config.py is in backend/ and we want project root (one level up)
    ROOT_DIR = Path(__file__).resolve().parent.parent
    
    # Secret Key
    SECRET_KEY = os.getenv('SECRET_KEY', 'change-this-in-production-12345')
    
    # Upload limits
    MAX_CONTENT_LENGTH = int(os.getenv('MAX_UPLOAD_MB', '50')) * 1024 * 1024
    
    # Cookie Settings
    SESSION_COOKIE_SAMESITE = 'Lax'
    SESSION_COOKIE_SECURE = os.getenv('SESSION_COOKIE_SECURE', 'true').lower() == 'true'
    SESSION_COOKIE_HTTPONLY = True
    SESSION_REFRESH_EACH_REQUEST = True
    
    AUTH_SESSION_DAYS = int(str(os.getenv("AUTH_SESSION_DAYS", "3650")).strip())
    PERMANENT_SESSION_LIFETIME = timedelta(days=max(AUTH_SESSION_DAYS, 1))
    
    AUTH_REMEMBER_DAYS = int(str(os.getenv("AUTH_REMEMBER_DAYS", "3650")).strip())
    REMEMBER_COOKIE_DURATION = timedelta(days=max(AUTH_REMEMBER_DAYS, 1))
    REMEMBER_COOKIE_HTTPONLY = True
    REMEMBER_COOKIE_SECURE = SESSION_COOKIE_SECURE
    REMEMBER_COOKIE_SAMESITE = SESSION_COOKIE_SAMESITE
    REMEMBER_COOKIE_REFRESH_EACH_REQUEST = True

    # Database Path Resolution
    @staticmethod
    def _resolve_db_path(root_dir: Path) -> Path:
        raw = (os.getenv("SABOR_DB_PATH") or os.getenv("DB_PATH") or "").strip()
        if raw:
            p = Path(raw)
            if not p.is_absolute():
                p = (root_dir / p).resolve()
            return p
        return root_dir / "backend" / "database.db"

    DB_PATH = _resolve_db_path(ROOT_DIR)
    SQLALCHEMY_DATABASE_URI = f"sqlite:///{DB_PATH}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    SABOR_SKIP_BOOTSTRAP = os.getenv("SABOR_SKIP_BOOTSTRAP", "false").lower() == "true"

    # Paths
    BACKEND_DIR = ROOT_DIR / "backend"
    IMAGES_DIR = ROOT_DIR / "images"
    AUDIO_DIR = ROOT_DIR / "audio"
    
    # Frontend Public Paths
    FRONTEND_PUBLIC_DIR = ROOT_DIR / "frontend" / "public"
    MENUS_DIR = FRONTEND_PUBLIC_DIR / "menus"
    TRAINER_DIR = FRONTEND_PUBLIC_DIR / "trainer"
    SCRIPTS_DIR = FRONTEND_PUBLIC_DIR / "scripts"
    TOOLS_DIR = BACKEND_DIR / "static" / "tools"

    # Frontend Build Paths
    FRONTEND_BUILD_DIR = ROOT_DIR / "frontend" / "build"
    FRONTEND_STATIC_DIR = FRONTEND_BUILD_DIR / "static"
    FRONTEND_INDEX = FRONTEND_BUILD_DIR / "index.html"

    # Data Paths
    MENU_DB_DIR = ROOT_DIR / "data"
    MENU_DB_PUBLIC_DIR = FRONTEND_PUBLIC_DIR / "data"
    
    # Menu Files
    MENU_KITCHEN_PATH = MENU_DB_DIR / "menu-kitchen.json"
    MENU_WINE_PATH = MENU_DB_DIR / "menu-wine.json"
    MENU_BAR_PATH = MENU_DB_DIR / "menu-bar.json"
    MENU_TEA_PATH = MENU_DB_DIR / "menu-tea.json"
    ART_DB_PATH = MENU_DB_DIR / "artworks.json"
    
    # Legacy Menu Files
    MENU_DB_PATH = MENU_DB_DIR / "menu-database.json"
    
    # Backup Paths
    MENU_KITCHEN_BACKUP_PATH = MENU_DB_PUBLIC_DIR / "menu-kitchen.json"
    MENU_WINE_BACKUP_PATH = MENU_DB_PUBLIC_DIR / "menu-wine.json"
    MENU_BAR_BACKUP_PATH = MENU_DB_PUBLIC_DIR / "menu-bar.json"
    MENU_TEA_BACKUP_PATH = MENU_DB_PUBLIC_DIR / "menu-tea.json"
    ART_DB_BACKUP_PATH = MENU_DB_PUBLIC_DIR / "artworks.json"
    MENU_DB_BACKUP_PATH = MENU_DB_PUBLIC_DIR / "menu-database.json"

    # Private files
    PRIVATE_MENUS_DIR = BACKEND_DIR / "private" / "menus"
    
    # Feedback
    FEEDBACK_UPLOAD_DIR = BACKEND_DIR / "static" / "uploads" / "feedback"

    # Tools Registry
    TOOLS_REGISTRY_PATH = TOOLS_DIR / "registry.json"

    # Feature Flags / External Services
    ADMIN_DEPLOY_ENABLED = os.getenv("ADMIN_DEPLOY_ENABLED", "false").lower() == "true"
    DEPLOY_ADMIN_TOKEN = os.getenv("DEPLOY_ADMIN_TOKEN", "").strip()
    
    TELEGRAM_ENABLED = (os.getenv("TELEGRAM_ENABLED") or "").strip().lower() in ("1", "true", "yes", "y", "on")
    TELEGRAM_BOT_TOKEN = (os.getenv("TELEGRAM_BOT_TOKEN") or "").strip()
    TELEGRAM_CHAT_ID = (os.getenv("TELEGRAM_CHAT_ID") or "").strip()
    
    # CORS
    CORS_ORIGINS = [o.strip() for o in os.getenv('CORS_ORIGINS', '').strip().split(',') if o.strip()] or ['http://localhost:3000', 'http://127.0.0.1:3000']

    # Bootstrap Admin
    BOOTSTRAP_ADMIN_USERNAME = (os.getenv("BOOTSTRAP_ADMIN_USERNAME") or "").strip()
    BOOTSTRAP_ADMIN_PASSWORD = (os.getenv("BOOTSTRAP_ADMIN_PASSWORD") or "").strip()
    BOOTSTRAP_ADMIN_NAME = (os.getenv("BOOTSTRAP_ADMIN_NAME") or "Администратор").strip()

# Ensure critical directories exist
Config.DB_PATH.parent.mkdir(parents=True, exist_ok=True)
Config.FEEDBACK_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

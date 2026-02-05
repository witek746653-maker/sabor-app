import json
from pathlib import Path

from backend.config import Config
from backend.services.menu_service import MenuService


def _count_items(path: Path) -> int:
    try:
        if not path.exists():
            return 0
        data = json.loads(path.read_text(encoding="utf-8"))
        return len(data) if isinstance(data, list) else 0
    except Exception:
        return 0


def main():
    MenuService.ensure_split_menu_files()
    print("Split files:")
    print(f"- {Config.MENU_KITCHEN_PATH} ({_count_items(Config.MENU_KITCHEN_PATH)})")
    print(f"- {Config.MENU_WINE_PATH} ({_count_items(Config.MENU_WINE_PATH)})")
    print(f"- {Config.MENU_BAR_PATH} ({_count_items(Config.MENU_BAR_PATH)})")
    print(f"- {Config.MENU_TEA_PATH} ({_count_items(Config.MENU_TEA_PATH)})")
    print(f"- {Config.ART_DB_PATH} ({_count_items(Config.ART_DB_PATH)})")
    print("Public backups:")
    print(f"- {Config.MENU_KITCHEN_BACKUP_PATH} ({_count_items(Config.MENU_KITCHEN_BACKUP_PATH)})")
    print(f"- {Config.MENU_WINE_BACKUP_PATH} ({_count_items(Config.MENU_WINE_BACKUP_PATH)})")
    print(f"- {Config.MENU_BAR_BACKUP_PATH} ({_count_items(Config.MENU_BAR_BACKUP_PATH)})")
    print(f"- {Config.MENU_TEA_BACKUP_PATH} ({_count_items(Config.MENU_TEA_BACKUP_PATH)})")
    print(f"- {Config.ART_DB_BACKUP_PATH} ({_count_items(Config.ART_DB_BACKUP_PATH)})")


if __name__ == "__main__":
    main()

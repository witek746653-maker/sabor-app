import json
from pathlib import Path

from app import (
    _ensure_split_menu_files,
    MENU_KITCHEN_PATH,
    MENU_WINE_PATH,
    MENU_BAR_PATH,
    MENU_TEA_PATH,
    ART_DB_PATH,
    MENU_KITCHEN_BACKUP_PATH,
    MENU_WINE_BACKUP_PATH,
    MENU_BAR_BACKUP_PATH,
    MENU_TEA_BACKUP_PATH,
    ART_DB_BACKUP_PATH,
)


def _count_items(path: Path) -> int:
    try:
        if not path.exists():
            return 0
        data = json.loads(path.read_text(encoding="utf-8"))
        return len(data) if isinstance(data, list) else 0
    except Exception:
        return 0


def main():
    _ensure_split_menu_files()
    print("Split files:")
    print(f"- {MENU_KITCHEN_PATH} ({_count_items(MENU_KITCHEN_PATH)})")
    print(f"- {MENU_WINE_PATH} ({_count_items(MENU_WINE_PATH)})")
    print(f"- {MENU_BAR_PATH} ({_count_items(MENU_BAR_PATH)})")
    print(f"- {MENU_TEA_PATH} ({_count_items(MENU_TEA_PATH)})")
    print(f"- {ART_DB_PATH} ({_count_items(ART_DB_PATH)})")
    print("Public backups:")
    print(f"- {MENU_KITCHEN_BACKUP_PATH} ({_count_items(MENU_KITCHEN_BACKUP_PATH)})")
    print(f"- {MENU_WINE_BACKUP_PATH} ({_count_items(MENU_WINE_BACKUP_PATH)})")
    print(f"- {MENU_BAR_BACKUP_PATH} ({_count_items(MENU_BAR_BACKUP_PATH)})")
    print(f"- {MENU_TEA_BACKUP_PATH} ({_count_items(MENU_TEA_BACKUP_PATH)})")
    print(f"- {ART_DB_BACKUP_PATH} ({_count_items(ART_DB_BACKUP_PATH)})")


if __name__ == "__main__":
    main()

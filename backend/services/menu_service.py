
import json
import logging
from pathlib import Path
from backend.config import Config
from backend.models import db, KitchenItem, WineItem, BarItem, TeaItem, Artwork
from backend.utils import text_contains, deep_merge_dicts

logger = logging.getLogger(__name__)

class MenuService:
    ART_SOURCE_NAME = "Искусство в Sabor de la Vida"
    WINE_KEYWORDS = ["вин", "wine"]
    BAR_MENU_KEYWORDS = ["бар", "bar", "напит", "drink"]
    BAR_SECTION_KEYWORDS = ["коктейл", "cocktail", "пиво", "beer", "кофе", "coffee", "напит", "drink"]
    TEA_KEYWORDS = ["чай", "tea"]
    ALLOWED_MENUS_ORDER = [
        "Авторские завтраки", "Барное меню", "Вино", "Детское меню", "Зимнее меню", 
        "Летние каникулы", "Основное меню", "Постное меню", "Специальное меню"
    ]

    _MENU_DB_BY_ID_CACHE = None

    @staticmethod
    def normalize_menu_value(val) -> str | None:
        if val is None: return None
        if isinstance(val, (list, tuple)):
            if not val: return None
            val = val[0]
        if val is None: return None
        s = str(val).strip()
        if not s: return None
        s_lower = s.lower()
        if "основное" in s_lower and "sabor de la vida" in s_lower:
            return "Основное меню"
        return s

    @staticmethod
    def is_art_item(item: dict) -> bool:
        if not isinstance(item, dict): return False
        source = str(item.get("source") or "").strip()
        if source == MenuService.ART_SOURCE_NAME: return True
        item_id = str(item.get("id") or "").strip()
        return item_id.startswith("09")

    @classmethod
    def classify_menu_item(cls, item: dict) -> str:
        if cls.is_art_item(item): return "art"
        menu = item.get("menu")
        section = item.get("section")
        if text_contains(menu, cls.TEA_KEYWORDS) or text_contains(section, cls.TEA_KEYWORDS):
            return "tea"
        if text_contains(menu, cls.WINE_KEYWORDS) or text_contains(section, cls.WINE_KEYWORDS):
            return "wine"
        if text_contains(menu, cls.BAR_MENU_KEYWORDS) or text_contains(section, cls.BAR_SECTION_KEYWORDS):
            return "bar"
        return "kitchen"

    @classmethod
    def split_menu_items(cls, items: list[dict]) -> dict:
        out = {"kitchen": [], "wine": [], "bar": [], "tea": [], "art": []}
        for it in items or []:
            if not isinstance(it, dict): continue
            out[cls.classify_menu_item(it)].append(it)
        return out

    @staticmethod
    def _load_json_list(path: Path) -> list[dict]:
        try:
            if path.exists():
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                if isinstance(data, list):
                    return [x for x in data if isinstance(x, dict)]
        except Exception as e:
            logger.warning(f"Failed to load {path}: {e}")
        return []

    @staticmethod
    def _load_items_from_paths(primary: Path, backup: Path) -> list[dict]:
        data = MenuService._load_json_list(primary)
        if data: return data
        return MenuService._load_json_list(backup)

    @staticmethod
    def _atomic_write_json(path: Path, data_obj):
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(path.suffix + ".tmp")
        tmp.write_text(json.dumps(data_obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        tmp.replace(path)

    @staticmethod
    def ensure_split_menu_files():
        if (Config.MENU_KITCHEN_PATH.exists() or Config.MENU_WINE_PATH.exists() or 
            Config.MENU_BAR_PATH.exists() or Config.MENU_TEA_PATH.exists() or 
            Config.ART_DB_PATH.exists()):
            return
        legacy = MenuService._load_items_from_paths(Config.MENU_DB_PATH, Config.MENU_DB_BACKUP_PATH)
        if not legacy: return
        parts = MenuService.split_menu_items(legacy)
        MenuService._atomic_write_json(Config.MENU_KITCHEN_PATH, parts["kitchen"])
        MenuService._atomic_write_json(Config.MENU_WINE_PATH, parts["wine"])
        MenuService._atomic_write_json(Config.MENU_BAR_PATH, parts["bar"])
        MenuService._atomic_write_json(Config.MENU_TEA_PATH, parts["tea"])
        MenuService._atomic_write_json(Config.ART_DB_PATH, parts["art"])
        
        # Backups
        MenuService._atomic_write_json(Config.MENU_KITCHEN_BACKUP_PATH, parts["kitchen"])
        MenuService._atomic_write_json(Config.MENU_WINE_BACKUP_PATH, parts["wine"])
        MenuService._atomic_write_json(Config.MENU_BAR_BACKUP_PATH, parts["bar"])
        MenuService._atomic_write_json(Config.MENU_TEA_BACKUP_PATH, parts["tea"])
        MenuService._atomic_write_json(Config.ART_DB_BACKUP_PATH, parts["art"])

    @staticmethod
    def load_menu_db_items() -> list[dict]:
        MenuService.ensure_split_menu_files()
        items = []
        kitchen = MenuService._load_items_from_paths(Config.MENU_KITCHEN_PATH, Config.MENU_KITCHEN_BACKUP_PATH)
        wine = MenuService._load_items_from_paths(Config.MENU_WINE_PATH, Config.MENU_WINE_BACKUP_PATH)
        bar = MenuService._load_items_from_paths(Config.MENU_BAR_PATH, Config.MENU_BAR_BACKUP_PATH)
        tea = MenuService._load_items_from_paths(Config.MENU_TEA_PATH, Config.MENU_TEA_BACKUP_PATH)
        if kitchen or wine or bar or tea:
            items.extend(kitchen)
            items.extend(wine)
            items.extend(bar)
            items.extend(tea)
            return items
        
        legacy = MenuService._load_items_from_paths(Config.MENU_DB_PATH, Config.MENU_DB_BACKUP_PATH)
        return [x for x in legacy if isinstance(x, dict) and not MenuService.is_art_item(x)]

    @staticmethod
    def load_art_db_items() -> list[dict]:
        MenuService.ensure_split_menu_files()
        art = MenuService._load_items_from_paths(Config.ART_DB_PATH, Config.ART_DB_BACKUP_PATH)
        if art: return art
        legacy = MenuService._load_items_from_paths(Config.MENU_DB_PATH, Config.MENU_DB_BACKUP_PATH)
        return [x for x in legacy if isinstance(x, dict) and MenuService.is_art_item(x)]
        
    @staticmethod
    def load_wine_db_items() -> list[dict]:
        MenuService.ensure_split_menu_files()
        items = MenuService._load_items_from_paths(Config.MENU_WINE_PATH, Config.MENU_WINE_BACKUP_PATH)
        if items: return items
        return [x for x in MenuService.load_menu_db_items() 
                if text_contains(x.get("menu"), MenuService.WINE_KEYWORDS) or 
                   text_contains(x.get("section"), MenuService.WINE_KEYWORDS)]

    @staticmethod
    def load_bar_db_items() -> list[dict]:
        MenuService.ensure_split_menu_files()
        items = MenuService._load_items_from_paths(Config.MENU_BAR_PATH, Config.MENU_BAR_BACKUP_PATH)
        if items: return items
        return [x for x in MenuService.load_menu_db_items() 
                if text_contains(x.get("menu"), MenuService.BAR_MENU_KEYWORDS) or 
                   text_contains(x.get("section"), MenuService.BAR_SECTION_KEYWORDS)]
                   
    @staticmethod
    def load_tea_db_items() -> list[dict]:
        MenuService.ensure_split_menu_files()
        items = MenuService._load_items_from_paths(Config.MENU_TEA_PATH, Config.MENU_TEA_BACKUP_PATH)
        if items: return items
        return [x for x in MenuService.load_menu_db_items() 
                if text_contains(x.get("menu"), MenuService.TEA_KEYWORDS) or 
                   text_contains(x.get("section"), MenuService.TEA_KEYWORDS)]

    @staticmethod
    def load_menu_db_by_id():
        db_map = {}
        for item in MenuService.load_menu_db_items():
            try:
                item_id = item.get("id")
                if item_id:
                    db_map[item_id] = item
            except Exception:
                continue
        return db_map

    @staticmethod
    def dedupe_menu_items(items: list[dict]):
        unique_by_id = {}
        duplicates = 0
        skipped_no_id = 0
        for item in items:
            if not isinstance(item, dict): continue
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

    @staticmethod
    def save_menu_db_items(items: list[dict], preserve_art: bool = True) -> tuple[int, int, int]:
        items, duplicates, skipped_no_id = MenuService.dedupe_menu_items(items or [])
        parts = MenuService.split_menu_items(items)
        if preserve_art:
            parts["art"] = MenuService.load_art_db_items()

        MenuService._atomic_write_json(Config.MENU_KITCHEN_PATH, parts["kitchen"])
        MenuService._atomic_write_json(Config.MENU_WINE_PATH, parts["wine"])
        MenuService._atomic_write_json(Config.MENU_BAR_PATH, parts["bar"])
        MenuService._atomic_write_json(Config.MENU_TEA_PATH, parts["tea"])
        MenuService._atomic_write_json(Config.ART_DB_PATH, parts["art"])

        # Backups
        MenuService._atomic_write_json(Config.MENU_KITCHEN_BACKUP_PATH, parts["kitchen"])
        MenuService._atomic_write_json(Config.MENU_WINE_BACKUP_PATH, parts["wine"])
        MenuService._atomic_write_json(Config.MENU_BAR_BACKUP_PATH, parts["bar"])
        MenuService._atomic_write_json(Config.MENU_TEA_BACKUP_PATH, parts["tea"])
        MenuService._atomic_write_json(Config.ART_DB_BACKUP_PATH, parts["art"])
        
        combined = parts["kitchen"] + parts["wine"] + parts["bar"] + parts["tea"] + parts["art"]
        MenuService._atomic_write_json(Config.MENU_DB_PATH, combined)
        MenuService._atomic_write_json(Config.MENU_DB_BACKUP_PATH, combined)
        
        MenuService._MENU_DB_BY_ID_CACHE = None
        return len(items), duplicates, skipped_no_id

    @staticmethod
    def upsert_menu_db_item(incoming: dict) -> bool:
        if not isinstance(incoming, dict): raise ValueError("incoming must be a dict")
        item_id = str(incoming.get("id") or "").strip()
        if not item_id: raise ValueError("incoming must have non-empty id")

        incoming = dict(incoming)
        incoming["id"] = item_id

        items = MenuService.load_menu_db_items()
        existed = False
        replaced = False

        for idx, it in enumerate(items):
            if not isinstance(it, dict): continue
            it_id = str(it.get("id") or "").strip()
            if it_id == item_id:
                items[idx] = deep_merge_dicts(it, incoming)
                existed = True
                replaced = True
                break

        if not replaced:
            items.append(incoming)

        MenuService.save_menu_db_items(items, preserve_art=True)
        return existed

    @staticmethod
    def delete_menu_db_item(item_id: str) -> bool:
        norm_id = str(item_id or "").strip()
        if not norm_id: return False
        items = [it for it in MenuService.load_menu_db_items() if isinstance(it, dict)]
        before = len(items)
        items = [it for it in items if str(it.get("id") or "").strip() != norm_id]
        if len(items) == before:
            return False
        MenuService.save_menu_db_items(items, preserve_art=True)
        return True

    @staticmethod
    def get_menu_models():
        return (KitchenItem, WineItem, BarItem, TeaItem)
    
    @classmethod
    def model_for_menu_item(cls, item: dict):
        kind = cls.classify_menu_item(item)
        if kind == "wine": return WineItem
        if kind == "bar": return BarItem
        if kind == "tea": return TeaItem
        return KitchenItem

    @staticmethod
    def menu_item_exists(item_id: str) -> bool:
        norm_id = str(item_id or "").strip()
        if not norm_id: return False
        for model in MenuService.get_menu_models():
            if model.query.get(norm_id):
                return True
        return False

    @staticmethod
    def rebuild_dishes_table_from_items(items: list[dict]):
        parts = MenuService.split_menu_items(items or [])
        
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
            except Exception: db.session.rollback()
        for item in parts.get("wine", []):
            try:
                db.session.merge(WineItem.from_dict(item))
                success += 1
            except Exception: db.session.rollback()
        for item in parts.get("bar", []):
            try:
                db.session.merge(BarItem.from_dict(item))
                success += 1
            except Exception: db.session.rollback()
        for item in parts.get("tea", []):
            try:
                db.session.merge(TeaItem.from_dict(item))
                success += 1
            except Exception: db.session.rollback()
        db.session.commit()
        return success

    @staticmethod
    def rebuild_artworks_table_from_items(items: list[dict]):
        parts = MenuService.split_menu_items(items or [])
        Artwork.query.delete()
        db.session.commit()
        success = 0
        for item in parts.get("art", []):
            try:
                db.session.merge(Artwork.from_dict(item))
                success += 1
            except Exception: db.session.rollback()
        db.session.commit()
        return success

    @staticmethod
    def enrich_wine_dict(wine_dict: dict) -> dict:
        if not wine_dict or not wine_dict.get("id"): return wine_dict
        full = MenuService.load_menu_db_by_id().get(wine_dict["id"])
        if not full: return wine_dict

        extra_keys = ["origin", "region", "producer", "grapeVarieties", "features", "category", "alcoholContent"]
        for k in extra_keys:
            if k not in wine_dict and k in full:
                wine_dict[k] = full.get(k)
        return wine_dict

    @staticmethod
    def get_wines_dicts() -> list[dict]:
        try:
            wines = WineItem.query.all()
            if wines:
                json_by_id = MenuService.load_menu_db_by_id()
                out = []
                for w in wines:
                    base = w.to_dict()
                    full = json_by_id.get(base.get("id")) if isinstance(json_by_id, dict) else None
                    merged = deep_merge_dicts(full or {}, base)
                    out.append(MenuService.enrich_wine_dict(merged))
                return out
            items = MenuService.load_wine_db_items()
            return [item for item in items]
        except Exception as e:
            logger.exception(f"Error fetching wines: {e}")
            return []

    @staticmethod
    def get_bar_items_dicts() -> list[dict]:
        try:
            bar_items = BarItem.query.all()
            if bar_items:
                json_by_id = MenuService.load_menu_db_by_id()
                out = []
                for b in bar_items:
                    base = b.to_dict()
                    full = json_by_id.get(base.get("id")) if isinstance(json_by_id, dict) else None
                    out.append(deep_merge_dicts(full or {}, base))
                return out
            items = MenuService.load_bar_db_items()
            return [item for item in items]
        except Exception as e:
            logger.exception(f"Error fetching bar: {e}")
            return []

    @staticmethod
    def get_all_dishes_dicts_with_json_fallback() -> list[dict]:
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

        json_by_id = MenuService.load_menu_db_by_id()
        result = []
        seen = set()
        for it in MenuService.load_menu_db_items():
            if not isinstance(it, dict): continue
            item_id = str(it.get("id") or "").strip()
            if not item_id: continue
            if item_id in seen: continue
            seen.add(item_id)
            if item_id in db_by_id:
                full = json_by_id.get(item_id) if isinstance(json_by_id, dict) else None
                result.append(deep_merge_dicts(full or {}, db_by_id[item_id]))
            else:
                result.append(it)

        for item_id, db_item in db_by_id.items():
            if item_id in seen: continue
            full = json_by_id.get(item_id) if isinstance(json_by_id, dict) else None
            result.append(deep_merge_dicts(full or {}, db_item))
        
        return result

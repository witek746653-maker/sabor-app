
from flask import Blueprint, jsonify, request
from flask_login import current_user
from backend.services.menu_service import MenuService
from backend.models import VisibilityConfig, Artwork
from backend.utils import text_contains

bp = Blueprint('api_public', __name__)

# Поля, которые отдаём гостям (остальное — пусто)
GUEST_ALLOWED_FIELDS = {'id', 'title', 'section', 'menu', 'image', 'status', 'category'}

def _is_guest():
    """Проверяем, является ли текущий пользователь гостем."""
    if not current_user.is_authenticated:
        return True
    return getattr(current_user, 'id', None) in (0, 'guest', '0')

def _strip_for_guest(item_dict):
    """Для гостя оставляем только базовые поля и цензурим названия для определенных категорий."""
    if not _is_guest() or not isinstance(item_dict, dict):
        return item_dict
    
    # Список слов, при которых заголовок должен быть скрыт
    RESTRICTED_KEYWORDS = {'вино', 'wine', 'useful', 'статьи', 'media', 'подкаст'}
    
    res = {k: v for k, v in item_dict.items() if k in GUEST_ALLOWED_FIELDS}
    
    # Проверяем, нужно ли скрыть название
    menu = str(item_dict.get('menu') or '').lower()
    section = str(item_dict.get('section') or '').lower()
    category = str(item_dict.get('category') or '').lower()
    
    if any(k in menu or k in section or k in category for k in RESTRICTED_KEYWORDS):
        res['title'] = '🔒 Заблокировано'
    
    return res

@bp.route('/api/health', methods=['GET'])
def health_check():
    db_ok = False
    json_ok = False
    db_count = None
    json_count = None

    try:
        models = MenuService.get_menu_models()
        db_count = sum(m.query.count() for m in models)
        db_ok = True
    except Exception:
        db_ok = False

    try:
        items = MenuService.load_menu_db_items()
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

@bp.route('/api/config/visibility', methods=['GET'])
def get_visibility_config_public():
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

@bp.route('/api/menu-json', methods=['GET'])
def get_menu_json():
    try:
        return jsonify(MenuService.load_menu_db_items())
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/api/dishes', methods=['GET'])
def get_dishes():
    try:
        items = MenuService.get_all_dishes_dicts_with_json_fallback()
        if _is_guest():
            items = [_strip_for_guest(it) for it in items]
        return jsonify(items)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/api/dishes/<dish_id>', methods=['GET'])
def get_dish(dish_id):
    try:
        dish_id_norm = str(dish_id or "").strip()
        if not dish_id_norm:
            return jsonify({'error': 'Dish not found'}), 404

        # 1) Try DB
        found = None
        for model in MenuService.get_menu_models():
            found = model.query.get(dish_id_norm)
            if found: break
        
        if found:
            base = found.to_dict()
            full = MenuService.load_menu_db_by_id().get(dish_id_norm)
            result = MenuService.enrich_wine_dict(MenuService.deep_merge_dicts(full or {}, base))
            return jsonify(_strip_for_guest(result))

        # 2) Fallback JSON
        from_json = MenuService.load_menu_db_by_id().get(dish_id_norm)
        if isinstance(from_json, dict):
            return jsonify(_strip_for_guest(from_json))

        return jsonify({'error': 'Dish not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/api/menus', methods=['GET'])
def get_menus():
    try:
        menu_set = set()
        for item in MenuService.get_all_dishes_dicts_with_json_fallback():
            norm = MenuService.normalize_menu_value(item.get("menu"))
            if norm:
                menu_set.add(norm)
        
        filtered_ordered = [m for m in MenuService.ALLOWED_MENUS_ORDER if m in menu_set]
        return jsonify(filtered_ordered)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/api/sections', methods=['GET'])
def get_sections():
    try:
        menu_name = request.args.get('menu')
        items = MenuService.get_all_dishes_dicts_with_json_fallback()
        if menu_name:
            items = [it for it in items if it.get("menu") == menu_name]
        section_list = [it.get("section") for it in items if it.get("section")]
        return jsonify(sorted(section_list))
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/api/wines', methods=['GET'])
def get_wines():
    try:
        wines = MenuService.get_wines_dicts()
        if _is_guest():
            wines = [_strip_for_guest(w) for w in wines]
        return jsonify(wines)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/api/wines/category/<category>', methods=['GET'])
def get_wines_by_category(category):
    try:
        wines = MenuService.get_wines_dicts()
        filtered = [w for w in wines if isinstance(w, dict) and w.get("category") == category]
        if _is_guest():
            filtered = [_strip_for_guest(w) for w in filtered]
        return jsonify(filtered)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/api/wines/<wine_id>', methods=['GET'])
def get_wine(wine_id):
    try:
        wine_id_norm = str(wine_id or "").strip()
        from backend.models import WineItem
        wine = WineItem.query.get(wine_id_norm)
        if wine:
            base = wine.to_dict()
            full = MenuService.load_menu_db_by_id().get(base.get("id"))
            merged = MenuService.deep_merge_dicts(full or {}, base)
            result = MenuService.enrich_wine_dict(merged)
            return jsonify(_strip_for_guest(result))
        
        wine_dict = MenuService.load_menu_db_by_id().get(wine_id_norm)
        if wine_dict and (text_contains(wine_dict.get("menu"), MenuService.WINE_KEYWORDS) or 
                          text_contains(wine_dict.get("section"), MenuService.WINE_KEYWORDS)):
            return jsonify(_strip_for_guest(wine_dict))

        return jsonify({'error': 'Wine not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/api/artworks', methods=['GET'])
def get_artworks():
    try:
        return jsonify(MenuService.get_artworks_dicts())
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/api/artworks/<art_id>', methods=['GET'])
def get_artwork(art_id):
    try:
        art_id_norm = str(art_id or "").strip()
        if not art_id_norm:
             return jsonify({'error': 'Artwork id is required'}), 404

        # 1) Try DB
        found = Artwork.query.get(art_id_norm)
        if found:
            return jsonify(found.to_dict())

        # 2) Fallback JSON
        items = MenuService.load_art_db_items()
        found_item = next((x for x in items if str(x.get("id")) == art_id_norm), None)
        if found_item:
            return jsonify(found_item)

        return jsonify({'error': 'Artwork not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

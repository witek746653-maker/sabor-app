
import json
from flask import Blueprint, jsonify, request
from werkzeug.utils import secure_filename
from backend.services.menu_service import MenuService
from backend.routes.auth import check_admin_role, check_not_guest
from flask_login import login_required, current_user
from backend.extensions import db

bp = Blueprint('admin_menu', __name__)

@bp.route('/api/admin/menu/items', methods=['POST'])
@login_required
def save_menu_items():
    check = check_admin_role()
    if check: return check
    
    try:
        data = request.json
        if not isinstance(data, list):
            return jsonify({'error': 'Expected list of items'}), 400
        
        count, duplicates, skipped = MenuService.save_menu_db_items(data, preserve_art=True)
        return jsonify({
            'status': 'ok',
            'saved': count,
            'duplicates_removed': duplicates,
            'skipped_no_id': skipped
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/api/admin/menu/items', methods=['PUT'])
@login_required
def upsert_menu_item():
    guest_check = check_not_guest()
    if guest_check: return guest_check
    check = check_admin_role()
    if check: return check

    try:
        data = request.json
        if not isinstance(data, dict):
            return jsonify({'error': 'Expected item object'}), 400
        
        existed = MenuService.upsert_menu_db_item(data)
        return jsonify({
            'status': 'ok', 
            'action': 'updated' if existed else 'created',
            'item': data
        })
    except ValueError as val_err:
        return jsonify({'error': str(val_err)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/api/admin/menu/items/<item_id>', methods=['DELETE'])
@login_required
def delete_menu_item(item_id):
    guest_check = check_not_guest()
    if guest_check: return guest_check
    check = check_admin_role()
    if check: return check

    try:
        deleted = MenuService.delete_menu_db_item(item_id)
        if deleted:
            return jsonify({'status': 'ok', 'deleted_id': item_id})
        return jsonify({'error': 'Item not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route("/api/admin/menu/import", methods=["POST"])
@login_required
def admin_import_menu_json():
    check = check_admin_role()
    if check: return check

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

    items, duplicates, skipped_no_id = MenuService.dedupe_menu_items(data)
    kinds = { MenuService.classify_menu_item(it) for it in items if isinstance(it, dict) }
    is_partial = len(kinds) == 1
    only_kind = next(iter(kinds)) if is_partial else None

    try:
        if is_partial:
            if only_kind == "art":
                existing_menu = MenuService.load_menu_db_items()
                combined = existing_menu + items
                MenuService.save_menu_db_items(combined, preserve_art=False)
            else:
                existing_menu = MenuService.load_menu_db_items()
                parts = MenuService.split_menu_items(existing_menu)
                parts[only_kind] = items
                combined_menu = parts["kitchen"] + parts["wine"] + parts["bar"]
                MenuService.save_menu_db_items(combined_menu, preserve_art=True)
        else:
            MenuService.save_menu_db_items(items, preserve_art=False)
    except Exception as e:
        return jsonify({"error": f"Не удалось сохранить файл на сервере: {e}"}), 500

    try:
        # Reset cache logic is inside save_menu_db_items usually, or global in app.py
        # Given we moved it to MenuService, it handles cache clearing in save_menu_db_items.

        if is_partial:
            if only_kind == "art":
                imported = MenuService.rebuild_dishes_table_from_items(MenuService.load_menu_db_items())
                imported_art = MenuService.rebuild_artworks_table_from_items(items)
            else:
                imported = MenuService.rebuild_dishes_table_from_items(MenuService.load_menu_db_items())
                imported_art = 0
        else:
            imported = MenuService.rebuild_dishes_table_from_items(items)
            imported_art = MenuService.rebuild_artworks_table_from_items(items)
        
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
        # _is_readonly_db_error is not imported, let's just return generic 500
        return jsonify({"error": f"Ошибка применения меню: {e}"}), 500

@bp.route('/api/admin/dish/<dish_id>', methods=['POST', 'PUT'])
@login_required
def update_dish_admin(dish_id):
    guest_check = check_not_guest()
    if guest_check: return guest_check
    check = check_admin_role()
    if check: return check
    
    try:
        data = request.json or {}
        # This was implementing specific updates to KitchenItem/WineItem/etc in app.py
        # lines 2225+
        # It was using direct model access.
        
        models_list = MenuService.get_menu_models()
        target = None
        for m in models_list:
            target = m.query.get(dish_id)
            if target: break
            
        if not target:
            return jsonify({'error': 'Dish not found'}), 404

        if 'title' in data: target.title = data['title']
        if 'description' in data: target.description = data['description']
        if 'price' in data: target.price = data['price']
        if 'old_price' in data: target.old_price = data['old_price']
        if 'tech_card_link' in data: target.tech_card = data['tech_card_link']
        if 'image' in data: target.image = data['image']
        
        db.session.commit()
        return jsonify({'status': 'ok', 'dish': target.to_dict()})
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/api/admin/dish/<dish_id>', methods=['DELETE'])
@login_required
def delete_dish_admin(dish_id):
    guest_check = check_not_guest()
    if guest_check: return guest_check
    check = check_admin_role()
    if check: return check
    
    try:
        models_list = MenuService.get_menu_models()
        target = None
        for m in models_list:
            target = m.query.get(dish_id)
            if target: break
        
        if not target:
            return jsonify({'error': 'Dish not found'}), 404
            
        db.session.delete(target)
        db.session.commit()
        return jsonify({'status': 'ok'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

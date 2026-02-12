
from flask import Blueprint, send_from_directory, abort, jsonify
from flask_login import login_required
from backend.routes.auth import check_not_guest
import os

bp = Blueprint('useful_guides', __name__)

# Папка с секретными материалами
GUIDES_DIR = os.path.join(os.getcwd(), 'backend', 'private', 'useful_guides')

@bp.route('/api/useful/article/<key>', methods=['GET'])
@login_required
def get_article(key):
    """Отдает содержимое markdown-файла только авторизованным (не гостям)."""
    guest_check = check_not_guest()
    if guest_check: return guest_check
    # Защита от Path Traversal
    safe_key = os.path.basename(key)
    filename = f"{safe_key}.md"
    
    file_path = os.path.join(GUIDES_DIR, filename)
    
    if not os.path.exists(file_path):
        return jsonify({"error": "Article not found"}), 404
        
    try:
        return send_from_directory(GUIDES_DIR, filename)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp.route('/api/useful/manifest', methods=['GET'])
@login_required
def get_manifest():
    """Отдает манифест статей только авторизованным (не гостям)."""
    guest_check = check_not_guest()
    if guest_check: return guest_check
    filename = "manifest.json"
    file_path = os.path.join(GUIDES_DIR, filename)
    
    if not os.path.exists(file_path):
        return jsonify({"articles": []}), 200 # Возвращаем пустой список, если манифеста нет
        
    try:
        return send_from_directory(GUIDES_DIR, filename)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


import os
import mimetypes
import re
import json
from datetime import datetime
from flask import Blueprint, jsonify, send_from_directory, send_file, request
from backend.config import Config
from backend.routes.auth import check_not_guest
from flask_login import current_user

bp = Blueprint('static_pages', __name__)

# --- Tools Endpoints ---

@bp.route('/tools/<path:filename>')
def serve_tool(filename):
    """Serve static tool files and index.html for directories"""
    try:
        base_dir = Config.TOOLS_DIR
        file_path = base_dir / filename
        
        # Если это директория, ищем index.html внутри
        if base_dir.exists() and file_path.exists() and file_path.is_dir():
            index_path = file_path / 'index.html'
            if index_path.exists():
                # Перенаправляем на путь с index.html или просто отдаем его
                # Для корректной работы относительных путей в React-приложении
                # лучше отдавать index.html из этой папки
                relative_index = os.path.join(filename, 'index.html')
                return send_from_directory(str(base_dir), relative_index, mimetype='text/html')

        if base_dir.exists() and file_path.exists() and file_path.is_file():
            if filename.endswith('.html'):
                return send_from_directory(str(base_dir), filename, mimetype='text/html')
            else:
                return send_from_directory(str(base_dir), filename)
        else:
            return jsonify({'error': f'Tool or file not found: {filename}'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/api/tools/registry', methods=['GET'])
def get_tools_registry():
    """Return the list of tools from registry.json"""
    try:
        if Config.TOOLS_REGISTRY_PATH.exists():
            with open(Config.TOOLS_REGISTRY_PATH, 'r', encoding='utf-8') as f:
                data = json.load(f)
            resp = jsonify(data)
            resp.headers['Cache-Control'] = 'public, max-age=60'
            return resp
        else:
            # Fallback empty list if file doesn't exist yet
            return jsonify([])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- Standard Static Endpoints ---

@bp.route('/images/<path:filename>')
def serve_image(filename):
    try:
        guessed_mime, _ = mimetypes.guess_type(filename)
        build_images_dir = Config.FRONTEND_BUILD_DIR / "images"
        if build_images_dir.exists() and (build_images_dir / filename).exists():
            return send_from_directory(str(build_images_dir), filename, mimetype=guessed_mime)
        
        # 2. Затем в публичной папке фронтенда (для разработки)
        public_images_dir = Config.FRONTEND_PUBLIC_DIR / "images"
        if public_images_dir.exists() and (public_images_dir / filename).exists():
            return send_from_directory(str(public_images_dir), filename, mimetype=guessed_mime)

        # 3. Затем в папке images в корне
        if Config.IMAGES_DIR.exists() and (Config.IMAGES_DIR / filename).exists():
            return send_from_directory(str(Config.IMAGES_DIR), filename, mimetype=guessed_mime)
        return jsonify({'error': 'Image not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/audio/<path:filename>')
def serve_audio(filename):
    try:
        # 1. Сначала ищем в сборке фронтенда (для продакшена)
        build_audio_dir = Config.FRONTEND_BUILD_DIR / "audio"
        if build_audio_dir.exists() and (build_audio_dir / filename).exists():
            return send_from_directory(str(build_audio_dir), filename)

        # 2. Затем ищем в папке audio в корне (для локальной разработки или если вынесено отдельно)
        audio_file = Config.AUDIO_DIR / filename
        if Config.AUDIO_DIR.exists() and audio_file.exists() and audio_file.is_file():
            return send_from_directory(str(audio_file.parent), audio_file.name)
            
        return jsonify({'error': f'Audio file not found: {filename}'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/api/private/menus/<path:filename>', methods=['GET'])
def serve_private_menu_pdf(filename):
    if not current_user.is_authenticated:
        return jsonify({"error": "Not authenticated"}), 401
    guest_check = check_not_guest()
    if guest_check: return guest_check

    # Basic security check to prevent directory traversal
    safe_filename = os.path.basename(filename)
    if safe_filename != filename:
         return jsonify({"error": "Invalid filename"}), 400

    pdf_path = Config.PRIVATE_MENUS_DIR / filename
    if not pdf_path.exists():
        return jsonify({"error": "File not found"}), 404

    disposition = (request.args.get("disposition") or "").strip().lower()
    open_inline = disposition == "inline"
    
    # Determine friendly download name
    if filename == "latest.pdf":
        final_name = "Комплекс для новых сотрудников (актуальный).pdf"
    elif filename == "hostess_instruction.pdf":
        final_name = "Инструкция для хостес.pdf"
    else:
        final_name = filename
        
    response = send_file(
        str(pdf_path),
        mimetype="application/pdf",
        as_attachment=not open_inline,
        download_name=final_name,
        conditional=False,
        etag=False,
        max_age=0,
    )
    response.headers["Cache-Control"] = "private, no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

@bp.route('/menus/<path:filename>')
def serve_menu_html(filename):
    try:
        file_path = Config.MENUS_DIR / filename
        if Config.MENUS_DIR.exists() and file_path.exists() and file_path.is_file():
            if filename.endswith('.pdf'):
                return send_from_directory(str(Config.MENUS_DIR), filename, mimetype='application/pdf')
            elif filename.endswith('.html'):
                return send_from_directory(str(Config.MENUS_DIR), filename, mimetype='text/html')
            else:
                return send_from_directory(str(Config.MENUS_DIR), filename)
        return jsonify({'error': f'File not found: {filename}'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/trainer/<path:filename>')
def serve_trainer_html(filename):
    try:
        file_path = Config.TRAINER_DIR / filename
        if Config.TRAINER_DIR.exists() and file_path.exists() and file_path.is_file():
            if filename.endswith('.html'):
                return send_from_directory(str(Config.TRAINER_DIR), filename, mimetype='text/html')
            else:
                return send_from_directory(str(Config.TRAINER_DIR), filename)
        return jsonify({'error': f'File not found: {filename}'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/scripts/<path:filename>')
def serve_public_scripts(filename):
    try:
        file_path = Config.SCRIPTS_DIR / filename
        if Config.SCRIPTS_DIR.exists() and file_path.exists() and file_path.is_file():
            return send_from_directory(str(Config.SCRIPTS_DIR), filename)
        return jsonify({'error': f'File not found: {filename}'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

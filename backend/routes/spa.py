
from flask import Blueprint, jsonify, send_file, send_from_directory
from backend.config import Config
import mimetypes

bp = Blueprint('spa', __name__)

@bp.route('/', defaults={'path': ''})
@bp.route('/<path:path>')
def serve_frontend(path):
    if path.startswith('api/') or path.startswith('images/') or \
       path.startswith('audio/') or path.startswith('menus/') or \
       path.startswith('trainer/') or path.startswith('tools/'):
        return jsonify({'error': 'Not found'}), 404
    
    if path:
        requested_file = Config.FRONTEND_BUILD_DIR / path
        if requested_file.exists() and requested_file.is_file():
            guessed_mime, _ = mimetypes.guess_type(str(requested_file))
            return send_from_directory(str(Config.FRONTEND_BUILD_DIR), path, mimetype=guessed_mime)
    
    if Config.FRONTEND_INDEX.exists():
        return send_file(str(Config.FRONTEND_INDEX))
    else:
        return jsonify({
            'error': 'Frontend not built',
            'message': 'Please build the frontend first: cd frontend && npm run build'
        }), 503

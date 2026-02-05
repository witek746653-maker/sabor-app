
from flask import Blueprint, jsonify, request, session
from flask_login import login_user, logout_user, current_user, UserMixin
from backend.models import User
from backend.extensions import login_manager
from backend.config import Config
import logging

bp = Blueprint('auth', __name__)
logger = logging.getLogger(__name__)

class GuestUser(UserMixin):
    def __init__(self):
        self.id = 0
        self.name = 'Гость'
        self.username = 'guest'
        self.role = 'guest'
    
    def get_id(self):
        return str(self.id)
    
    @property
    def is_authenticated(self): return True
    @property
    def is_active(self): return True
    @property
    def is_anonymous(self): return False
    
    def to_dict(self):
        return {
            'id': 0,
            'name': self.name,
            'username': self.username,
            'role': self.role
        }

@login_manager.user_loader
def load_user(user_id):
    try:
        if not user_id: return None
        if str(user_id) == 'guest' or str(user_id) == '0':
            return GuestUser()
        user_id_int = int(user_id)
        return User.query.get(user_id_int)
    except (ValueError, TypeError):
        return None

def check_not_guest():
    if current_user.is_authenticated and (current_user.id == 0 or current_user.id == 'guest'):
        return jsonify({'error': 'Доступ запрещён. Гостевой режим поддерживает только просмотр данных.'}), 403
    return None

def check_admin_role():
    user = User.query.get(current_user.id)
    if not user or user.role != 'администратор':
        return jsonify({'error': 'Доступ запрещен', 'message': 'Только администратор'}), 403
    return None

@bp.route('/api/admin/login', methods=['POST'])
def admin_login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    remember = bool(data.get('remember')) if isinstance(data, dict) else False
    
    if not username or not password:
        return jsonify({'error': 'Логин и пароль обязательны'}), 400
    
    user = User.query.filter_by(username=username).first()
    
    if user and user.check_password(password):
        session.permanent = remember
        login_user(
            user,
            remember=remember,
            duration=Config.REMEMBER_COOKIE_DURATION if remember else None,
        )
        return jsonify({'status': 'ok', 'message': 'Успешный вход', 'user': user.to_dict()})
    else:
        return jsonify({'error': 'Неверный логин или пароль'}), 401

@bp.route('/api/admin/login/guest', methods=['POST'])
def guest_login():
    try:
        guest = GuestUser()
        login_user(guest, remember=False)
        return jsonify({
            'status': 'ok',
            'message': 'Вход в гостевой режим',
            'user': guest.to_dict()
        })
    except Exception as e:
        logger.error(f'Ошибка при входе гостя: {str(e)}')
        return jsonify({'error': f'Ошибка входа в гостевой режим: {str(e)}'}), 500

@bp.route('/api/admin/logout', methods=['POST'])
def admin_logout():
    logout_user()
    return jsonify({'status': 'ok'})

@bp.route('/api/admin/check', methods=['GET'])
def check_auth():
    if current_user.is_authenticated:
        if current_user.id == 'guest' or current_user.id == 0:
            return jsonify({
                'authenticated': True,
                'user': current_user.to_dict()
            })
        user = User.query.get(current_user.id)
        return jsonify({
            'authenticated': True,
            'user': user.to_dict() if user else None
        })
    else:
        return jsonify({'authenticated': False})

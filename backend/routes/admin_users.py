
from flask import Blueprint, jsonify, request
from backend.models import User
from backend.routes.auth import check_admin_role, check_not_guest
from flask_login import login_required, current_user
from backend.extensions import db

bp = Blueprint('admin_users', __name__)

@bp.route('/api/admin/users', methods=['GET'])
@login_required
def get_users():
    guest_check = check_not_guest()
    if guest_check: return guest_check
    check = check_admin_role()
    if check: return check
    
    try:
        users = User.query.order_by(User.created_at.desc()).all()
        return jsonify([user.to_dict() for user in users])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/api/admin/users', methods=['POST'])
@login_required
def create_user():
    guest_check = check_not_guest()
    if guest_check: return guest_check
    check = check_admin_role()
    if check: return check
    
    try:
        data = request.json
        name = data.get('name')
        username = data.get('username')
        password = data.get('password')
        role = data.get('role', 'официант')
        
        if not name or not username or not password:
            return jsonify({'error': 'Имя, логин и пароль обязательны'}), 400
        
        existing_user = User.query.filter_by(username=username).first()
        if existing_user:
            return jsonify({'error': 'Пользователь с таким логином уже существует'}), 400
        
        new_user = User(
            name=name,
            username=username,
            role=role if role else 'официант'
        )
        new_user.set_password(password)
        db.session.add(new_user)
        db.session.commit()
        
        return jsonify({'status': 'ok', 'message': 'Пользователь создан', 'user': new_user.to_dict()})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/api/admin/users/<int:user_id>', methods=['PUT'])
@login_required
def update_user(user_id):
    guest_check = check_not_guest()
    if guest_check: return guest_check
    check = check_admin_role()
    if check: return check
    
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'Пользователь не найден'}), 404
        
        data = request.json
        if 'name' in data:
            user.name = data['name']
        
        if 'username' in data:
            new_username = data['username']
            if new_username != user.username:
                existing_user = User.query.filter_by(username=new_username).first()
                if existing_user:
                    return jsonify({'error': 'Пользователь с таким логином уже существует'}), 400
                user.username = new_username
        
        if 'password' in data and data['password']:
            user.set_password(data['password'])
        
        if 'role' in data:
            user.role = data['role']
        
        db.session.commit()
        return jsonify({'status': 'ok', 'message': 'Пользователь обновлен', 'user': user.to_dict()})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
@login_required
def delete_user(user_id):
    guest_check = check_not_guest()
    if guest_check: return guest_check
    check = check_admin_role()
    if check: return check
    
    try:
        if current_user.id == user_id:
            return jsonify({'error': 'Нельзя удалить самого себя'}), 400
        
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'Пользователь не найден'}), 404
        
        db.session.delete(user)
        db.session.commit()
        return jsonify({'status': 'ok', 'message': 'Пользователь удален'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

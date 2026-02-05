
from flask import Blueprint, jsonify, request
from backend.models import Notification
from backend.routes.auth import check_admin_role, check_not_guest
from backend.utils import parse_datetime_local
from flask_login import login_required
from backend.extensions import db
from datetime import datetime

bp = Blueprint('admin_notifications', __name__)

@bp.route('/api/notifications/active', methods=['GET'])
def get_active_notifications():
    try:
        now = datetime.now()
        active = (
            Notification.query.filter_by(status='active')
            .filter(
                (Notification.lifetime_type != 'date')
                | (Notification.expires_at.is_(None))
                | (Notification.expires_at > now)
            )
            .order_by(Notification.created_at.desc())
            .all()
        )
        return jsonify([n.to_dict() for n in active])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/api/admin/notifications', methods=['GET'])
@login_required
def get_admin_notifications():
    check = check_admin_role()
    if check: return check
    try:
        notifs = Notification.query.order_by(Notification.created_at.desc()).all()
        return jsonify([n.to_dict() for n in notifs])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/api/admin/notifications', methods=['POST'])
@login_required
def create_admin_notification():
    guest_check = check_not_guest()
    if guest_check: return guest_check
    check = check_admin_role()
    if check: return check

    try:
        data = request.json or {}
        title = data.get('title')
        message = data.get('message')
        if not title or not message:
            return jsonify({'error': 'Title and message required'}), 400
        
        status = data.get('status', 'draft')
        lifetime_type = data.get('lifetimeType') or data.get('lifetime_type') or 'infinity'
        expires_raw = data.get('expiresAt') or data.get('expires_at')
        expires_at = parse_datetime_local(expires_raw)

        if lifetime_type == 'date' and not expires_at:
             return jsonify({'error': 'Expires date is required for date lifetime', 'message': 'Нужна дата окончания'}), 400

        notification = Notification(
            title=title,
            message=message,
            category=data.get('category') or 'info',
            type=data.get('type') or 'announcement',
            lifetime_type=lifetime_type,
            expires_at=expires_at,
            author=data.get('author') or '',
            status=status
        )
        db.session.add(notification)
        db.session.commit()
        return jsonify({'status': 'ok', 'notification': notification.to_dict()})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/api/admin/notifications/<int:notification_id>', methods=['PUT'])
@login_required
def update_admin_notification(notification_id):
    guest_check = check_not_guest()
    if guest_check: return guest_check
    check = check_admin_role()
    if check: return check

    try:
        data = request.json or {}
        notification = Notification.query.get(notification_id)
        if not notification:
            return jsonify({'error': 'Notification not found', 'message': 'Уведомление не найдено'}), 404

        if 'title' in data: notification.title = data.get('title') or ''
        if 'message' in data: notification.message = data.get('message') or ''
        if 'category' in data: notification.category = data.get('category') or ''
        if 'type' in data: notification.type = data.get('type') or 'announcement'
        if 'author' in data: notification.author = data.get('author') or ''
        if 'status' in data: notification.status = data.get('status') or 'draft'
        
        if 'lifetimeType' in data or 'lifetime_type' in data:
            notification.lifetime_type = data.get('lifetimeType') or data.get('lifetime_type')

        if 'expiresAt' in data or 'expires_at' in data:
            expires_raw = data.get('expiresAt') or data.get('expires_at')
            notification.expires_at = parse_datetime_local(expires_raw)

        if notification.lifetime_type == 'date' and not notification.expires_at:
            return jsonify({'error': 'Expires date is required for date lifetime', 'message': 'Нужна дата окончания'}), 400
        if notification.lifetime_type != 'date':
            notification.expires_at = None

        db.session.commit()
        return jsonify({'status': 'ok', 'notification': notification.to_dict()})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/api/admin/notifications/<int:notification_id>', methods=['DELETE'])
@login_required
def delete_admin_notification(notification_id):
    guest_check = check_not_guest()
    if guest_check: return guest_check
    check = check_admin_role()
    if check: return check
    try:
        notification = Notification.query.get(notification_id)
        if not notification:
            return jsonify({'error': 'Notification not found', 'message': 'Уведомление не найдено'}), 404
        db.session.delete(notification)
        db.session.commit()
        return jsonify({'status': 'ok'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

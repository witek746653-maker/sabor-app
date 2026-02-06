
from flask import Blueprint, jsonify, request
from backend.models import FeedbackMessage
from backend.services.feedback_service import FeedbackService
from backend.services.telegram_service import send_telegram_message
from backend.routes.auth import check_admin_role, check_not_guest
from flask_login import login_required
from backend.extensions import db
from datetime import datetime

bp = Blueprint('feedback', __name__)

@bp.route('/api/feedback', methods=['POST'])
def submit_feedback():
    raw_message = request.form.get('message', '')
    raw_contact = request.form.get('contact', '')
    raw_rating = request.form.get('rating')
    raw_type = request.form.get('type', 'feedback')
    files = request.files.getlist('attachments')
    
    # Clean up message tag fields if any
    clean_message = raw_message
    if "\n\nТеги:" in clean_message:
        clean_message = clean_message.split("\n\nТеги:")[0]

    try:
        saved_attachments = FeedbackService.save_attachments(files)
        
        import json
        fb = FeedbackMessage(
            message=clean_message,
            name=raw_contact, 
            type=raw_type,
            attachments_json=json.dumps(saved_attachments),
            meta_json=json.dumps({"rating": raw_rating}) if raw_rating else None
        )
        db.session.add(fb)
        db.session.commit()

        # Telegram notification
        status_line = f"Тип: {raw_type}"
        if raw_rating:
            status_line += f" | Оценка: {raw_rating}/5"
        
        lines = [
            f"📩 <b>Новое сообщение ({raw_type})</b>",
            f"👤 Контакт: {raw_contact or 'Аноним'}",
            status_line,
            "",
            clean_message or "(нет текста)"
        ]
        if saved_attachments:
            lines.append("")
            lines.append("📎 Вложения:")
            base_url = "https://sabor-de-la-vida.ru" # Should ideally be from config
            for att in saved_attachments:
                url_path = att.get('url', '')
                full_url = f"{base_url}{url_path}"
                lines.append(f"— <a href='{full_url}'>{att.get('name')}</a>")
        
        send_telegram_message("\n".join(lines))
        return jsonify({'status': 'ok', 'id': fb.id})
    except ValueError as ve:
        return jsonify({'error': str(ve)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Feedback save error', 'details': str(e)}), 500

@bp.route('/api/admin/feedback', methods=['GET'])
@login_required
def get_admin_feedback():
    check = check_admin_role()
    if check: return check
    try:
        query = FeedbackMessage.query.order_by(FeedbackMessage.created_at.desc())
        items = query.limit(200).all()
        return jsonify([f.to_dict() for f in items])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/api/admin/feedback/<int:msg_id>/read', methods=['POST'])
@login_required
def mark_feedback_read(msg_id):
    guest_check = check_not_guest()
    if guest_check: return guest_check
    check = check_admin_role()
    if check: return check
    try:
        fb = FeedbackMessage.query.get(msg_id)
        if not fb:
            return jsonify({'error': 'Not found'}), 404
        fb.read = True
        db.session.commit()
        return jsonify({'status': 'ok', 'item': fb.to_dict()})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

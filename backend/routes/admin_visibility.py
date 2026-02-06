
import json
from flask import Blueprint, jsonify, request, g
from backend.models import VisibilityConfig
from backend.services.visibility_service import VisibilityService
from backend.routes.auth import check_admin_role, check_not_guest
from flask_login import login_required
from backend.extensions import db

bp = Blueprint('admin_visibility', __name__)

@bp.route('/api/admin/visibility', methods=['GET'])
@login_required
def get_visibility_config_admin():
    check = check_admin_role()
    if check: return check
    
    try:
        published = (
            VisibilityConfig.query.filter_by(status="published")
            .order_by(VisibilityConfig.version.desc(), VisibilityConfig.updated_at.desc())
            .first()
        )
        draft = (
            VisibilityConfig.query.filter_by(status="draft")
            .order_by(VisibilityConfig.version.desc(), VisibilityConfig.updated_at.desc())
            .first()
        )
        history = (
            VisibilityConfig.query.order_by(VisibilityConfig.version.desc(), VisibilityConfig.updated_at.desc())
            .all()
        )
        return jsonify({
            "published": published.to_dict() if published else None,
            "draft": draft.to_dict() if draft else None,
            "versions": [
                {
                    "id": item.id,
                    "version": item.version,
                    "status": item.status,
                    "updated_at": item.updated_at.isoformat() if item.updated_at else None,
                    "updated_by": item.updated_by,
                }
                for item in history
            ],
        })
    except Exception as e:
        return jsonify({"error": "VISIBILITY_ADMIN_ERROR", "message": str(e)}), 500

@bp.route('/api/admin/visibility/draft', methods=['POST'])
@login_required
def save_visibility_draft():
    check = check_admin_role()
    if check: return check
    
    try:
        payload = request.json if isinstance(request.json, dict) else {}
        config = payload.get("config") if isinstance(payload.get("config"), dict) else payload

        error = VisibilityService.validate_config(config)
        if error:
            return jsonify({"error": "INVALID_VISIBILITY_CONFIG", "message": error}), 400

        published = (
            VisibilityConfig.query.filter_by(status="published")
            .order_by(VisibilityConfig.version.desc())
            .first()
        )
        draft = (
            VisibilityConfig.query.filter_by(status="draft")
            .order_by(VisibilityConfig.version.desc())
            .first()
        )
        next_version = draft.version if draft else ((published.version if published else 0) + 1)
        normalized = VisibilityService.normalize_config(config, version_override=next_version)
        actor = VisibilityService.get_actor_label()

        if draft:
            draft.config_json = json.dumps(normalized, ensure_ascii=False)
            draft.updated_by = actor
        else:
            draft = VisibilityConfig(
                status="draft",
                version=next_version,
                config_json=json.dumps(normalized, ensure_ascii=False),
                updated_by=actor,
            )
            db.session.add(draft)
        db.session.commit()

        return jsonify({
            "status": "ok",
            "draft": draft.to_dict(),
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "VISIBILITY_DRAFT_ERROR", "message": str(e)}), 500

@bp.route('/api/admin/visibility/update', methods=['POST'])
@login_required
def update_visibility_live():
    """
    Индустриальный стандарт: Live Toggle.
    Сразу сохраняет конфиг как 'published' и архивирует старый.
    """
    guest_check = check_not_guest()
    if guest_check: return guest_check
    check = check_admin_role()
    if check: return check

    data = request.get_json() or {}
    raw_config = data.get('config')
    
    if not raw_config:
        return jsonify({"error": "Config is required"}), 400

    try:
        # 1. Получаем текущую опубликованную версию для архивации
        current_pub = VisibilityConfig.query.filter_by(status='published').order_by(VisibilityConfig.version.desc()).first()
        
        reset_version = data.get('reset_version', False)
        if reset_version:
            new_version = 1
        else:
            current_version = current_pub.version if current_pub else 0
            new_version = current_version + 1

        # 2. Нормализуем данные
        service = VisibilityService()
        normalized_payload = service.normalize_config(raw_config, version_override=new_version)

        # 3. Архивируем текущую опубликованную версию
        if current_pub:
            current_pub.status = 'archived'

        # 4. Создаем новую опубликованную версию
        new_config = VisibilityConfig(
            status='published',
            version=new_version,
            config_json=json.dumps(normalized_payload, ensure_ascii=False),
            updated_by=g.user.username if hasattr(g, 'user') else 'admin'
        )
        
        # 5. Также обновляем черновик, чтобы они были синхронизированы
        draft = VisibilityConfig.query.filter_by(status='draft').first()
        if draft:
            draft.config_json = new_config.config_json
            draft.version = new_config.version
        else:
            new_draft = VisibilityConfig(
                status='draft',
                version=new_version,
                config_json=new_config.config_json,
                updated_by=new_config.updated_by
            )
            db.session.add(new_draft)

        db.session.add(new_config)
        db.session.commit()

        return jsonify({
            "message": "Configuration published live",
            "version": new_version,
            "config": normalized_payload
        })

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@bp.route('/api/admin/visibility/publish', methods=['POST'])
@login_required
def publish_visibility_config():
    check = check_admin_role()
    if check: return check
    
    try:
        payload = request.json if isinstance(request.json, dict) else {}
        version = payload.get("version")

        target = None
        if isinstance(version, int):
            target = VisibilityConfig.query.filter_by(version=version).first()
        if not target:
            target = (
                VisibilityConfig.query.filter_by(status="draft")
                .order_by(VisibilityConfig.version.desc())
                .first()
            )
        if not target:
            return jsonify({"error": "NO_DRAFT", "message": "Нет черновика для публикации"}), 400

        error = VisibilityService.validate_config(target.to_dict().get("config"))
        if error:
            return jsonify({"error": "INVALID_VISIBILITY_CONFIG", "message": error}), 400

        VisibilityConfig.query.filter_by(status="published").update({"status": "archived"})
        VisibilityConfig.query.filter_by(status="draft").update({"status": "archived"})
        target.status = "published"
        target.updated_by = VisibilityService.get_actor_label()
        db.session.commit()

        return jsonify({
            "status": "ok",
            "published": target.to_dict(),
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "VISIBILITY_PUBLISH_ERROR", "message": str(e)}), 500

@bp.route('/api/admin/visibility/rollback', methods=['POST'])
@login_required
def rollback_visibility_config():
    check = check_admin_role()
    if check: return check
    
    try:
        payload = request.json if isinstance(request.json, dict) else {}
        version = payload.get("version")
        if not isinstance(version, int):
            return jsonify({"error": "INVALID_VERSION", "message": "version must be integer"}), 400

        if version == 0:
            empty_config = {"version": 0, "rules": [], "features": {}}
            actor = VisibilityService.get_actor_label()
            VisibilityConfig.query.filter_by(status="published").update({"status": "archived"})
            VisibilityConfig.query.filter_by(status="draft").update({"status": "archived"})
            target = VisibilityConfig(
                status="published",
                version=0,
                config_json=json.dumps(empty_config, ensure_ascii=False),
                updated_by=actor,
            )
            db.session.add(target)
            db.session.commit()
        else:
            target = VisibilityConfig.query.filter_by(version=version).first()
            if not target:
                return jsonify({"error": "NOT_FOUND", "message": "Version not found"}), 404

            VisibilityConfig.query.filter_by(status="published").update({"status": "archived"})
            VisibilityConfig.query.filter_by(status="draft").update({"status": "archived"})
            target.status = "published"
            target.updated_by = VisibilityService.get_actor_label()
            db.session.commit()

        return jsonify({
            "status": "ok",
            "published": target.to_dict(),
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "VISIBILITY_ROLLBACK_ERROR", "message": str(e)}), 500

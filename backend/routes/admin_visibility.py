
import json
from flask import Blueprint, jsonify, request
from backend.models import VisibilityConfig
from backend.services.visibility_service import VisibilityService
from backend.routes.auth import check_admin_role
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

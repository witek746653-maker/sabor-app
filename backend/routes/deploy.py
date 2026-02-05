
from flask import Blueprint, jsonify, request
from backend.services.deploy_service import DeployService
from backend.config import Config
from backend.routes.auth import check_admin_role
from flask_login import login_required

bp = Blueprint('deploy', __name__)

@bp.route("/api/admin/deploy/status", methods=["GET"])
@login_required
def admin_deploy_status():
    check = check_admin_role()
    if check: return check
    
    return jsonify({
        "enabled": Config.ADMIN_DEPLOY_ENABLED and bool(Config.DEPLOY_ADMIN_TOKEN),
        "state": DeployService.STATE,
    })

@bp.route("/api/admin/deploy/run", methods=["POST"])
@login_required
def admin_deploy_run():
    check = check_admin_role()
    if check: return check

    if not (Config.ADMIN_DEPLOY_ENABLED and Config.DEPLOY_ADMIN_TOKEN):
        return jsonify({"error": "Deploy disabled"}), 403

    token = request.headers.get("X-Deploy-Token", "").strip()
    if token != Config.DEPLOY_ADMIN_TOKEN:
        return jsonify({"error": "Bad deploy token"}), 403

    started = DeployService.start_deploy_thread()
    if not started:
        return jsonify({"error": "Deploy already running", "state": DeployService.STATE}), 409

    return jsonify({"status": "started", "state": DeployService.STATE})

@bp.route("/api/admin/deploy/job", methods=["GET"])
@login_required
def admin_deploy_job():
    check = check_admin_role()
    if check: return check
    return jsonify(DeployService.STATE)

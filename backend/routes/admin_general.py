
import json
from datetime import datetime
from flask import Blueprint, jsonify
from backend.models import User, FeedbackMessage, Notification, MediaLike, VisibilityConfig
from backend.models import KitchenItem, WineItem, BarItem, TeaItem, Artwork
from backend.services.menu_service import MenuService
from backend.routes.auth import check_admin_role
from flask_login import login_required

bp = Blueprint('admin_general', __name__)

@bp.route('/api/admin/sidebar-stats', methods=['GET'])
@login_required
def get_admin_sidebar_stats():
    check = check_admin_role()
    if check: return check
    
    try:
        users_total = User.query.count()
        feedback_unread = FeedbackMessage.query.filter_by(read=False).count()
        
        now = datetime.now()
        notifications_active = (
            Notification.query.filter_by(status='active')
            .filter(
                (Notification.lifetime_type != 'date')
                | (Notification.expires_at.is_(None))
                | (Notification.expires_at > now)
            )
            .count()
        )
        
        media_likes_total = MediaLike.query.count()
        
        visibility_rules_active = 0
        published = (
            VisibilityConfig.query.filter_by(status="published")
            .order_by(VisibilityConfig.version.desc(), VisibilityConfig.updated_at.desc())
            .first()
        )
        if published:
            try:
                payload = json.loads(published.config_json) if published.config_json else {}
            except Exception:
                payload = {}
            rules = payload.get("rules") if isinstance(payload.get("rules"), list) else []
            visibility_rules_active = sum(
                1 for rule in rules
                if isinstance(rule, dict) and rule.get("enabled", True) is not False
            )
            
        wine_items = WineItem.query.count()
        bar_items = BarItem.query.count()
        tea_items = TeaItem.query.count()
        kitchen_items = KitchenItem.query.count()
        art_items = Artwork.query.count()

        if wine_items == 0 or bar_items == 0 or tea_items == 0 or kitchen_items == 0 or art_items == 0:
            items = MenuService.load_menu_db_items()
            # Also load art specific items as they might be separate
            art_json_items = MenuService.load_art_db_items()
            
            if items or art_json_items:
                parts = MenuService.split_menu_items(items)
                if wine_items == 0: wine_items = len(parts.get("wine") or [])
                if bar_items == 0: bar_items = len(parts.get("bar") or [])
                if tea_items == 0: tea_items = len(parts.get("tea") or [])
                if kitchen_items == 0: kitchen_items = len(parts.get("kitchen") or [])
                if art_items == 0: art_items = len(art_json_items)

        return jsonify({
            "users": users_total,
            "feedbackUnread": feedback_unread,
            "notificationsActive": notifications_active,
            "mediaLikesTotal": media_likes_total,
            "visibilityRulesActive": visibility_rules_active,
            "kitchenItems": kitchen_items,
            "wineItems": wine_items,
            "barItems": bar_items,
            "teaItems": tea_items,
            "artItems": art_items,
        })
    except Exception as e:
        return jsonify({"error": "ADMIN_SIDEBAR_STATS_ERROR", "message": str(e)}), 500

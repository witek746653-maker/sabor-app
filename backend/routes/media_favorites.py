
from flask import Blueprint, jsonify, request
from backend.models import FavoriteItem, MediaLike
from backend.extensions import db
from backend.routes.auth import check_not_guest
from flask_login import login_required, current_user
from sqlalchemy.exc import IntegrityError

bp = Blueprint('media_favorites', __name__)

FAVORITE_ALLOWED_TYPES = {"catalog", "media", "article"}

def _normalize_favorite_type(val):
    s = str(val or "").strip().lower()
    return s if s in FAVORITE_ALLOWED_TYPES else None

def _normalize_favorite_id(val):
    return str(val or "").strip()

def _favorites_response(items):
    out = {t: [] for t in FAVORITE_ALLOWED_TYPES}
    for it in items:
        if it.item_type in out:
            out[it.item_type].append(it.item_id)
    return out

@bp.route('/api/favorites', methods=['GET'])
@login_required
def get_favorites():
    guest_check = check_not_guest()
    if guest_check: return guest_check
    try:
        user_id = int(current_user.id)
        items = FavoriteItem.query.filter_by(user_id=user_id).all()
        return jsonify(_favorites_response(items))
    except Exception as e:
        return jsonify({'error': 'FAVORITES_READ_ERROR', 'message': str(e)}), 500

@bp.route('/api/favorites', methods=['POST'])
@login_required
def update_favorite():
    guest_check = check_not_guest()
    if guest_check: return guest_check
    
    payload = request.json if isinstance(request.json, dict) else {}
    fav_type = _normalize_favorite_type(payload.get("type"))
    item_id = _normalize_favorite_id(payload.get("id"))
    action = str(payload.get("action") or "toggle").strip().lower()

    if not fav_type:
        return jsonify({'error': 'FAVORITES_BAD_REQUEST', 'message': 'type обязателен'}), 400
    if not item_id:
        return jsonify({'error': 'FAVORITES_BAD_REQUEST', 'message': 'id обязателен'}), 400
        
    try:
        user_id = int(current_user.id)
        existing = FavoriteItem.query.filter_by(user_id=user_id, item_type=fav_type, item_id=item_id).first()
        
        if action == "remove":
            if existing:
                db.session.delete(existing)
                db.session.commit()
        elif action == "add":
            if not existing:
                db.session.add(FavoriteItem(user_id=user_id, item_type=fav_type, item_id=item_id))
                db.session.commit()
        else: # toggle
            if existing:
                db.session.delete(existing)
            else:
                db.session.add(FavoriteItem(user_id=user_id, item_type=fav_type, item_id=item_id))
            db.session.commit()
            
        items = FavoriteItem.query.filter_by(user_id=user_id).all()
        return jsonify(_favorites_response(items))
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'FAVORITES_UPDATE_ERROR', 'message': str(e)}), 500

@bp.route('/api/media/<media_id>/like-toggle', methods=['POST'])
@login_required
def toggle_media_like(media_id):
    guest_check = check_not_guest()
    if guest_check: return guest_check
    
    media_id_norm = str(media_id or '').strip()
    if not media_id_norm:
        return jsonify({'error': 'MEDIA_ID_REQUIRED', 'message': 'media_id обязателен'}), 400

    try:
        user_id = int(current_user.id)
        existing = MediaLike.query.filter_by(media_id=media_id_norm, user_id=user_id).first()
        liked_by_me = False
        
        if existing:
            db.session.delete(existing)
            db.session.commit()
            liked_by_me = False
        else:
            db.session.add(MediaLike(media_id=media_id_norm, user_id=user_id))
            try:
                db.session.commit()
                liked_by_me = True
            except IntegrityError:
                db.session.rollback()
                still_exists = MediaLike.query.filter_by(media_id=media_id_norm, user_id=user_id).first()
                liked_by_me = bool(still_exists)

        count = MediaLike.query.filter_by(media_id=media_id_norm).count()
        return jsonify({'count': int(count), 'likedByMe': liked_by_me})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'MEDIA_LIKE_TOGGLE_ERROR', 'message': str(e)}), 500
        
@bp.route('/api/media/likes-batch', methods=['POST'])
def get_media_likes_batch():
    # Only authenticated? App.py snippet didn't imply it, but context suggests.
    # Actually, batch check might be public for viewing counts?
    # Snippet 1650 logic: 
    # if current_user.is_authenticated ... check liked_by_me.
    # else liked_by_me = False.
    # So it IS public.
    
    try:
        payload = request.json if isinstance(request.json, dict) else {}
        ids = payload.get("ids")
        if not isinstance(ids, list):
             return jsonify({'counts': {}, 'likedByMe': {}})
        
        ids = [str(x).strip() for x in ids if x]
        if not ids:
             return jsonify({'counts': {}, 'likedByMe': {}})
             
        # Count query
        # SELECT media_id, COUNT(*) FROM media_likes WHERE media_id IN (...) GROUP BY media_id
        from sqlalchemy import func
        rows = db.session.query(MediaLike.media_id, func.count(MediaLike.id))\
                         .filter(MediaLike.media_id.in_(ids))\
                         .group_by(MediaLike.media_id).all()
        counts = {r[0]: r[1] for r in rows}
        
        liked_by_me = {}
        if current_user.is_authenticated and current_user.id != 0:
            user_id = int(current_user.id)
            liked_rows = db.session.query(MediaLike.media_id)\
                                   .filter(MediaLike.media_id.in_(ids))\
                                   .filter(MediaLike.user_id == user_id).all()
            user_likes = {r[0] for r in liked_rows}
            liked_by_me = {mid: (mid in user_likes) for mid in ids}
        else:
            liked_by_me = {mid: False for mid in ids}
            
        for mid in ids:
            counts.setdefault(mid, 0)
            liked_by_me.setdefault(mid, False)
            
        return jsonify({'counts': counts, 'likedByMe': liked_by_me})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

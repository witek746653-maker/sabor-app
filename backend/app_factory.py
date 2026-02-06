
from flask import Flask, jsonify
from backend.config import Config
from backend.extensions import db, login_manager, init_sentry, init_cors
from backend.services.menu_service import MenuService
from backend.models import User, VisibilityConfig, Notification
import os

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Initialize Extensions
    init_sentry(app)
    init_cors(app, Config.CORS_ORIGINS)
    db.init_app(app)
    login_manager.init_app(app)
    login_manager.login_view = None # We use API only, no redirect

    with app.app_context():
        # Create Tables
        db.create_all()
        
        # Ensure initial data
        MenuService.ensure_split_menu_files()
        
        # Bootstrap Admin if needed
        _bootstrap_admin_if_configured()

        from backend.routes import (
            api_public, auth, admin_menu, admin_users, admin_visibility, 
            admin_notifications, feedback, deploy, media_favorites, 
            admin_general, static_pages, useful_guides, spa
        )

        app.register_blueprint(static_pages.bp) # Static first to catch specific paths
        app.register_blueprint(api_public.bp)
        app.register_blueprint(auth.bp)
        app.register_blueprint(admin_menu.bp)
        app.register_blueprint(admin_users.bp)
        app.register_blueprint(admin_visibility.bp)
        app.register_blueprint(admin_notifications.bp)
        app.register_blueprint(admin_general.bp)
        app.register_blueprint(feedback.bp)
        app.register_blueprint(deploy.bp)
        app.register_blueprint(media_favorites.bp)
        app.register_blueprint(useful_guides.bp)
        
        # SPA last (catch-all)
        app.register_blueprint(spa.bp)

    return app

def _bootstrap_admin_if_configured():
    """
    KISS-предохранитель: если база пустая/сброшена и админа нет,
    то можем создать первого администратора из переменных окружения.
    """
    username = Config.BOOTSTRAP_ADMIN_USERNAME
    password = Config.BOOTSTRAP_ADMIN_PASSWORD
    name = Config.BOOTSTRAP_ADMIN_NAME

    # Если не настроили переменные — ничего не делаем
    if not username or not password:
        return

    try:
        # Если админ уже есть — ничего не делаем
        if User.query.filter_by(role="администратор").first() is not None:
            return

        # Если пользователь с таким логином уже существует (но не админ) — не меняем роли автоматически
        if User.query.filter_by(username=username).first() is not None:
            return

        # Создаём админа
        admin = User(name=name, username=username, role="администратор")
        admin.set_password(password)
        db.session.add(admin)
        db.session.commit()
        print(f"Bootstrapped admin user: {username}")
    except Exception as e:
        print(f"Failed to bootstrap admin: {e}")

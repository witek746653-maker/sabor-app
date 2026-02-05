
import os
import logging
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from flask_cors import CORS
from sentry_sdk.integrations.flask import FlaskIntegration
from sentry_sdk.integrations.logging import LoggingIntegration

# Initialize SQLAlchemy
db = SQLAlchemy()

# Initialize LoginManager
login_manager = LoginManager()

# Sentry
try:
    import sentry_sdk
except ImportError:
    sentry_sdk = None

def init_sentry(app):
    if sentry_sdk is None:
        return

    dsn = (os.getenv("SENTRY_DSN") or "").strip()
    if not dsn:
        return
        
    enabled = (os.getenv("SENTRY_ENABLED") or "true").strip().lower() in ("1", "true", "yes", "y", "on")
    if not enabled:
        return

    logging_integration = LoggingIntegration(level=None, event_level=logging.ERROR)

    def _sentry_before_send(event, hint):
        try:
            req = event.get("request") if isinstance(event, dict) else None
            if isinstance(req, dict):
                headers = req.get("headers")
                if isinstance(headers, dict):
                    for key in list(headers.keys()):
                        if str(key).lower() in ("authorization", "cookie", "set-cookie"):
                            headers[key] = "[REDACTED]"

                data = req.get("data")
                if isinstance(data, dict):
                    for key in list(data.keys()):
                        lk = str(key).lower()
                        if "password" in lk or "token" in lk or "secret" in lk:
                            data[key] = "[REDACTED]"
        except Exception:
            pass
        return event

    sentry_sdk.init(
        dsn=dsn,
        integrations=[FlaskIntegration(), logging_integration],
        traces_sample_rate=0.0,
        send_default_pii=False,
        environment=(os.getenv("SENTRY_ENV") or os.getenv("FLASK_ENV") or "production").strip(),
        release=(os.getenv("SENTRY_RELEASE") or "").strip() or None,
        before_send=_sentry_before_send,
    )

def init_cors(app, origins):
    CORS(
        app,
        supports_credentials=True,
        resources={r"/api/*": {"origins": origins}},
        allow_headers=["Content-Type", "Authorization"],
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    )

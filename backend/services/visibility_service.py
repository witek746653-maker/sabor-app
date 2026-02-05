
from flask_login import current_user
from backend.models import User, VisibilityConfig
from backend.extensions import db
from backend.utils import safe_json_load
import json

class VisibilityService:
    ALLOWED_SCOPES = {
        "route", "menuItem", "menuSection", "pageBlock", "featureAction", "contentItem"
    }

    ALLOWED_ACTIONS = {"allow", "deny"}

    @staticmethod
    def get_actor_label():
        try:
            if not current_user.is_authenticated:
                return None
            user = User.query.get(current_user.id)
            if not user:
                return None
            username = (user.username or "").strip()
            name = (user.name or "").strip()
            if username and name and username != name:
                return f"{username} ({name})"
            return username or name or None
        except Exception:
            return None

    @staticmethod
    def validate_config(payload):
        if not isinstance(payload, dict):
            return "Payload must be an object"
        rules = payload.get("rules")
        if not isinstance(rules, list):
            return "rules must be an array"
        for idx, rule in enumerate(rules):
            if not isinstance(rule, dict):
                return f"rules[{idx}] must be an object"
            rule_id = rule.get("id")
            scope = rule.get("scope")
            target = rule.get("target")
            action = rule.get("action")
            enabled = rule.get("enabled", True)
            when = rule.get("when") if isinstance(rule.get("when"), dict) else None

            if not isinstance(rule_id, str) or not rule_id.strip():
                return f"rules[{idx}].id must be a non-empty string"
            if scope not in VisibilityService.ALLOWED_SCOPES:
                return f"rules[{idx}].scope must be one of: {sorted(VisibilityService.ALLOWED_SCOPES)}"
            if not isinstance(target, str) or not target.strip():
                return f"rules[{idx}].target must be a non-empty string"
            if action not in VisibilityService.ALLOWED_ACTIONS:
                return f"rules[{idx}].action must be one of: {sorted(VisibilityService.ALLOWED_ACTIONS)}"
            if not isinstance(enabled, bool):
                return f"rules[{idx}].enabled must be boolean"

            if when is not None:
                allowed_when_keys = {
                    "roles", "isGuest", "isAdmin", "canWrite", "isAuthenticated", "userIds", "everyone"
                }
                for key in when.keys():
                    if key not in allowed_when_keys:
                        return f"rules[{idx}].when has unknown key: {key}"
                roles = when.get("roles")
                user_ids = when.get("userIds")
                if roles is not None and (not isinstance(roles, list) or not all(isinstance(r, str) for r in roles)):
                    return f"rules[{idx}].when.roles must be array of strings"
                if user_ids is not None and (not isinstance(user_ids, list) or not all(isinstance(u, (str, int)) for u in user_ids)):
                    return f"rules[{idx}].when.userIds must be array of strings or numbers"
        return None

    @staticmethod
    def normalize_config(payload, version_override=None, current_version=None):
        config = dict(payload or {})
        rules = config.get("rules") if isinstance(config.get("rules"), list) else []
        features = config.get("features") if isinstance(config.get("features"), dict) else {}
        normalized_rules = []
        for rule in rules:
            if not isinstance(rule, dict):
                continue
            normalized = dict(rule)
            normalized["id"] = str(normalized.get("id") or "").strip()
            normalized["scope"] = str(normalized.get("scope") or "").strip()
            normalized["target"] = str(normalized.get("target") or "").strip()
            normalized["action"] = str(normalized.get("action") or "").strip()
            normalized["enabled"] = bool(normalized.get("enabled", True))
            when = normalized.get("when")
            if isinstance(when, dict):
                normalized["when"] = dict(when)
            elif when is None:
                normalized["when"] = None
            else:
                normalized["when"] = None
            normalized_rules.append(normalized)
        
        normalized_features = {}
        for key, raw in (features or {}).items():
            try:
                feature_key = str(key).strip()
            except Exception:
                continue
            if not feature_key:
                continue
            raw_obj = raw if isinstance(raw, dict) else {}
            normalized_features[feature_key] = {
                "comingSoon": bool(raw_obj.get("comingSoon", False)),
                "allowAccess": bool(raw_obj.get("allowAccess", False)),
            }

        normalized_config = {
            "rules": normalized_rules,
            "features": normalized_features,
        }
        if isinstance(version_override, int):
            normalized_config["version"] = version_override
        elif isinstance(config.get("version"), int):
            normalized_config["version"] = config.get("version")
        
        return normalized_config

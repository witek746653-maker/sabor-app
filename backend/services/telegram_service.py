
import json
import urllib.request
import urllib.error
import logging
from backend.config import Config

logger = logging.getLogger(__name__)

def send_telegram_message(text: str) -> bool:
    if not Config.TELEGRAM_ENABLED:
        return False
    if not Config.TELEGRAM_BOT_TOKEN or not Config.TELEGRAM_CHAT_ID:
        return False
    try:
        payload = {
            "chat_id": Config.TELEGRAM_CHAT_ID,
            "text": text,
            "disable_web_page_preview": True,
        }
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        url = f"https://api.telegram.org/bot{Config.TELEGRAM_BOT_TOKEN}/sendMessage"
        req = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=6) as resp:
            _ = resp.read()
        return True
    except Exception as e:
        logger.warning(f"Telegram send failed: {e}")
        return False


import os
import uuid
import json
from pathlib import Path
from werkzeug.utils import secure_filename
from backend.config import Config

class FeedbackService:
    @staticmethod
    def get_file_size(file_storage) -> int:
        try:
            pos = file_storage.stream.tell()
            file_storage.stream.seek(0, os.SEEK_END)
            size = file_storage.stream.tell()
            file_storage.stream.seek(pos)
            return int(size)
        except Exception:
            return 0

    @staticmethod
    def save_attachments(files: list):
        allowed_ext = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
        saved = []
        Config.FEEDBACK_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        files_list = list(files or [])
        if len(files_list) > 5:
            raise ValueError("Слишком много вложений")
        for f in files_list:
            if not f or not getattr(f, "filename", ""):
                continue
            raw_name = secure_filename(f.filename)
            ext = Path(raw_name).suffix.lower()
            if ext not in allowed_ext:
                raise ValueError("Неподдерживаемый тип файла")
            if not (f.mimetype or "").startswith("image/"):
                raise ValueError("Неподдерживаемый тип файла")
            size = FeedbackService.get_file_size(f)
            unique = f"{uuid.uuid4().hex}{ext or '.png'}"
            save_path = Config.FEEDBACK_UPLOAD_DIR / unique
            f.save(save_path)
            saved.append({
                "url": f"/static/uploads/feedback/{unique}",
                "name": raw_name or unique,
                "size": size,
                "type": f.mimetype or "image/*",
            })
        return saved


import subprocess
import time
import os
import signal
import threading
from pathlib import Path
from backend.config import Config

class DeployService:
    STATE = {
        "status": "idle",  # idle | running | done | error
        "started_at": None,
        "finished_at": None,
        "step": None,
        "log": [],
        "error": None,
    }

    @classmethod
    def log(cls, line: str):
        try:
            cls.STATE["log"].append(str(line))
            cls.STATE["log"] = cls.STATE["log"][-200:]
        except Exception:
            pass

    @classmethod
    def _run_cmd(cls, cmd: list[str], cwd: Path | None = None):
        cls.log(f"$ {' '.join(cmd)}")
        res = subprocess.run(
            cmd,
            cwd=str(cwd) if cwd else None,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        out = (res.stdout or "").strip()
        if out:
            for line in out.splitlines()[-50:]:
                cls.log(line)
        if res.returncode != 0:
            raise RuntimeError(f"Command failed ({res.returncode}): {' '.join(cmd)}")

    @classmethod
    def _kill_parent(cls):
        time.sleep(0.5)
        try:
            os.kill(os.getppid(), signal.SIGTERM)
        except Exception:
            pass

    @classmethod
    def run_deploy(cls):
        cls.STATE["status"] = "running"
        cls.STATE["started_at"] = time.time()
        cls.STATE["finished_at"] = None
        cls.STATE["error"] = None
        cls.STATE["log"] = []
        try:
            cls.STATE["step"] = "git pull"
            cls._run_cmd(["git", "-C", str(Config.ROOT_DIR), "pull"])

            cls.STATE["step"] = "frontend build"
            cls._run_cmd(["npm", "ci"], cwd=Config.ROOT_DIR / "frontend")
            cls._run_cmd(["npm", "run", "build"], cwd=Config.ROOT_DIR / "frontend")

            cls.STATE["step"] = "migrate db"
            cls._run_cmd([str(Config.ROOT_DIR / "venv" / "bin" / "python3"), str(Config.BACKEND_DIR / "migrate_to_db.py"), "--yes"])

            cls.STATE["step"] = "restart (self-terminate master)"
            cls.STATE["status"] = "done"
            cls.STATE["finished_at"] = time.time()

            threading.Thread(target=cls._kill_parent, daemon=True).start()
        except Exception as e:
            cls.STATE["status"] = "error"
            cls.STATE["error"] = str(e)
            cls.STATE["finished_at"] = time.time()
            cls.log(f"ERROR: {e}")

    @classmethod
    def start_deploy_thread(cls):
        if cls.STATE.get("status") == "running":
            return False
        threading.Thread(target=cls.run_deploy, daemon=True).start()
        return True

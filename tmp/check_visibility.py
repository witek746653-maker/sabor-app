
import os
import sys
import json

# Add project root to sys.path
project_root = r"d:\GitHub\sabor-app"
sys.path.append(project_root)

from backend.app_factory import create_app
from backend.models import VisibilityConfig

app = create_app()
with app.app_context():
    published = (
        VisibilityConfig.query.filter_by(status="published")
        .order_by(VisibilityConfig.version.desc())
        .first()
    )
    if published:
        config = json.loads(published.config_json)
        print(json.dumps(config, indent=2, ensure_ascii=False))
    else:
        print("No published visibility configuration found.")

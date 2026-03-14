# --- Settings ---
REMOTE_USER = romka
REMOTE_HOST = 85.198.98.16
REMOTE_DIR = /var/www/sabor-app
SERVICE_NAME = sabor.service

# --- Local Paths ---
DATA_SRC = ./data/
IMAGES_SRC = ./images/
AUDIO_SRC = ./audio/
ICONS_SRC = ./icons/
BACKEND_SRC = ./backend/
FRONTEND_BUILD = ./frontend/build/

# SSH options
SSH_ARGS = -o StrictHostKeyChecking=accept-new

.PHONY: up sync-data sync-backend sync-frontend restart

# Full deploy: Sync everything and restart
up: sync-data sync-backend sync-frontend restart

# Sync only JSON data
sync-data:
	rsync -avz --progress $(SSH_ARGS) $(DATA_SRC)*.json $(REMOTE_USER)@$(REMOTE_HOST):$(REMOTE_DIR)/data/

# Sync backend code (excluding DB and env)
sync-backend:
	rsync -avz --progress $(SSH_ARGS) \
		--exclude='*.db' \
		--exclude='.env' \
		--exclude='__pycache__/' \
		--exclude='venv/' \
		$(BACKEND_SRC) $(REMOTE_USER)@$(REMOTE_HOST):$(REMOTE_DIR)/backend/

# Sync frontend build
sync-frontend:
	@if [ -d "$(FRONTEND_BUILD)" ]; then \
		rsync -avz --progress --delete $(SSH_ARGS) $(FRONTEND_BUILD) $(REMOTE_USER)@$(REMOTE_HOST):$(REMOTE_DIR)/frontend/build/; \
	else \
		echo "Error: $(FRONTEND_BUILD) not found. Run 'npm run build' in frontend folder first."; \
		exit 1; \
	fi

# Restart server service
restart:
	ssh $(SSH_ARGS) $(REMOTE_USER)@$(REMOTE_HOST) "sudo systemctl restart $(SERVICE_NAME)"

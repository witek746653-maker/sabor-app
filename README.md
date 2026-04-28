# Sabor-App

The core management platform for Sabor de la Vida restaurant.

## 📝 Overview
Sabor-App is a full-stack web application designed to handle restaurant operations, including an interactive digital menu, guest feedback systems, and a comprehensive administrative dashboard.

## 🚀 Features
- **Interactive Menu**: Multi-category (Kitchen, Wine, Bar) menu with advanced filtering and search.
- **Hybrid Data Flow**: Primary data from SQLite API with an automatic fallback to static JSON for 100% uptime.
- **Admin Suite**: Real-time stop-list management, menu editing, and feedback moderation.
- **Feedback Engine**: Guest reviews with photo uploads and category tagging.
- **Private Staff Portal**: Secure access to internal documents (PDFs) and training materials.
- **Optimized Performance**: Client-side filtering, lazy loading, and aggressive caching.

## 🛠 Tech Stack
- **Frontend**: React 18, Tailwind CSS, Lucide React.
- **Backend**: Python, Flask, SQLAlchemy.
- **Database**: SQLite (Dual-stage: Dev/Prod).
- **Deployment**: Nginx, Gunicorn, Systemd, PowerShell (automation).

## 📂 Project Structure
```text
sabor-app/
├── frontend/            # React application
├── backend/             # Flask API and models
├── tools/               # Data processing and maintenance scripts
├── content/             # Articles and static resources
├── deploy.ps1           # Automated deployment script
└── PROJECT_MAP.md       # Developer architectural guide
```

## 💻 Developer Instructions
### Local Setup
1. **Frontend**:
   ```bash
   cd frontend
   npm install
   npm start
   ```
2. **Backend**:
   ```bash
   cd backend
   pip install -r requirements.txt
   python app.py
   ```
3. **Combined Dev**: Run `./dev.bat` for a synchronized environment.

### Deployment
- Changes are deployed via `.\deploy.ps1`, which builds the frontend and syncs assets to the production server via SSH/SCP.

## 📄 License
Proprietary. Internal restaurant management system.

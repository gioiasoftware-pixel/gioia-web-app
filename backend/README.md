# Backend - Gio.ia Web App

Backend FastAPI per web app unificata.

## 🚀 Setup

```bash
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Configurare .env
uvicorn app.main:app --reload --port 8000
```

## 📁 Struttura

```
backend/
├── app/
│   ├── api/              # API routes
│   │   ├── auth.py      # Autenticazione
│   │   ├── viewer.py    # Viewer endpoints
│   │   ├── chat.py      # Chat AI endpoints
│   │   ├── inventory.py # Gestione inventario
│   │   └── admin.py     # Admin endpoints
│   ├── core/            # Core logic
│   │   ├── config.py    # Configurazione
│   │   ├── database.py  # Database connection
│   │   ├── auth.py      # JWT authentication
│   │   └── processor_client.py  # Client Processor
│   ├── services/        # Business logic
│   │   ├── ai_service.py
│   │   ├── viewer_service.py
│   │   └── inventory_service.py
│   └── models/          # Database models
├── main.py              # Entry point
└── requirements.txt
```

## 🔌 API Endpoints

Vedi documentazione completa in `../ANALISI_WEB_APP_UNIFICATA.md`.

### Principali

- `POST /api/auth/login` - Login utente
- `GET /api/viewer/snapshot` - Snapshot inventario
- `POST /api/chat/message` - Messaggio chat AI
- `GET /api/inventory/wines` - Lista vini
- `GET /api/admin/notifications` - Notifiche admin

## 🔐 Autenticazione

Usa JWT tokens. Vedi `app/core/auth.py` per implementazione.

## 🗄️ Database

Collegato allo stesso PostgreSQL dei servizi esistenti.
Usa SQLAlchemy async per query.

## 🔗 Integrazione Processor

Chiama Processor microservice via HTTP usando `processor_client.py`.

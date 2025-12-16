# 🍷 Gio.ia Web App - Applicazione Web Unificata

Web Application unificata che integra Viewer, Chat AI, Gestione Inventario e Admin Dashboard.

## 📋 Panoramica

Questa applicazione web unifica tutte le funzionalità di Gio.ia in un'unica interfaccia:
- **Viewer**: Visualizzazione inventario vini con filtri e ricerca
- **Chat AI**: Interfaccia conversazionale per gestione inventario
- **Gestione Inventario**: CRUD completo vini, upload file, movimenti
- **Admin Dashboard**: Monitoraggio sistema e notifiche

## 🏗️ Architettura

Vedi `../ANALISI_WEB_APP_UNIFICATA.md` per documentazione completa.

### Struttura Directory

```
gioia-web-app/
├── frontend/          # Frontend React/Vue
├── backend/           # Backend FastAPI
├── shared/            # Codice condiviso (opzionale)
├── docs/              # Documentazione
└── tests/             # Test
```

## 🚀 Setup Sviluppo

### Prerequisiti
- Node.js 18+
- Python 3.10+
- PostgreSQL
- Railway account (per deploy)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Configurare .env
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
# Configurare .env
npm run dev
```

## 📚 Documentazione

- [Analisi Completa](../ANALISI_WEB_APP_UNIFICATA.md)
- [API Documentation](./docs/API.md) (da creare)
- [Frontend Guide](./docs/FRONTEND.md) (da creare)

## 🔗 Integrazione Componenti Esistenti

- **Processor**: Chiamate HTTP a `PROCESSOR_URL`
- **Database**: Condiviso con altri servizi (PostgreSQL)
- **Admin Bot**: Lettura da `admin_notifications` table

## 📝 TODO

Vedi [ANALISI_WEB_APP_UNIFICATA.md](../ANALISI_WEB_APP_UNIFICATA.md) per piano implementazione completo.

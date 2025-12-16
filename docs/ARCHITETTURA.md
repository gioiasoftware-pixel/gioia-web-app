# 🏛️ Architettura Web App

## Panoramica

La web app è strutturata come **full-stack application** con:
- **Frontend**: SPA (React/Vue) che comunica con backend via REST API
- **Backend**: FastAPI che orchestrazione logica business e chiamate a Processor
- **Database**: PostgreSQL condiviso con altri servizi

## Flusso Dati

```
┌─────────────┐
│   Browser   │
│  (Frontend) │
└──────┬──────┘
       │ HTTP/REST
       ▼
┌─────────────┐
│   Backend   │
│   FastAPI   │
└──────┬──────┘
       │
       ├──► PostgreSQL (Database)
       │
       └──► Processor (HTTP)
              │
              └──► PostgreSQL (Database)
```

## Componenti

### Frontend
- **Viewer Component**: Reuse da viewer esistente
- **Chat Component**: Interfaccia chat AI
- **Inventory Component**: CRUD inventario
- **Admin Component**: Dashboard admin

### Backend
- **API Routes**: Endpoint REST
- **Services**: Business logic (AI, Viewer, Inventory)
- **Core**: Database, Auth, Processor Client

### Integrazioni
- **Processor**: Chiamate HTTP per elaborazione file/movimenti
- **Database**: Lettura/scrittura tabelle esistenti
- **Admin Bot**: Lettura `admin_notifications` table

## Autenticazione

1. Utente fa login → Backend genera JWT token
2. Frontend salva token → Invia in header `Authorization: Bearer <token>`
3. Backend valida token → Processa richiesta
4. Per link condivisibili: Token temporaneo JWT con scadenza

## Sicurezza

- CORS configurato per dominio frontend
- Rate limiting su endpoint API
- Input validation con Pydantic
- SQL injection prevention (SQLAlchemy parametri)
- XSS prevention (sanitizzazione output)

Vedi `../ANALISI_WEB_APP_UNIFICATA.md` per dettagli completi.


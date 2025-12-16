# 🔐 Sistema Autenticazione Web App

## 📋 Panoramica

Sistema di autenticazione completo con:
- **Signup** con email, password e business_name
- **Login** con email e password
- **Ricordami** per token con scadenza estesa (30 giorni)
- **Supporto utenti Telegram** esistenti

## 🔄 Flussi

### 1. Signup Nuovo Utente

```json
POST /api/auth/signup
{
  "email": "utente@example.com",
  "password": "password123",
  "business_name": "Nome del tuo locale",
  "telegram_id": null  // Opzionale
}
```

**Risposta:**
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "user_id": 123,
  "telegram_id": null,
  "business_name": "Nome del tuo locale",
  "onboarding_completed": false
}
```

### 2. Signup Utente Telegram Esistente

Se utente ha già fatto onboarding su Telegram:

```json
POST /api/auth/signup
{
  "email": "utente@example.com",
  "password": "password123",
  "business_name": "Nome del tuo locale",
  "telegram_id": 123456789  // ID Telegram esistente
}
```

**Comportamento:**
- Se utente con `telegram_id` esiste E `onboarding_completed = true`:
  - ✅ Aggiorna solo `email` e `password_hash` nella riga esistente
  - ✅ Mantiene tutti i dati Telegram (business_name, inventario, ecc.)
  - ✅ Restituisce token con dati utente esistente

- Se utente con `telegram_id` esiste MA `onboarding_completed = false`:
  - ✅ Aggiorna `email`, `password_hash` e `business_name` (se mancante)
  - ✅ Mantiene `telegram_id`

### 3. Login

```json
POST /api/auth/login
{
  "email": "utente@example.com",
  "password": "password123",
  "remember_me": true  // Opzionale: token valido 30 giorni invece di 7
}
```

**Risposta:**
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "user_id": 123,
  "telegram_id": 123456789,  // Se presente
  "business_name": "Nome del tuo locale",
  "onboarding_completed": true
}
```

## 🔒 Sicurezza

- Password hash con **bcrypt**
- Validazione password minimo 8 caratteri
- Email univoca (unique constraint)
- Token JWT con scadenza configurabile
- "Ricordami" estende scadenza a 30 giorni

## 📊 Database

### Migration Necessaria

Eseguire migration per aggiungere colonna `password_hash`:

```sql
-- File: migrations/001_add_password_to_users.sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(200);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
```

### Modello User Aggiornato

```python
class User:
    id: int
    telegram_id: Optional[int]  # Nullable per utenti web-only
    email: str  # Unique, per login
    password_hash: Optional[str]  # Hash bcrypt
    business_name: str
    onboarding_completed: bool
    # ... altri campi
```

## 🧪 Test

### Signup Nuovo Utente
```bash
curl -X POST http://localhost:8000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "business_name": "Enoteca Test"
  }'
```

### Signup Utente Telegram Esistente
```bash
curl -X POST http://localhost:8000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "business_name": "Enoteca Test",
    "telegram_id": 123456789
  }'
```

### Login
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "remember_me": true
  }'
```

### Info Utente
```bash
curl http://localhost:8000/api/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 📝 Note

### Utenti Web-Only
- Possono avere `telegram_id = null`
- Login solo con email/password
- Possono completare onboarding via web app

### Utenti Telegram Esistenti
- Se `telegram_id` fornito in signup:
  - Se onboarding completato → aggiorna solo email/password
  - Se onboarding non completato → aggiorna email/password + business_name
- Mantengono accesso sia via Telegram che via web

### Token JWT
- **Default**: 7 giorni (configurabile con `ACCESS_TOKEN_EXPIRE_HOURS`)
- **Remember Me**: 30 giorni
- Payload include `user_id`, `telegram_id` (opzionale), `business_name`

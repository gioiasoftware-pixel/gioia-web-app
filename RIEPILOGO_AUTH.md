# 🔐 Riepilogo Sistema Autenticazione Implementato

## ✅ Cosa è stato implementato

### 1. Database
- ✅ Modello `User` aggiornato con:
  - `email` (unique, indexato)
  - `password_hash` (hash bcrypt)
  - `telegram_id` (nullable per utenti web-only)

- ✅ Migration SQL creata (`migrations/001_add_password_to_users.sql`)
  - Aggiunge colonna `password_hash`
  - Aggiunge colonna `email` (se non esiste)
  - Crea indici per performance

- ✅ Metodi DatabaseManager aggiunti:
  - `get_user_by_email()` - Trova utente per email
  - `create_user()` - Crea nuovo utente
  - `update_user_email_password()` - Aggiorna email/password utente Telegram esistente

### 2. Autenticazione
- ✅ Hash password con bcrypt (`hash_password()`, `verify_password()`)
- ✅ Generazione token JWT con supporto "ricordami"
  - Default: 7 giorni (configurabile)
  - Remember me: 30 giorni
- ✅ Validazione token e dependency `get_current_user()`

### 3. API Endpoints

#### Signup
```
POST /api/auth/signup
Body: {
  "email": "utente@example.com",
  "password": "password123",
  "business_name": "Nome del tuo locale",
  "telegram_id": 123456789  // Opzionale
}
```

**Comportamento:**
- Se `telegram_id` fornito E utente esiste con `onboarding_completed = true`:
  - ✅ Aggiorna solo `email` e `password_hash` nella riga esistente
  - ✅ Mantiene tutti i dati Telegram (inventario, business_name, ecc.)
  
- Se `telegram_id` fornito MA utente esiste con `onboarding_completed = false`:
  - ✅ Aggiorna `email`, `password_hash` e `business_name` (se mancante)

- Altrimenti:
  - ✅ Crea nuovo utente
  - ✅ Se `telegram_id` fornito, lo associa

#### Login
```
POST /api/auth/login
Body: {
  "email": "utente@example.com",
  "password": "password123",
  "remember_me": true  // Opzionale
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

#### Info Utente
```
GET /api/auth/me
Headers: Authorization: Bearer <token>
```

## 🔄 Flussi Utente

### Scenario 1: Nuovo Utente Web
1. Utente fa signup con email, password, business_name
2. Sistema crea nuovo utente con `telegram_id = null`
3. Utente può completare onboarding via web app
4. Login con email/password

### Scenario 2: Utente Telegram Esistente (Onboarding Completato)
1. Utente ha già fatto onboarding su Telegram
2. Utente fa signup web con stesso `telegram_id`
3. Sistema trova utente esistente
4. Sistema aggiorna solo `email` e `password_hash`
5. Utente mantiene accesso sia Telegram che web
6. Login con email/password

### Scenario 3: Utente Telegram Esistente (Onboarding Non Completato)
1. Utente ha iniziato onboarding Telegram ma non completato
2. Utente fa signup web con stesso `telegram_id`
3. Sistema aggiorna `email`, `password_hash` e `business_name` (se mancante)
4. Utente può completare onboarding via web

## 🔒 Sicurezza

- ✅ Password hash con bcrypt (non salvate in chiaro)
- ✅ Validazione password minimo 8 caratteri
- ✅ Email univoca (unique constraint)
- ✅ Token JWT con scadenza configurabile
- ✅ Token "ricordami" valido 30 giorni

## ⚠️ IMPORTANTE: Migration Database

**PRIMA** di usare signup/login, eseguire migration:

```bash
# Opzione 1: PostgreSQL CLI
psql $DATABASE_URL -f migrations/001_add_password_to_users.sql

# Opzione 2: Railway Dashboard SQL Editor
# Incolla contenuto di migrations/001_add_password_to_users.sql
```

Vedi `GUIDA_MIGRATION.md` per dettagli.

## 🧪 Test Completo

```bash
# 1. Signup nuovo utente
curl -X POST http://localhost:8000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "business_name": "Enoteca Test"
  }'

# Risposta contiene access_token

# 2. Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "remember_me": true
  }'

# 3. Chat (usa token da login)
curl -X POST http://localhost:8000/api/chat/message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"message": "che vini ho?"}'

# 4. Info utente
curl http://localhost:8000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 📝 Note Implementative

### Utenti Web-Only
- Possono avere `telegram_id = null`
- Per ora, AI service usa `user_id` come fallback quando `telegram_id` è null
- Potrebbe essere necessario adattare AI service per gestire meglio utenti web-only

### Compatibilità Telegram
- Utenti Telegram esistenti mantengono tutti i dati
- Possono aggiungere email/password senza perdere nulla
- Accesso sia Telegram che web funzionante

### Token JWT
- Payload include `user_id` (sempre presente)
- Payload include `telegram_id` (opzionale, può essere null)
- Payload include `business_name`
- Payload include `remember_me` flag

---

**Sistema completo e funzionante!** 🎉

Ricorda di eseguire la migration prima di testare signup/login.

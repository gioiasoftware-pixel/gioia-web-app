# 🔐 Creazione Utente Admin

## Problema

Se ricevi errori **403 Forbidden** dopo il login, probabilmente l'utente admin non esiste nel database.

## Soluzione: Creare Utente Admin

### Opzione 1: Script Python (Consigliato)

Esegui lo script `scripts/create_admin_user.py`:

```bash
cd backend
python scripts/create_admin_user.py
```

Lo script:
- Verifica se l'utente admin esiste già
- Se non esiste, lo crea con email `gio.ia.software@gmail.com`
- Se esiste ma non ha password, aggiorna la password

**Variabili ambiente** (opzionali):
```bash
export ADMIN_EMAIL=gio.ia.software@gmail.com
export ADMIN_PASSWORD=Lagioiadilavorare2025
```

### Opzione 2: SQL Diretto

Esegui questa query nel database PostgreSQL:

```sql
-- Verifica se utente esiste
SELECT id, email, business_name FROM users WHERE email = 'gio.ia.software@gmail.com';

-- Se non esiste, crealo (sostituisci 'password_hash' con hash bcrypt della password)
INSERT INTO users (email, password_hash, business_name, onboarding_completed, created_at, updated_at)
VALUES (
  'gio.ia.software@gmail.com',
  '$2b$12$...', -- Hash bcrypt della password
  'Gio.ia Admin',
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
```

**Nota**: Per generare l'hash bcrypt della password, usa Python:
```python
from app.core.auth import hash_password
print(hash_password("Lagioiadilavorare2025"))
```

### Opzione 3: Via API (se disponibile)

Se hai accesso al backend, puoi creare l'utente tramite l'endpoint `/api/admin/users` (richiede autenticazione admin esistente).

## Verifica

Dopo aver creato l'utente admin:

1. **Verifica nel database**:
   ```sql
   SELECT id, email, business_name, password_hash IS NOT NULL as has_password
   FROM users 
   WHERE email = 'gio.ia.software@gmail.com';
   ```

2. **Prova login**:
   - Email: `gio.ia.software@gmail.com`
   - Password: `Lagioiadilavorare2025` (o quella configurata)

3. **Verifica logs backend**:
   - Dovresti vedere `[AUTH] Login effettuato` nei logs

## Troubleshooting

### Errore: "Email o password non corretti"

- Verifica che l'utente esista nel database
- Verifica che `password_hash` non sia NULL
- Verifica che la password sia corretta

### Errore: "Account non configurato"

- L'utente esiste ma non ha `password_hash`
- Esegui lo script `create_admin_user.py` per aggiornare la password

### Errore: 403 Forbidden dopo login

- Verifica che l'email corrisponda a `ADMIN_EMAIL` configurata nel backend
- Verifica che `ADMIN_EMAIL` sia configurata su Railway (default: `gio.ia.software@gmail.com`)

---

**Data**: 2025-01-XX  
**Versione**: 1.0.0



# 📋 Guida Esecuzione Migration Database

## ⚠️ IMPORTANTE

Prima di usare il sistema di login/signup, è necessario eseguire la migration per aggiungere la colonna `password_hash` alla tabella `users`.

## 🔧 Esecuzione Migration

### Opzione 1: PostgreSQL CLI

```bash
# Connettiti al database
psql $DATABASE_URL

# Esegui migration
\i migrations/001_add_password_to_users.sql

# Verifica
\d users
```

### Opzione 2: Python Script

```python
# backend/run_migration.py
import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def run_migration():
    conn = await asyncpg.connect(os.getenv("DATABASE_URL"))
    
    migration_sql = """
    ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
    
    ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS email VARCHAR(200);
    
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    
    CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
    """
    
    await conn.execute(migration_sql)
    print("✅ Migration completata!")
    await conn.close()

if __name__ == "__main__":
    asyncio.run(run_migration())
```

Esegui:
```bash
cd backend
python run_migration.py
```

### Opzione 3: Railway Dashboard

1. Vai su Railway Dashboard
2. Seleziona il database PostgreSQL
3. Apri "Query" o "SQL Editor"
4. Incolla il contenuto di `migrations/001_add_password_to_users.sql`
5. Esegui

## ✅ Verifica Migration

Dopo l'esecuzione, verifica che le colonne siano state aggiunte:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
AND column_name IN ('password_hash', 'email');
```

Dovresti vedere:
- `password_hash` VARCHAR(255) nullable
- `email` VARCHAR(200) nullable (o unique se già presente)

## 📝 Note

- La migration è **idempotente** (usa `IF NOT EXISTS`)
- Può essere eseguita più volte senza problemi
- Non modifica dati esistenti
- Utenti Telegram esistenti avranno `password_hash = NULL` (normale)

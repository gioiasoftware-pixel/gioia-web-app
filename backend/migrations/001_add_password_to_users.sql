-- Migration: Aggiungi colonna password alla tabella users
-- Per supportare login con email/password oltre a Telegram

-- Aggiungi colonna password (nullable per retrocompatibilità con utenti Telegram esistenti)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

-- Aggiungi colonna email se non esiste (potrebbe già esistere)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email VARCHAR(200);

-- Crea indice su email per login veloce
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Crea indice su telegram_id se non esiste già
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);


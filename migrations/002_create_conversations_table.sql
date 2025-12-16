-- Migration: Crea tabella conversations per gestire chat multiple
-- Ogni utente può avere più conversazioni separate (come ChatGPT)

CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    telegram_id BIGINT,  -- Per compatibilità con sistema esistente
    title VARCHAR(255),  -- Titolo conversazione (primo messaggio o generato)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP  -- Ultimo messaggio per ordinamento
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_telegram_id ON conversations(telegram_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);

-- Aggiungi colonna conversation_id alla tabella LOG interazione (se esiste già)
-- Nota: Le tabelle LOG interazione sono dinamiche, quindi questa modifica va applicata manualmente
-- o tramite migrazione dinamica per ogni utente

COMMENT ON TABLE conversations IS 'Tabella per gestire conversazioni multiple per utente (stile ChatGPT)';
COMMENT ON COLUMN conversations.title IS 'Titolo della conversazione (primo messaggio o generato dall''AI)';
COMMENT ON COLUMN conversations.last_message_at IS 'Timestamp ultimo messaggio per ordinamento conversazioni';

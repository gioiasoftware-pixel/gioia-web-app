-- Migration: Aggiunge colonna pending_movements alla tabella conversations
-- Per salvare lo stato dei movimenti pendenti quando c'è una disambiguazione in movimenti multipli

ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS pending_movements JSONB;

-- Indice per query rapide su movimenti pendenti
CREATE INDEX IF NOT EXISTS idx_conversations_pending_movements 
ON conversations(user_id, pending_movements) 
WHERE pending_movements IS NOT NULL;

COMMENT ON COLUMN conversations.pending_movements IS 'Movimenti pendenti da processare dopo disambiguazione (JSON array di movimenti)';


# 📊 Analisi Costi OpenAI - Gio.ia

## Modelli Utilizzati

### Sistema Ibrido (AIServiceV1 + AIServiceV2)

**AIServiceV1 (Function Calling)**
- Modello principale: `gpt-4o-mini` (da configurazione `OPENAI_MODEL`)
- Usato per: richieste semplici (80-90% dei messaggi)
- Function calling: chiamate dirette alle funzioni del sistema

**AIServiceV2 (Multi-Agent System)**
- Router Agent: `gpt-4o-mini`
- Query Agent: `gpt-4o-mini`
- Movement Agent: delega a AIServiceV1 (function calling)
- Analytics Agent: `gpt-4o-mini`
- Wine Management Agent: `gpt-4o-mini`
- Notification Agent: `gpt-4o-mini`
- Report Agent: `gpt-4o-mini`
- Conversation Agent: `gpt-4o` (più potente per contesto complesso)
- Validation Agent: `gpt-4o-mini`

**Altri Servizi**
- Audio Transcription: `whisper-1` ($0.006 per minuto)

## Prezzi OpenAI (Gennaio 2025)

### GPT-4o-mini
- Input: $0.15 per 1M token ($0.00015 per 1K token)
- Output: $0.60 per 1M token ($0.0006 per 1K token)

### GPT-4o
- Input: $2.50 per 1M token ($0.0025 per 1K token)
- Output: $10.00 per 1M token ($0.01 per 1K token)

### Whisper-1
- $0.006 per minuto di audio

## Stima Token per Messaggio

### Scenario: Utente invia 10 messaggi/giorno

**Media messaggio utente:**
- Lunghezza: ~20-30 parole italiane
- Token input: ~40-60 token (considerando contesto inventario)

**Contesto inviato per messaggio:**
- Sistema prompt: ~200 token
- Storia conversazione (ultimi 10 messaggi): ~400 token
- Inventario vini (se necessario): ~500-1000 token
- **Totale input per messaggio: ~700-1500 token**

**Risposta AI:**
- Media: 50-100 parole
- Token output: ~80-150 token

### Distribuzione Messaggi (Stima Realistica)

1. **70% messaggi semplici (AIServiceV1 - gpt-4o-mini)**
   - Ricerche vini, movimenti, statistiche
   - Input medio: 1000 token
   - Output medio: 100 token

2. **20% messaggi complessi (AIServiceV2 - gpt-4o-mini)**
   - Query complesse, analisi, report
   - Input medio: 1200 token
   - Output medio: 150 token

3. **10% messaggi molto complessi (AIServiceV2 - gpt-4o)**
   - Conversazioni elaborate, gestione contesto complesso
   - Input medio: 1500 token
   - Output medio: 200 token

## Calcolo Costo Mensile per Utente

### Assunzioni:
- 10 messaggi/giorno
- 30 giorni/mese
- Totale: 300 messaggi/mese

### Breakdown per Tipo:

#### 1. Messaggi Semplici (70% = 210 messaggi)
**gpt-4o-mini:**
- Input: 210 × 1000 token = 210,000 token
- Output: 210 × 100 token = 21,000 token
- Costo input: (210,000 / 1,000,000) × $0.15 = **$0.0315**
- Costo output: (21,000 / 1,000,000) × $0.60 = **$0.0126**
- **Totale: $0.0441**

#### 2. Messaggi Complessi (20% = 60 messaggi)
**gpt-4o-mini:**
- Input: 60 × 1200 token = 72,000 token
- Output: 60 × 150 token = 9,000 token
- Costo input: (72,000 / 1,000,000) × $0.15 = **$0.0108**
- Costo output: (9,000 / 1,000,000) × $0.60 = **$0.0054**
- **Totale: $0.0162**

#### 3. Messaggi Molto Complessi (10% = 30 messaggi)
**gpt-4o:**
- Input: 30 × 1500 token = 45,000 token
- Output: 30 × 200 token = 6,000 token
- Costo input: (45,000 / 1,000,000) × $2.50 = **$0.1125**
- Costo output: (6,000 / 1,000,000) × $10.00 = **$0.06**
- **Totale: $0.1725**

### Costo Totale Mensile per Utente

**Solo AI Chat:**
- Messaggi semplici: $0.0441
- Messaggi complessi: $0.0162
- Messaggi molto complessi: $0.1725
- **TOTALE: $0.2328 / mese**

**In Euro (tasso 1 USD = 0.92 EUR):**
- **€0.214 / mese per utente**

### Costi Aggiuntivi (Opzionali)

**Audio Transcription (se utilizzato):**
- Assumendo 1 messaggio audio al giorno
- Durata media: 10 secondi (0.17 minuti)
- Costo: 30 × 0.17 × $0.006 = **$0.0306 / mese** (€0.028)

**Costo totale con audio:**
- **€0.242 / mese per utente**

## Riepilogo

| Componente | Costo Mensile (USD) | Costo Mensile (EUR) |
|------------|---------------------|---------------------|
| Messaggi semplici (gpt-4o-mini) | $0.0441 | €0.041 |
| Messaggi complessi (gpt-4o-mini) | $0.0162 | €0.015 |
| Messaggi molto complessi (gpt-4o) | $0.1725 | €0.159 |
| **TOTALE AI Chat** | **$0.2328** | **€0.214** |
| Audio (opzionale) | $0.0306 | €0.028 |
| **TOTALE CON AUDIO** | **$0.2634** | **€0.242** |

## Considerazioni

1. **Ottimizzazioni Possibili:**
   - Ridurre contesto inventario inviato (filtrare solo vini rilevanti)
   - Usare cache per risposte comuni
   - Limitare storia conversazione a ultimi 5 messaggi invece di 10

2. **Scalabilità:**
   - Costo per utente: ~€0.21-0.24/mese
   - Per 100 utenti: ~€21-24/mese
   - Per 1000 utenti: ~€210-240/mese

3. **Variabilità:**
   - I costi possono variare del 30-50% in base a:
     - Lunghezza effettiva dei messaggi
     - Complessità delle richieste
     - Dimensione inventario vini
     - Frequenza di utilizzo V2 vs V1

## Raccomandazioni

1. **Monitorare utilizzo reale** per calibrare le stime
2. **Ottimizzare routing** per massimizzare utilizzo V1 (più economico)
3. **Limitare uso gpt-4o** solo quando strettamente necessario
4. **Implementare caching** per query ripetute
5. **Considerare tier pricing** basato su utilizzo mensile


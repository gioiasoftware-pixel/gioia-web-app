# Checklist Implementazione Chat Web App

## 🎯 Obiettivo
Portare la chat della Web App alla parità funzionale con il Telegram AI Bot.

---

## ✅ Fase 1: Funzionalità Core (Priorità ALTA)

### 1.1 Function Calling OpenAI
- [ ] Creare struttura tools OpenAI
  - [ ] Definire tools base (get_wine_info, search_wines, get_inventory_list)
  - [ ] Definire tools avanzati (get_wine_by_criteria, register_consumption, ecc.)
- [ ] Implementare `_call_openai_with_tools` in `ai_service.py`
  - [ ] Chiamata OpenAI con tools
  - [ ] Gestione tool calls nella risposta
- [ ] Creare Function Executor o fallback inline
  - [ ] Eseguire tools chiamati dall'AI
  - [ ] Formattare risposte
  - [ ] Evitare re-chiamate AI quando possibile
- [ ] Integrare nel flusso `process_message`
  - [ ] Chiamare function calling prima del fallback
  - [ ] Gestire errori gracefully

### 1.2 Cascading Retry Search
- [ ] Implementare `_retry_level_1_normalize_local`
  - [ ] Normalizzazione plurali (vermentini → vermentino)
  - [ ] Rimozione accenti/apostrofi
- [ ] Implementare `_retry_level_2_fallback_less_specific`
  - [ ] Rimozione filtri troppo specifici
  - [ ] Ricerca generica con termini chiave
- [ ] Implementare `_retry_level_3_ai_post_processing`
  - [ ] Chiamata OpenAI per reinterpretare query
  - [ ] Estrazione query alternativa
- [ ] Implementare `_cascading_retry_search` wrapper
  - [ ] Orchestrazione 3 livelli
  - [ ] Logging dettagliato
- [ ] Integrare in tutte le ricerche vini
  - [ ] `search_wines` calls
  - [ ] `get_wine_info` calls
  - [ ] `search_wines_filtered` calls

### 1.3 Rilevamento Movimenti Inventario
- [ ] Copiare/importare `movement_patterns.py` dal bot
  - [ ] Pattern consumo
  - [ ] Pattern rifornimento
  - [ ] Supporto numeri in lettere
- [ ] Implementare `_check_movement_with_ai`
  - [ ] Fallback AI quando regex non matcha
  - [ ] Validazione output LLM
- [ ] Implementare `_check_and_process_movement`
  - [ ] Verifica condizioni base (utente, business_name, inventario)
  - [ ] Pattern matching
  - [ ] AI fallback
- [ ] Implementare `_process_movement_async`
  - [ ] Fuzzy matching vini
  - [ ] Chiamata Processor via `processor_client`
  - [ ] Formattazione messaggio successo/errore
- [ ] Integrare nel flusso `process_message`
  - [ ] Chiamare PRIMA di ricerca vini
  - [ ] Ritornare marker o messaggio diretto

---

## 🟡 Fase 2: Miglioramenti UX (Priorità MEDIA)

### 2.1 Storia Conversazione
- [x] Creare tabella `chat_messages` nel database (se non esiste)
  - [x] Schema: id, user_id, role, content, created_at (usa tabella dinamica LOG interazione)
  - [x] Indici per user_id e created_at
- [x] Implementare `get_recent_chat_messages` in `database.py`
  - [x] Recupero ultimi N messaggi per user_id
  - [x] Filtro per role (user/assistant)
- [x] Implementare salvataggio messaggi
  - [x] Salvare messaggio utente dopo ricezione (`log_chat_message`)
  - [x] Salvare risposta AI dopo generazione (`log_chat_message`)
- [x] Integrare in `process_message`
  - [x] Recuperare storia prima di chiamare AI
  - [x] Includere nel contesto OpenAI

### 2.2 Formattazione Pre-Strutturata
- [ ] Copiare/importare `response_templates.py` dal bot
  - [ ] `format_wine_info`
  - [ ] `format_wine_quantity`
  - [ ] `format_wine_price`
  - [ ] `format_inventory_list`
  - [ ] `format_wine_not_found`
  - [ ] `format_wine_exists`
  - [ ] `format_movement_period_summary`
- [ ] Implementare `_format_wine_response_directly`
  - [ ] Bypassa AI per domande specifiche
  - [ ] Pattern matching per tipo domanda
- [ ] Migliorare `_format_wines_response`
  - [ ] Usare templates quando appropriato
  - [ ] Generare sempre buttons per 2-10 vini

### 2.3 Rilevamento Richieste Specifiche
- [x] Implementare `_is_inventory_list_request`
  - [x] Pattern matching per richieste lista
  - [x] Bypassa AI, risposta diretta DB (`_build_inventory_list_response`)
- [x] Implementare `_is_movement_summary_request`
  - [x] Rilevamento richieste movimenti
  - [x] Supporto periodi (day/week/month/yesterday/yesterday_replenished)
- [ ] Implementare `_handle_movement_summary_request`
  - [ ] Recupero dati movimenti (TODO: quando necessario)
  - [ ] Formattazione con template
- [x] Implementare `_is_informational_query`
  - [x] Rilevamento query min/max
  - [x] Estrazione query_type e field
- [x] Implementare `_handle_informational_query`
  - [x] Query DB per min/max
  - [x] Formattazione risultati

---

## 🟢 Fase 3: Funzionalità Avanzate (Priorità BASSA)

### 3.1 Query Qualitative/Sensoriali
- [ ] Implementare `_handle_qualitative_query_fallback`
  - [ ] Pattern matching per query qualitative
  - [ ] Mappatura a query informative
- [ ] Implementare `_handle_sensory_query`
  - [ ] Mappatura caratteristiche sensoriali
  - [ ] Ricerca keywords in description/notes
  - [ ] Mappatura euristica (wine_type + alcohol_content)
  - [ ] Mappatura per uvaggi tipici
  - [ ] Scoring e combinazione risultati

### 3.2 Parser Filtri Avanzato
- [ ] Implementare `_parse_filters`
  - [ ] Estrazione paese/regione
  - [ ] Estrazione tipo vino
  - [ ] Estrazione prezzo (min/max)
  - [ ] Estrazione annata (min/max)
  - [ ] Estrazione produttore
  - [ ] Supporto sinonimi geografici
  - [ ] Normalizzazione variazioni

### 3.3 Rilevamento Conversazione Generale
- [ ] Implementare `_is_general_conversation`
  - [ ] Pattern matching per conversazioni generali
  - [ ] Bypassa ricerca vini quando appropriato

---

## 📝 Note Implementazione

### Struttura File
- `backend/app/services/ai_service.py` - Servizio AI principale
- `backend/app/services/function_executor.py` - Executor tools (nuovo)
- `backend/app/services/response_templates.py` - Templates formattazione (nuovo o importato)
- `backend/app/core/database.py` - Metodi DB per chat messages

### Dipendenze
- OpenAI SDK già presente
- Processor client già presente
- Database manager già presente

### Testing
- Testare ogni funzionalità isolatamente
- Testare integrazione nel flusso completo
- Verificare compatibilità con utenti web-only (no telegram_id)

---

## 🚀 Stato Implementazione

**Ultimo aggiornamento**: 2024-12-19

### Completato ✅
- [x] Function Calling OpenAI - Implementato con 12 tools base
- [x] Cascading Retry Search - Implementato con 3 livelli (normalizzazione, fallback, AI post-processing)
- [x] Rilevamento Movimenti - Implementato tramite Function Calling (register_consumption/register_replenishment)
- [x] Function Executor fallback inline - Implementato per tutti i tools
- [x] Integrazione nel flusso process_message - Completata
- [x] Storia Conversazione - Implementata con tabella dinamica LOG interazione
- [x] Rilevamento Richieste Specifiche - Implementato (_is_inventory_list_request, _is_movement_summary_request, _is_informational_query, _handle_informational_query)

### In Progress
- Nessuna funzionalità in corso al momento

### Pending
- Formattazione Pre-Strutturata completa (Fase 2) - Parzialmente implementata, mancano templates completi
- Query Qualitative/Sensoriali (Fase 3)
- Parser Filtri Avanzato (Fase 3)

---

## 📊 Progresso Generale

- **Fase 1 (ALTA)**: 3/3 funzionalità completate ✅ **100%**
- **Fase 2 (MEDIA)**: 2/3 funzionalità completate ✅ **67%** (Storia Conversazione ✅, Rilevamento Richieste Specifiche ✅, Formattazione Pre-Strutturata parziale)
- **Fase 3 (BASSA)**: 0/3 funzionalità completate

**Totale**: 5/9 funzionalità completate (**56%**)

### Note Implementazione

**Function Calling OpenAI**:
- ✅ 12 tools implementati (get_inventory_list, get_wine_info, get_wine_price, get_wine_quantity, get_wine_by_criteria, search_wines, get_inventory_stats, get_movement_summary, register_consumption, register_replenishment, get_low_stock_wines, get_wine_details)
- ✅ Fallback inline executor per tutti i tools
- ✅ Gestione errori robusta
- ✅ Supporto buttons per selezione vini (2-10 vini)

**Cascading Retry Search**:
- ✅ Livello 1: Normalizzazione plurali/accenti
- ✅ Livello 2: Fallback ricerca meno specifica
- ✅ Livello 3: AI Post-Processing per reinterpretare query
- ✅ Integrato in tutte le ricerche vini

**Rilevamento Movimenti**:
- ✅ Implementato tramite Function Calling (register_consumption/register_replenishment)
- ✅ Processamento via Processor Client
- ✅ Fuzzy matching vini integrato
- ✅ Formattazione messaggi successo/errore

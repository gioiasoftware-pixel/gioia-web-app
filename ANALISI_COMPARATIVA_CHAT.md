# Analisi Comparativa: Chat Web App vs Telegram AI Bot

## 📋 Obiettivo
Identificare tutte le funzionalità del Telegram AI Bot che mancano nella Web App per raggiungere parità funzionale.

---

## 🔍 Analisi Dettagliata

### 1. **Architettura e Flusso di Elaborazione**

#### Telegram Bot (`get_ai_response`)
```
1. Rilevamento conversazione generale → bypass ricerca vini
2. Rilevamento richiesta lista inventario → risposta diretta DB
3. Rilevamento richiesta movimenti → recupero movimenti
4. Rilevamento movimento inventario → processamento movimento
5. Ricerca vini con pattern matching avanzato
6. Query informative (min/max quantità/prezzo/annata)
7. Query qualitative (pregiato, economico, ecc.)
8. Query sensoriali (tannico, corposo, floreale, ecc.)
9. Function calling OpenAI con tools
10. Cascading retry search (3 livelli)
11. Storia conversazione (ultimi 10 messaggi)
12. Formattazione risposte pre-strutturate
```

#### Web App (`ai_service.py`)
```
1. Tentativo import get_ai_response dal bot (fallisce spesso)
2. Fallback semplificato:
   - Ricerca vini con pattern base
   - Formattazione base risposte
   - Nessun function calling
   - Nessuna storia conversazione
   - Nessun rilevamento movimenti
   - Nessuna query qualitativa/sensoriale
```

**❌ MANCA**: Quasi tutto il flusso avanzato del bot.

---

### 2. **Rilevamento Movimenti Inventario**

#### Telegram Bot ✅
- **Pattern matching avanzato** (`movement_patterns.py`)
  - Supporta numeri in lettere ("sei" → 6)
  - Pattern consumo: "ho venduto", "ho consumato", "ho bevuto"
  - Pattern rifornimento: "mi sono arrivati", "ho acquistato", "ho ricevuto"
- **AI fallback** (`_check_movement_with_ai`)
  - Usa OpenAI per rilevare movimenti quando regex non matcha
  - Gestisce variazioni linguistiche naturali
- **Fuzzy matching vini** (`fuzzy_match_wine_name`)
  - Corregge automaticamente typo nei nomi vini
- **Processamento movimento** (`_process_movement_async`)
  - Chiama Processor via `processor_client`
  - Formatta messaggio successo/errore

#### Web App ❌
- **Nessun rilevamento movimenti**
- Gli utenti non possono registrare consumi/rifornimenti tramite chat

**🔧 IMPLEMENTAZIONE NECESSARIA**:
```python
# In ai_service.py, aggiungere:
async def _check_and_process_movement(self, prompt: str, telegram_id: int) -> Optional[str]:
    # Copia logica da telegram-ai-bot/src/ai.py:_check_and_process_movement
    # Adatta per web app (usa db_manager invece di async_db_manager)
```

---

### 3. **Rilevamento Richieste Lista Inventario**

#### Telegram Bot ✅
- **Funzione `_is_inventory_list_request`**
  - Riconosce: "che vini ho?", "mostra inventario", "elenco vini"
  - Bypassa AI e risponde direttamente con dati DB
  - Usa `format_inventory_list` per formattazione

#### Web App ❌
- **Nessun rilevamento specifico**
- Passa sempre all'AI generica

**🔧 IMPLEMENTAZIONE NECESSARIA**:
```python
def _is_inventory_list_request(self, prompt: str) -> bool:
    # Copia da telegram-ai-bot/src/ai.py:_is_inventory_list_request
    # Ritorna True se è richiesta lista semplice
```

---

### 4. **Rilevamento Richieste Movimenti**

#### Telegram Bot ✅
- **Funzione `_is_movement_summary_request`**
  - Riconosce: "ultimi consumi", "consumi ieri", "movimenti recenti"
  - Supporta periodi: 'day', 'week', 'month', 'yesterday', 'yesterday_replenished'
  - Recupera dati da `get_movement_summary_yesterday`
  - Formatta con `format_movement_period_summary`

#### Web App ❌
- **Nessun rilevamento**
- Gli utenti non possono chiedere riepiloghi movimenti

**🔧 IMPLEMENTAZIONE NECESSARIA**:
```python
async def _handle_movement_summary_request(self, prompt: str, telegram_id: int) -> Optional[str]:
    # Copia logica da telegram-ai-bot/src/ai.py:_is_movement_summary_request
    # Adatta per web app
```

---

### 5. **Query Informative (Min/Max)**

#### Telegram Bot ✅
- **Funzione `_is_informational_query`**
  - Rileva: "quale vino ha meno quantità", "quale è il più costoso"
  - Supporta: `quantity`, `selling_price`, `cost_price`, `vintage`
  - Chiama `_handle_informational_query` che:
    - Trova valore min/max nel DB
    - Recupera tutti i vini con quel valore
    - Formatta con `format_wines_response_by_count`

#### Web App ❌
- **Nessun rilevamento**
- L'AI generica non gestisce queste query specifiche

**🔧 IMPLEMENTAZIONE NECESSARIA**:
```python
def _is_informational_query(self, prompt: str) -> tuple[Optional[str], Optional[str]]:
    # Copia da telegram-ai-bot/src/ai.py:_is_informational_query
    # Ritorna (query_type, field) o (None, None)

async def _handle_informational_query(self, telegram_id: int, query_type: str, field: str) -> Optional[str]:
    # Copia logica da telegram-ai-bot/src/ai.py:_handle_informational_query
    # Adatta per web app
```

---

### 6. **Query Qualitative**

#### Telegram Bot ✅
- **Funzione `_handle_qualitative_query_fallback`**
  - Rileva: "più pregiato", "migliore", "di valore", "più economico"
  - Mappa a query informative (max/min selling_price)
  - Fallback quando AI non trova risultati

#### Web App ❌
- **Nessun rilevamento**
- L'AI generica può rispondere ma senza accesso deterministico ai dati

**🔧 IMPLEMENTAZIONE NECESSARIA**:
```python
async def _handle_qualitative_query_fallback(self, telegram_id: int, prompt: str) -> Optional[str]:
    # Copia da telegram-ai-bot/src/ai.py:_handle_qualitative_query_fallback
    # Adatta per web app
```

---

### 7. **Query Sensoriali**

#### Telegram Bot ✅
- **Funzione `_handle_sensory_query`**
  - Rileva: "più tannico", "più corposo", "più floreale", "più secco", "più boccato"
  - Approccio ibrido:
    1. Ricerca keywords in `description`/`notes`
    2. Mappatura euristica (wine_type + alcohol_content)
    3. Mappatura per uvaggi tipici
  - Combina risultati con scoring
  - Formatta con `format_wines_response_by_count`

#### Web App ❌
- **Nessun rilevamento**
- L'AI generica non può gestire query sensoriali

**🔧 IMPLEMENTAZIONE NECESSARIA**:
```python
async def _handle_sensory_query(self, telegram_id: int, prompt: str) -> Optional[str]:
    # Copia logica completa da telegram-ai-bot/src/ai.py:_handle_sensory_query
    # Adatta per web app (usa db_manager invece di async_db_manager)
```

---

### 8. **Cascading Retry Search**

#### Telegram Bot ✅
- **Funzione `_cascading_retry_search`**
  - **Livello 1**: Normalizzazione locale (plurali, accenti)
  - **Livello 2**: Fallback ricerca meno specifica
  - **Livello 3**: AI Post-Processing (reinterpreta query)
  - Migliora drasticamente il tasso di successo ricerche

#### Web App ❌
- **Solo retry base** nel fallback
  - Prova ricerca diretta con prompt pulito
  - Nessun normalizzazione plurali/accenti
  - Nessun AI Post-Processing

**🔧 IMPLEMENTAZIONE NECESSARIA**:
```python
async def _cascading_retry_search(
    self,
    telegram_id: int,
    original_query: str,
    search_func,
    search_func_args: Dict[str, Any],
    original_filters: Optional[Dict[str, Any]] = None
) -> tuple[Optional[List], Optional[str], str]:
    # Copia logica completa da telegram-ai-bot/src/ai.py:_cascading_retry_search
    # Adatta per web app
```

---

### 9. **Function Calling OpenAI**

#### Telegram Bot ✅
- **Tools disponibili**:
  - `get_inventory_list` - Elenco inventario
  - `get_wine_info` - Info vino specifico
  - `get_wine_price` - Prezzo vino
  - `get_wine_quantity` - Quantità vino
  - `get_wine_by_criteria` - Query min/max
  - `search_wines` - Ricerca filtrata
  - `get_inventory_stats` - Statistiche inventario
  - `get_movement_summary` - Riepilogo movimenti
  - `register_consumption` - Registra consumo
  - `register_replenishment` - Registra rifornimento
  - `get_low_stock_wines` - Vini scorte basse
  - `get_wine_details` - Dettagli completi vino
- **Function Executor** (`function_executor.py`)
  - Esegue tools in modo centralizzato
  - Gestisce formattazione risposte
  - Evita re-chiamate AI quando possibile

#### Web App ❌
- **Nessun function calling**
- L'AI generica non ha accesso deterministico ai dati
- Risposte meno accurate e consistenti

**🔧 IMPLEMENTAZIONE NECESSARIA**:
```python
# In ai_service.py, aggiungere:
async def _call_openai_with_tools(self, messages: list, tools: list) -> Dict:
    # Implementa chiamata OpenAI con tools
    # Gestisci tool calls come nel bot
    # Usa FunctionExecutor se disponibile, altrimenti fallback inline
```

---

### 10. **Storia Conversazione**

#### Telegram Bot ✅
- **Recupero storico** (`get_recent_chat_messages`)
  - Ultimi 10 messaggi utente/assistant
  - Inclusi nel contesto OpenAI
  - Migliora coerenza conversazione

#### Web App ❌
- **Nessuna storia conversazione**
- Ogni messaggio è isolato
- L'AI non ha contesto conversazione precedente

**🔧 IMPLEMENTAZIONE NECESSARIA**:
```python
# In database.py, aggiungere:
async def get_recent_chat_messages(self, user_id: int, limit: int = 10) -> List[Dict]:
    # Recupera messaggi da tabella chat_messages o log_interactions
    # Ritorna lista di dict con 'role' e 'content'

# In ai_service.py, aggiungere:
async def _get_conversation_history(self, user_id: int, limit: int = 10) -> List[Dict]:
    # Wrapper per get_recent_chat_messages
    # Adatta per web app (usa user_id invece di telegram_id)
```

---

### 11. **Formattazione Risposte Pre-Strutturate**

#### Telegram Bot ✅
- **Templates dedicati** (`response_templates.py`)
  - `format_wine_info` - Info completo vino
  - `format_wine_quantity` - Quantità vino
  - `format_wine_price` - Prezzo vino
  - `format_inventory_list` - Lista inventario
  - `format_wine_not_found` - Vino non trovato
  - `format_wine_exists` - Vino presente
  - `format_movement_period_summary` - Riepilogo movimenti
  - `format_wines_response_by_count` - Gestisce 1/multi/10+ vini
- **Formattazione diretta** (`_format_wine_response_directly`)
  - Bypassa AI per domande specifiche
  - Risposte immediate e ben formattate

#### Web App ⚠️
- **Formattazione base** (`_format_wines_response`)
  - Solo gestione 1/2-10/>10 vini
  - Nessun template dedicato per altri casi
  - Nessuna formattazione diretta

**🔧 IMPLEMENTAZIONE NECESSARIA**:
```python
# Importare o copiare response_templates.py dal bot
# Oppure implementare funzioni equivalenti in ai_service.py:
def _format_wine_info(self, wine) -> str:
    # Copia da telegram-ai-bot/src/response_templates.py:format_wine_info

def _format_wine_quantity(self, wine) -> str:
    # Copia da telegram-ai-bot/src/response_templates.py:format_wine_quantity

# Ecc.
```

---

### 12. **Rilevamento Conversazione Generale**

#### Telegram Bot ✅
- **Funzione `_is_general_conversation`**
  - Rileva: "chi sei", "cosa fai", "aiuto", "ciao"
  - Bypassa ricerca vini per conversazioni generali
  - Evita ricerche inutili nel DB

#### Web App ❌
- **Nessun rilevamento**
- Ogni messaggio può triggerare ricerca vini

**🔧 IMPLEMENTAZIONE NECESSARIA**:
```python
def _is_general_conversation(self, prompt: str) -> bool:
    # Copia da telegram-ai-bot/src/ai.py:_is_general_conversation
```

---

### 13. **Ricerca Vini con Pattern Matching Avanzato**

#### Telegram Bot ✅
- **Pattern multipli** (`wine_search_patterns`)
  - "che X ho/hai?" - Pattern più generico
  - "quanti/quante bottiglie di X" - Pattern specifico quantità
  - "a quanto vendo X" - Pattern prezzo
  - "prezzo X" - Pattern prezzo semplice
  - "informazioni su X" - Pattern info
- **Pulizia termine** (`_clean_wine_search_term`)
  - Rimuove parole interrogative, articoli, verbi
  - Preserva preposizioni articolate (es. "del" in "Ca del Bosco")
  - Normalizza punteggiatura

#### Web App ⚠️
- **Pattern base** nel fallback
  - Solo alcuni pattern base
  - Pulizia termine presente ma meno completa

**🔧 IMPLEMENTAZIONE NECESSARIA**:
```python
# Migliorare pattern matching in _simple_ai_response
# Aggiungere tutti i pattern del bot
# Migliorare _clean_wine_search_term se necessario
```

---

### 14. **Gestione Bottoni Selezione Vini**

#### Telegram Bot ✅
- **Marker `[[WINE_SELECTION_BUTTONS:id1:id2:...]]`**
  - Generato da `format_wines_response_by_count` per 2-10 vini
  - Bot interpreta marker e crea bottoni Telegram
  - Click bottone → richiesta dettagli vino

#### Web App ⚠️
- **Bottoni implementati** nel frontend
  - `buttons` field in `ChatResponse`
  - Frontend renderizza bottoni
  - Click → invia nuovo messaggio
- **Manca generazione automatica** bottoni
  - `_format_wines_response` non genera sempre bottoni
  - Dovrebbe generare per 2-10 vini come nel bot

**🔧 IMPLEMENTAZIONE NECESSARIA**:
```python
# In _format_wines_response, assicurarsi che ritorni sempre buttons per 2-10 vini
# Già implementato ma verificare che funzioni correttamente
```

---

### 15. **Ricerca Filtrata Avanzata**

#### Telegram Bot ✅
- **Parser filtri** (`_parse_filters`)
  - Estrae: paese, regione, tipo, prezzo, annata, produttore
  - Supporta sinonimi geografici
  - Normalizza variazioni (es. "toscata" → "Toscana")
- **Function `search_wines_filtered`**
  - Applica filtri multipli
  - Combina con cascading retry

#### Web App ❌
- **Nessun parser filtri**
- L'AI generica può interpretare ma senza estrazione strutturata

**🔧 IMPLEMENTAZIONE NECESSARIA**:
```python
def _parse_filters(self, prompt: str) -> dict:
    # Copia da telegram-ai-bot/src/ai.py:_parse_filters
    # Adatta per web app
```

---

## 📊 Riepilogo Funzionalità Mancanti

| Funzionalità | Telegram Bot | Web App | Priorità |
|-------------|--------------|---------|----------|
| Rilevamento movimenti | ✅ | ❌ | 🔴 ALTA |
| Rilevamento lista inventario | ✅ | ❌ | 🟡 MEDIA |
| Rilevamento movimenti summary | ✅ | ❌ | 🟡 MEDIA |
| Query informative (min/max) | ✅ | ❌ | 🟡 MEDIA |
| Query qualitative | ✅ | ❌ | 🟢 BASSA |
| Query sensoriali | ✅ | ❌ | 🟢 BASSA |
| Cascading retry search | ✅ | ⚠️ Parziale | 🔴 ALTA |
| Function calling OpenAI | ✅ | ❌ | 🔴 ALTA |
| Storia conversazione | ✅ | ❌ | 🟡 MEDIA |
| Formattazione pre-strutturata | ✅ | ⚠️ Parziale | 🟡 MEDIA |
| Rilevamento conversazione generale | ✅ | ❌ | 🟢 BASSA |
| Pattern matching avanzato | ✅ | ⚠️ Base | 🟡 MEDIA |
| Parser filtri | ✅ | ❌ | 🟡 MEDIA |

---

## 🎯 Piano di Implementazione Consigliato

### Fase 1: Funzionalità Core (Priorità ALTA)
1. **Function Calling OpenAI**
   - Implementa tools base (get_wine_info, search_wines, ecc.)
   - Aggiungi FunctionExecutor o fallback inline
2. **Cascading Retry Search**
   - Migliora tasso successo ricerche
   - Implementa 3 livelli retry
3. **Rilevamento Movimenti**
   - Permette registrazione consumi/rifornimenti
   - Core funzionalità inventario

### Fase 2: Miglioramenti UX (Priorità MEDIA)
4. **Storia Conversazione**
   - Migliora coerenza risposte
   - Migliore esperienza utente
5. **Formattazione Pre-Strutturata**
   - Risposte più consistenti
   - Migliore leggibilità
6. **Rilevamento Richieste Specifiche**
   - Lista inventario, movimenti summary
   - Query informative (min/max)

### Fase 3: Funzionalità Avanzate (Priorità BASSA)
7. **Query Qualitative/Sensoriali**
   - Migliora capacità AI
   - Funzionalità avanzate
8. **Parser Filtri Avanzato**
   - Migliora ricerca filtrata
   - Supporto sinonimi geografici

---

## 🔧 Note Tecniche

### Adattamenti Necessari
- **Database Manager**: Web app usa `db_manager` (sync-like), bot usa `async_db_manager` (async)
- **User ID**: Web app può usare `user_id` invece di `telegram_id` per utenti web-only
- **Processor Client**: Già presente in web app, riusabile
- **Response Templates**: Importare o copiare da bot, o implementare equivalenti

### Compatibilità
- La maggior parte del codice del bot può essere riutilizzato con piccole modifiche
- Funzioni helper (`_clean_wine_search_term`, `_parse_filters`) sono pure e riutilizzabili
- Function calling richiede adattamento per web app (no Telegram context)

---

## ✅ Conclusione

La Web App manca di **circa il 70-80% delle funzionalità** del Telegram Bot. Le funzionalità più critiche mancanti sono:

1. **Function Calling** - Accesso deterministico ai dati
2. **Cascading Retry** - Migliora successo ricerche
3. **Rilevamento Movimenti** - Core funzionalità inventario
4. **Storia Conversazione** - Migliora UX

Implementando queste 4 funzionalità, la Web App raggiungerebbe **circa il 60-70% della parità funzionale** con il bot. Le altre funzionalità possono essere aggiunte progressivamente.

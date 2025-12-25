# 📋 Piano Refactoring ai_service.py

## Stato Attuale
- **File**: `ai_service.py`
- **Righe**: 2,765
- **Token stimati**: ~33,000
- **Problema**: File monolitico, alto consumo token in Cursor

## Strategia Refactoring

### Fase 1: Estrarre Utility HTML ✅ (Priorità Alta)
**Modulo**: `ai_utils/response_formatter.py`

**Metodi da estrarre**:
- `_escape_html()`
- `_generate_wine_card_html()`
- `_generate_movement_card_html()`
- `_generate_inventory_list_html()`
- `_generate_stats_card_html()`
- `_generate_wines_list_html()`
- `_generate_empty_state_html()`
- `_generate_error_message_html()`
- `_generate_wine_confirmation_html()`
- `_detect_movement_in_message()`

**Beneficio**: Riduce ~500 righe, ~6,000 token

### Fase 2: Estrarre Handler Movimenti
**Modulo**: `ai_handlers/movement_handler.py`

**Metodi da estrarre**:
- Logica gestione movimenti con conferma (righe 87-171)
- Gestione movimenti da function calling
- Validazione movimenti

**Beneficio**: Riduce ~400 righe, ~5,000 token

### Fase 3: Estrarre Handler Query
**Modulo**: `ai_handlers/query_handler.py`

**Metodi da estrarre**:
- `_build_inventory_list_response()`
- `_handle_informational_query()`
- `_format_wines_response()`
- `_cascading_retry_search()`
- `_retry_level_1_normalize_local()`
- `_retry_level_2_fallback_less_specific()`
- `_retry_level_3_ai_post_processing()`

**Beneficio**: Riduce ~600 righe, ~7,000 token

### Fase 4: Estrarre Handler Report/Analytics
**Modulo**: `ai_handlers/analytics_handler.py` e `report_handler.py`

**Metodi da estrarre**:
- `_build_report_card_response()`
- `_build_movements_response()`
- `_is_report_request()`
- `_is_inventory_list_request()`
- `_is_movement_summary_request()`
- `_is_informational_query()`

**Beneficio**: Riduce ~300 righe, ~4,000 token

### Fase 5: Estrarre Function Calling Tools
**Modulo**: `ai_utils/tools_definitions.py` e `ai_utils/tools_executor.py`

**Metodi da estrarre**:
- `_get_openai_tools()`
- `_execute_tool()`
- `_call_openai_with_tools()`

**Beneficio**: Riduce ~700 righe, ~8,000 token

### Fase 6: Estrarre Context Manager
**Modulo**: `ai_utils/context_manager.py`

**Metodi da estrarre**:
- Costruzione contesto utente
- Gestione storia conversazione
- Preparazione prompt

**Beneficio**: Riduce ~200 righe, ~2,500 token

### Fase 7: Refactor ai_service.py come Orchestratore
**Risultato finale**: `ai_service.py` con ~200 righe

**Metodi rimasti**:
- `__init__()`
- `process_message()` - orchestratore principale
- Delegazione a handler appropriati

## Struttura Finale

```
backend/app/services/
├── ai_service.py (orchestratore, ~200 righe)
├── ai_handlers/
│   ├── __init__.py
│   ├── movement_handler.py (~400 righe)
│   ├── query_handler.py (~600 righe)
│   ├── analytics_handler.py (~150 righe)
│   └── report_handler.py (~150 righe)
└── ai_utils/
    ├── __init__.py
    ├── response_formatter.py (~500 righe)
    ├── tools_definitions.py (~200 righe)
    ├── tools_executor.py (~500 righe)
    └── context_manager.py (~200 righe)
```

## Risultato Atteso

- **Riduzione token**: Da ~33,000 a ~2,000-5,000 per file
- **Miglior manutenibilità**: File più piccoli e focalizzati
- **Più veloce da navigare**: File specifici per task specifici

## Note Implementazione

1. Mantenere compatibilità retroattiva
2. Testare ogni fase prima di procedere
3. Usare import relativi correttamente
4. Aggiornare `ai_service.py` per usare i nuovi moduli


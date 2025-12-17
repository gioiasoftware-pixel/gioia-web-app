# 📋 Checklist Progetto - Modifica Vini Web App

**Data Creazione**: 2024  
**Obiettivo**: Implementare sistema completo di modifica vini dalla web app con tracciabilità movimenti

---

## 📊 STATO ATTUALE DEL PROGETTO

### ✅ Funzionalità Esistenti

- [x] **Autenticazione JWT** - Sistema completo di login/signup
- [x] **Viewer Inventario** - Visualizzazione inventario con filtri e ricerca
- [x] **Viewer Fullscreen** - Versione estesa con grafici movimenti
- [x] **Chat AI** - Sistema conversazione con AI
- [x] **Wine Card Edit Form** - Form di modifica vino nella chat (frontend)
- [x] **API Backend** - Endpoint `PUT /api/wines/{wine_id}` esistente
- [x] **Processor Admin** - Endpoint `/admin/update-wine-field` esistente
- [x] **Sistema Movimenti** - Log movimenti consumi/rifornimenti funzionante

### ❌ Problemi Identificati

- [ ] **Modifica non funziona** - Form permette modifiche ma salvataggio fallisce
- [ ] **Campi non supportati** - `name`, `quantity`, `region`, `country`, `wine_type` rifiutati dal processor
- [ ] **Nome vino modificabile** - Dovrebbe essere readonly (identificatore principale)
- [ ] **Quantità senza movimento** - Modifica quantità non crea log movimento
- [ ] **Viewer senza modifica** - Fullscreen non ha pulsante modifica
- [ ] **Wine ID mancante** - Snapshot viewer non include `id` necessario per modifiche

---

## 🎯 IMPLEMENTAZIONI DA FARE

### 📦 FASE 1: Processor - Estensione Campi Supportati

**File**: `gioia-processor/api/routers/admin.py`

#### Task 1.1: Estendere `allowed_fields`
- [ ] Aggiungere `'region': 'region'` a `allowed_fields` (riga 588-599)
- [ ] Aggiungere `'country': 'country'` a `allowed_fields`
- [ ] Aggiungere `'wine_type': 'wine_type'` a `allowed_fields`
- [ ] **NON aggiungere** `'name'` (deve rimanere non modificabile)
- [ ] **NON aggiungere** `'quantity'` (richiede endpoint speciale)

#### Task 1.2: Estendere `cast_value` per nuovi campi
- [ ] Aggiungere validazione per `wine_type` (enum: Rosso, Bianco, Rosato, Spumante, Altro)
- [ ] Aggiungere gestione per `region` (stringa semplice)
- [ ] Aggiungere gestione per `country` (stringa semplice)
- [ ] Testare validazione enum per `wine_type`

#### Task 1.3: Aggiornare documentazione endpoint
- [ ] Aggiornare docstring `update_wine_field` (riga 582-586) con nuovi campi supportati

**Note**: `quantity` richiede endpoint separato (vedi Fase 2)

---

### 📦 FASE 2: Processor - Modifica Quantità con Movimento

**File**: `gioia-processor/api/routers/admin.py`

#### Task 2.1: Creare nuovo endpoint `update-wine-field-with-movement`
- [ ] Creare funzione `update_wine_field_with_movement` (dopo riga 692)
- [ ] Parametri: `telegram_id`, `business_name`, `wine_id`, `field='quantity'`, `new_value`
- [ ] Validare che `field == 'quantity'`
- [ ] Validare che `new_value` sia intero >= 0

#### Task 2.2: Implementare logica movimento
- [ ] Recuperare `quantity_before` dal database
- [ ] Calcolare `quantity_change = new_value - quantity_before`
- [ ] Se `quantity_change == 0`: skip movimento, solo aggiorna
- [ ] Se `quantity_change > 0`: `movement_type = 'rifornimento'`
- [ ] Se `quantity_change < 0`: `movement_type = 'consumo'`, validare quantità sufficiente

#### Task 2.3: Transazione database
- [ ] UPDATE `quantity` nella tabella inventario
- [ ] INSERT movimento nella tabella `Consumi e rifornimenti` (stesso schema di `process_movement_background`)
- [ ] Campi movimento: `user_id`, `wine_name`, `wine_producer`, `movement_type`, `quantity_change`, `quantity_before`, `quantity_after`, `movement_date`
- [ ] Gestire rollback in caso di errore
- [ ] Logging dettagliato

#### Task 2.4: Registrare endpoint in router
- [ ] Aggiungere route in `api/main.py` (riga 171) se necessario
- [ ] Testare endpoint con Postman/curl

**Riferimento**: Usare logica da `movements.py` righe 253-338

---

### 📦 FASE 3: Backend Web App - Processor Client

**File**: `gioia-web-app/backend/app/core/processor_client.py`

#### Task 3.1: Aggiungere metodo `update_wine_field_with_movement`
- [ ] Creare metodo async dopo `update_wine_field` (dopo riga 235)
- [ ] Parametri: `telegram_id`, `business_name`, `wine_id`, `new_quantity`
- [ ] Chiamare endpoint processor `/admin/update-wine-field-with-movement`
- [ ] Gestire errori HTTP e restituire risultato formattato
- [ ] Logging appropriato

---

### 📦 FASE 4: Backend Web App - API Wines

**File**: `gioia-web-app/backend/app/api/wines.py`

#### Task 4.1: Gestire `quantity` in modo speciale
- [ ] Modificare loop aggiornamento (riga 122-138)
- [ ] Se `field == 'quantity'`: chiamare `update_wine_field_with_movement`
- [ ] Altrimenti: chiamare `update_wine_field` normale
- [ ] Gestire errori separatamente per `quantity`

#### Task 4.2: Escludere `name` dall'aggiornamento
- [ ] Filtrare `name` da `update_data` prima del loop (dopo riga 107)
- [ ] Log warning se `name` è presente in `update_data`
- [ ] Non inviare `name` al processor

#### Task 4.3: Migliorare gestione errori
- [ ] Se alcuni campi falliscono ma altri no: restituire successo parziale
- [ ] Includere dettagli errori nella risposta
- [ ] Logging dettagliato per debug

---

### 📦 FASE 5: Backend Web App - Viewer Snapshot

**File**: `gioia-web-app/backend/app/api/viewer.py`

#### Task 5.1: Aggiungere `id` alla query snapshot
- [ ] Modificare query SQL (riga 103-117) per includere `id`
- [ ] Aggiungere `id` al SELECT

#### Task 5.2: Includere `id` nelle rows
- [ ] Aggiungere `"id": wine.id` nel dict rows (riga 125-134)
- [ ] Verificare che `id` sia sempre presente

**Test**: Verificare che snapshot restituisca `id` per ogni vino

---

### 📦 FASE 6: Frontend - Form Modifica (Wine Card)

**File**: `gioia-web-app/frontend/app.js`

#### Task 6.1: Rendere `name` readonly
- [ ] Modificare input `name` (riga 868) aggiungendo `readonly` e `disabled`
- [ ] Aggiungere stile CSS per indicare campo non modificabile
- [ ] Aggiungere tooltip "Nome non modificabile"

#### Task 6.2: Escludere `name` dal salvataggio
- [ ] Modificare `saveWineCardEdit` (riga 959) per saltare campo `name`
- [ ] Aggiungere check: `if (input.name === 'name') return;`

#### Task 6.3: Migliorare feedback utente
- [ ] Mostrare messaggio chiaro se alcuni campi non sono stati aggiornati
- [ ] Distinguere tra errori e successi parziali
- [ ] Mostrare lista campi aggiornati con successo

---

### 📦 FASE 7: Frontend - Viewer Fullscreen Modifica

**File**: `gioia-web-app/frontend/app.js`

#### Task 7.1: Aggiungere pulsante modifica nella tabella
- [ ] Modificare `renderViewerTable` (riga 1442-1452)
- [ ] Aggiungere pulsante "Modifica" accanto a pulsante grafico
- [ ] Icona matita/modifica (SVG)
- [ ] Attributo `data-wine-id` con `row.id` (da snapshot)
- [ ] Attributo `data-wine-name` per riferimento
- [ ] Handler `onclick` che chiama `handleViewerWineEdit(row.id)`

#### Task 7.2: Creare funzione `handleViewerWineEdit`
- [ ] Creare funzione async `handleViewerWineEdit(wineId)`
- [ ] Caricare dati vino da `GET /api/wines/{wineId}`
- [ ] Mostrare modal/form di modifica (riutilizzare stile `wine-card-edit-form`)
- [ ] Gestire salvataggio chiamando `PUT /api/wines/{wineId}`
- [ ] Ricaricare snapshot dopo salvataggio riuscito

#### Task 7.3: Creare modal modifica per viewer
- [ ] Creare HTML modal (o riutilizzare struttura esistente)
- [ ] Form con stessi campi di `wine-card-edit-form` (escluso `name`)
- [ ] Pulsanti "Annulla" e "Salva"
- [ ] Styling coerente con design esistente

#### Task 7.4: Integrare con sistema esistente
- [ ] Assicurarsi che modal si apra correttamente
- [ ] Gestire chiusura modal (click overlay, ESC, pulsante annulla)
- [ ] Ricaricare tabella dopo modifica riuscita

---

### 📦 FASE 8: Testing e Validazione

#### Task 8.1: Test Processor
- [ ] Test aggiornamento campi supportati (producer, supplier, etc.)
- [ ] Test aggiornamento nuovi campi (region, country, wine_type)
- [ ] Test validazione enum `wine_type`
- [ ] Test modifica `quantity` con movimento automatico
- [ ] Test movimento rifornimento (quantity aumenta)
- [ ] Test movimento consumo (quantity diminuisce)
- [ ] Test quantità insufficiente (consumo > disponibile)
- [ ] Verificare log movimenti creati correttamente

#### Task 8.2: Test Backend API
- [ ] Test `PUT /api/wines/{wine_id}` con tutti i campi
- [ ] Test esclusione `name` dall'aggiornamento
- [ ] Test gestione `quantity` con movimento
- [ ] Test errori e messaggi appropriati
- [ ] Test successo parziale (alcuni campi ok, altri no)

#### Task 8.3: Test Frontend
- [ ] Test form modifica wine card (chat)
- [ ] Test campo `name` readonly
- [ ] Test salvataggio escludendo `name`
- [ ] Test pulsante modifica viewer fullscreen
- [ ] Test modal modifica viewer
- [ ] Test ricaricamento dati dopo modifica
- [ ] Test feedback utente (messaggi successo/errore)

#### Task 8.4: Test Integrazione
- [ ] Test flusso completo: modifica → salvataggio → verifica database
- [ ] Test modifica quantità → verifica movimento creato
- [ ] Test modifica multipli campi simultaneamente
- [ ] Test da viewer fullscreen e da chat

---

## 🔍 CHECKLIST PRE-IMPLEMENTAZIONE

### Verifica Prerequisiti
- [ ] Backup database attuale
- [ ] Verificare che processor sia raggiungibile da backend web app
- [ ] Verificare che endpoint processor `/admin/update-wine-field` funzioni
- [ ] Verificare struttura tabelle database (inventario, movimenti)
- [ ] Verificare che `wine_id` sia disponibile nel database

### Setup Ambiente
- [ ] Processor in esecuzione e accessibile
- [ ] Backend web app in esecuzione
- [ ] Frontend web app in esecuzione
- [ ] Database connesso e funzionante
- [ ] Strumenti di test pronti (Postman, browser dev tools)

---

## 📝 NOTE IMPLEMENTAZIONE

### Ordine Consigliato
1. **Fase 1** (Processor - Campi supportati) - Base per tutto
2. **Fase 2** (Processor - Movimento quantità) - Funzionalità critica
3. **Fase 3** (Backend - Processor client) - Collegamento
4. **Fase 4** (Backend - API Wines) - Logica business
5. **Fase 5** (Backend - Viewer snapshot) - Prerequisito frontend
6. **Fase 6** (Frontend - Form modifica) - UX chat
7. **Fase 7** (Frontend - Viewer fullscreen) - UX viewer
8. **Fase 8** (Testing) - Validazione completa

### Punti Critici
- ⚠️ **Quantità con movimento**: Deve mantenere coerenza con sistema esistente
- ⚠️ **Nome vino**: NON deve essere modificabile (identificatore)
- ⚠️ **Wine ID**: Deve essere disponibile nel viewer per modifiche
- ⚠️ **Transazioni**: Movimenti devono essere atomici con aggiornamento inventario

### Riferimenti Codice
- **Movimenti**: `gioia-processor/api/routers/movements.py` (righe 253-338)
- **Update field**: `gioia-processor/api/routers/admin.py` (righe 574-692)
- **API Wines**: `gioia-web-app/backend/app/api/wines.py` (righe 85-160)
- **Viewer**: `gioia-web-app/backend/app/api/viewer.py` (righe 103-134)
- **Form edit**: `gioia-web-app/frontend/app.js` (righe 784-1002)
- **Viewer table**: `gioia-web-app/frontend/app.js` (righe 1405-1545)

---

## 🎯 CRITERI DI COMPLETAMENTO

### Funzionalità Complete Quando:
- [x] Tutti i campi supportati possono essere modificati (eccetto `name`)
- [x] Modifica `quantity` crea movimento automatico nel log
- [x] Form modifica funziona correttamente (chat)
- [x] Viewer fullscreen ha pulsante modifica funzionante
- [x] `name` non è modificabile in nessun contesto
- [x] Movimenti creati hanno stesso formato di quelli da chat
- [x] Feedback utente chiaro su successi/errori
- [x] Tutti i test passano

---

## 📚 DOCUMENTAZIONE DA AGGIORNARE

- [ ] Aggiornare README processor con nuovi endpoint
- [ ] Documentare nuovo flusso modifica quantità
- [ ] Aggiornare API documentation (se presente)
- [ ] Aggiungere commenti nel codice per logica complessa

---

**Ultimo Aggiornamento**: 2024  
**Stato**: 🟡 In Attesa Implementazione

# ⚡ Checklist Rapida - Modifica Vini Web App

## 🎯 OBIETTIVO
Implementare modifica vini completa dalla web app con tracciabilità movimenti quantità.

---

## ✅ CHECKLIST IMPLEMENTAZIONE

### 📦 FASE 1: Processor - Campi Supportati ✅
**File**: `gioia-processor/api/routers/admin.py`
- [x] Aggiungere `region`, `country`, `wine_type` a `allowed_fields`
- [x] Estendere `cast_value` per validazione `wine_type` (enum)
- [x] Aggiornare docstring endpoint

### 📦 FASE 2: Processor - Movimento Quantità ✅
**File**: `gioia-processor/api/routers/admin.py`
- [x] Creare endpoint `update-wine-field-with-movement`
- [x] Calcolare `quantity_change = new_value - quantity_before`
- [x] Determinare `movement_type` (consumo/rifornimento)
- [x] UPDATE quantity + INSERT movimento (transazione atomica)

### 📦 FASE 3: Backend - Processor Client ✅
**File**: `gioia-web-app/backend/app/core/processor_client.py`
- [x] Aggiungere metodo `update_wine_field_with_movement`

### 📦 FASE 4: Backend - API Wines ✅
**File**: `gioia-web-app/backend/app/api/wines.py`
- [x] Gestire `quantity` con endpoint speciale
- [x] Escludere `name` dall'aggiornamento
- [x] Migliorare gestione errori (successo parziale)

### 📦 FASE 5: Backend - Viewer Snapshot ✅
**File**: `gioia-web-app/backend/app/api/viewer.py`
- [x] Aggiungere `id` alla query SELECT
- [x] Includere `id` nelle rows restituite

### 📦 FASE 6: Frontend - Form Modifica ✅
**File**: `gioia-web-app/frontend/app.js`
- [x] Rendere `name` readonly/disabled
- [x] Escludere `name` dal salvataggio
- [ ] Migliorare feedback utente (opzionale - da migliorare in futuro)

### 📦 FASE 7: Frontend - Viewer Fullscreen ✅
**File**: `gioia-web-app/frontend/app.js`
- [x] Aggiungere pulsante "Modifica" nella tabella
- [x] Creare funzione `handleViewerWineEdit(wineId)`
- [x] Creare modal form modifica
- [x] Integrare con sistema esistente

### 📦 FASE 8: Testing ⏳
- [ ] Test processor (campi, movimenti)
- [ ] Test backend API
- [ ] Test frontend (form, viewer)
- [ ] Test integrazione completa

---

## ✅ IMPLEMENTAZIONE COMPLETATA (Fasi 1-7)

Tutte le fasi di implementazione sono state completate:
- ✅ Processor esteso con nuovi campi supportati
- ✅ Endpoint modifica quantità con movimento automatico
- ✅ Backend integrato con processor client
- ✅ API Wines gestisce quantity e esclude name
- ✅ Viewer snapshot include wine_id
- ✅ Frontend form modifica con name readonly
- ✅ Viewer fullscreen con pulsante modifica e modal

**Prossimo passo**: Testing completo (FASE 8)

---

## 🚨 PUNTI CRITICI

- ⚠️ **Quantità**: Deve creare movimento automatico
- ⚠️ **Nome**: NON modificabile
- ⚠️ **Wine ID**: Deve essere nel viewer snapshot
- ⚠️ **Transazioni**: Movimenti atomici

---

## 📋 PRE-IMPLEMENTAZIONE

- [ ] Backup database
- [ ] Verificare processor raggiungibile
- [ ] Verificare endpoint esistenti funzionano
- [ ] Setup ambiente test

---

## 🎯 ORDINE CONSIGLIATO

1. Fase 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

---

**Riferimento completo**: `CHECKLIST_IMPLEMENTAZIONE.md`

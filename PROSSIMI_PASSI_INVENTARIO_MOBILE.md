# Prossimi Passi - Inventario Mobile

## ✅ Completato

1. ✅ Creato `ChatMobile.js` con gestione inventario mobile
2. ✅ Creato `inventoryMobile.js` per gestione completa inventario mobile
3. ✅ Aggiunto caricamento condizionale script con verifiche namespace
4. ✅ Aggiunto verifiche namespace in `ChatDesktop.js` per evitare conflitti
5. ✅ Auto-inizializzazione script quando DOM è pronto

## 🔄 Prossimi Passi (Opzionali)

### 1. Implementare Caricamento Movimenti Vino
**File**: `gioia-web-app/frontend/features/inventory/mobile/inventoryMobile.js`  
**Funzione**: `loadMovements(wineId)`

**Cosa fare**:
- Implementare chiamata API per recuperare movimenti del vino
- Endpoint da verificare: `/api/wines/{id}/movements` o simile
- Renderizzare movimenti nella sezione `inventory-movements-log-mobile`
- Mostrare grafico movimenti se disponibile

**Priorità**: Media

---

### 2. Implementare Filtro Ricerca
**File**: `gioia-web-app/frontend/features/inventory/mobile/inventoryMobile.js`  
**Funzione**: `filterWineList(searchTerm)`

**Cosa fare**:
- Filtrare lista vini in base al termine di ricerca
- Cercare in nome, produttore, annata
- Aggiornare display lista in tempo reale
- Gestire ricerca case-insensitive

**Priorità**: Media

---

### 3. Implementare Reset Completo Filtri
**File**: `gioia-web-app/frontend/features/inventory/mobile/inventoryMobile.js`  
**Funzione**: `resetFilters()`

**Cosa fare**:
- Resetare tutti i filtri (tipologia, annata, cantina, fornitore)
- Resetare campo ricerca
- Ricaricare lista completa inventario
- Aggiornare UI filtri

**Priorità**: Bassa

---

### 4. Migliorare Gestione Errori
**File**: `gioia-web-app/frontend/features/inventory/mobile/inventoryMobile.js`

**Cosa fare**:
- Sostituire `alert()` con modali personalizzate
- Aggiungere retry automatico per chiamate API fallite
- Mostrare messaggi di errore più descrittivi
- Gestire timeout e connessioni lente

**Priorità**: Media

---

### 5. Aggiungere Modali Personalizzate
**File**: Nuovo file o estensione `inventoryMobile.js`

**Cosa fare**:
- Creare sistema modali mobile-friendly
- Sostituire `alert()` e `confirm()` con modali custom
- Aggiungere modale "Conferma salvataggio" con anteprima modifiche
- Modale "Errore" con dettagli e opzione retry

**Priorità**: Bassa

---

### 6. Implementare Grafico Movimenti
**File**: `gioia-web-app/frontend/features/inventory/mobile/inventoryMobile.js`  
**Funzione**: `loadMovements()` o nuova funzione dedicata

**Cosa fare**:
- Integrare Chart.js per grafico movimenti
- Mostrare grafico nella sezione `inventory-graph-preview-mobile`
- Gestire diversi periodi (giorno, settimana, mese, trimestre, anno)
- Navigazione tra schermata dettagli e schermata chart

**Priorità**: Media

---

### 7. Ottimizzare Performance
**File**: `gioia-web-app/frontend/features/inventory/mobile/inventoryMobile.js`

**Cosa fare**:
- Implementare debounce per ricerca
- Cache dati vino caricati
- Lazy loading lista vini con paginazione
- Virtual scrolling per liste lunghe

**Priorità**: Bassa

---

### 8. Aggiungere Validazione Form
**File**: `gioia-web-app/frontend/features/inventory/mobile/inventoryMobile.js`  
**Funzione**: `handleSaveClick()`

**Cosa fare**:
- Validare campi numerici (quantità, prezzi, gradazione)
- Validare formato annata
- Mostrare errori di validazione inline
- Bloccare salvataggio se ci sono errori

**Priorità**: Media

---

### 9. Implementare Modal Aggiungi Vino
**File**: `gioia-web-app/frontend/features/chat/mobile/ChatMobile.js`  
**Funzione**: `setupHeaderActionButtons()`

**Cosa fare**:
- Creare modale per aggiungere nuovo vino
- Form completo con tutti i campi
- Validazione dati
- Chiamata API per creazione vino

**Priorità**: Alta

---

### 10. Aggiungere Feedback Visivo Salvataggio
**File**: `gioia-web-app/frontend/features/inventory/mobile/inventoryMobile.js`  
**Funzione**: `handleSaveClick()`

**Cosa fare**:
- Mostrare spinner durante salvataggio
- Disabilitare bottone salva durante operazione
- Mostrare checkmark quando salvataggio completato
- Animazione transizione

**Priorità**: Media

---

## 📝 Note Implementazione

### API Endpoints Utilizzati
- `GET /api/viewer/snapshot` - Lista vini inventario
- `GET /api/wines/{id}` - Dettagli completo vino
- `PUT /api/wines/{id}` - Salvataggio modifiche vino

### Namespace Isolation
Tutti gli script verificano il namespace prima di inizializzarsi:
- `window.LayoutBoundary?.isMobileNamespace()` per mobile
- `window.LayoutBoundary?.isDesktopNamespace()` per desktop

### Struttura File
```
frontend/
├── features/
│   ├── chat/
│   │   ├── mobile/
│   │   │   └── ChatMobile.js ✅
│   │   └── desktop/
│   │       └── ChatDesktop.js ✅
│   └── inventory/
│       └── mobile/
│           └── inventoryMobile.js ✅
```

### Testing Consigliato
1. Test apertura inventario mobile
2. Test caricamento lista vini
3. Test visualizzazione dettagli vino
4. Test modifica e salvataggio campi
5. Test navigazione tra schermate
6. Test gestione errori API
7. Test su dispositivi mobile reali

---

**Ultimo aggiornamento**: 6 gennaio 2026  
**Stato**: Implementazione base completata ✅


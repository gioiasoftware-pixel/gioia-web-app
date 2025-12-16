# 📊 Analisi Comparativa: Viewer Toggle vs Directory Viewer

**Data**: 2025-01-XX  
**Scopo**: Identificare funzionalità mancanti nel viewer toggle della web app rispetto al viewer originale standalone

---

## 📋 Indice

1. [Panoramica](#panoramica)
2. [Funzionalità Viewer Originale](#funzionalità-viewer-originale)
3. [Funzionalità Viewer Toggle (Web App)](#funzionalità-viewer-toggle-web-app)
4. [Gap Analysis](#gap-analysis)
5. [Piano di Implementazione](#piano-di-implementazione)

---

## 🎯 Panoramica

### Viewer Originale (`Vineinventory Viewer`)
- **Tipo**: Applicazione standalone standalone
- **Autenticazione**: Token JWT via URL (`?token=...`)
- **Endpoint**: `/api/inventory/snapshot`, `/api/inventory/export.csv`, `/api/inventory/movements`
- **Librerie**: Chart.js per grafici movimenti
- **Caratteristiche**: Viewer completo con tutte le funzionalità avanzate

### Viewer Toggle (Web App)
- **Tipo**: Componente integrato nella web app (sidebar destro)
- **Autenticazione**: Bearer token (JWT) via header
- **Endpoint**: `/api/viewer/snapshot` (backend web app)
- **Librerie**: Nessuna libreria esterna per grafici
- **Caratteristiche**: Viewer base con funzionalità essenziali

---

## ✅ Funzionalità Viewer Originale

### 1. **Visualizzazione Dati**
- ✅ Tabella inventario completa (Nome, Cantina, Quantità, Prezzo, Fornitore, Scorta critica)
- ✅ Meta informazioni ("234 records • Last updated...")
- ✅ Paginazione completa (50 righe/pagina)
- ✅ Ricerca istantanea debounced (300ms) su Nome/Annata/Cantina/Fornitore

### 2. **Filtri Avanzati**
- ✅ Filtri espandibili/collassabili (Tipologia, Annata, Cantina, Fornitori)
- ✅ Conteggi dinamici per ogni filtro
- ✅ Filtri multipli combinabili
- ✅ Visualizzazione stato attivo filtro
- ✅ Filtri ordinati per frequenza (count desc)

### 3. **Interattività Righe**
- ✅ **Click su riga vino**: Espansione con dettagli completi
  - Nome, Cantina, Annata, Quantità, Prezzo vendita
  - Fornitore, Tipologia, Uvaggio, Regione, Paese
  - Classificazione, Prezzo costo, Gradazione
  - Descrizione, Note
- ✅ **Pulsante grafico**: Apertura modal con grafico movimenti
- ✅ Visualizzazione stato espanso (highlight riga)

### 4. **Grafico Movimenti**
- ✅ **Modal dedicato** per visualizzazione grafico
- ✅ **Chart.js** con 3 dataset:
  - Consumi (linea rossa granaccia)
  - Rifornimenti (linea verde)
  - Quantità Stock (linea blu, asse Y secondario)
- ✅ Endpoint `/api/inventory/movements?token=...&wine_name=...`
- ✅ Gestione stato vuoto (nessun movimento)
- ✅ Chiusura modal (click fuori, ESC, pulsante X)

### 5. **Download CSV**
- ✅ Pulsante "Download CSV" in header
- ✅ Endpoint `/api/inventory/export.csv?token=...`
- ✅ Export dati filtrati
- ✅ Mock CSV per sviluppo (token=FAKE)

### 6. **UI/UX**
- ✅ Header con logo, titolo, meta info
- ✅ Sidebar filtri a sinistra (desktop)
- ✅ Layout responsive (stack verticale su mobile)
- ✅ Error banner per token scaduto/non valido
- ✅ Loading states
- ✅ Empty states

### 7. **Gestione Dati**
- ✅ Normalizzazione dati (gestione valori null/vuoti)
- ✅ Escape HTML per sicurezza
- ✅ Gestione vintage come stringa/number
- ✅ Filtraggio facets vuoti (supplier, winery)

---

## ⚠️ Funzionalità Viewer Toggle (Web App)

### 1. **Visualizzazione Dati**
- ✅ Tabella inventario base (Nome, Cantina, Quantità, Prezzo, Fornitore, Scorta)
- ❌ Meta informazioni ("X records • Last updated...")
- ✅ Paginazione base (20 righe/pagina)
- ✅ Ricerca base (senza debounce esplicito)

### 2. **Filtri**
- ✅ Filtri espandibili/collassabili (Tipologia, Annata, Cantina, Fornitori)
- ✅ Conteggi dinamici per ogni filtro
- ✅ Filtri multipli combinabili
- ✅ Visualizzazione stato attivo filtro
- ⚠️ Filtri NON ordinati per frequenza (ordinamento backend)

### 3. **Interattività Righe**
- ❌ **Nessuna espansione righe** con dettagli
- ❌ **Nessun pulsante grafico** movimenti
- ❌ Nessuna visualizzazione dettagli vino

### 4. **Grafico Movimenti**
- ❌ **Nessun grafico movimenti**
- ❌ Nessun modal dedicato
- ❌ Nessuna libreria Chart.js
- ❌ Nessun endpoint movimenti

### 5. **Download CSV**
- ❌ **Nessun pulsante download CSV**
- ❌ Nessun endpoint export

### 6. **UI/UX**
- ✅ Header con titolo e pulsante chiusura
- ✅ Sidebar filtri integrata nel panel
- ✅ Layout sidebar destro (draggable)
- ⚠️ Nessun error banner dedicato
- ✅ Loading states base
- ✅ Empty states base

### 7. **Gestione Dati**
- ✅ Normalizzazione dati base
- ✅ Escape HTML
- ⚠️ Gestione vintage meno robusta

---

## 🔍 Gap Analysis

### **Funzionalità Critiche Mancanti** 🔴

1. **Espansione Righe con Dettagli Vino**
   - **Priorità**: ALTA
   - **Impatto**: UX - utenti non possono vedere dettagli completi vino
   - **Complessità**: Media
   - **Dettagli**: Click su riga espande sezione con tutti i campi vino (uvaggio, regione, descrizione, note, etc.)

2. **Grafico Movimenti Vino**
   - **Priorità**: ALTA
   - **Impatto**: UX - funzionalità chiave per analisi storico movimenti
   - **Complessità**: Alta (richiede libreria Chart.js e endpoint backend)
   - **Dettagli**: Modal con grafico Chart.js, endpoint `/api/viewer/movements`

3. **Download CSV**
   - **Priorità**: MEDIA
   - **Impatto**: Utilità - export dati per analisi esterne
   - **Complessità**: Bassa (endpoint backend già esistente nel processor)
   - **Dettagli**: Pulsante download, endpoint `/api/viewer/export.csv`

### **Funzionalità Migliorabili** 🟡

4. **Meta Informazioni**
   - **Priorità**: BASSA
   - **Impatto**: UX - feedback visivo su stato dati
   - **Complessità**: Bassa
   - **Dettagli**: Mostrare "X records • Last updated Y minuti fa" in header viewer

5. **Ricerca Debounced**
   - **Priorità**: BASSA
   - **Impatto**: Performance - riduce chiamate API durante digitazione
   - **Complessità**: Bassa
   - **Dettagli**: Debounce 300ms su input ricerca

6. **Ordinamento Filtri per Frequenza**
   - **Priorità**: BASSA
   - **Impatto**: UX - filtri più usati in cima
   - **Complessità**: Bassa
   - **Dettagli**: Ordinare facets per count desc nel frontend

---

## 📋 Piano di Implementazione

### **Fase 1: Funzionalità Essenziali** (Priorità ALTA)

#### 1.1 Espansione Righe con Dettagli Vino
**File da modificare:**
- `frontend/app.js`: Aggiungere logica click riga e rendering dettagli
- `frontend/styles.css`: Stili per riga espansa e dettagli
- `frontend/index.html`: Struttura HTML per riga dettagli (opzionale, può essere generata dinamicamente)

**Implementazione:**
```javascript
// In renderViewerTable():
// 1. Aggiungere classe 'clickable-row' alle righe
// 2. Event listener click su riga
// 3. Toggle classe 'expanded' e mostra/nascondi riga dettagli
// 4. Rendering dettagli con tutti i campi disponibili dal row object
```

**Campi da mostrare:**
- Nome, Cantina, Annata, Quantità, Prezzo vendita, Fornitore, Tipologia
- Uvaggio, Regione, Paese, Classificazione (se disponibili)
- Prezzo costo, Gradazione (se disponibili)
- Descrizione, Note (se disponibili)

**Stima**: 2-3 ore

---

#### 1.2 Grafico Movimenti Vino
**File da modificare:**
- `frontend/index.html`: Aggiungere modal HTML e script Chart.js CDN
- `frontend/app.js`: Logica apertura/chiusura modal, fetch movimenti, rendering grafico
- `frontend/styles.css`: Stili modal e grafico
- `backend/app/api/viewer.py`: Nuovo endpoint `GET /api/viewer/movements?wine_name=...`

**Dipendenza Backend:**
- Endpoint deve chiamare processor `/api/inventory/movements` o database direttamente
- Restituire array movimenti con: `date`, `type` (consumo/rifornimento), `quantity_change`, `quantity_after`

**Libreria:**
- Chart.js via CDN: `<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>`

**Implementazione:**
```javascript
// 1. Aggiungere pulsante grafico in ogni riga tabella
// 2. Event listener click pulsante → showMovementsChart(wineName)
// 3. Fetch `/api/viewer/movements?wine_name=...`
// 4. Render Chart.js con 3 dataset (consumi, rifornimenti, stock)
// 5. Gestione stato vuoto, errori, chiusura modal
```

**Stima**: 4-5 ore (include backend endpoint)

---

### **Fase 2: Funzionalità Utili** (Priorità MEDIA)

#### 2.1 Download CSV
**File da modificare:**
- `frontend/index.html`: Aggiungere pulsante download in viewer header
- `frontend/app.js`: Logica download CSV (fetch endpoint o generazione client-side)
- `backend/app/api/viewer.py`: Endpoint `GET /api/viewer/export.csv` (proxy a processor o generazione diretta)

**Implementazione:**
```javascript
// Opzione 1: Download da endpoint backend
const csvUrl = `${API_BASE_URL}/api/viewer/export.csv`;
window.open(csvUrl, '_blank');

// Opzione 2: Generazione client-side da dati filtrati
function downloadCSV() {
    const csv = generateCSVFromFilteredData(viewerData.rows);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'inventario.csv';
    link.click();
}
```

**Stima**: 1-2 ore

---

### **Fase 3: Miglioramenti UX** (Priorità BASSA)

#### 3.1 Meta Informazioni
**File da modificare:**
- `frontend/index.html`: Aggiungere elemento meta info in viewer header
- `frontend/app.js`: Funzione `updateViewerMeta()` chiamata dopo `loadViewerData()`

**Implementazione:**
```javascript
function updateViewerMeta() {
    const metaEl = document.getElementById('viewer-meta');
    const total = viewerData.meta?.total_rows || viewerData.rows.length;
    const lastUpdate = viewerData.meta?.last_update 
        ? formatRelativeTime(viewerData.meta.last_update)
        : "sconosciuto";
    metaEl.textContent = `${total} records • Last updated ${lastUpdate}`;
}
```

**Stima**: 30 minuti

---

#### 3.2 Ricerca Debounced
**File da modificare:**
- `frontend/app.js`: Modificare `handleViewerSearch()` per aggiungere debounce

**Implementazione:**
```javascript
let searchTimeout;
function handleViewerSearch(e) {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        viewerSearchQuery = e.target.value;
        applyViewerFilters();
    }, 300); // Debounce 300ms
}
```

**Stima**: 15 minuti

---

#### 3.3 Ordinamento Filtri per Frequenza
**File da modificare:**
- `frontend/app.js`: Modificare `populateFilters()` per ordinare facets

**Implementazione:**
```javascript
function populateFilters(facets) {
    Object.keys(facets).forEach(filterType => {
        const items = facets[filterType];
        // Ordina per count desc
        const sortedItems = Object.entries(items)
            .sort((a, b) => b[1] - a[1]); // Sort by count desc
        // Render sorted items...
    });
}
```

**Stima**: 15 minuti

---

## 🔧 Dettagli Implementazione Backend

### **Endpoint Movimenti** (`GET /api/viewer/movements`)

**File**: `backend/app/api/viewer.py` (nuovo file o aggiunta a esistente)

```python
from fastapi import APIRouter, Depends, HTTPException, Query
from app.core.auth import get_current_user
from app.core.database import db_manager
from app.services.processor_client import processor_client

router = APIRouter()

@router.get("/movements")
async def get_wine_movements(
    wine_name: str = Query(..., description="Nome del vino"),
    current_user = Depends(get_current_user)
):
    """
    Recupera movimenti storici per un vino specifico.
    """
    try:
        # Opzione 1: Chiama processor (se endpoint esiste)
        # movements = await processor_client.get_wine_movements(
        #     telegram_id=current_user.telegram_id,
        #     wine_name=wine_name
        # )
        
        # Opzione 2: Query diretta database (tabella consumi dinamica)
        movements = await db_manager.get_wine_movements(
            telegram_id=current_user.telegram_id,
            wine_name=wine_name
        )
        
        return {
            "movements": movements,
            "wine_name": wine_name
        }
    except Exception as e:
        logger.error(f"Errore recupero movimenti: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

**Nota**: Potrebbe essere necessario creare `db_manager.get_wine_movements()` se non esiste.

---

### **Endpoint Export CSV** (`GET /api/viewer/export.csv`)

**File**: `backend/app/api/viewer.py`

```python
from fastapi.responses import Response
import csv
import io

@router.get("/export.csv")
async def export_viewer_csv(
    current_user = Depends(get_current_user)
):
    """
    Esporta inventario filtrato come CSV.
    """
    try:
        # Recupera snapshot (stesso endpoint di /snapshot)
        snapshot = await get_viewer_snapshot(current_user)
        rows = snapshot.get("rows", [])
        
        # Genera CSV
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header
        writer.writerow(['Nome', 'Cantina', 'Fornitore', 'Annata', 'Quantità', 'Prezzo (€)', 'Tipo', 'Scorta Critica'])
        
        # Rows
        for row in rows:
            writer.writerow([
                row.get('name', ''),
                row.get('winery', ''),
                row.get('supplier', ''),
                row.get('vintage', ''),
                row.get('qty', 0),
                row.get('price', 0.0),
                row.get('type', ''),
                'Sì' if row.get('critical', False) else 'No'
            ])
        
        csv_content = output.getvalue()
        output.close()
        
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=inventario.csv"}
        )
    except Exception as e:
        logger.error(f"Errore export CSV: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

---

## 📊 Riepilogo Priorità

| Funzionalità | Priorità | Complessità | Stima | Dipendenze |
|--------------|----------|-------------|-------|------------|
| Espansione righe dettagli | 🔴 ALTA | Media | 2-3h | Nessuna |
| Grafico movimenti | 🔴 ALTA | Alta | 4-5h | Chart.js, Endpoint backend |
| Download CSV | 🟡 MEDIA | Bassa | 1-2h | Endpoint backend |
| Meta informazioni | 🟢 BASSA | Bassa | 30min | Nessuna |
| Ricerca debounced | 🟢 BASSA | Bassa | 15min | Nessuna |
| Ordinamento filtri | 🟢 BASSA | Bassa | 15min | Nessuna |

**Totale stima**: ~8-11 ore per implementazione completa

---

## 🎯 Prossimi Passi

1. **Implementare Fase 1** (funzionalità critiche):
   - Espansione righe con dettagli
   - Grafico movimenti vino
   
2. **Test end-to-end**:
   - Verificare funzionamento su mobile
   - Verificare performance con dataset grandi
   - Verificare compatibilità browser

3. **Implementare Fase 2** (download CSV)

4. **Implementare Fase 3** (miglioramenti UX)

5. **Documentazione**:
   - Aggiornare README con nuove funzionalità
   - Documentare endpoint backend nuovi

---

## 📝 Note Tecniche

- **Chart.js**: Versione 4.4.0 (stessa del viewer originale)
- **Modal**: Usare stesso pattern del viewer originale (overlay + modal-content)
- **Espansione righe**: Usare `display: table-row` per riga dettagli (compatibilità tabella)
- **Performance**: Considerare virtualizzazione tabella se dataset > 1000 righe
- **Mobile**: Assicurarsi che modal e espansione righe funzionino correttamente su mobile

---

**Fine Analisi**

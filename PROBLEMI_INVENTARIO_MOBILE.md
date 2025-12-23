# Problemi Identificati - Inventario Mobile Non Funziona

## 🔴 Problema Critico 1: Funzione Inesistente

**File:** `frontend/features/chat/mobile/ChatMobile.js`  
**Riga:** 1765  
**Errore:** `applyViewerFiltersMobile()` chiama `renderViewerTableMobile(filtered)` che NON ESISTE

**Soluzione:**
```javascript
// Riga 1765 - SOSTITUIRE:
renderViewerTableMobile(filtered);

// CON:
renderInventoryList(filtered);
```

## ⚠️ Problema 2: Ordine Operazioni

**File:** `frontend/features/chat/mobile/ChatMobile.js`  
**Riga:** 1367-1392  
**Problema:** `showInventoryScreen('list')` viene chiamato PRIMA di `openViewer()`

**Soluzione:**
```javascript
async function openInventoryViewerMobile() {
    const viewerMobile = document.getElementById('viewerPanel');
    if (!viewerMobile) return;
    
    // 1. PRIMA apri il viewer (mostra elementi)
    openViewer();
    viewerMobile.removeAttribute('hidden');
    
    // 2. POI setup e mostra schermata (elementi ora accessibili)
    setupInventoryNavigation();
    setupInventoryMobileFeatures();
    showInventoryScreen('list');
    setupInventoryBackButton();
    
    // 3. INFINE carica dati
    await loadInventoryDataMobile();
}
```

## ⚠️ Problema 3: Codice Legacy

**File:** `frontend/features/chat/mobile/ChatMobile.js`  
**Riga:** 1729-1766  
**Problema:** `applyViewerFiltersMobile()` usa variabili globali vecchie

**Stato:**
- Usa `window.viewerData`, `viewerFilters`, `viewerSearchQuery` (vecchie)
- Nuova implementazione usa `inventoryDataMobile`, `inventoryFilteredDataMobile`
- Funzione chiama `renderViewerTableMobile` (non esiste)

**Opzioni:**
1. Rimuovere `applyViewerFiltersMobile()` se non più usata
2. Aggiornarla per usare `filterInventoryList()` invece
3. Eliminare completamente se `filterInventoryList()` la sostituisce

## ⚠️ Problema 4: Duplicazione Setup Viewer

**File:** `frontend/features/chat/mobile/ChatMobile.js`  
**Riga:** 1386, 1389  
**Problema:** Sia `openViewer()` che `removeAttribute('hidden')` mostrano il viewer

**Nota:** Non è un errore critico, ma potrebbe causare problemi di timing. `openViewer()` imposta lo stato che attiva `openViewerInternal()` che mostra il viewer. Il `removeAttribute('hidden')` diretto potrebbe essere ridondante ma non dannoso.

## ⚠️ Problema 5: Setup Elementi Nascosti

**File:** `frontend/features/chat/mobile/ChatMobile.js`  
**Riga:** 1374-1377  
**Problema:** `setupInventoryNavigation()` e `setupInventoryMobileFeatures()` cercano elementi quando il viewer è ancora nascosto

**Nota:** JavaScript può trovare elementi anche se nascosti, quindi non è un errore critico, ma è meglio fare setup dopo che il viewer è visibile.

## ✅ Checklist Fix

- [ ] Fix problema 1: Sostituire `renderViewerTableMobile` con `renderInventoryList` in `applyViewerFiltersMobile()`
- [ ] Fix problema 2: Riorganizzare ordine operazioni in `openInventoryViewerMobile()`
- [ ] Fix problema 3: Rimuovere o aggiornare `applyViewerFiltersMobile()` se non più necessaria
- [ ] Test: Verificare che il tasto inventario apra correttamente la schermata lista
- [ ] Test: Verificare che ricerca e filtri funzionino


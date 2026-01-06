/**
 * InventoryMobile - Gestione inventario mobile
 * 
 * Gestisce tutte le funzionalità dell'inventario mobile:
 * - Caricamento lista vini
 * - Visualizzazione dettagli vino
 * - Modifica e salvataggio vino
 * - Navigazione tra schermate
 */

let currentWineId = null;
let originalWineData = null;

/**
 * Inizializza l'inventario mobile
 */
function initInventoryMobile() {
    // Verifica che siamo nel namespace mobile
    if (!window.LayoutBoundary?.isMobileNamespace()) {
        console.warn('[InventoryMobile] Namespace non mobile, skip inizializzazione');
        return;
    }
    
    console.log('[InventoryMobile] === INIZIALIZZAZIONE INVENTARIO MOBILE ===');
    
    // Setup event listeners
    // Nota: setupInventoryButtons() viene chiamato per primo per assicurarsi che il bottone indietro funzioni
    setupInventoryButtons();
    setupWineListClickHandlers();
    setupSaveButton();
    setupSearchAndFilters();
    
    // Carica inventario iniziale
    loadInventory();
    
    // Riprova a setup il bottone più volte per gestire timing issues
    setTimeout(() => {
        console.log('[InventoryMobile] Retry 1: setup bottone dopo 200ms');
        setupInventoryButtons();
    }, 200);
    
    setTimeout(() => {
        console.log('[InventoryMobile] Retry 2: setup bottone dopo 500ms');
        setupInventoryButtons();
    }, 500);
    
    setTimeout(() => {
        console.log('[InventoryMobile] Retry 3: setup bottone dopo 1000ms');
        setupInventoryButtons();
    }, 1000);
    
    // Observer per quando l'header diventa visibile
    const observer = new MutationObserver(() => {
        const header = document.getElementById('inventory-header-mobile');
        const viewerPanel = document.getElementById('viewerPanel');
        if (header && viewerPanel && !viewerPanel.hidden) {
            console.log('[InventoryMobile] Observer: Header visibile, setup bottone');
            setupInventoryButtons();
        }
    });
    
    // Osserva il viewerPanel per cambiamenti di visibilità
    const viewerPanel = document.getElementById('viewerPanel');
    if (viewerPanel) {
        observer.observe(viewerPanel, {
            attributes: true,
            attributeFilter: ['hidden']
        });
    }
    
    console.log('[InventoryMobile] Inizializzato');
}

/**
 * Setup bottoni inventario
 * Crea il bottone indietro da zero con stile tondo
 */
function setupInventoryButtons() {
    console.log('[InventoryMobile] === CREAZIONE BOTTONE INDIETRO DA ZERO ===');
    
    // Verifica che il viewerPanel sia visibile
    const viewerPanel = document.getElementById('viewerPanel');
    if (!viewerPanel || viewerPanel.hidden) {
        console.warn('[InventoryMobile] ViewerPanel non visibile, aspetto...');
        setTimeout(() => setupInventoryButtons(), 100);
        return false;
    }
    
    // Trova l'header
    const header = document.getElementById('inventory-header-mobile');
    if (!header) {
        console.warn('[InventoryMobile] Header inventario non trovato, riprovo...');
        setTimeout(() => setupInventoryButtons(), 100);
        return false;
    }
    
    // Verifica che l'header sia visibile
    const headerStyle = window.getComputedStyle(header);
    if (headerStyle.display === 'none' || headerStyle.visibility === 'hidden') {
        console.warn('[InventoryMobile] Header non visibile, aspetto...');
        setTimeout(() => setupInventoryButtons(), 100);
        return false;
    }
    
    // Rimuovi bottone esistente se presente
    const existingBtn = document.getElementById('inventory-back-btn-mobile');
    if (existingBtn) {
        console.log('[InventoryMobile] Rimuovo bottone esistente');
        existingBtn.remove();
    }
    
    // Crea nuovo bottone da zero
    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.id = 'inventory-back-btn-mobile';
    backBtn.className = 'inventory-back-btn-mobile';
    backBtn.title = 'Indietro';
    backBtn.setAttribute('aria-label', 'Torna indietro');
    
    // Stili inline per garantire visibilità e posizionamento
    backBtn.style.cssText = `
        width: clamp(40px, 10vw, 50px) !important;
        height: clamp(40px, 10vw, 50px) !important;
        min-width: clamp(40px, 10vw, 50px) !important;
        min-height: clamp(40px, 10vw, 50px) !important;
        padding: 0 !important;
        margin: 0 !important;
        background-color: var(--color-granaccia) !important;
        color: white !important;
        border: none !important;
        border-radius: 50% !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        cursor: pointer !important;
        pointer-events: auto !important;
        position: relative !important;
        z-index: 1001 !important;
        flex-shrink: 0 !important;
        visibility: visible !important;
        opacity: 1 !important;
    `;
    
    // Icona freccia indietro
    backBtn.textContent = '←';
    backBtn.style.fontSize = 'clamp(18px, 4.5vw, 24px)';
    backBtn.style.lineHeight = '1';
    
    // Aggiungi listener per click
    backBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        console.log('[InventoryMobile] ✅ Bottone indietro cliccato!');
        handleBackClick();
    }, { capture: true });
    
    // Aggiungi listener per touchstart (mobile)
    backBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        console.log('[InventoryMobile] ✅ Bottone indietro toccato (touchstart)!');
        handleBackClick();
    }, { capture: true, passive: false });
    
    // Aggiungi listener per touchend (backup)
    backBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        e.stopPropagation();
    }, { capture: true, passive: false });
    
    // Aggiungi bottone all'header (alla fine, così appare a destra)
    header.appendChild(backBtn);
    
    // Forza il layout per assicurarsi che il bottone sia visibile
    backBtn.offsetHeight; // Trigger reflow
    
    // Verifica che il bottone sia visibile
    const rect = backBtn.getBoundingClientRect();
    const isVisible = rect.width > 0 && rect.height > 0 && 
                      window.getComputedStyle(backBtn).display !== 'none' &&
                      window.getComputedStyle(backBtn).visibility !== 'hidden' &&
                      window.getComputedStyle(backBtn).opacity !== '0';
    
    console.log('[InventoryMobile] ✅ Bottone indietro creato e aggiunto con successo');
    console.log('[InventoryMobile] Bottone posizione:', rect);
    console.log('[InventoryMobile] Bottone visibile:', isVisible);
    console.log('[InventoryMobile] Bottone display:', window.getComputedStyle(backBtn).display);
    console.log('[InventoryMobile] Bottone visibility:', window.getComputedStyle(backBtn).visibility);
    console.log('[InventoryMobile] Bottone opacity:', window.getComputedStyle(backBtn).opacity);
    console.log('[InventoryMobile] Bottone pointer-events:', window.getComputedStyle(backBtn).pointerEvents);
    
    if (!isVisible) {
        console.error('[InventoryMobile] ⚠️ ATTENZIONE: Bottone creato ma non visibile!');
    }
    
    return true;
}

/**
 * Setup click handlers per lista vini
 */
function setupWineListClickHandlers() {
    const wineList = document.getElementById('inventory-wine-list-mobile');
    if (!wineList) return;
    
    // Event delegation per elementi dinamici
    wineList.addEventListener('click', (e) => {
        const wineItem = e.target.closest('[data-wine-id]');
        if (wineItem) {
            // Estrai l'ID dall'attributo data-wine-id
            let wineIdAttr = wineItem.getAttribute('data-wine-id');
            
            // Se getAttribute fallisce o restituisce qualcosa di strano, prova con dataset
            if (!wineIdAttr || wineIdAttr === 'null' || wineIdAttr === 'undefined') {
                if (wineItem.dataset?.wineId !== undefined) {
                    const datasetValue = wineItem.dataset.wineId;
                    // Se dataset restituisce un oggetto, estrai l'ID dall'oggetto
                    if (typeof datasetValue === 'object' && datasetValue !== null) {
                        // Se l'oggetto ha una proprietà 'id', usala
                        if ('id' in datasetValue && datasetValue.id !== undefined && datasetValue.id !== null) {
                            wineIdAttr = String(datasetValue.id);
                        } else {
                            console.error('[InventoryMobile] dataset.wineId è un oggetto senza proprietà id:', datasetValue);
                            showErrorPopup('Errore', 'ID vino non valido: oggetto senza proprietà id');
                            return;
                        }
                    } else {
                        wineIdAttr = String(datasetValue);
                    }
                }
            }
            
            if (!wineIdAttr || wineIdAttr === 'null' || wineIdAttr === 'undefined') {
                console.error('[InventoryMobile] ID vino non trovato nell\'elemento cliccato');
                showErrorPopup('Errore', 'ID vino non trovato nell\'elemento cliccato');
                return;
            }
            
            // Converti a numero intero
            const cleanedAttr = String(wineIdAttr).trim().replace(/[^\d-]/g, '');
            const wineId = parseInt(cleanedAttr, 10);
            
            // Validazione
            if (isNaN(wineId) || wineId <= 0 || !Number.isInteger(wineId)) {
                console.error('[InventoryMobile] ID vino non valido dopo conversione:', wineIdAttr, '->', wineId);
                showErrorPopup('Errore', `ID vino non valido: ${wineIdAttr}`);
                return;
            }
            
            showWineDetails(wineId);
        }
    });
}

/**
 * Setup bottone salva modifiche
 */
function setupSaveButton() {
    const saveBtn = document.getElementById('inventory-save-btn-mobile');
    if (!saveBtn) return;
    
    saveBtn.addEventListener('click', handleSaveClick);
}

/**
 * Setup search e filtri
 */
function setupSearchAndFilters() {
    // Search input
    const searchInput = document.getElementById('inventory-search-input-mobile');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            filterWineList(e.target.value);
        });
    }
    
    // Filters dropdown
    const filtersBtn = document.getElementById('inventory-filters-dropdown-btn');
    const filtersMenu = document.getElementById('inventory-filters-dropdown-menu');
    if (filtersBtn && filtersMenu) {
        filtersBtn.addEventListener('click', () => {
            filtersMenu.classList.toggle('hidden');
        });
    }
    
    // Reset filters
    const resetFiltersBtn = document.getElementById('inventory-filter-reset-btn-mobile');
    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', () => {
            resetFilters();
        });
    }
}

/**
 * Carica lista inventario
 */
async function loadInventory() {
    const wineList = document.getElementById('inventory-wine-list-mobile');
    if (!wineList) return;
    
    wineList.innerHTML = '<div class="inventory-loading">Caricamento inventario...</div>';
    
    try {
        const authToken = getAuthToken();
        if (!authToken) {
            // Mostra popup errore invece di solo throw
            showErrorPopup('Errore autenticazione', 'Token di autenticazione non disponibile. Effettua il login.');
            throw new Error('Token di autenticazione non disponibile');
        }
        
        // Usa endpoint snapshot per lista vini
        const response = await fetch(`${window.API_BASE_URL || ''}/api/viewer/snapshot`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`Errore caricamento inventario: ${response.status}`);
        }
        
        const data = await response.json();
        // L'API restituisce 'rows' non 'wines'
        const wines = data.wines || data.rows || [];
        console.log('[InventoryMobile] Vini caricati:', wines.length, wines);
        renderWineList(wines);
        
    } catch (error) {
        console.error('[InventoryMobile] Errore caricamento inventario:', error);
        wineList.innerHTML = '<div class="inventory-loading">Errore caricamento inventario</div>';
    }
}

/**
 * Renderizza lista vini
 */
function renderWineList(wines) {
    const wineList = document.getElementById('inventory-wine-list-mobile');
    if (!wineList) return;
    
    if (wines.length === 0) {
        wineList.innerHTML = '<div class="inventory-loading">Nessun vino trovato</div>';
        return;
    }
    
    wineList.innerHTML = wines.map(wine => {
        // Estrai l'ID - gestisci il caso in cui è un oggetto
        let wineId = wine.id || wine.wine_id || wine.wineId;
        
        // Se l'ID è un oggetto, estrai la proprietà id
        if (typeof wineId === 'object' && wineId !== null) {
            if ('id' in wineId && wineId.id !== undefined && wineId.id !== null) {
                wineId = wineId.id;
            } else {
                console.warn('[InventoryMobile] wine.id è un oggetto senza proprietà id:', wineId);
                return '';
            }
        }
        
        // Converti a numero intero se necessario
        if (typeof wineId !== 'number') {
            const parsedId = parseInt(String(wineId).trim().replace(/[^\d-]/g, ''), 10);
            if (isNaN(parsedId) || parsedId <= 0 || !Number.isInteger(parsedId)) {
                console.warn('[InventoryMobile] ID vino non valido:', wineId);
                return '';
            }
            wineId = parsedId;
        }
        
        // Validazione finale: deve essere un numero intero positivo
        if (!Number.isInteger(wineId) || wineId <= 0) {
            console.warn('[InventoryMobile] ID vino finale non valido:', wineId);
            return '';
        }
        
        const name = wine.name || '-';
        // L'API potrebbe restituire 'winery' invece di 'producer'
        const producer = wine.producer || wine.winery || '-';
        const vintage = wine.vintage || '-';
        // L'API potrebbe restituire 'qty' invece di 'quantity'
        const quantity = wine.quantity || wine.qty || 0;
        
        return `
            <button type="button" class="inventory-wine-item-btn" data-wine-id="${wineId}">
                <div class="inventory-wine-item-name">${escapeHtml(name)}</div>
                <div class="inventory-wine-item-details">
                    ${escapeHtml(producer)} • ${vintage} • ${quantity} bottiglie
                </div>
            </button>
        `;
    }).filter(html => html !== '').join('');
}

/**
 * Mostra dettagli vino
 */
async function showWineDetails(wineId) {
    // Validazione: assicurati che wineId sia un numero intero valido
    if (wineId === null || wineId === undefined) {
        console.error('[InventoryMobile] wineId è null o undefined');
        showErrorPopup('Errore', 'ID vino non valido: valore nullo o indefinito');
        return;
    }
    
    // Se wineId è un oggetto, estrai la proprietà id
    if (typeof wineId === 'object' && wineId !== null) {
        if ('id' in wineId && wineId.id !== undefined && wineId.id !== null) {
            wineId = wineId.id;
        } else {
            console.error('[InventoryMobile] wineId è un oggetto senza proprietà id:', wineId);
            showErrorPopup('Errore', 'ID vino non valido: ricevuto oggetto invece di numero');
            return;
        }
    }
    
    // Converti a numero intero se necessario
    let wineIdNum;
    if (typeof wineId === 'string') {
        const cleaned = wineId.trim().replace(/[^\d-]/g, '');
        wineIdNum = parseInt(cleaned, 10);
    } else if (typeof wineId === 'number') {
        wineIdNum = Number.isInteger(wineId) ? wineId : Math.floor(wineId);
    } else {
        const str = String(wineId).trim().replace(/[^\d-]/g, '');
        wineIdNum = parseInt(str, 10);
    }
    
    // Validazione rigorosa
    if (isNaN(wineIdNum) || !Number.isFinite(wineIdNum) || wineIdNum <= 0 || !Number.isInteger(wineIdNum)) {
        console.error('[InventoryMobile] wineId non valido dopo conversione:', wineId, '->', wineIdNum);
        showErrorPopup('Errore', `ID vino non valido: ${wineId}`);
        return;
    }
    
    // Forza a numero primitivo
    const finalWineId = Number(wineIdNum);
    
    currentWineId = finalWineId;
    
    // Mostra schermata dettagli
    showInventoryScreen('details');
    
    // Mostra loading
    const form = document.getElementById('inventory-wine-form-mobile');
    if (form) {
        form.innerHTML = '<div class="inventory-loading">Caricamento dettagli vino...</div>';
    }
    
    // Carica dati vino completi
    try {
        const authToken = getAuthToken();
        if (!authToken) {
            // Mostra popup errore invece di solo throw
            showErrorPopup('Errore autenticazione', 'Token di autenticazione non disponibile. Effettua il login.');
            throw new Error('Token di autenticazione non disponibile');
        }
        
        console.log('[InventoryMobile] Caricamento dettagli vino:', finalWineId);
        const url = `${window.API_BASE_URL || ''}/api/wines/${finalWineId}`;
        console.log('[InventoryMobile] URL:', url);
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        console.log('[InventoryMobile] Response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('[InventoryMobile] Errore risposta:', errorText);
            throw new Error(`Errore caricamento vino: ${response.status} - ${errorText}`);
        }
        
        const wineData = await response.json();
        console.log('[InventoryMobile] Dati vino ricevuti:', wineData);
        
        if (!wineData || !wineData.id) {
            throw new Error('Dati vino non validi nella risposta');
        }
        
        originalWineData = { ...wineData };
        
        populateWineForm(wineData);
        updateWineBanner(wineData);
        // Usa finalWineId invece di wineId per evitare problemi
        loadMovements(finalWineId);
        
    } catch (error) {
        console.error('[InventoryMobile] Errore caricamento dettagli vino:', error);
        const form = document.getElementById('inventory-wine-form-mobile');
        if (form) {
            form.innerHTML = `<div class="inventory-loading" style="color: red;">Errore: ${error.message}</div>`;
        }
        // Mostra popup errore invece di alert
        showErrorPopup('Errore caricamento dettagli vino', error.message);
    }
}

/**
 * Popola form vino con tutti i campi
 */
function populateWineForm(wineData) {
    const form = document.getElementById('inventory-wine-form-mobile');
    if (!form) return;
    
    // Campi da mostrare nel form
    const fields = [
        { key: 'producer', label: 'Produttore', type: 'text' },
        { key: 'vintage', label: 'Annata', type: 'number' },
        { key: 'quantity', label: 'Quantità', type: 'number' },
        { key: 'selling_price', label: 'Prezzo di vendita', type: 'number', step: '0.01' },
        { key: 'cost_price', label: 'Prezzo di acquisto', type: 'number', step: '0.01' },
        { key: 'region', label: 'Regione', type: 'text' },
        { key: 'country', label: 'Paese', type: 'text' },
        { key: 'wine_type', label: 'Tipologia', type: 'text' },
        { key: 'supplier', label: 'Fornitore', type: 'text' },
        { key: 'grape_variety', label: 'Vitigno', type: 'text' },
        { key: 'classification', label: 'Classificazione', type: 'text' },
        { key: 'alcohol_content', label: 'Gradazione alcolica', type: 'number', step: '0.1' },
        { key: 'description', label: 'Descrizione', type: 'textarea' },
        { key: 'notes', label: 'Note', type: 'textarea' }
    ];
    
    form.innerHTML = fields.map(field => {
        const value = wineData[field.key] || '';
        const inputId = `inventory-field-${field.key}-mobile`;
        
        if (field.type === 'textarea') {
            return `
                <div class="inventory-form-field-mobile">
                    <label class="inventory-form-label-mobile" for="${inputId}">${field.label}</label>
                    <textarea 
                        class="inventory-form-input-mobile" 
                        id="${inputId}" 
                        name="${field.key}"
                        data-field="${field.key}"
                        rows="3"
                    >${escapeHtml(value)}</textarea>
                </div>
            `;
        } else {
            return `
                <div class="inventory-form-field-mobile">
                    <label class="inventory-form-label-mobile" for="${inputId}">${field.label}</label>
                    <input 
                        type="${field.type}" 
                        class="inventory-form-input-mobile" 
                        id="${inputId}" 
                        name="${field.key}"
                        data-field="${field.key}"
                        value="${escapeHtml(value)}"
                        ${field.step ? `step="${field.step}"` : ''}
                    />
                </div>
            `;
        }
    }).join('');
    
    // Aggiorna quantità visualizzata
    updateQuantityDisplay(wineData.quantity || 0);
}

/**
 * Aggiorna banner vino
 */
function updateWineBanner(wineData) {
    const banner = document.getElementById('inventory-wine-name-banner-mobile');
    if (banner) {
        banner.textContent = wineData.name || 'Nome Vino';
    }
}

/**
 * Aggiorna display quantità
 */
function updateQuantityDisplay(quantity) {
    const quantityValue = document.getElementById('inventory-quantity-value-mobile');
    if (quantityValue) {
        quantityValue.textContent = `${quantity} bottiglie`;
    }
}

/**
 * Carica movimenti vino
 */
async function loadMovements(wineId) {
    const movementsLog = document.getElementById('inventory-movements-log-mobile');
    if (!movementsLog) return;
    
    movementsLog.innerHTML = '<div class="inventory-loading">Caricamento movimenti...</div>';
    
    // TODO: Implementare caricamento movimenti
    // Per ora mostra messaggio placeholder
    movementsLog.innerHTML = '<div class="inventory-loading">Nessun movimento disponibile</div>';
}

/**
 * Gestisce click salva modifiche
 */
async function handleSaveClick() {
    if (!currentWineId) {
        showErrorPopup('Errore', 'Nessun vino selezionato');
        return;
    }
    
    const form = document.getElementById('inventory-wine-form-mobile');
    if (!form) return;
    
    // Raccogli dati form
    const formData = new FormData(form);
    const updateData = {};
    
    // Mappa nomi campo frontend -> backend
    const fieldMapping = {
        'producer': 'producer',
        'vintage': 'vintage',
        'quantity': 'quantity',
        'selling_price': 'selling_price',
        'cost_price': 'cost_price',
        'region': 'region',
        'country': 'country',
        'wine_type': 'wine_type',
        'supplier': 'supplier',
        'grape_variety': 'grape_variety',
        'classification': 'classification',
        'alcohol_content': 'alcohol_content',
        'description': 'description',
        'notes': 'notes'
    };
    
    // Raccogli solo campi modificati
    for (const [frontendKey, backendKey] of Object.entries(fieldMapping)) {
        const input = form.querySelector(`[name="${frontendKey}"]`);
        if (!input) continue;
        
        const currentValue = input.value.trim();
        const originalValue = originalWineData?.[backendKey] || '';
        
        // Confronta valori (gestisce anche null/undefined)
        if (currentValue !== String(originalValue || '')) {
            // Converti tipo se necessario
            if (backendKey === 'vintage' || backendKey === 'quantity') {
                updateData[backendKey] = currentValue ? parseInt(currentValue) : null;
            } else if (backendKey === 'selling_price' || backendKey === 'cost_price' || backendKey === 'alcohol_content') {
                updateData[backendKey] = currentValue ? parseFloat(currentValue) : null;
            } else {
                updateData[backendKey] = currentValue || null;
            }
        }
    }
    
    // Se nessuna modifica, esci
    if (Object.keys(updateData).length === 0) {
        showSuccessPopup('Nessuna modifica', 'Non ci sono modifiche da salvare');
        return;
    }
    
    // Salva modifiche
    try {
        const authToken = getAuthToken();
        if (!authToken) {
            // Mostra popup errore invece di solo throw
            showErrorPopup('Errore autenticazione', 'Token di autenticazione non disponibile. Effettua il login.');
            throw new Error('Token di autenticazione non disponibile');
        }
        
        const response = await fetch(`${window.API_BASE_URL || ''}/api/wines/${currentWineId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(updateData)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Errore salvataggio: ${response.status}`);
        }
        
        const result = await response.json();
        
        // Aggiorna dati originali
        originalWineData = { ...originalWineData, ...updateData };
        
        // Mostra messaggio successo
        showSuccessPopup('Modifiche salvate', 'Le modifiche sono state salvate con successo');
        
        // Ricarica dati vino per aggiornare display
        await showWineDetails(currentWineId);
        
    } catch (error) {
        console.error('[InventoryMobile] Errore salvataggio:', error);
        showErrorPopup('Errore salvataggio', `Errore durante il salvataggio: ${error.message}`);
    }
}

/**
 * Mostra schermata inventario specifica
 */
function showInventoryScreen(screen) {
    const screens = ['list', 'details', 'chart'];
    
    screens.forEach(s => {
        const screenEl = document.getElementById(`inventory-screen-${s}`);
        if (screenEl) {
            if (s === screen) {
                screenEl.classList.remove('hidden');
            } else {
                screenEl.classList.add('hidden');
            }
        }
    });
}

/**
 * Gestisce click indietro
 */
function handleBackClick() {
    const detailsScreen = document.getElementById('inventory-screen-details');
    const chartScreen = document.getElementById('inventory-screen-chart');
    
    // Se siamo in dettagli o chart, torna alla lista
    if (detailsScreen && !detailsScreen.classList.contains('hidden')) {
        showInventoryScreen('list');
        currentWineId = null;
        originalWineData = null;
    } else if (chartScreen && !chartScreen.classList.contains('hidden')) {
        showInventoryScreen('details');
    } else {
        // Se siamo in lista, chiudi inventario
        const viewerPanel = document.getElementById('viewerPanel');
        const mobileLayout = document.getElementById('mobile-layout');
        
        if (viewerPanel) viewerPanel.hidden = true;
        if (mobileLayout) {
            mobileLayout.classList.remove('state-viewer');
            mobileLayout.classList.add('state-chat');
        }
    }
}

/**
 * Filtra lista vini
 */
function filterWineList(searchTerm) {
    // TODO: Implementare filtro ricerca
    console.log('[InventoryMobile] Filtro ricerca:', searchTerm);
}

/**
 * Reset filtri
 */
function resetFilters() {
    const searchInput = document.getElementById('inventory-search-input-mobile');
    if (searchInput) searchInput.value = '';
    
    // Reset altri filtri
    // TODO: Implementare reset completo filtri
    
    loadInventory();
}

/**
 * Utility: Ottiene token autenticazione
 * Cerca in tutte le possibili chiavi utilizzate dall'app
 */
function getAuthToken() {
    // Prova variabile globale se esiste (usata da chatAPI.js)
    if (typeof window !== 'undefined' && window.authToken) {
        return window.authToken;
    }
    
    // Prova tutte le possibili chiavi in ordine di priorità
    const token = localStorage.getItem('authToken') || 
                  localStorage.getItem('auth_token') ||
                  sessionStorage.getItem('authToken') ||
                  sessionStorage.getItem('auth_token') ||
                  null;
    
    // Debug: se non trovato, mostra popup con info disponibili
    if (!token && typeof window !== 'undefined') {
        const availableKeys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.toLowerCase().includes('auth') || key.toLowerCase().includes('token'))) {
                availableKeys.push(key);
            }
        }
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key && (key.toLowerCase().includes('auth') || key.toLowerCase().includes('token'))) {
                availableKeys.push(key);
            }
        }
        
        if (availableKeys.length > 0) {
            console.warn('[InventoryMobile] Token non trovato. Chiavi disponibili:', availableKeys);
        }
    }
    
    return token;
}

/**
 * Utility: Mostra popup errore mobile-friendly
 */
function showErrorPopup(title, message) {
    // Crea popup overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
    `;
    
    // Crea popup content
    const popup = document.createElement('div');
    popup.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 24px;
        max-width: 90%;
        max-height: 80%;
        overflow-y: auto;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    `;
    
    popup.innerHTML = `
        <div style="margin-bottom: 16px;">
            <h3 style="margin: 0 0 8px 0; color: #dc2626; font-size: 18px; font-weight: 600;">${escapeHtml(title)}</h3>
            <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.5;">${escapeHtml(message)}</p>
        </div>
        <button type="button" style="
            width: 100%;
            padding: 12px;
            background: #dc2626;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
        ">Chiudi</button>
    `;
    
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
    
    // Chiudi al click sul bottone o sull'overlay
    const closeBtn = popup.querySelector('button');
    const closePopup = () => {
        document.body.removeChild(overlay);
    };
    
    closeBtn.addEventListener('click', closePopup);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closePopup();
        }
    });
}

/**
 * Utility: Mostra popup successo mobile-friendly
 */
function showSuccessPopup(title, message) {
    // Crea popup overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
    `;
    
    // Crea popup content
    const popup = document.createElement('div');
    popup.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 24px;
        max-width: 90%;
        max-height: 80%;
        overflow-y: auto;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    `;
    
    popup.innerHTML = `
        <div style="margin-bottom: 16px;">
            <h3 style="margin: 0 0 8px 0; color: #16a34a; font-size: 18px; font-weight: 600;">${escapeHtml(title)}</h3>
            <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.5;">${escapeHtml(message)}</p>
        </div>
        <button type="button" style="
            width: 100%;
            padding: 12px;
            background: #16a34a;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
        ">OK</button>
    `;
    
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
    
    // Chiudi al click sul bottone o sull'overlay
    const closeBtn = popup.querySelector('button');
    const closePopup = () => {
        document.body.removeChild(overlay);
    };
    
    closeBtn.addEventListener('click', closePopup);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closePopup();
        }
    });
}

/**
 * Utility: Escape HTML
 */
function escapeHtml(text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

// Export per uso globale
if (typeof window !== 'undefined') {
    window.InventoryMobile = {
        init: initInventoryMobile,
        handleBackClick: handleBackClick,
        loadInventory: loadInventory,
        showWineDetails: showWineDetails,
        setupInventoryButtons: setupInventoryButtons
    };
}


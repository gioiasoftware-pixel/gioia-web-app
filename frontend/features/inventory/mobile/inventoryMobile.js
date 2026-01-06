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

// Flag per evitare setup multipli del bottone indietro
let backButtonInitialized = false;
let backButtonListeners = null;

// Flag per evitare setup multipli del bottone salva
let saveButtonInitialized = false;
let saveButtonListener = null;


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
    setupWineListClickHandlers();
    setupSaveButton();
    setupSearchAndFilters();
    
    // Carica inventario iniziale
    loadInventory();
    
    // Observer per quando il viewerPanel diventa visibile
    const viewerPanel = document.getElementById('viewerPanel');
    if (viewerPanel) {
        // Setup immediato se già visibile
        if (!viewerPanel.hidden) {
            setupInventoryButtons();
        }
        
        // Observer per quando diventa visibile
        const observer = new MutationObserver(() => {
            if (!viewerPanel.hidden && !backButtonInitialized) {
                console.log('[InventoryMobile] ViewerPanel visibile, setup bottone');
                setupInventoryButtons();
            }
        });
        observer.observe(viewerPanel, {
            attributes: true,
            attributeFilter: ['hidden']
        });
    }
    
    console.log('[InventoryMobile] Inizializzazione completata');
}

/**
 * Setup bottoni inventario
 * Crea il bottone indietro da zero con stile tondo
 */
function setupInventoryButtons() {
    // GUARDIA: evita setup multipli
    if (backButtonInitialized) {
        console.log('[InventoryMobile] Bottone già inizializzato, skip');
        return true;
    }
    
    console.log('[InventoryMobile] === SETUP BOTTONE INDIETRO ===');
    
    // Verifica che viewerPanel sia visibile E che state-viewer sia attivo
    const viewerPanel = document.getElementById('viewerPanel');
    const mobileLayout = document.getElementById('mobile-layout');
    
    if (!viewerPanel || viewerPanel.hidden) {
        console.log('[InventoryMobile] ViewerPanel non visibile, skip setup');
        return false;
    }
    
    // Verifica che state-viewer sia attivo
    if (mobileLayout && !mobileLayout.classList.contains('state-viewer')) {
        console.log('[InventoryMobile] state-viewer non attivo, skip setup');
        return false;
    }
    
    // Verifica che il bottone STATICO esista (non crearlo, solo trovarlo)
    const backBtn = document.getElementById('inventory-back-btn-mobile');
    if (!backBtn) {
        console.error('[InventoryMobile] ❌ Bottone statico non trovato nel DOM!');
        console.error('[InventoryMobile] Verifica che esista in index.html con id="inventory-back-btn-mobile"');
        return false;
    }
    
    // Verifica che ci sia SOLO un bottone con quell'ID
    const allButtons = document.querySelectorAll('#inventory-back-btn-mobile');
    if (allButtons.length > 1) {
        console.error(`[InventoryMobile] ❌ TROVATI ${allButtons.length} BOTTONI CON LO STESSO ID!`);
        console.error('[InventoryMobile] Questo può causare problemi - getElementById ritorna solo il primo');
        // Continua comunque, ma logga il problema
    }
    
    console.log('[InventoryMobile] ✅ Bottone statico trovato nel DOM');
    
    // Rimuovi listener esistenti se presenti
    if (backButtonListeners && backButtonListeners.click) {
        backBtn.removeEventListener('click', backButtonListeners.click, true);
    }
    
    // Forza stili inline per garantire visibilità (con fix iOS Safari)
    backBtn.style.cssText = `
        width: 50px !important;
        height: 50px !important;
        min-width: 50px !important;
        min-height: 50px !important;
        padding: 0 !important;
        margin: 0 !important;
        background-color: #8B1538 !important;
        color: white !important;
        border: 2px solid #8B1538 !important;
        border-radius: 50% !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        cursor: pointer !important;
        pointer-events: auto !important;
        position: relative !important;
        z-index: 9999 !important;
        flex-shrink: 0 !important;
        visibility: visible !important;
        opacity: 1 !important;
        font-size: 24px !important;
        line-height: 1 !important;
        box-shadow: 0 4px 12px rgba(139, 21, 56, 0.4) !important;
        user-select: none !important;
        -webkit-user-select: none !important;
        -webkit-tap-highlight-color: rgba(139, 21, 56, 0.3) !important;
        touch-action: manipulation !important;
        -webkit-touch-callout: none !important;
    `;
    
    console.log('[InventoryMobile] ✅ Stili inline applicati');
    
    // Handler semplice
    const handler = (e) => {
        console.log('[InventoryMobile] 🎯 CLICK INTERCETTATO sul bottone statico!');
        e.preventDefault();
        e.stopPropagation();
        
        try {
            const backClickHandler = window.InventoryMobile?.handleBackClick || handleBackClick;
            if (typeof backClickHandler === 'function') {
                backClickHandler();
            } else {
                console.error('[InventoryMobile] handleBackClick non trovata!');
                window.location.reload();
            }
        } catch (err) {
            console.error('[InventoryMobile] ❌ ERRORE in handler:', err);
            window.location.reload();
        }
    };
    
    // UN SOLO LISTENER, SEMPLICE, con capture per intercettare prima di altri
    backBtn.addEventListener('click', handler, { capture: true });
    
    // Salva riferimento per rimozione futura
    backButtonListeners = {
        click: handler
    };
    
    backButtonInitialized = true;
    console.log('[InventoryMobile] ✅ Listener aggiunto al bottone statico');
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
 * BOTTONE STATICO IN HTML - solo attach handler, niente creazione dinamica
 */
function setupSaveButton() {
    // GUARDIA: evita setup multipli
    if (saveButtonInitialized) {
        console.log('[InventoryMobile] Bottone salva già inizializzato, skip');
        return true;
    }
    
    console.log('[InventoryMobile] === SETUP BOTTONE SALVA ===');
    
    // Verifica che viewerPanel sia visibile E che state-viewer sia attivo
    const viewerPanel = document.getElementById('viewerPanel');
    const mobileLayout = document.getElementById('mobile-layout');
    
    if (!viewerPanel || viewerPanel.hidden) {
        console.log('[InventoryMobile] ViewerPanel non visibile, skip setup salva');
        return false;
    }
    
    // Verifica che state-viewer sia attivo
    if (mobileLayout && !mobileLayout.classList.contains('state-viewer')) {
        console.log('[InventoryMobile] state-viewer non attivo, skip setup salva');
        return false;
    }
    
    // Verifica che il bottone STATICO esista (non crearlo, solo trovarlo)
    const saveBtn = document.getElementById('inventory-save-btn-mobile');
    if (!saveBtn) {
        console.log('[InventoryMobile] Bottone salva statico non trovato nel DOM');
        return false;
    }
    
    // Verifica che ci sia SOLO un bottone con quell'ID
    const allButtons = document.querySelectorAll('#inventory-save-btn-mobile');
    if (allButtons.length > 1) {
        console.error(`[InventoryMobile] ❌ TROVATI ${allButtons.length} BOTTONI SALVA CON LO STESSO ID!`);
    }
    
    console.log('[InventoryMobile] ✅ Bottone salva statico trovato nel DOM');
    
    // Rimuovi listener esistenti se presenti
    if (saveButtonListener) {
        saveBtn.removeEventListener('click', saveButtonListener, true);
    }
    
    // Forza stili inline per garantire visibilità (con fix iOS Safari)
    saveBtn.style.cssText = `
        width: 100% !important;
        padding: 14px 20px !important;
        margin: 16px 0 !important;
        background-color: #8B1538 !important;
        color: white !important;
        border: none !important;
        border-radius: 8px !important;
        font-size: 16px !important;
        font-weight: 600 !important;
        cursor: pointer !important;
        pointer-events: auto !important;
        position: relative !important;
        z-index: 9999 !important;
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        box-shadow: 0 2px 8px rgba(139, 21, 56, 0.3) !important;
        user-select: none !important;
        -webkit-user-select: none !important;
        -webkit-tap-highlight-color: rgba(139, 21, 56, 0.3) !important;
        touch-action: manipulation !important;
        -webkit-touch-callout: none !important;
        transition: all 0.2s ease !important;
    `;
    
    console.log('[InventoryMobile] ✅ Stili inline applicati al bottone salva');
    
    // Handler semplice
    const handler = (e) => {
        console.log('[InventoryMobile] 🎯 CLICK INTERCETTATO sul bottone salva!');
        e.preventDefault();
        e.stopPropagation();
        
        try {
            handleSaveClick();
        } catch (err) {
            console.error('[InventoryMobile] ❌ ERRORE in handler salva:', err);
            showErrorPopup('Errore', `Errore durante il salvataggio: ${err.message}`);
        }
    };
    
    // UN SOLO LISTENER, SEMPLICE, con capture per intercettare prima di altri
    saveBtn.addEventListener('click', handler, { capture: true });
    
    // Salva riferimento per rimozione futura
    saveButtonListener = handler;
    
    saveButtonInitialized = true;
    console.log('[InventoryMobile] ✅ Listener aggiunto al bottone salva statico');
    return true;
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
        
        // Setup bottone salva quando la schermata dettagli è pronta
        // Reset flag per permettere re-setup quando si apre un nuovo vino
        saveButtonInitialized = false;
        setTimeout(() => {
            setupSaveButton();
        }, 100);
        
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
    
    // STEP 1: Mostra popup con dati prima/dopo per validare funzionamento
    // NON salvare ancora, solo mostrare popup di anteprima
    showChangesPreviewPopup(updateData, originalWineData);
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
 * - Nella pagina "lista" (prima pagina inventario) → torna alla chat/homepage (refresh browser)
 * - Nella pagina dettagli vino → torna alla lista inventario
 */
function handleBackClick() {
    console.log('[InventoryMobile] handleBackClick chiamato');
    console.log('▶️ handleBackClick CHIAMATO', 'info');
    
    const listScreen = document.getElementById('inventory-screen-list');
    const detailsScreen = document.getElementById('inventory-screen-details');
    const chartScreen = document.getElementById('inventory-screen-chart');
    
    // Verifica quale schermata è attualmente visibile
    const isDetailsVisible = detailsScreen && !detailsScreen.classList.contains('hidden');
    const isChartVisible = chartScreen && !chartScreen.classList.contains('hidden');
    const isListVisible = listScreen && !listScreen.classList.contains('hidden');
    
    console.log('[InventoryMobile] Stato schermate - Lista:', isListVisible, 'Dettagli:', isDetailsVisible, 'Chart:', isChartVisible);
    console.log(`Stato: Lista=${isListVisible}, Dettagli=${isDetailsVisible}, Chart=${isChartVisible}`, 'info');
    
    // Se siamo nella pagina dettagli vino → torna alla lista inventario
    if (isDetailsVisible) {
        console.log('[InventoryMobile] Dalla pagina dettagli → torno alla lista inventario');
        console.log('📋 Dettagli → Lista inventario', 'info');
        showInventoryScreen('list');
        currentWineId = null;
        originalWineData = null;
        return;
    }
    
    // Se siamo nella pagina chart → torna ai dettagli
    if (isChartVisible) {
        console.log('[InventoryMobile] Dalla pagina chart → torno ai dettagli');
        console.log('📊 Chart → Dettagli', 'info');
        showInventoryScreen('details');
        return;
    }
    
    // Se siamo nella pagina lista → torna alla chat (SENZA RELOAD)
    if (isListVisible) {
        console.log('[InventoryMobile] Dalla pagina lista → torno alla chat');
        const viewerPanel = document.getElementById('viewerPanel');
        const mobileLayout = document.getElementById('mobile-layout');
        
        if (viewerPanel) viewerPanel.hidden = true;
        if (mobileLayout) {
            mobileLayout.classList.remove('state-viewer');
            mobileLayout.classList.add('state-chat');
        }
        
        // Reset flag per permettere re-inizializzazione quando si riapre
        backButtonInitialized = false;
        return;
    }
    
    // Fallback: chiudi inventario
    console.log('[InventoryMobile] Fallback: chiudo inventario');
    const viewerPanel = document.getElementById('viewerPanel');
    const mobileLayout = document.getElementById('mobile-layout');
    
    if (viewerPanel) viewerPanel.hidden = true;
    if (mobileLayout) {
        mobileLayout.classList.remove('state-viewer');
        mobileLayout.classList.add('state-chat');
    }
    
    backButtonInitialized = false;
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
/**
 * Mostra popup anteprima modifiche (prima/dopo)
 * STEP 1: Solo per validare funzionamento bottone salva
 */
function showChangesPreviewPopup(updateData, originalData) {
    // Mappa nomi campo per visualizzazione
    const fieldLabels = {
        'producer': 'Produttore',
        'vintage': 'Annata',
        'quantity': 'Quantità',
        'selling_price': 'Prezzo di vendita',
        'cost_price': 'Prezzo di acquisto',
        'region': 'Regione',
        'country': 'Paese',
        'wine_type': 'Tipologia',
        'supplier': 'Fornitore',
        'grape_variety': 'Vitigno',
        'classification': 'Classificazione',
        'alcohol_content': 'Gradazione alcolica',
        'description': 'Descrizione',
        'notes': 'Note'
    };
    
    // Formatta valore per visualizzazione
    const formatValue = (value, field) => {
        if (value === null || value === undefined || value === '') {
            return '<em>vuoto</em>';
        }
        if (field === 'selling_price' || field === 'cost_price') {
            return `€ ${parseFloat(value).toFixed(2)}`;
        }
        if (field === 'alcohol_content') {
            return `${parseFloat(value).toFixed(1)}%`;
        }
        return String(value);
    };
    
    // Crea lista modifiche
    const changesList = Object.entries(updateData).map(([field, newValue]) => {
        const label = fieldLabels[field] || field;
        const oldValue = originalData?.[field] || '';
        const oldFormatted = formatValue(oldValue, field);
        const newFormatted = formatValue(newValue, field);
        
        return `
            <div style="margin-bottom: 12px; padding: 12px; background: #f3f4f6; border-radius: 8px;">
                <div style="font-weight: 600; color: #374151; margin-bottom: 4px;">${escapeHtml(label)}</div>
                <div style="font-size: 13px; color: #6b7280;">
                    <div style="margin-bottom: 2px;">
                        <span style="color: #dc2626;">Prima:</span> ${oldFormatted}
                    </div>
                    <div>
                        <span style="color: #16a34a;">Dopo:</span> ${newFormatted}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
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
        <div style="margin-bottom: 20px;">
            <h3 style="margin: 0 0 12px 0; color: #1f2937; font-size: 20px; font-weight: 600;">
                Anteprima Modifiche
            </h3>
            <p style="margin: 0 0 16px 0; color: #6b7280; font-size: 14px; line-height: 1.5;">
                Dati che verranno modificati:
            </p>
            <div style="max-height: 300px; overflow-y: auto;">
                ${changesList}
            </div>
        </div>
        <div style="display: flex; gap: 12px;">
            <button type="button" id="preview-close-btn" style="
                flex: 1;
                padding: 12px;
                background: #e5e7eb;
                color: #374151;
                border: none;
                border-radius: 8px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
            ">Chiudi</button>
        </div>
    `;
    
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
    
    // Gestione click
    const closeBtn = popup.querySelector('#preview-close-btn');
    
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


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
    // setupSaveButton() RIMOSSO da qui - viene chiamato troppo presto quando il bottone è nascosto
    // Verrà chiamato quando si apre un vino (showWineDetails) e tramite MutationObserver
    setupSearchAndFilters();
    
    // Carica inventario iniziale
    loadInventory();
    
    // Observer per quando il viewerPanel diventa visibile
    const viewerPanel = document.getElementById('viewerPanel');
    if (viewerPanel) {
        // Setup immediato se già visibile
        if (!viewerPanel.hidden) {
            setupInventoryButtons();
            // Setup bottone salva se details screen è visibile
            setupSaveButtonIfVisible();
        }
        
        // Observer per quando diventa visibile
        const observer = new MutationObserver(() => {
            if (!viewerPanel.hidden) {
                if (!backButtonInitialized) {
                    console.log('[InventoryMobile] ViewerPanel visibile, setup bottone indietro');
                    setupInventoryButtons();
                }
                // Setup bottone salva se details screen è visibile
                setupSaveButtonIfVisible();
            }
        });
        observer.observe(viewerPanel, {
            attributes: true,
            attributeFilter: ['hidden']
        });
    }
    
    // Observer per quando inventory-screen-details diventa visibile
    const detailsScreen = document.getElementById('inventory-screen-details');
    if (detailsScreen) {
        const detailsObserver = new MutationObserver(() => {
            // Se details screen diventa visibile (rimossa classe hidden), setup bottone salva
            if (!detailsScreen.classList.contains('hidden') && !saveButtonInitialized) {
                console.log('[InventoryMobile] Details screen visibile, setup bottone salva');
                setupSaveButton();
            }
        });
        detailsObserver.observe(detailsScreen, {
            attributes: true,
            attributeFilter: ['class']
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
 * Verifica se il bottone salva può essere setup (helper)
 */
function setupSaveButtonIfVisible() {
    const detailsScreen = document.getElementById('inventory-screen-details');
    if (detailsScreen && !detailsScreen.classList.contains('hidden')) {
        setupSaveButton();
    }
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
    
    // Verifica che inventory-screen-details sia visibile (non hidden)
    const detailsScreen = document.getElementById('inventory-screen-details');
    if (!detailsScreen || detailsScreen.classList.contains('hidden')) {
        console.log('[InventoryMobile] Details screen nascosto, skip setup salva');
        return false;
    }
    
    // Verifica che il bottone STATICO esista (non crearlo, solo trovarlo)
    const saveBtn = document.getElementById('inventory-save-btn-mobile');
    if (!saveBtn) {
        console.log('[InventoryMobile] Bottone salva statico non trovato nel DOM');
        return false;
    }
    
    // Verifica che il bottone sia effettivamente visibile (non nascosto da CSS o parent)
    const computedStyle = window.getComputedStyle(saveBtn);
    if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden' || computedStyle.opacity === '0') {
        console.log('[InventoryMobile] Bottone salva non visibile (CSS), skip setup');
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
    
    // Handler semplice - STEP 2: Chiama handleSaveClick() e verifica che funzioni
    const handler = (e) => {
        try {
            handleSaveClick();
        } catch (err) {
            showErrorPopup('Errore', `Errore durante il salvataggio: ${err.message}`);
        }
    };
    
    // STEP 1: Listener semplice senza capture
    saveBtn.addEventListener('click', handler);
    
    // Salva riferimento per rimozione futura
    saveButtonListener = handler;
    
    // Verifica che il listener sia stato aggiunto
    console.log('[InventoryMobile] ✅ Listener aggiunto al bottone salva statico');
    console.log('[InventoryMobile] Bottone elemento:', saveBtn);
    console.log('[InventoryMobile] Bottone ID:', saveBtn.id);
    console.log('[InventoryMobile] Bottone visible:', window.getComputedStyle(saveBtn).visibility);
    console.log('[InventoryMobile] Bottone display:', window.getComputedStyle(saveBtn).display);
    
    saveButtonInitialized = true;
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
        console.log('[InventoryMobile] Supplier value:', wineData?.supplier);
        console.log('[InventoryMobile] Classification value:', wineData?.classification);
        console.log('[InventoryMobile] Description value:', wineData?.description);
        console.log('[InventoryMobile] Notes value:', wineData?.notes);
        
        if (!wineData || !wineData.id) {
            throw new Error('Dati vino non validi nella risposta');
        }
        
        // Salva dati originali (mantieni null se presente, non convertire in undefined)
        originalWineData = { ...wineData };
        
        populateWineForm(wineData);
        updateWineBanner(wineData);
        // Carica movimenti usando il nome del vino (l'API si aspetta wine_name, non wine_id)
        loadMovements(wineData.name);
        // Carica e renderizza grafico movimenti
        loadAndRenderMovementsChartMobile(wineData.name);
        
        // Setup bottone salva quando la schermata dettagli è pronta
        // Reset flag per permettere re-setup quando si apre un nuovo vino
        saveButtonInitialized = false;
        
        // Usa requestAnimationFrame per assicurarsi che il DOM sia aggiornato
        // Poi verifica che lo screen sia visibile prima di fare setup
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                // Doppio requestAnimationFrame per assicurarsi che le classi CSS siano applicate
                const detailsScreen = document.getElementById('inventory-screen-details');
                if (detailsScreen && !detailsScreen.classList.contains('hidden')) {
                    setupSaveButton();
                } else {
                    // Se ancora nascosto, riprova dopo un breve delay
                    setTimeout(() => {
                        setupSaveButton();
                    }, 50);
                }
            });
        });
        
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
        // Gestisci correttamente null/undefined per tutti i campi
        // DEBUG: verifica che il campo esista nei dati
        if (!(field.key in wineData)) {
            console.warn(`[InventoryMobile] Campo ${field.key} non trovato in wineData. Chiavi disponibili:`, Object.keys(wineData));
        }
        const rawValue = wineData[field.key];
        const value = (rawValue === null || rawValue === undefined) ? '' : String(rawValue);
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
/**
 * Carica e visualizza movimenti del vino
 * @param {string} wineName - Nome del vino (l'API si aspetta wine_name, non wine_id)
 */
async function loadMovements(wineName) {
    const movementsLog = document.getElementById('inventory-movements-log-mobile');
    if (!movementsLog) {
        console.warn('[InventoryMobile] Elemento movements-log non trovato');
        return;
    }
    
    movementsLog.innerHTML = '<div class="inventory-loading">Caricamento movimenti...</div>';
    
    try {
        if (!wineName) {
            console.warn('[InventoryMobile] Nome vino non disponibile per caricamento movimenti');
            movementsLog.innerHTML = '<div class="inventory-loading">Nome vino non disponibile</div>';
            return;
        }
        
        const authToken = getAuthToken();
        if (!authToken) {
            movementsLog.innerHTML = '<div class="inventory-loading">Errore autenticazione</div>';
            return;
        }
        
        // Chiama API movimenti (endpoint si aspetta wine_name, non wine_id)
        const response = await fetch(
            `${window.API_BASE_URL || ''}/api/viewer/movements?wine_name=${encodeURIComponent(wineName)}`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            }
        );
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('[InventoryMobile] Errore caricamento movimenti:', errorText);
            movementsLog.innerHTML = '<div class="inventory-loading">Errore caricamento movimenti</div>';
            return;
        }
        
        const data = await response.json();
        let movements = data.movements || [];
        
        if (movements.length === 0) {
            movementsLog.innerHTML = '<div class="inventory-loading">Nessun movimento disponibile</div>';
            return;
        }
        
        // Salva current_stock e opening_stock dalla risposta API
        window.currentWineStock = {
            current: data.current_stock || 0,
            opening: data.opening_stock || 0
        };
        
        // Ordina movimenti per data (più recenti prima) per la lista
        const movementsForList = [...movements].sort((a, b) => {
            const dateA = a.at ? new Date(a.at) : new Date(0);
            const dateB = b.at ? new Date(b.at) : new Date(0);
            return dateB - dateA; // Ordine decrescente (più recenti prima)
        });
        
        // Ordina movimenti per data (più vecchi prima) per il grafico
        movements.sort((a, b) => {
            const dateA = a.at ? new Date(a.at) : new Date(0);
            const dateB = b.at ? new Date(b.at) : new Date(0);
            return dateA - dateB; // Ordine crescente (più vecchi prima) per grafico
        });
        
        // Genera HTML movimenti (usa lista ordinata per display)
        movementsLog.innerHTML = movementsForList.map(movement => {
            const date = movement.at ? new Date(movement.at).toLocaleString('it-IT', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }) : 'Data non disponibile';
            
            const type = movement.type || 'unknown';
            const isConsumed = type === 'consumo';
            const isRifornimento = type === 'rifornimento';
            
            const quantityChange = movement.quantity_change || 0;
            const quantityBefore = movement.quantity_before || 0;
            const quantityAfter = movement.quantity_after || 0;
            
            const typeLabel = isConsumed ? 'Consumo' : isRifornimento ? 'Rifornimento' : 'Movimento';
            const quantityLabel = isConsumed 
                ? `-${Math.abs(quantityChange)}` 
                : `+${Math.abs(quantityChange)}`;
            
            return `
                <div class="inventory-movement-card-mobile ${isConsumed ? 'consumed' : isRifornimento ? 'refilled' : ''}">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span style="font-weight: 600; color: var(--color-dark-gray);">${escapeHtml(typeLabel)}</span>
                        <span style="font-weight: 700; color: ${isConsumed ? 'var(--color-granaccia)' : 'var(--color-green)'};">
                            ${quantityLabel}
                        </span>
                    </div>
                    <div style="font-size: 12px; color: var(--color-gray); margin-bottom: 4px;">
                        ${escapeHtml(date)}
                    </div>
                    <div style="font-size: 12px; color: var(--color-gray);">
                        Da: ${quantityBefore} → A: ${quantityAfter}
                    </div>
                </div>
            `;
        }).join('');
        
        console.log(`[InventoryMobile] ✅ Caricati ${movements.length} movimenti per vino: ${wineName}`);
        
        // Salva movimenti per il grafico
        window.currentWineMovements = movements;
        
    } catch (error) {
        console.error('[InventoryMobile] Errore caricamento movimenti:', error);
        movementsLog.innerHTML = '<div class="inventory-loading">Errore caricamento movimenti</div>';
    }
}

/**
 * Carica e renderizza grafico movimenti per mobile
 * @param {string} wineName - Nome del vino
 */
async function loadAndRenderMovementsChartMobile(wineName) {
    console.log('[InventoryMobile] Caricamento grafico movimenti per:', wineName);
    
    // Se i movimenti sono già stati caricati, usali
    let movements = window.currentWineMovements;
    
    if (!movements || movements.length === 0) {
        // Carica movimenti se non disponibili
        try {
            const authToken = getAuthToken();
            if (!authToken) {
                console.warn('[InventoryMobile] Token non disponibile per caricamento grafico');
                return;
            }
            
            const response = await fetch(
                `${window.API_BASE_URL || ''}/api/viewer/movements?wine_name=${encodeURIComponent(wineName)}`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${authToken}`
                    }
                }
            );
            
            if (!response.ok) {
                console.error('[InventoryMobile] Errore caricamento movimenti per grafico');
                return;
            }
            
            const data = await response.json();
            movements = data.movements || [];
            window.currentWineMovements = movements;
        } catch (error) {
            console.error('[InventoryMobile] Errore caricamento movimenti per grafico:', error);
            return;
        }
    }
    
    if (!movements || movements.length === 0) {
        console.log('[InventoryMobile] Nessun movimento disponibile per il grafico');
        const previewContainer = document.getElementById('inventory-graph-preview-mobile');
        if (previewContainer) {
            previewContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--color-gray);">Nessun movimento disponibile</div>';
        }
        return;
    }
    
    // Renderizza grafico preview
    renderMovementsChartPreview(movements);
    
    // Setup click handler per aprire grafico fullscreen
    setupChartFullscreenHandler(wineName);
}

/**
 * Renderizza grafico preview nella pagina dettagli
 * @param {Array} movements - Array di movimenti
 */
function renderMovementsChartPreview(movements) {
    const previewContainer = document.getElementById('inventory-graph-preview-mobile');
    if (!previewContainer) {
        console.warn('[InventoryMobile] Container grafico preview non trovato');
        return;
    }
    
    // Verifica che Chart.js sia disponibile
    if (typeof Chart === 'undefined') {
        console.error('[InventoryMobile] Chart.js non disponibile');
        previewContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--color-gray);">Grafico non disponibile</div>';
        return;
    }
    
    // Verifica che le funzioni del grafico siano disponibili
    if (typeof createAnchoredFlowStockChart === 'undefined') {
        console.error('[InventoryMobile] createAnchoredFlowStockChart non disponibile');
        previewContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--color-gray);">Grafico non disponibile</div>';
        return;
    }
    
    try {
        // Pulisci container
        previewContainer.innerHTML = '';
        
        // Passa movimenti raw come fa il desktop - createAnchoredFlowStockChart li convertirà internamente
        // I movimenti devono essere ordinati cronologicamente (più vecchi prima)
        const rawMovements = movements.map(m => ({
            type: m.type || 'unknown',
            quantity_change: m.quantity_change || 0,
            quantity: m.quantity || Math.abs(m.quantity_change || 0),
            quantity_before: m.quantity_before,
            quantity_after: m.quantity_after,
            date: m.at,
            at: m.at
        }));
        
        // Prepara dati come nel desktop (con current_stock e opening_stock)
        const movementsData = {
            movements: rawMovements,
            current_stock: window.currentWineStock?.current || (movements.length > 0 && movements[movements.length - 1].quantity_after !== undefined
                ? movements[movements.length - 1].quantity_after
                : 0),
            opening_stock: window.currentWineStock?.opening || (movements.length > 0 && movements[0].quantity_before !== undefined 
                ? movements[0].quantity_before 
                : 0)
        };
        
        // Crea grafico preview - passa movementsData come nel desktop
        const chart = createAnchoredFlowStockChart(previewContainer, movementsData, {
            now: new Date(),
            preset: 'week', // Preview mostra ultima settimana
            responsive: true,
            maintainAspectRatio: false
        });
        
        if (chart) {
            console.log('[InventoryMobile] ✅ Grafico preview renderizzato');
            // Salva riferimento al chart per cleanup futuro
            window.currentChartPreview = chart;
        }
    } catch (error) {
        console.error('[InventoryMobile] Errore rendering grafico preview:', error);
        previewContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--color-gray);">Errore caricamento grafico</div>';
    }
}

/**
 * Setup handler per aprire grafico fullscreen
 * @param {string} wineName - Nome del vino
 */
function setupChartFullscreenHandler(wineName) {
    const previewContainer = document.getElementById('inventory-graph-preview-mobile');
    if (!previewContainer) return;
    
    // Rimuovi listener esistenti
    previewContainer.removeEventListener('click', handleChartPreviewClick);
    
    // Aggiungi listener per click sul preview
    previewContainer.addEventListener('click', handleChartPreviewClick);
    
    // Salva wineName per uso nel handler
    previewContainer.dataset.wineName = wineName;
}

/**
 * Handler click sul grafico preview - apre fullscreen
 */
function handleChartPreviewClick(e) {
    const previewContainer = e.currentTarget;
    const wineName = previewContainer.dataset.wineName;
    
    if (!wineName) {
        console.warn('[InventoryMobile] Nome vino non disponibile per grafico fullscreen');
        return;
    }
    
    console.log('[InventoryMobile] Apertura grafico fullscreen per:', wineName);
    
    // Mostra schermata chart
    const chartScreen = document.getElementById('inventory-screen-chart');
    const detailsScreen = document.getElementById('inventory-screen-details');
    
    if (!chartScreen || !detailsScreen) {
        console.warn('[InventoryMobile] Schermate chart/dettagli non trovate');
        return;
    }
    
    // Nascondi dettagli, mostra chart
    detailsScreen.classList.add('hidden');
    chartScreen.classList.remove('hidden');
    
    // Aggiorna nome vino nel banner chart
    const chartBanner = document.getElementById('inventory-wine-name-chart-mobile');
    if (chartBanner) {
        chartBanner.textContent = wineName;
    }
    
    // Renderizza grafico fullscreen
    renderMovementsChartFullscreen(wineName);
    
    // Setup filtri periodo
    setupPeriodFilters(wineName);
}

/**
 * Renderizza grafico fullscreen
 * @param {string} wineName - Nome del vino
 */
function renderMovementsChartFullscreen(wineName) {
    const chartContainer = document.getElementById('inventory-chart-container-mobile');
    if (!chartContainer) {
        console.warn('[InventoryMobile] Container grafico fullscreen non trovato');
        return;
    }
    
    // Usa movimenti già caricati o carica di nuovo
    let movements = window.currentWineMovements;
    
    if (!movements || movements.length === 0) {
        console.warn('[InventoryMobile] Nessun movimento disponibile per grafico fullscreen');
        chartContainer.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--color-gray);">Nessun movimento disponibile</div>';
        return;
    }
    
    // Verifica Chart.js
    if (typeof Chart === 'undefined' || typeof createAnchoredFlowStockChart === 'undefined') {
        console.error('[InventoryMobile] Chart.js o createAnchoredFlowStockChart non disponibile');
        chartContainer.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--color-gray);">Grafico non disponibile</div>';
        return;
    }
    
    try {
        // Pulisci container
        chartContainer.innerHTML = '';
        
        // Passa movimenti raw come fa il desktop
        const rawMovements = movements.map(m => ({
            type: m.type || 'unknown',
            quantity_change: m.quantity_change || 0,
            quantity: m.quantity || Math.abs(m.quantity_change || 0),
            quantity_before: m.quantity_before,
            quantity_after: m.quantity_after,
            date: m.at,
            at: m.at
        }));
        
        // Prepara dati come nel desktop
        const movementsData = {
            movements: rawMovements,
            current_stock: window.currentWineStock?.current || (movements.length > 0 && movements[movements.length - 1].quantity_after !== undefined
                ? movements[movements.length - 1].quantity_after
                : 0),
            opening_stock: window.currentWineStock?.opening || (movements.length > 0 && movements[0].quantity_before !== undefined 
                ? movements[0].quantity_before 
                : 0)
        };
        
        // Crea grafico fullscreen - passa movementsData come nel desktop
        const chart = createAnchoredFlowStockChart(chartContainer, movementsData, {
            now: new Date(),
            preset: 'week',
            responsive: true,
            maintainAspectRatio: false
        });
        
        if (chart) {
            console.log('[InventoryMobile] ✅ Grafico fullscreen renderizzato');
            window.currentChartFullscreen = chart;
        }
    } catch (error) {
        console.error('[InventoryMobile] Errore rendering grafico fullscreen:', error);
        chartContainer.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--color-gray);">Errore caricamento grafico</div>';
    }
}

/**
 * Setup filtri periodo per grafico fullscreen
 * @param {string} wineName - Nome del vino
 */
function setupPeriodFilters(wineName) {
    const periodButtons = document.querySelectorAll('.inventory-period-btn');
    
    periodButtons.forEach(btn => {
        // Rimuovi listener esistenti
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        
        // Aggiungi listener
        newBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            
            // Rimuovi active da tutti i bottoni
            periodButtons.forEach(b => b.classList.remove('active'));
            
            // Aggiungi active al bottone cliccato
            newBtn.classList.add('active');
            
            const period = newBtn.dataset.period;
            console.log('[InventoryMobile] Cambio periodo grafico:', period);
            
            // Ricarica grafico con nuovo periodo
            await renderMovementsChartFullscreenWithPeriod(wineName, period);
        });
    });
}

/**
 * Renderizza grafico fullscreen con periodo specifico
 * @param {string} wineName - Nome del vino
 * @param {string} period - Periodo ('day', 'week', 'month', 'quarter', 'year')
 */
async function renderMovementsChartFullscreenWithPeriod(wineName, period) {
    const chartContainer = document.getElementById('inventory-chart-container-mobile');
    if (!chartContainer) return;
    
    // Distruggi chart esistente se presente
    if (window.currentChartFullscreen && typeof window.currentChartFullscreen.destroy === 'function') {
        window.currentChartFullscreen.destroy();
        window.currentChartFullscreen = null;
    }
    
    // Usa movimenti già caricati
    let movements = window.currentWineMovements;
    
    if (!movements || movements.length === 0) {
        chartContainer.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--color-gray);">Nessun movimento disponibile</div>';
        return;
    }
    
    // Verifica Chart.js
    if (typeof Chart === 'undefined' || typeof createAnchoredFlowStockChart === 'undefined') {
        chartContainer.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--color-gray);">Grafico non disponibile</div>';
        return;
    }
    
    try {
        chartContainer.innerHTML = '';
        
        // Passa movimenti raw come fa il desktop
        const rawMovements = movements.map(m => ({
            type: m.type || 'unknown',
            quantity_change: m.quantity_change || 0,
            quantity: m.quantity || Math.abs(m.quantity_change || 0),
            quantity_before: m.quantity_before,
            quantity_after: m.quantity_after,
            date: m.at,
            at: m.at
        }));
        
        // Prepara dati come nel desktop
        const movementsData = {
            movements: rawMovements,
            current_stock: window.currentWineStock?.current || (movements.length > 0 && movements[movements.length - 1].quantity_after !== undefined
                ? movements[movements.length - 1].quantity_after
                : 0),
            opening_stock: window.currentWineStock?.opening || (movements.length > 0 && movements[0].quantity_before !== undefined 
                ? movements[0].quantity_before 
                : 0)
        };
        
        // Crea grafico con periodo specificato - passa movementsData come nel desktop
        const chart = createAnchoredFlowStockChart(chartContainer, movementsData, {
            now: new Date(),
            preset: period,
            responsive: true,
            maintainAspectRatio: false
        });
        
        if (chart) {
            window.currentChartFullscreen = chart;
        }
    } catch (error) {
        console.error('[InventoryMobile] Errore rendering grafico con periodo:', error);
        chartContainer.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--color-gray);">Errore caricamento grafico</div>';
    }
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
    if (!form) {
        showErrorPopup('Errore', 'Form non trovato');
        return;
    }
    
    // Raccogli dati form
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
        const originalValue = originalWineData?.[backendKey];
        
        // Normalizza valori originali: null, undefined, '' → null
        const normalizedOriginal = (originalValue === null || originalValue === undefined || originalValue === '') 
            ? null 
            : String(originalValue).trim();
        
        // Normalizza valori correnti: '' → null, altrimenti mantieni valore
        const normalizedCurrent = currentValue === '' ? null : currentValue;
        
        // Confronta valori normalizzati
        // Se entrambi sono null → nessuna modifica
        // Se uno è null e l'altro no → modifica
        // Se entrambi hanno valore → confronta stringhe
        let hasChanged = false;
        
        if (normalizedCurrent === null && normalizedOriginal === null) {
            hasChanged = false; // Entrambi vuoti, nessuna modifica
        } else if (normalizedCurrent === null || normalizedOriginal === null) {
            hasChanged = true; // Uno vuoto e l'altro no, c'è modifica
        } else {
            // Entrambi hanno valore, confronta
            hasChanged = String(normalizedCurrent) !== String(normalizedOriginal);
        }
        
        if (hasChanged) {
            // Converti tipo se necessario
            if (backendKey === 'vintage' || backendKey === 'quantity') {
                // Per vintage e quantity: invia null se vuoto, altrimenti numero
                updateData[backendKey] = normalizedCurrent ? parseInt(normalizedCurrent) : null;
            } else if (backendKey === 'selling_price' || backendKey === 'cost_price') {
                // Per prezzi: invia null se vuoto, altrimenti float
                updateData[backendKey] = normalizedCurrent ? parseFloat(normalizedCurrent) : null;
            } else if (backendKey === 'alcohol_content') {
                // Per gradazione: backend si aspetta stringa, non float
                updateData[backendKey] = normalizedCurrent || null;
            } else {
                // Per stringhe (supplier, classification, description, notes, etc.):
                // Se vuoto → invia null, altrimenti stringa (non stringa vuota)
                // IMPORTANTE: per campi textarea e stringhe lunghe, mantieni il valore anche se contiene solo spazi
                if (normalizedCurrent === null) {
                    updateData[backendKey] = null;
                } else {
                    // Mantieni il valore come stringa (può contenere spazi per textarea)
                    updateData[backendKey] = String(normalizedCurrent);
                }
            }
        }
    }
    
    // Se nessuna modifica, esci
    if (Object.keys(updateData).length === 0) {
        showSuccessPopup('Nessuna modifica', 'Non ci sono modifiche da salvare');
        return;
    }
    
    // STEP 4: Mostra popup anteprima modifiche e salva se confermato
    const confirmed = await showConfirmSavePopup(updateData, originalWineData);
    if (!confirmed) {
        return; // Utente ha annullato
    }
    
    // Mostra loading sul bottone
    const saveBtn = document.getElementById('inventory-save-btn-mobile');
    const originalBtnText = saveBtn ? saveBtn.textContent : '';
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'SALVATAGGIO...';
        saveBtn.style.opacity = '0.6';
    }
    
    // Salva modifiche
    try {
        const authToken = getAuthToken();
        if (!authToken) {
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
            let errorMessage = `Errore salvataggio: ${response.status}`;
            try {
                const errorData = await response.json();
                // Gestisci diversi formati di errore
                if (errorData.detail) {
                    errorMessage = typeof errorData.detail === 'string' 
                        ? errorData.detail 
                        : JSON.stringify(errorData.detail);
                } else if (errorData.message) {
                    errorMessage = typeof errorData.message === 'string'
                        ? errorData.message
                        : JSON.stringify(errorData.message);
                } else if (errorData.error) {
                    errorMessage = typeof errorData.error === 'string'
                        ? errorData.error
                        : JSON.stringify(errorData.error);
                } else {
                    errorMessage = JSON.stringify(errorData);
                }
            } catch (e) {
                // Se non riesce a parsare JSON, usa il testo della risposta
                const errorText = await response.text().catch(() => 'Errore sconosciuto');
                errorMessage = errorText || `Errore salvataggio: ${response.status}`;
            }
            throw new Error(errorMessage);
        }
        
        const result = await response.json();
        
        // Aggiorna dati originali
        originalWineData = { ...originalWineData, ...updateData };
        
        // Se è stata modificata la quantità, ricarica i movimenti dopo un breve delay
        // per permettere al backend di processare il movimento
        if ('quantity' in updateData) {
            console.log('[InventoryMobile] Quantità modificata, ricarico movimenti dopo salvataggio...');
            // Piccolo delay per permettere al backend di processare il movimento
            setTimeout(async () => {
                const wineName = originalWineData?.name;
                if (wineName) {
                    await loadMovements(wineName);
                }
            }, 500); // 500ms delay per permettere al processor di creare il movimento
        }
        
        // Mostra messaggio successo
        showSuccessPopup('Modifiche salvate', 'Le modifiche sono state salvate con successo');
        
        // Ricarica dati vino per aggiornare display
        await showWineDetails(currentWineId);
        
    } catch (error) {
        // Gestisci errori in modo più robusto
        let errorMessage = 'Errore sconosciuto durante il salvataggio';
        if (error instanceof Error) {
            errorMessage = error.message;
        } else if (typeof error === 'string') {
            errorMessage = error;
        } else if (error && typeof error === 'object') {
            errorMessage = error.message || error.detail || JSON.stringify(error);
        }
        showErrorPopup('Errore salvataggio', errorMessage);
    } finally {
        // Ripristina bottone
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = originalBtnText;
            saveBtn.style.opacity = '1';
        }
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
        
        // Distruggi chart fullscreen se presente
        if (window.currentChartFullscreen && typeof window.currentChartFullscreen.destroy === 'function') {
            window.currentChartFullscreen.destroy();
            window.currentChartFullscreen = null;
        }
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
 * Mostra popup conferma salvataggio con dati modificati
 * Ritorna Promise<boolean> - true se confermato, false se annullato
 */
function showConfirmSavePopup(updateData, originalData) {
    return new Promise((resolve) => {
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
            <button type="button" id="preview-cancel-btn" style="
                flex: 1;
                padding: 12px;
                background: #e5e7eb;
                color: #374151;
                border: none;
                border-radius: 8px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
            ">Annulla</button>
            <button type="button" id="preview-save-btn" style="
                flex: 1;
                padding: 12px;
                background: #16a34a;
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
            ">Salva</button>
        </div>
    `;
    
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
    
    // Gestione click
    const cancelBtn = popup.querySelector('#preview-cancel-btn');
    const saveBtn = popup.querySelector('#preview-save-btn');
    
    const closePopup = (confirmed) => {
        document.body.removeChild(overlay);
        resolve(confirmed);
    };
    
    cancelBtn.addEventListener('click', () => closePopup(false));
    saveBtn.addEventListener('click', () => closePopup(true));
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closePopup(false);
        }
    });
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


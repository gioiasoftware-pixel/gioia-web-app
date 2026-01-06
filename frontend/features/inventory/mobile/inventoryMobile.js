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
    
    // Setup event listeners
    setupInventoryButtons();
    setupWineListClickHandlers();
    setupSaveButton();
    setupSearchAndFilters();
    
    // Carica inventario iniziale
    loadInventory();
    
    console.log('[InventoryMobile] Inizializzato');
}

/**
 * Setup bottoni inventario
 */
function setupInventoryButtons() {
    // Bottone indietro già gestito da ChatMobile.js
    // Qui possiamo aggiungere altri bottoni se necessario
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
            const wineId = wineItem.getAttribute('data-wine-id');
            if (wineId) {
                showWineDetails(parseInt(wineId));
            }
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
        // L'API restituisce 'id' direttamente o potrebbe essere in altri formati
        const wineId = wine.id || wine.wine_id || wine.wineId;
        const name = wine.name || '-';
        // L'API potrebbe restituire 'winery' invece di 'producer'
        const producer = wine.producer || wine.winery || '-';
        const vintage = wine.vintage || '-';
        // L'API potrebbe restituire 'qty' invece di 'quantity'
        const quantity = wine.quantity || wine.qty || 0;
        
        if (!wineId) {
            console.warn('[InventoryMobile] Vino senza ID:', wine);
            return '';
        }
        
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
    if (!wineId || wineId === 'undefined' || wineId === 'null') {
        console.error('[InventoryMobile] wineId non valido:', wineId);
        alert('ID vino non valido');
        return;
    }
    
    currentWineId = wineId;
    
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
        
        console.log('[InventoryMobile] Caricamento dettagli vino:', wineId);
        const url = `${window.API_BASE_URL || ''}/api/wines/${wineId}`;
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
        loadMovements(wineId);
        
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
        showWineDetails: showWineDetails
    };
}


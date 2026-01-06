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
 * Pannello log mobile per debug
 */
let debugLogPanel = null;
let debugLogs = [];
const MAX_LOGS = 50;

function createDebugLogPanel() {
    console.log('[InventoryMobile] === CREAZIONE PANNELLO LOG DEBUG ===');
    
    // Rimuovi pannello esistente se presente
    const existing = document.getElementById('inventory-debug-log-panel');
    if (existing) {
        console.log('[InventoryMobile] Rimuovo pannello esistente');
        existing.remove();
    }
    
    // Crea pannello
    debugLogPanel = document.createElement('div');
    debugLogPanel.id = 'inventory-debug-log-panel';
    
    // Stili FORZATI per garantire visibilità - PANNELLO GRANDE E VISIBILE
    debugLogPanel.style.cssText = `
        position: fixed !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) !important;
        width: 90% !important;
        max-width: 500px !important;
        min-width: 300px !important;
        height: 60% !important;
        max-height: 400px !important;
        min-height: 300px !important;
        background: rgba(0, 0, 0, 0.98) !important;
        color: #00ff00 !important;
        font-family: 'Courier New', monospace !important;
        font-size: 12px !important;
        padding: 15px !important;
        border-radius: 12px !important;
        border: 3px solid #00ff00 !important;
        z-index: 999999 !important;
        overflow-y: auto !important;
        overflow-x: hidden !important;
        box-shadow: 0 8px 24px rgba(0, 255, 0, 0.8) !important;
        pointer-events: auto !important;
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
    `;
    
    console.log('[InventoryMobile] Pannello creato, stili applicati');
    
    // Header del pannello
    const header = document.createElement('div');
    header.style.cssText = `
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        margin-bottom: 8px !important;
        padding-bottom: 8px !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.3) !important;
    `;
    
    const title = document.createElement('div');
    title.textContent = '🔍 DEBUG LOG - INVENTARIO MOBILE';
    title.style.cssText = `
        font-weight: bold !important;
        color: #00ff00 !important;
        font-size: 14px !important;
    `;
    
    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'CLEAR';
    clearBtn.style.cssText = `
        background: rgba(255, 0, 0, 0.7) !important;
        color: white !important;
        border: 1px solid #ff0000 !important;
        padding: 6px 12px !important;
        border-radius: 6px !important;
        font-size: 11px !important;
        font-weight: bold !important;
        cursor: pointer !important;
        pointer-events: auto !important;
    `;
    clearBtn.addEventListener('click', () => {
        debugLogs = [];
        updateLogDisplay();
    });
    
    header.appendChild(title);
    header.appendChild(clearBtn);
    debugLogPanel.appendChild(header);
    
    // Container log - più grande
    const logContainer = document.createElement('div');
    logContainer.id = 'inventory-debug-log-content';
    logContainer.style.cssText = `
        height: calc(100% - 60px) !important;
        max-height: calc(100% - 60px) !important;
        overflow-y: auto !important;
        overflow-x: hidden !important;
        padding: 5px 0 !important;
    `;
    debugLogPanel.appendChild(logContainer);
    
    // Aggiungi al body
    document.body.appendChild(debugLogPanel);
    console.log('[InventoryMobile] ✅ Pannello aggiunto al body');
    
    // Forza reflow
    debugLogPanel.offsetHeight;
    
    // Verifica che sia visibile
    setTimeout(() => {
        const rect = debugLogPanel.getBoundingClientRect();
        const computed = window.getComputedStyle(debugLogPanel);
        console.log('[InventoryMobile] === VERIFICA PANNELLO LOG ===');
        console.log('[InventoryMobile] Posizione:', rect);
        console.log('[InventoryMobile] Display:', computed.display);
        console.log('[InventoryMobile] Visibility:', computed.visibility);
        console.log('[InventoryMobile] Opacity:', computed.opacity);
        console.log('[InventoryMobile] Z-index:', computed.zIndex);
        console.log('[InventoryMobile] Width:', computed.width);
        console.log('[InventoryMobile] Height:', computed.height);
        
        if (rect.width === 0 || rect.height === 0) {
            console.error('[InventoryMobile] ❌ PANNELLO HA DIMENSIONI ZERO!');
            // Prova a forzare dimensioni
            debugLogPanel.style.width = '300px';
            debugLogPanel.style.height = '150px';
        }
        
        // Aggiungi log iniziale
        addDebugLog('✅ PANNELLO LOG CREATO E VISIBILE', 'info');
        addDebugLog('Se vedi questo messaggio, il pannello funziona!', 'info');
    }, 100);
    
    console.log('[InventoryMobile] ✅ Pannello debug log creato e aggiunto al DOM');
}

function addDebugLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = {
        time: timestamp,
        message: message,
        type: type
    };
    
    debugLogs.push(logEntry);
    
    // Mantieni solo gli ultimi MAX_LOGS
    if (debugLogs.length > MAX_LOGS) {
        debugLogs.shift();
    }
    
    // Verifica che il pannello esista
    if (!debugLogPanel || !document.getElementById('inventory-debug-log-panel')) {
        console.warn('[InventoryMobile] Pannello log non trovato, ricreo...');
        createDebugLogPanel();
    }
    
    updateLogDisplay();
    
    // Log anche nella console normale
    const consoleMethod = type === 'error' ? 'error' : type === 'warn' ? 'warn' : 'log';
    console[consoleMethod](`[${timestamp}] ${message}`);
}

function updateLogDisplay() {
    const logContainer = document.getElementById('inventory-debug-log-content');
    if (!logContainer) {
        console.warn('[InventoryMobile] Container log non trovato, ricreo pannello...');
        createDebugLogPanel();
        // Riprova dopo un breve delay
        setTimeout(() => {
            const retryContainer = document.getElementById('inventory-debug-log-content');
            if (retryContainer) {
                retryContainer.innerHTML = debugLogs.map(log => {
                    const color = log.type === 'error' ? '#ff4444' : log.type === 'warn' ? '#ffaa00' : '#00ff00';
                    return `<div style="color: ${color}; margin-bottom: 2px; word-break: break-word;">[${log.time}] ${log.message}</div>`;
                }).join('');
                retryContainer.scrollTop = retryContainer.scrollHeight;
            }
        }, 50);
        return;
    }
    
    logContainer.innerHTML = debugLogs.map(log => {
        const color = log.type === 'error' ? '#ff4444' : log.type === 'warn' ? '#ffaa00' : '#00ff00';
        return `<div style="color: ${color}; margin-bottom: 4px; word-break: break-word; line-height: 1.4;">[${log.time}] ${log.message}</div>`;
    }).join('');
    
    // Auto-scroll all'ultimo log
    logContainer.scrollTop = logContainer.scrollHeight;
}

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
    
    // Crea pannello debug log IMMEDIATAMENTE quando si entra nell'inventario
    console.log('[InventoryMobile] Chiamata createDebugLogPanel()...');
    createDebugLogPanel();
    
    // Verifica che sia stato creato e forzalo visibile
    setTimeout(() => {
        const panel = document.getElementById('inventory-debug-log-panel');
        if (!panel) {
            console.error('[InventoryMobile] ❌ Pannello non creato! Riprovo...');
            createDebugLogPanel();
        } else {
            console.log('[InventoryMobile] ✅ Pannello trovato nel DOM');
            // Forza visibilità
            panel.style.display = 'block';
            panel.style.visibility = 'visible';
            panel.style.opacity = '1';
            panel.style.zIndex = '999999';
        }
    }, 50);
    
    // Crea anche quando il viewerPanel diventa visibile
    const viewerPanelForObserver = document.getElementById('viewerPanel');
    if (viewerPanelForObserver) {
        const observer = new MutationObserver(() => {
            if (!viewerPanelForObserver.hidden) {
                const panel = document.getElementById('inventory-debug-log-panel');
                if (!panel) {
                    console.log('[InventoryMobile] ViewerPanel visibile, creo pannello log...');
                    createDebugLogPanel();
                } else {
                    // Forza visibilità quando viewerPanel diventa visibile
                    panel.style.display = 'block';
                    panel.style.visibility = 'visible';
                    panel.style.opacity = '1';
                }
            }
        });
        observer.observe(viewerPanelForObserver, {
            attributes: true,
            attributeFilter: ['hidden']
        });
    }
    
    addDebugLog('=== INIZIALIZZAZIONE INVENTARIO MOBILE ===', 'info');
    addDebugLog('PANNELLO LOG VISIBILE - Se non lo vedi, controlla console', 'info');
    
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
        addDebugLog('Retry 1: setup bottone dopo 200ms', 'info');
        setupInventoryButtons();
    }, 200);
    
    setTimeout(() => {
        addDebugLog('Retry 2: setup bottone dopo 500ms', 'info');
        setupInventoryButtons();
    }, 500);
    
    setTimeout(() => {
        addDebugLog('Retry 3: setup bottone dopo 1000ms', 'info');
        setupInventoryButtons();
    }, 1000);
    
    // Observer per quando l'header diventa visibile
    const observer = new MutationObserver(() => {
        const header = document.getElementById('inventory-header-mobile');
        const viewerPanel = document.getElementById('viewerPanel');
        if (header && viewerPanel && !viewerPanel.hidden) {
            addDebugLog('Observer: Header visibile, setup bottone', 'info');
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
    
    addDebugLog('Inizializzazione completata', 'info');
    console.log('[InventoryMobile] Inizializzato');
}

/**
 * Setup bottoni inventario
 * Crea il bottone indietro da zero con stile tondo
 */
function setupInventoryButtons() {
    console.log('[InventoryMobile] === SETUP BOTTONE INDIETRO (VERSIONE ROBUSTA) ===');
    addDebugLog('=== SETUP BOTTONE INDIETRO ===', 'info');
    addDebugLog('📝 ANALISI: Verifico se il bottone può essere cliccato...', 'info');
    
    // Trova l'header (usiamo event delegation)
    const header = document.getElementById('inventory-header-mobile');
    if (!header) {
        console.error('[InventoryMobile] ❌ Header non trovato nel DOM!');
        addDebugLog('❌ PROBLEMA: Header non trovato nel DOM!', 'error');
        addDebugLog('💡 SOLUZIONE: L\'header deve esistere nell\'HTML con id="inventory-header-mobile"', 'warn');
        addDebugLog('💡 CAUSA: Il viewerPanel potrebbe non essere ancora caricato', 'warn');
        return false;
    }
    
    console.log('[InventoryMobile] ✅ Header trovato nel DOM');
    addDebugLog('✅ Header trovato nel DOM', 'info');
    
    // Rimuovi listener esistenti sull'header clonandolo
    const newHeader = header.cloneNode(true);
    header.parentNode.replaceChild(newHeader, header);
    
    // Trova il bottone nel nuovo header
    const backBtn = document.getElementById('inventory-back-btn-mobile');
    if (!backBtn) {
        console.error('[InventoryMobile] ❌ Bottone non trovato dopo clone!');
        addDebugLog('❌ PROBLEMA: Bottone non trovato dopo clone!', 'error');
        addDebugLog('💡 CAUSA: Il bottone potrebbe non essere nell\'HTML o essere stato rimosso', 'warn');
        addDebugLog('💡 SOLUZIONE: Verifica che il bottone esista in index.html con id="inventory-back-btn-mobile"', 'warn');
        return false;
    }
    
    console.log('[InventoryMobile] ✅ Bottone trovato nel DOM');
    addDebugLog('✅ Bottone trovato nel DOM', 'info');
    addDebugLog('📝 ANALISI: Verifico se il bottone è visibile e cliccabile...', 'info');
    
    // Forza stili inline per garantire visibilità
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
    `;
    
    console.log('[InventoryMobile] ✅ Stili inline applicati');
    
    // Funzione handler robusta con try-catch
    const handleButtonAction = (eventType, e) => {
        console.log(`[InventoryMobile] 🎯 EVENTO ${eventType} INTERCETTATO sul bottone!`);
        addDebugLog(`🎯🎯🎯 EVENTO ${eventType} INTERCETTATO! 🎯🎯🎯`, 'info');
        addDebugLog('✅ SUCCESSO: Il tap è stato rilevato!', 'info');
        console.log('[InventoryMobile] Event object:', e);
        console.log('[InventoryMobile] Target:', e.target);
        addDebugLog(`Target: ${e.target?.id || e.target?.tagName || 'unknown'}`, 'info');
        addDebugLog('📝 ANALISI: Se vedi questo log, il listener funziona!', 'info');
        
        try {
            // NON usare preventDefault/stopPropagation qui - potrebbe interferire
            console.log('[InventoryMobile] Verifico handleBackClick...');
            addDebugLog('📝 Verifico se handleBackClick è disponibile...', 'info');
            console.log('[InventoryMobile] handleBackClick type:', typeof handleBackClick);
            addDebugLog(`handleBackClick type: ${typeof handleBackClick}`, 'info');
            
            if (typeof handleBackClick !== 'function') {
                addDebugLog('⚠️ ATTENZIONE: handleBackClick non è una funzione diretta', 'warn');
            }
            
            // Verifica se handleBackClick è definita (può essere in scope diverso)
            let backClickHandler = handleBackClick;
            if (typeof backClickHandler !== 'function') {
                addDebugLog('⚠️ handleBackClick non è funzione diretta, cerco in window.InventoryMobile...', 'warn');
                // Prova a recuperarla da window.InventoryMobile
                if (window.InventoryMobile && typeof window.InventoryMobile.handleBackClick === 'function') {
                    backClickHandler = window.InventoryMobile.handleBackClick;
                    console.log('[InventoryMobile] ✅ handleBackClick trovata in window.InventoryMobile');
                    addDebugLog('✅ handleBackClick trovata in window.InventoryMobile', 'info');
                } else {
                    console.error('[InventoryMobile] ❌ handleBackClick non trovata!');
                    addDebugLog('❌ PROBLEMA CRITICO: handleBackClick non trovata!', 'error');
                    addDebugLog('💡 CAUSA: La funzione handleBackClick non è definita o non è accessibile', 'error');
                    addDebugLog('💡 SOLUZIONE: Verifica che window.InventoryMobile.handleBackClick esista', 'error');
                    addDebugLog('🔄 FALLBACK: Eseguo refresh diretto del browser', 'warn');
                    // Fallback: refresh diretto
                    console.log('[InventoryMobile] Fallback: refresh diretto');
                    window.location.reload();
                    return;
                }
            }
            
            console.log('[InventoryMobile] Chiamata handleBackClick...');
            addDebugLog('▶️▶️▶️ CHIAMATA handleBackClick() ▶️▶️▶️', 'info');
            addDebugLog('📝 Se non vedi log dopo questo, handleBackClick potrebbe avere un errore', 'info');
            backClickHandler();
            console.log('[InventoryMobile] ✅ handleBackClick eseguita con successo');
            addDebugLog('✅✅✅ handleBackClick eseguita con successo! ✅✅✅', 'info');
            addDebugLog('📝 Se vedi questo, la funzione è stata eseguita correttamente', 'info');
        } catch (error) {
            console.error('[InventoryMobile] ❌ ERRORE in handleButtonAction:', error);
            addDebugLog('❌❌❌ ERRORE CRITICO in handleButtonAction! ❌❌❌', 'error');
            addDebugLog(`❌ Messaggio errore: ${error.message}`, 'error');
            console.error('[InventoryMobile] Stack trace:', error.stack);
            addDebugLog(`❌ Stack trace: ${error.stack?.substring(0, 150)}...`, 'error');
            addDebugLog('💡 CAUSA: handleBackClick ha generato un errore JavaScript', 'error');
            addDebugLog('💡 SOLUZIONE: Controlla la console per dettagli completi', 'error');
            // Fallback: refresh diretto in caso di errore
            console.log('[InventoryMobile] Fallback dopo errore: refresh diretto');
            addDebugLog('🔄 FALLBACK: Eseguo refresh diretto del browser', 'warn');
            try {
                window.location.reload();
            } catch (reloadError) {
                console.error('[InventoryMobile] ❌ ERRORE anche nel reload:', reloadError);
                addDebugLog(`❌ ERRORE CRITICO anche nel reload: ${reloadError.message}`, 'error');
                addDebugLog('💡 PROBLEMA GRAVE: Nemmeno il reload funziona!', 'error');
            }
        }
    };
    
    // Aggiungi spiegazione finale
    addDebugLog('📝 RIEPILOGO POSSIBILI PROBLEMI:', 'info');
    addDebugLog('1. Se NON vedi "EVENTO INTERCETTATO" → listener non funziona', 'info');
    addDebugLog('2. Se vedi "EVENTO INTERCETTATO" ma non "handleBackClick eseguita" → errore nella funzione', 'info');
    addDebugLog('3. Se vedi "dimensioni zero" → problema CSS', 'info');
    addDebugLog('4. Se vedi "pointer-events none" → elemento parent blocca eventi', 'info');
    
    // Aggiungi listener DIRETTI sul bottone (non capture, per evitare conflitti)
    backBtn.addEventListener('click', (e) => {
        handleButtonAction('CLICK', e);
    }, false);
    
    backBtn.addEventListener('touchstart', (e) => {
        handleButtonAction('TOUCHSTART', e);
    }, { passive: false });
    
    backBtn.addEventListener('touchend', (e) => {
        handleButtonAction('TOUCHEND', e);
    }, { passive: false });
    
    // Aggiungi anche event delegation sull'header come backup
    newHeader.addEventListener('click', (e) => {
        if (e.target.id === 'inventory-back-btn-mobile' || e.target.closest('#inventory-back-btn-mobile')) {
            console.log('[InventoryMobile] 🎯 CLICK intercettato via event delegation!');
            handleButtonAction('CLICK-DELEGATION', e);
        }
    }, false);
    
    newHeader.addEventListener('touchstart', (e) => {
        if (e.target.id === 'inventory-back-btn-mobile' || e.target.closest('#inventory-back-btn-mobile')) {
            console.log('[InventoryMobile] 🎯 TOUCHSTART intercettato via event delegation!');
            handleButtonAction('TOUCHSTART-DELEGATION', e);
        }
    }, { passive: false });
    
    console.log('[InventoryMobile] ✅ Listener aggiunti (diretti + delegation)');
    addDebugLog('✅ Listener aggiunti (diretti + delegation)', 'info');
    
    // Verifica visibilità
    setTimeout(() => {
        const rect = backBtn.getBoundingClientRect();
        const computed = window.getComputedStyle(backBtn);
        console.log('[InventoryMobile] === VERIFICA BOTTONE ===');
        addDebugLog('=== VERIFICA BOTTONE ===', 'info');
        console.log('[InventoryMobile] Posizione:', rect);
        addDebugLog(`Posizione: x=${rect.x}, y=${rect.y}, w=${rect.width}, h=${rect.height}`, 'info');
        console.log('[InventoryMobile] Display:', computed.display);
        addDebugLog(`Display: ${computed.display}`, 'info');
        console.log('[InventoryMobile] Visibility:', computed.visibility);
        addDebugLog(`Visibility: ${computed.visibility}`, 'info');
        console.log('[InventoryMobile] Opacity:', computed.opacity);
        addDebugLog(`Opacity: ${computed.opacity}`, 'info');
        console.log('[InventoryMobile] Pointer-events:', computed.pointerEvents);
        addDebugLog(`Pointer-events: ${computed.pointerEvents}`, 'info');
        console.log('[InventoryMobile] Z-index:', computed.zIndex);
        addDebugLog(`Z-index: ${computed.zIndex}`, 'info');
        console.log('[InventoryMobile] Width:', computed.width);
        console.log('[InventoryMobile] Height:', computed.height);
        
        if (rect.width === 0 || rect.height === 0) {
            console.error('[InventoryMobile] ❌❌❌ BOTTONE HA DIMENSIONI ZERO! ❌❌❌');
            addDebugLog('❌❌❌ PROBLEMA CRITICO: BOTTONE HA DIMENSIONI ZERO! ❌❌❌', 'error');
            addDebugLog('💡 CAUSA: Il bottone è nascosto da CSS (display:none) o ha width/height=0', 'error');
            addDebugLog('💡 SOLUZIONE: Verifica CSS - il bottone deve avere width/height > 0', 'error');
            addDebugLog('💡 VERIFICA: Controlla se .mViewer ha display:none o pointer-events:none', 'error');
        } else {
            console.log('[InventoryMobile] ✅ Bottone ha dimensioni valide');
            addDebugLog('✅ Bottone ha dimensioni valide', 'info');
        }
        
        // Verifica aggiuntive
        if (computed.pointerEvents === 'none') {
            addDebugLog('❌ PROBLEMA: pointer-events è "none"!', 'error');
            addDebugLog('💡 CAUSA: Un elemento parent ha pointer-events:none', 'error');
            addDebugLog('💡 SOLUZIONE: Verifica .mViewer e parent elements', 'error');
        }
        
        if (computed.display === 'none') {
            addDebugLog('❌ PROBLEMA: display è "none"!', 'error');
            addDebugLog('💡 CAUSA: Il bottone è nascosto da CSS', 'error');
        }
        
        if (computed.visibility === 'hidden') {
            addDebugLog('❌ PROBLEMA: visibility è "hidden"!', 'error');
            addDebugLog('💡 CAUSA: Il bottone è nascosto da CSS visibility', 'error');
        }
        
        if (computed.opacity === '0') {
            addDebugLog('❌ PROBLEMA: opacity è "0"!', 'error');
            addDebugLog('💡 CAUSA: Il bottone è trasparente', 'error');
        }
        
        if (parseInt(computed.zIndex) < 1000) {
            addDebugLog('⚠️ ATTENZIONE: z-index potrebbe essere troppo basso', 'warn');
            addDebugLog('💡 VERIFICA: Potrebbe esserci un overlay sopra il bottone', 'warn');
        }
        
        addDebugLog('📝 ANALISI COMPLETA: Se il bottone non funziona, controlla i log sopra', 'info');
    }, 100);
    
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
 * - Nella pagina "lista" (prima pagina inventario) → torna alla chat/homepage (refresh browser)
 * - Nella pagina dettagli vino → torna alla lista inventario
 */
function handleBackClick() {
    console.log('[InventoryMobile] handleBackClick chiamato');
    addDebugLog('▶️ handleBackClick CHIAMATO', 'info');
    
    const listScreen = document.getElementById('inventory-screen-list');
    const detailsScreen = document.getElementById('inventory-screen-details');
    const chartScreen = document.getElementById('inventory-screen-chart');
    
    // Verifica quale schermata è attualmente visibile
    const isDetailsVisible = detailsScreen && !detailsScreen.classList.contains('hidden');
    const isChartVisible = chartScreen && !chartScreen.classList.contains('hidden');
    const isListVisible = listScreen && !listScreen.classList.contains('hidden');
    
    console.log('[InventoryMobile] Stato schermate - Lista:', isListVisible, 'Dettagli:', isDetailsVisible, 'Chart:', isChartVisible);
    addDebugLog(`Stato: Lista=${isListVisible}, Dettagli=${isDetailsVisible}, Chart=${isChartVisible}`, 'info');
    
    // Se siamo nella pagina dettagli vino → torna alla lista inventario
    if (isDetailsVisible) {
        console.log('[InventoryMobile] Dalla pagina dettagli → torno alla lista inventario');
        addDebugLog('📋 Dettagli → Lista inventario', 'info');
        showInventoryScreen('list');
        currentWineId = null;
        originalWineData = null;
        return;
    }
    
    // Se siamo nella pagina chart → torna ai dettagli
    if (isChartVisible) {
        console.log('[InventoryMobile] Dalla pagina chart → torno ai dettagli');
        addDebugLog('📊 Chart → Dettagli', 'info');
        showInventoryScreen('details');
        return;
    }
    
    // Se siamo nella pagina lista (prima pagina inventario) → torna alla chat/homepage
    // Facciamo un refresh del browser per tornare alla homepage
    if (isListVisible) {
        console.log('[InventoryMobile] Dalla pagina lista → refresh browser per tornare alla chat/homepage');
        addDebugLog('🔄 Lista → Refresh browser (homepage)', 'info');
        window.location.reload();
        return;
    }
    
    // Fallback: se non riusciamo a determinare la schermata, chiudi inventario
    console.log('[InventoryMobile] Fallback: chiudo inventario');
    addDebugLog('⚠️ Fallback: chiudo inventario', 'warn');
    const viewerPanel = document.getElementById('viewerPanel');
    const mobileLayout = document.getElementById('mobile-layout');
    
    if (viewerPanel) viewerPanel.hidden = true;
    if (mobileLayout) {
        mobileLayout.classList.remove('state-viewer');
        mobileLayout.classList.add('state-chat');
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


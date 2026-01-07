/**
 * Wine Card Buttons - Gestione bottoni wine cards (mobile e desktop)
 * Funzioni condivise per setup e gestione click bottoni wine cards
 */

/**
 * Mostra popup di test per feedback visivo
 * SOLUZIONE ULTRA-ROBUSTA: supporta Shadow DOM, iframe, forza tutte le proprietà
 * 
 * @param {string} title - Titolo popup
 * @param {string} message - Messaggio popup
 * @param {string} type - Tipo: 'info', 'success', 'error'
 * @param {HTMLElement|Document} rootElement - Root element dove appendare (default: document.body)
 */
function showWineCardTestPopup(title, message, type = 'info', rootElement = document.body) {
    // Se rootElement è document, usa body
    const root = rootElement?.body || rootElement || document.body;
    const doc = root.ownerDocument || root.defaultView?.document || document;
    
    console.log('[WineCardButtons] 🎯 Creazione popup:', {
        rootElement,
        root,
        doc,
        rootType: root.constructor.name,
        isShadowRoot: root instanceof ShadowRoot
    });
    
    // Crea o recupera layer globale dedicato (fuori da stacking context)
    let layer = doc.getElementById('global-popup-layer');
    if (!layer) {
        layer = doc.createElement('div');
        layer.id = 'global-popup-layer';
        // FORZA tutte le proprietà con !important inline
        layer.setAttribute('style', `
            all: unset;
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            z-index: 2147483647 !important;
            pointer-events: none !important;
            display: block !important;
            opacity: 1 !important;
            visibility: visible !important;
        `);
        // Append al root corretto
        root.appendChild(layer);
        console.log('[WineCardButtons] ✅ Layer creato e appeso a:', root);
    }
    
    // Crea popup
    const popup = doc.createElement('div');
    popup.className = 'wine-card-test-popup';
    
    // Colori forzati (rosso per test di visibilità)
    const bgColor = type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6';
    
    // FORZA tutte le proprietà con !important inline
    popup.setAttribute('style', `
        all: unset;
        position: absolute !important;
        top: 20px !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        background: ${bgColor} !important;
        background-color: ${bgColor} !important;
        color: white !important;
        padding: 16px 24px !important;
        border-radius: 8px !important;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
        font-size: 14px !important;
        font-weight: 500 !important;
        max-width: 90% !important;
        text-align: center !important;
        opacity: 1 !important;
        visibility: visible !important;
        display: block !important;
        pointer-events: auto !important;
        z-index: 2147483647 !important;
    `);
    
    popup.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 4px; color: white !important;">${title}</div>
        <div style="font-size: 12px; opacity: 0.9; color: white !important;">${message}</div>
    `;
    
    // Append al layer globale (non al body diretto)
    layer.appendChild(popup);
    
    // Debug: verifica completa
    const rect = popup.getBoundingClientRect();
    const computed = doc.defaultView?.getComputedStyle(popup) || window.getComputedStyle(popup);
    
    console.log('[WineCardButtons] 🎯 Popup creato e verificato:', {
        layerExists: !!layer,
        layerInDOM: root.contains(layer),
        popupInDOM: layer.contains(popup),
        popupRect: {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            visible: rect.width > 0 && rect.height > 0
        },
        computed: {
            display: computed.display,
            visibility: computed.visibility,
            opacity: computed.opacity,
            zIndex: computed.zIndex,
            position: computed.position,
            backgroundColor: computed.backgroundColor
        },
        popupStyle: popup.getAttribute('style').substring(0, 100)
    });
    
    // Test visivo: se ancora non si vede, prova un overlay rosso fullscreen
    setTimeout(() => {
        const testOverlay = doc.createElement('div');
        testOverlay.id = 'test-overlay-visible';
        testOverlay.setAttribute('style', `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            background: rgba(255, 0, 0, 0.3) !important;
            z-index: 2147483646 !important;
            pointer-events: none !important;
            display: block !important;
        `);
        testOverlay.textContent = 'TEST OVERLAY - Se vedi questo, il problema è solo il popup';
        root.appendChild(testOverlay);
        
        setTimeout(() => testOverlay.remove(), 1000);
    }, 100);
    
    // Rimuovi dopo 3 secondi
    setTimeout(() => {
        if (popup.parentNode) {
            popup.remove();
        }
        // Rimuovi layer se vuoto
        if (layer && layer.children.length === 0) {
            layer.remove();
        }
    }, 3000);
}

/**
 * Setup listener per pulsanti di movimento integrati nelle wine cards
 * Gestisce .wines-list-item-button per movimenti multipli/singoli
 * 
 * @param {HTMLElement} messageElement - Elemento messaggio contenente i bottoni
 */
function setupWineCardMovementButtons(messageElement) {
    if (!messageElement) {
        console.warn('[WineCardButtons] messageElement non fornito');
        return;
    }
    
    // Cerca tutti i pulsanti di movimento (.wines-list-item-button e .chat-button)
    const buttonElements = messageElement.querySelectorAll('.chat-button, .wines-list-item-button');
    
    if (buttonElements.length === 0) {
        console.log('[WineCardButtons] Nessun bottone movimento trovato nel messaggio');
        return;
    }
    
    console.log(`[WineCardButtons] ✅ Trovati ${buttonElements.length} bottoni movimento da collegare`);
    
    // Determina layout (mobile o desktop)
    const isMobile = window.LayoutBoundary?.isMobileNamespace() || 
                     document.documentElement.classList.contains('mobileRoot');
    
    buttonElements.forEach((btn, index) => {
        // Rimuovi listener esistenti clonando il bottone
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        
        // Leggi data attributes dal pulsante
        const wineId = newBtn.dataset.wineId || newBtn.getAttribute('data-wine-id');
        const wineText = newBtn.dataset.wineText || newBtn.getAttribute('data-wine-text');
        const movementType = newBtn.dataset.movementType || newBtn.getAttribute('data-movement-type');
        const quantity = newBtn.dataset.quantity || newBtn.getAttribute('data-quantity');
        
        console.log(`[WineCardButtons] 🔗 Collegamento listener bottone ${index + 1}:`, {
            wineId,
            wineText,
            movementType,
            quantity,
            hasMovementData: !!(movementType && quantity && wineId),
            isMobile,
            buttonClass: newBtn.className,
            buttonText: newBtn.textContent?.trim().substring(0, 30)
        });
        
        // Aggiungi listener - supporta sia click che pointerup per mobile
        const handleClick = async (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            console.log('[WineCardButtons] 🎯 CLICK RILEVATO sul bottone movimento!', {
                wineId,
                wineText,
                movementType,
                quantity,
                eventType: e.type,
                isMobile,
                target: e.target,
                rootNode: e.target?.getRootNode()
            });
            
            // CRITICO: Usa il root del bottone cliccato (supporta Shadow DOM / iframe)
            const rootNode = e.target?.getRootNode();
            const doc = rootNode?.host ? rootNode : (rootNode?.defaultView || window).document || document;
            const rootBody = doc.body || doc.documentElement || doc;
            
            console.log('[WineCardButtons] 🔍 Root detection:', {
                hasRootNode: !!rootNode,
                isShadowRoot: rootNode instanceof ShadowRoot,
                isDocument: rootNode === document,
                docBody: !!doc.body,
                rootBody: !!rootBody
            });
            
            // Leggi data attributes al momento del click (per sicurezza)
            const clickWineId = newBtn.dataset.wineId || newBtn.getAttribute('data-wine-id');
            const clickWineText = newBtn.dataset.wineText || newBtn.getAttribute('data-wine-text');
            const clickMovementType = newBtn.dataset.movementType || newBtn.getAttribute('data-movement-type');
            const clickQuantity = newBtn.dataset.quantity || newBtn.getAttribute('data-quantity');
            
            // MOSTRA POPUP DI TEST (passa il root corretto)
            if (clickMovementType && clickQuantity && clickWineId) {
                showWineCardTestPopup(
                    '✅ Movimento rilevato',
                    `${clickMovementType} di ${clickQuantity} bottiglie per vino ID: ${clickWineId}`,
                    'success',
                    rootBody
                );
            } else {
                showWineCardTestPopup(
                    '✅ Click rilevato',
                    `Ricerca info per: ${clickWineText || 'vino'}`,
                    'info',
                    rootBody
                );
            }
            
            // Se è un pulsante di conferma movimento, processa direttamente
            if (clickMovementType && clickQuantity && clickWineId) {
                console.log('[WineCardButtons] 📤 Processando movimento:', { 
                    movementType: clickMovementType, 
                    quantity: clickQuantity, 
                    wineId: clickWineId 
                });
                
                // Costruisci messaggio movimento
                const message = `[movement:${clickMovementType}] [wine_id:${clickWineId}] [quantity:${clickQuantity}]`;
                console.log('[WineCardButtons] 📨 Messaggio da inviare:', message);
                
                // Invia messaggio usando ChatAPI
                try {
                    if (!window.ChatAPI || !window.ChatAPI.sendMessage) {
                        throw new Error('ChatAPI.sendMessage non disponibile');
                    }
                    
                    const response = await window.ChatAPI.sendMessage(message);
                    console.log('[WineCardButtons] ✅ Risposta ricevuta:', response);
                    
                    if (response && response.message) {
                        // Aggiungi risposta AI alla chat usando il metodo appropriato
                        const addMessage = isMobile 
                            ? window.ChatMobile?.addMessage 
                            : window.ChatDesktop?.addMessage;
                        
                        if (addMessage) {
                            addMessage('ai', response.message, false, false, null, response.is_html);
                        } else {
                            console.warn('[WineCardButtons] addMessage non disponibile per layout corrente');
                            showWineCardTestPopup('⚠️ Errore', 'Funzione addMessage non disponibile', 'error');
                        }
                    } else {
                        showWineCardTestPopup('⚠️ Nessuna risposta', 'Il server non ha risposto', 'error');
                    }
                } catch (error) {
                    console.error('[WineCardButtons] ❌ Errore invio movimento:', error);
                    showWineCardTestPopup('❌ Errore', `Errore invio: ${error.message}`, 'error');
                }
            } else if (clickWineId || clickWineText) {
                // Pulsante normale (ricerca vino)
                console.log('[WineCardButtons] 🔍 Click pulsante ricerca vino:', clickWineText);
                
                const searchMessage = clickWineText || `Vino ID: ${clickWineId}`;
                
                try {
                    if (!window.ChatAPI || !window.ChatAPI.sendMessage) {
                        throw new Error('ChatAPI.sendMessage non disponibile');
                    }
                    
                    const response = await window.ChatAPI.sendMessage(searchMessage);
                    console.log('[WineCardButtons] ✅ Risposta ricerca ricevuta:', response);
                    
                    if (response && response.message) {
                        // Aggiungi messaggio utente e risposta AI
                        const addMessage = isMobile 
                            ? window.ChatMobile?.addMessage 
                            : window.ChatDesktop?.addMessage;
                        
                        if (addMessage) {
                            addMessage('user', searchMessage);
                            addMessage('ai', response.message, false, false, null, response.is_html);
                        } else {
                            console.warn('[WineCardButtons] addMessage non disponibile per layout corrente');
                            showWineCardTestPopup('⚠️ Errore', 'Funzione addMessage non disponibile', 'error');
                        }
                    } else {
                        showWineCardTestPopup('⚠️ Nessuna risposta', 'Il server non ha risposto', 'error');
                    }
                } catch (error) {
                    console.error('[WineCardButtons] ❌ Errore ricerca vino:', error);
                    showWineCardTestPopup('❌ Errore', `Errore ricerca: ${error.message}`, 'error');
                }
            } else {
                console.warn('[WineCardButtons] ⚠️ Bottone senza data attributes validi');
                showWineCardTestPopup('⚠️ Errore', 'Bottone senza dati validi', 'error');
            }
        };
        
        // Aggiungi listener multipli per compatibilità mobile/desktop
        newBtn.addEventListener('click', handleClick, { passive: false });
        newBtn.addEventListener('pointerup', handleClick, { passive: false });
        
        // Su mobile, aggiungi anche touchstart per migliore risposta
        if (isMobile) {
            newBtn.addEventListener('touchstart', (e) => {
                e.stopPropagation();
            }, { passive: false });
        }
    });
    
    console.log('[WineCardButtons] ✅ Setup bottoni movimento completato');
}

// Export per uso globale
if (typeof window !== 'undefined') {
    window.WineCardButtons = {
        setup: setupWineCardMovementButtons,
        showPopup: showWineCardTestPopup
    };
}


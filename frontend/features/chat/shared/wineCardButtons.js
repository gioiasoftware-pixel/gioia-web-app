/**
 * Wine Card Buttons - Gestione bottoni wine cards (mobile e desktop)
 * Funzioni condivise per setup e gestione click bottoni wine cards
 */

/**
 * Mostra popup di test per feedback visivo
 * SOLUZIONE SHADOW DOM: isola completamente il popup da CSS esterni
 * 
 * @param {string} title - Titolo popup
 * @param {string} message - Messaggio popup
 * @param {string} type - Tipo: 'info', 'success', 'error'
 * @param {HTMLElement} eventTarget - Target dell'evento click (per trovare root corretto)
 */
function showWineCardTestPopup(title, message, type = 'info', eventTarget = null) {
    // 1) Individua il root corretto (anche shadow DOM / iframe)
    const root = eventTarget?.getRootNode?.() || document;
    
    console.log('[WineCardButtons] 🎯 Creazione popup Shadow DOM:', {
        eventTarget,
        root,
        rootType: root.constructor.name,
        isShadowRoot: root instanceof ShadowRoot,
        isDocument: root === document
    });
    
    // 2) Crea host indipendente
    const host = document.createElement('div');
    host.style.position = 'fixed';
    host.style.inset = '0';
    host.style.zIndex = '2147483647';
    host.style.pointerEvents = 'none';
    
    // 3) Shadow DOM isolato da QUALSIASI CSS esterno
    const shadow = host.attachShadow({ mode: 'open' });
    
    // 4) Popup reale (dentro shadow → nessun CSS lo tocca)
    const popup = document.createElement('div');
    
    // Colore in base al tipo
    const bgColor = type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#2563eb';
    
    popup.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${bgColor};
        color: white;
        padding: 14px 22px;
        font-size: 14px;
        font-weight: 500;
        border-radius: 10px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.35);
        opacity: 1;
        pointer-events: none;
        max-width: 90%;
        text-align: center;
    `;
    
    popup.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 4px;">${title}</div>
        <div style="font-size: 12px; opacity: 0.9;">${message}</div>
    `;
    
    // 5) Inserisci nel shadow
    shadow.appendChild(popup);
    
    // 6) Attacca al root corretto
    const appendTarget = root === document ? document.body : root;
    appendTarget.appendChild(host);
    
    console.log('[WineCardButtons] ✅ Popup Shadow DOM creato:', {
        hostInDOM: appendTarget.contains(host),
        shadowRoot: !!shadow,
        popupInShadow: shadow.contains(popup),
        appendTarget: appendTarget.constructor.name
    });
    
    // 7) Autodistruzione
    setTimeout(() => {
        if (host.parentNode) {
            host.remove();
        }
    }, 2500);
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
            
            // Leggi data attributes al momento del click (per sicurezza)
            const clickWineId = newBtn.dataset.wineId || newBtn.getAttribute('data-wine-id');
            const clickWineText = newBtn.dataset.wineText || newBtn.getAttribute('data-wine-text');
            const clickMovementType = newBtn.dataset.movementType || newBtn.getAttribute('data-movement-type');
            const clickQuantity = newBtn.dataset.quantity || newBtn.getAttribute('data-quantity');
            
            // MOSTRA POPUP DI TEST (passa e.target per root detection)
            if (clickMovementType && clickQuantity && clickWineId) {
                showWineCardTestPopup(
                    '✅ Movimento rilevato',
                    `${clickMovementType} di ${clickQuantity} bottiglie per vino ID: ${clickWineId}`,
                    'success',
                    e.target
                );
            } else {
                showWineCardTestPopup(
                    '✅ Click rilevato',
                    `Ricerca info per: ${clickWineText || 'vino'}`,
                    'info',
                    e.target
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


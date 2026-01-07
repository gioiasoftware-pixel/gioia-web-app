/**
 * Wine Card Buttons - Gestione bottoni wine cards (mobile e desktop)
 * Funzioni condivise per setup e gestione click bottoni wine cards
 */

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
            
            // LOG DEBUG (usa AppDebug overlay invece di popup)
            if (clickMovementType && clickQuantity && clickWineId) {
                window.AppDebug?.log(
                    `[WineCardButtons] Movimento rilevato: ${clickMovementType} di ${clickQuantity} bottiglie per vino ID: ${clickWineId}`,
                    'success'
                );
            } else {
                window.AppDebug?.log(
                    `[WineCardButtons] Click rilevato: Ricerca info per ${clickWineText || 'vino'}`,
                    'info'
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
                            window.AppDebug?.log('[WineCardButtons] Errore: Funzione addMessage non disponibile', 'error');
                        }
                    } else {
                        window.AppDebug?.log('[WineCardButtons] Errore: Il server non ha risposto', 'error');
                    }
                } catch (error) {
                    console.error('[WineCardButtons] ❌ Errore invio movimento:', error);
                    window.AppDebug?.log(`[WineCardButtons] Errore invio movimento: ${error.message}`, 'error');
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
                            window.AppDebug?.log('[WineCardButtons] Errore: Funzione addMessage non disponibile', 'error');
                        }
                    } else {
                        window.AppDebug?.log('[WineCardButtons] Errore: Il server non ha risposto', 'error');
                    }
                } catch (error) {
                    console.error('[WineCardButtons] ❌ Errore ricerca vino:', error);
                    window.AppDebug?.log(`[WineCardButtons] Errore ricerca vino: ${error.message}`, 'error');
                }
            } else {
                console.warn('[WineCardButtons] ⚠️ Bottone senza data attributes validi');
                window.AppDebug?.log('[WineCardButtons] Errore: Bottone senza data attributes validi', 'warn');
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
        setup: setupWineCardMovementButtons
    };
}


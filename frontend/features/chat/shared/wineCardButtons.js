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
    window.AppDebug?.log('[WineCardButtons] 🚀 Setup avviato (setupWineCardMovementButtons chiamata)', 'info');
    
    if (!messageElement) {
        console.warn('[WineCardButtons] messageElement non fornito');
        window.AppDebug?.log('[WineCardButtons] ERRORE: messageElement non fornito', 'error');
        return;
    }
    
    // Cerca tutti i pulsanti di movimento (.wines-list-item-button e .chat-button)
    const buttonElements = messageElement.querySelectorAll('.chat-button, .wines-list-item-button');
    
    if (buttonElements.length === 0) {
        console.log('[WineCardButtons] Nessun bottone movimento trovato nel messaggio');
        window.AppDebug?.log('[WineCardButtons] Nessun bottone movimento trovato', 'warn');
        return;
    }
    
    console.log(`[WineCardButtons] ✅ Trovati ${buttonElements.length} bottoni movimento da collegare`);
    window.AppDebug?.log(`[WineCardButtons] Setup: Trovati ${buttonElements.length} bottoni da collegare`, 'info');
    
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
        
        const buttonInfo = {
            wineId,
            wineText: wineText?.substring(0, 30),
            movementType,
            quantity,
            hasMovementData: !!(movementType && quantity && wineId),
            isMobile,
            buttonClass: newBtn.className,
            buttonText: newBtn.textContent?.trim().substring(0, 30)
        };
        
        console.log(`[WineCardButtons] 🔗 Collegamento listener bottone ${index + 1}:`, buttonInfo);
        window.AppDebug?.log(
            `[WineCardButtons] Bottone ${index + 1}: ${wineText || wineId || 'N/A'} | Tipo: ${movementType || 'ricerca'} | Qty: ${quantity || 'N/A'}`,
            buttonInfo.hasMovementData ? 'success' : 'info'
        );
        
        // Aggiungi listener - supporta sia click che pointerup per mobile
        const handleClick = async (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            window.AppDebug?.log(`[WineCardButtons] 🎯 CLICK RILEVATO (event: ${e.type})`, 'info');
            
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
            
            window.AppDebug?.log(
                `[WineCardButtons] Dati estratti: wineId=${clickWineId || 'N/A'}, wineText="${clickWineText || 'N/A'}", movementType=${clickMovementType || 'N/A'}, quantity=${clickQuantity || 'N/A'}`,
                'info'
            );
            
            // LOG DEBUG (usa AppDebug overlay invece di popup)
            if (clickMovementType && clickQuantity && clickWineId) {
                window.AppDebug?.log(
                    `[WineCardButtons] ✅ Tipo azione: MOVIMENTO | ${clickMovementType} | ${clickQuantity} bottiglie | Vino: ${clickWineId}`,
                    'success'
                );
            } else {
                window.AppDebug?.log(
                    `[WineCardButtons] 🔍 Tipo azione: RICERCA INFO | Vino: "${clickWineText || clickWineId || 'N/A'}"`,
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
                window.AppDebug?.log(`[WineCardButtons] 📨 Messaggio costruito: "${message}"`, 'info');
                
                // Invia messaggio usando ChatAPI
                try {
                    window.AppDebug?.log('[WineCardButtons] Verifica ChatAPI disponibilità...', 'info');
                    
                    if (!window.ChatAPI || !window.ChatAPI.sendMessage) {
                        throw new Error('ChatAPI.sendMessage non disponibile');
                    }
                    
                    window.AppDebug?.log('[WineCardButtons] ✅ ChatAPI disponibile, invio messaggio...', 'info');
                    const response = await window.ChatAPI.sendMessage(message);
                    
                    window.AppDebug?.log(`[WineCardButtons] ✅ Risposta ricevuta dal server (hasMessage: ${!!response?.message}, isHtml: ${!!response?.is_html})`, 'success');
                    console.log('[WineCardButtons] ✅ Risposta ricevuta:', response);
                    
                    if (response && response.message) {
                        // Aggiungi risposta AI alla chat usando il metodo appropriato
                        const addMessage = isMobile 
                            ? window.ChatMobile?.addMessage 
                            : window.ChatDesktop?.addMessage;
                        
                        window.AppDebug?.log(`[WineCardButtons] Verifica addMessage (mobile: ${isMobile})...`, 'info');
                        
                        if (addMessage) {
                            window.AppDebug?.log(`[WineCardButtons] ✅ addMessage disponibile, aggiungo risposta AI (html: ${!!response.is_html})`, 'success');
                            addMessage('ai', response.message, false, false, null, response.is_html);
                            window.AppDebug?.log('[WineCardButtons] ✅ Messaggio AI aggiunto alla chat', 'success');
                        } else {
                            console.warn('[WineCardButtons] addMessage non disponibile per layout corrente');
                            window.AppDebug?.log(`[WineCardButtons] ❌ Errore: addMessage non disponibile (mobile: ${isMobile}, ChatMobile: ${!!window.ChatMobile}, ChatDesktop: ${!!window.ChatDesktop})`, 'error');
                        }
                    } else {
                        window.AppDebug?.log(`[WineCardButtons] ❌ Errore: Il server non ha risposto (response: ${JSON.stringify(response)})`, 'error');
                    }
                } catch (error) {
                    console.error('[WineCardButtons] ❌ Errore invio movimento:', error);
                    window.AppDebug?.log(`[WineCardButtons] ❌ Errore invio movimento: ${error.message}`, 'error');
                    if (error.stack) {
                        window.AppDebug?.log(`[WineCardButtons] Stack: ${error.stack.substring(0, 200)}`, 'error');
                    }
                }
            } else if (clickWineId || clickWineText) {
                // Pulsante normale (ricerca vino)
                console.log('[WineCardButtons] 🔍 Click pulsante ricerca vino:', clickWineText);
                
                const searchMessage = clickWineText || `Vino ID: ${clickWineId}`;
                window.AppDebug?.log(`[WineCardButtons] 🔍 Messaggio ricerca costruito: "${searchMessage}"`, 'info');
                
                try {
                    window.AppDebug?.log('[WineCardButtons] Verifica ChatAPI disponibilità...', 'info');
                    
                    if (!window.ChatAPI || !window.ChatAPI.sendMessage) {
                        throw new Error('ChatAPI.sendMessage non disponibile');
                    }
                    
                    window.AppDebug?.log('[WineCardButtons] ✅ ChatAPI disponibile, invio messaggio ricerca...', 'info');
                    const response = await window.ChatAPI.sendMessage(searchMessage);
                    
                    window.AppDebug?.log(`[WineCardButtons] ✅ Risposta ricerca ricevuta (hasMessage: ${!!response?.message}, isHtml: ${!!response?.is_html})`, 'success');
                    console.log('[WineCardButtons] ✅ Risposta ricerca ricevuta:', response);
                    
                    if (response && response.message) {
                        // Aggiungi messaggio utente e risposta AI
                        const addMessage = isMobile 
                            ? window.ChatMobile?.addMessage 
                            : window.ChatDesktop?.addMessage;
                        
                        window.AppDebug?.log(`[WineCardButtons] Verifica addMessage (mobile: ${isMobile})...`, 'info');
                        
                        if (addMessage) {
                            window.AppDebug?.log('[WineCardButtons] ✅ addMessage disponibile, aggiungo messaggi (user + AI)', 'success');
                            addMessage('user', searchMessage);
                            addMessage('ai', response.message, false, false, null, response.is_html);
                            window.AppDebug?.log('[WineCardButtons] ✅ Messaggi aggiunti alla chat', 'success');
                        } else {
                            console.warn('[WineCardButtons] addMessage non disponibile per layout corrente');
                            window.AppDebug?.log(`[WineCardButtons] ❌ Errore: addMessage non disponibile (mobile: ${isMobile}, ChatMobile: ${!!window.ChatMobile}, ChatDesktop: ${!!window.ChatDesktop})`, 'error');
                        }
                    } else {
                        window.AppDebug?.log(`[WineCardButtons] ❌ Errore: Il server non ha risposto (response: ${JSON.stringify(response)})`, 'error');
                    }
                } catch (error) {
                    console.error('[WineCardButtons] ❌ Errore ricerca vino:', error);
                    window.AppDebug?.log(`[WineCardButtons] ❌ Errore ricerca vino: ${error.message}`, 'error');
                    if (error.stack) {
                        window.AppDebug?.log(`[WineCardButtons] Stack: ${error.stack.substring(0, 200)}`, 'error');
                    }
                }
            } else {
                console.warn('[WineCardButtons] ⚠️ Bottone senza data attributes validi');
                window.AppDebug?.log('[WineCardButtons] ⚠️ Bottone senza data attributes validi (mancano wineId e wineText)', 'warn');
                window.AppDebug?.log(`[WineCardButtons] Data attuali: wineId=${clickWineId || 'N/A'}, wineText=${clickWineText || 'N/A'}`, 'warn');
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
        
        window.AppDebug?.log(`[WineCardButtons] ✅ Listener collegato al bottone ${index + 1} (click + pointerup${isMobile ? ' + touchstart' : ''})`, 'success');
    });
    
    console.log('[WineCardButtons] ✅ Setup bottoni movimento completato');
    window.AppDebug?.log(`[WineCardButtons] ✅ Setup completato: ${buttonElements.length} bottoni collegati`, 'success');
}

// Export per uso globale
if (typeof window !== 'undefined') {
    window.WineCardButtons = {
        setup: setupWineCardMovementButtons
    };
    
    // Auto-setup quando vengono aggiunti messaggi HTML con bottoni
    // Observer per rilevare nuovi messaggi HTML aggiunti al DOM
    const setupObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) { // Element node
                    // Cerca bottoni wine card nei nuovi nodi
                    const buttons = node.querySelectorAll?.('.chat-button, .wines-list-item-button');
                    if (buttons && buttons.length > 0) {
                        window.AppDebug?.log(`[WineCardButtons] 🔍 Observer: Trovati ${buttons.length} bottoni in nodo aggiunto (nodeType: ${node.nodeName}, classes: ${node.className})`, 'info');
                        
                        // Trova l'elemento messaggio contenitore
                        let messageElement = node;
                        if (!messageElement.classList?.contains('chat-message')) {
                            messageElement = node.closest?.('.chat-message') || 
                                           node.querySelector?.('.chat-message') ||
                                           (node.parentElement?.closest?.('.chat-message'));
                        }
                        
                        window.AppDebug?.log(`[WineCardButtons] 🔍 Observer: messageElement trovato: ${!!messageElement}, è il nodo stesso: ${messageElement === node}`, 'info');
                        
                        if (messageElement && messageElement !== node) {
                            // Verifica che non sia già stato processato
                            if (!messageElement.dataset.wineButtonsSetup) {
                                window.AppDebug?.log(`[WineCardButtons] 🔍 Auto-setup: Trovati ${buttons.length} bottoni in nuovo messaggio HTML`, 'info');
                                setTimeout(() => {
                                    setupWineCardMovementButtons(messageElement);
                                    messageElement.dataset.wineButtonsSetup = 'true';
                                }, 150); // Aumentato a 150ms per dare tempo a ChatMobile
                            } else {
                                window.AppDebug?.log(`[WineCardButtons] ⏭️ Messaggio già processato (dataset flag presente)`, 'warn');
                            }
                        } else if (node.classList?.contains?.('chat-message')) {
                            // Il nodo stesso è il messaggio
                            if (!node.dataset.wineButtonsSetup) {
                                const foundButtons = node.querySelectorAll('.chat-button, .wines-list-item-button');
                                if (foundButtons && foundButtons.length > 0) {
                                    window.AppDebug?.log(`[WineCardButtons] 🔍 Auto-setup: Trovati ${foundButtons.length} bottoni nel messaggio`, 'info');
                                    setTimeout(() => {
                                        setupWineCardMovementButtons(node);
                                        node.dataset.wineButtonsSetup = 'true';
                                    }, 150);
                                }
                            } else {
                                window.AppDebug?.log(`[WineCardButtons] ⏭️ Messaggio già processato (dataset flag presente)`, 'warn');
                            }
                        } else {
                            window.AppDebug?.log(`[WineCardButtons] ⚠️ Observer: Bottoni trovati ma nessun chat-message contenitore identificato`, 'warn');
                        }
                    }
                }
            });
        });
    });
    
    // Event delegation per intercettare click sui bottoni (anche se clonati/sostituiti)
    // Processa direttamente il click invece di aspettare setup
    function setupEventDelegation() {
        document.addEventListener('click', async (e) => {
            // Cerca se il click è su un bottone wine card
            const button = e.target.closest?.('.chat-button, .wines-list-item-button');
            if (button && (button.classList.contains('wines-list-item-button') || button.classList.contains('chat-button'))) {
                const wineId = button.dataset.wineId || button.getAttribute('data-wine-id');
                const wineText = button.dataset.wineText || button.getAttribute('data-wine-text');
                const movementType = button.dataset.movementType || button.getAttribute('data-movement-type');
                const quantity = button.dataset.quantity || button.getAttribute('data-quantity');
                
                // Verifica che sia un bottone wine card (ha almeno wineId o wineText)
                if (wineId || wineText) {
                    window.AppDebug?.log(`[WineCardButtons] 🎯 CLICK DELEGATION: Bottone wine card cliccato (wineId: ${wineId || 'N/A'}, wineText: ${wineText || 'N/A'})`, 'info');
                    
                    window.AppDebug?.log(
                        `[WineCardButtons] Dati estratti: wineId=${wineId || 'N/A'}, wineText="${wineText || 'N/A'}", movementType=${movementType || 'N/A'}, quantity=${quantity || 'N/A'}`,
                        'info'
                    );
                    
                    // Determina layout
                    const isMobile = window.LayoutBoundary?.isMobileNamespace() || 
                                     document.documentElement.classList.contains('mobileRoot');
                    
                    // Processa direttamente il click
                    if (movementType && quantity && wineId) {
                        window.AppDebug?.log(
                            `[WineCardButtons] ✅ Tipo azione: MOVIMENTO | ${movementType} | ${quantity} bottiglie | Vino: ${wineId}`,
                            'success'
                        );
                        
                        const message = `[movement:${movementType}] [wine_id:${wineId}] [quantity:${quantity}]`;
                        window.AppDebug?.log(`[WineCardButtons] 📨 Messaggio costruito: "${message}"`, 'info');
                        
                        try {
                            window.AppDebug?.log('[WineCardButtons] Verifica ChatAPI disponibilità...', 'info');
                            if (!window.ChatAPI || !window.ChatAPI.sendMessage) {
                                throw new Error('ChatAPI.sendMessage non disponibile');
                            }
                            
                            window.AppDebug?.log('[WineCardButtons] ✅ ChatAPI disponibile, invio messaggio...', 'info');
                            const response = await window.ChatAPI.sendMessage(message);
                            
                            window.AppDebug?.log(`[WineCardButtons] ✅ Risposta ricevuta dal server (hasMessage: ${!!response?.message}, isHtml: ${!!response?.is_html})`, 'success');
                            
                            if (response && response.message) {
                                const addMessage = isMobile 
                                    ? window.ChatMobile?.addMessage 
                                    : window.ChatDesktop?.addMessage;
                                
                                if (addMessage) {
                                    window.AppDebug?.log(`[WineCardButtons] ✅ addMessage disponibile, aggiungo risposta AI (html: ${!!response.is_html})`, 'success');
                                    addMessage('ai', response.message, false, false, null, response.is_html);
                                    window.AppDebug?.log('[WineCardButtons] ✅ Messaggio AI aggiunto alla chat', 'success');
                                } else {
                                    window.AppDebug?.log(`[WineCardButtons] ❌ Errore: addMessage non disponibile (mobile: ${isMobile})`, 'error');
                                }
                            } else {
                                window.AppDebug?.log(`[WineCardButtons] ❌ Errore: Il server non ha risposto`, 'error');
                            }
                        } catch (error) {
                            window.AppDebug?.log(`[WineCardButtons] ❌ Errore invio movimento: ${error.message}`, 'error');
                        }
                    } else if (wineId || wineText) {
                        window.AppDebug?.log(
                            `[WineCardButtons] 🔍 Tipo azione: RICERCA INFO | Vino: "${wineText || wineId || 'N/A'}"`,
                            'info'
                        );
                        
                        const searchMessage = wineText || `Vino ID: ${wineId}`;
                        window.AppDebug?.log(`[WineCardButtons] 🔍 Messaggio ricerca costruito: "${searchMessage}"`, 'info');
                        
                        try {
                            window.AppDebug?.log('[WineCardButtons] Verifica ChatAPI disponibilità...', 'info');
                            if (!window.ChatAPI || !window.ChatAPI.sendMessage) {
                                throw new Error('ChatAPI.sendMessage non disponibile');
                            }
                            
                            window.AppDebug?.log('[WineCardButtons] ✅ ChatAPI disponibile, invio messaggio ricerca...', 'info');
                            const response = await window.ChatAPI.sendMessage(searchMessage);
                            
                            window.AppDebug?.log(`[WineCardButtons] ✅ Risposta ricerca ricevuta (hasMessage: ${!!response?.message}, isHtml: ${!!response?.is_html})`, 'success');
                            
                            if (response && response.message) {
                                const addMessage = isMobile 
                                    ? window.ChatMobile?.addMessage 
                                    : window.ChatDesktop?.addMessage;
                                
                                if (addMessage) {
                                    window.AppDebug?.log('[WineCardButtons] ✅ addMessage disponibile, aggiungo messaggi (user + AI)', 'success');
                                    addMessage('user', searchMessage);
                                    addMessage('ai', response.message, false, false, null, response.is_html);
                                    window.AppDebug?.log('[WineCardButtons] ✅ Messaggi aggiunti alla chat', 'success');
                                } else {
                                    window.AppDebug?.log(`[WineCardButtons] ❌ Errore: addMessage non disponibile (mobile: ${isMobile})`, 'error');
                                }
                            } else {
                                window.AppDebug?.log(`[WineCardButtons] ❌ Errore: Il server non ha risposto`, 'error');
                            }
                        } catch (error) {
                            window.AppDebug?.log(`[WineCardButtons] ❌ Errore ricerca vino: ${error.message}`, 'error');
                        }
                    }
                    
                    // Non fermare la propagazione - lascia che ChatMobile gestisca anche il suo handler se necessario
                    // Ma aggiungi un piccolo delay per assicurarsi che i nostri log appaiano
                }
            }
        }, true); // Usa capture phase per intercettare PRIMA di ChatMobile
    }
    
    // Avvia observer quando DOM è pronto
    function startAutoSetup() {
        // Setup event delegation
        setupEventDelegation();
        window.AppDebug?.log('[WineCardButtons] ✅ Event delegation attivo', 'success');
        // Cerca container chat mobile e desktop con più selettori
        const selectors = [
            '.mobileRoot .chat-messages',
            '.mobileRoot #chat-messages',
            '.chat-messages-mobile',
            '#chat-messages-mobile',
            '.desktopRoot .chat-messages',
            '.desktopRoot #chat-messages',
            '.chat-messages-desktop',
            '#chat-messages-desktop',
            '.chat-messages', // Generico
            '#chat-messages'  // Generico
        ];
        
        const containers = [];
        selectors.forEach(sel => {
            const found = document.querySelector(sel);
            if (found && !containers.includes(found)) {
                containers.push(found);
            }
        });
        
        window.AppDebug?.log(`[WineCardButtons] 🔍 Ricerca container chat: trovati ${containers.length} container`, 'info');
        
        if (containers.length > 0) {
            containers.forEach((container, idx) => {
                setupObserver.observe(container, {
                    childList: true,
                    subtree: true
                });
                window.AppDebug?.log(`[WineCardButtons] ✅ Observer attivo su container ${idx + 1}: ${container.className || container.id || 'sconosciuto'}`, 'success');
            });
        } else {
            window.AppDebug?.log('[WineCardButtons] ⚠️ Nessun container chat trovato, retry tra 500ms', 'warn');
            // Retry dopo 500ms se container non trovati
            setTimeout(startAutoSetup, 500);
        }
        
        // Setup anche su tutti i messaggi già presenti
        setTimeout(() => {
            const existingMessages = document.querySelectorAll('.chat-message');
            window.AppDebug?.log(`[WineCardButtons] 🔍 Setup messaggi esistenti: trovati ${existingMessages.length} messaggi`, 'info');
            existingMessages.forEach(msg => {
                if (!msg.dataset.wineButtonsSetup) {
                    const buttons = msg.querySelectorAll('.chat-button, .wines-list-item-button');
                    if (buttons && buttons.length > 0) {
                        window.AppDebug?.log(`[WineCardButtons] 🔍 Setup messaggio esistente con ${buttons.length} bottoni`, 'info');
                        setupWineCardMovementButtons(msg);
                        msg.dataset.wineButtonsSetup = 'true';
                    }
                }
            });
        }, 300);
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startAutoSetup);
    } else {
        setTimeout(startAutoSetup, 100);
    }
}


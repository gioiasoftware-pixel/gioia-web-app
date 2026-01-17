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
        const chatMessage = newBtn.dataset.chatMessage || newBtn.getAttribute('data-chat-message');
        const chatLabel = newBtn.dataset.chatLabel || newBtn.getAttribute('data-chat-label');
        
        const buttonInfo = {
            wineId,
            wineText: wineText?.substring(0, 30),
            movementType,
            quantity,
            hasMovementData: !!(movementType && quantity && wineId),
            hasChatMessage: !!chatMessage,
            chatLabel: chatLabel?.substring(0, 30),
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
            const clickChatMessage = newBtn.dataset.chatMessage || newBtn.getAttribute('data-chat-message');
            const clickChatLabel = newBtn.dataset.chatLabel || newBtn.getAttribute('data-chat-label');
            
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
            } else if (clickChatMessage) {
                window.AppDebug?.log(
                    `[WineCardButtons] ✅ Tipo azione: COMANDO CHAT | ${clickChatLabel || clickChatMessage}`,
                    'success'
                );
            } else {
                window.AppDebug?.log(
                    `[WineCardButtons] 🔍 Tipo azione: RICERCA INFO | Vino: "${clickWineText || clickWineId || 'N/A'}"`,
                    'info'
                );
            }
            
            if (clickChatMessage) {
                const displayLabel = clickChatLabel || clickChatMessage;

                window.AppDebug?.log(`[WineCardButtons] Chat action: ${displayLabel}`, 'info');

                try {
                    window.AppDebug?.log('[WineCardButtons] Verifica ChatAPI disponibilita...', 'info');

                    if (!window.ChatAPI || !window.ChatAPI.sendMessage) {
                        throw new Error('ChatAPI.sendMessage non disponibile');
                    }

                    const conversationId = (typeof window !== 'undefined' && window.currentConversationId) || null;
                    window.AppDebug?.log(`[WineCardButtons] Conversation ID: ${conversationId || 'N/A'}`, 'info');

                    window.AppDebug?.log('[WineCardButtons] Invio messaggio custom...', 'info');
                    const response = await window.ChatAPI.sendMessage(clickChatMessage, conversationId);

                    window.AppDebug?.log(`[WineCardButtons] Risposta ricevuta (hasMessage: ${!!response?.message}, isHtml: ${!!response?.is_html})`, 'success');

                    if (response && response.message) {
                        const addMessage = isMobile
                            ? window.ChatMobile?.addMessage
                            : window.ChatDesktop?.addMessage;

                        if (addMessage) {
                            addMessage('user', displayLabel);
                            addMessage('ai', response.message, false, false, null, response.is_html);
                        } else {
                            window.AppDebug?.log(`[WineCardButtons] Errore: addMessage non disponibile (mobile: ${isMobile})`, 'error');
                        }
                    } else {
                        window.AppDebug?.log(`[WineCardButtons] Errore: Il server non ha risposto (response: ${JSON.stringify(response)})`, 'error');
                    }
                } catch (error) {
                    console.error('[WineCardButtons] Errore invio messaggio custom:', error);
                    window.AppDebug?.log(`[WineCardButtons] Errore invio messaggio custom: ${error.message}`, 'error');
                    if (error.stack) {
                        window.AppDebug?.log(`[WineCardButtons] Stack: ${error.stack.substring(0, 200)}`, 'error');
                    }
                }
            } else if (clickMovementType && clickQuantity && clickWineId) {
                // Se è un pulsante di conferma movimento, processa direttamente
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
                    
                    // Recupera conversationId da variabili globali
                    const conversationId = (typeof window !== 'undefined' && window.currentConversationId) || null;
                    window.AppDebug?.log(`[WineCardButtons] Conversation ID: ${conversationId || 'N/A'}`, 'info');
                    
                    window.AppDebug?.log('[WineCardButtons] ✅ ChatAPI disponibile, invio messaggio...', 'info');
                    const response = await window.ChatAPI.sendMessage(message, conversationId);
                    
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
                    
                    // Recupera conversationId da variabili globali
                    const conversationId = (typeof window !== 'undefined' && window.currentConversationId) || null;
                    window.AppDebug?.log(`[WineCardButtons] Conversation ID: ${conversationId || 'N/A'}`, 'info');
                    
                    window.AppDebug?.log('[WineCardButtons] ✅ ChatAPI disponibile, invio messaggio ricerca...', 'info');
                    const response = await window.ChatAPI.sendMessage(searchMessage, conversationId);
                    
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

async function handleMobileActionEdit(buttonEl) {
    const wineId = buttonEl.dataset.wineId || buttonEl.getAttribute('data-wine-id');
    window.AppDebug?.log(`[WineCardButtons] 🖊️ Azione edit (mobile) wineId=${wineId || 'N/A'}`, 'info');
    const wineCard = buttonEl.closest('.wine-card');
    if (wineId && window.handleWineCardEdit && typeof window.handleWineCardEdit === 'function') {
        await window.handleWineCardEdit(wineCard, wineId);
        return;
    }
    window.AppDebug?.log('[WineCardButtons] ⚠️ handleWineCardEdit non disponibile', 'warn');
}

async function handleMobileActionDetails(buttonEl) {
    const wineId = buttonEl.dataset.wineId || buttonEl.getAttribute('data-wine-id');
    window.AppDebug?.log(`[WineCardButtons] 🍔 Azione dettagli (mobile) wineId=${wineId || 'N/A'}`, 'info');
    const isMobileLayout = window.LayoutBoundary?.isMobileNamespace() ||
        document.documentElement.classList.contains('mobileRoot');
    if (!isMobileLayout) {
        window.AppDebug?.log('[WineCardButtons] ❌ Bottone mobile cliccato su desktop', 'error');
        return;
    }

    const viewerPanel = document.getElementById('viewerPanel');
    const mobileLayout = document.getElementById('mobile-layout') || document.querySelector('.mobileRoot');
    const listScreen = document.getElementById('inventory-screen-list');
    const detailsScreen = document.getElementById('inventory-screen-details');
    const chartScreen = document.getElementById('inventory-screen-chart');

    if (!viewerPanel || !mobileLayout) {
        window.AppDebug?.log('[WineCardButtons] ❌ viewerPanel o mobileLayout non trovati', 'error');
        return;
    }

    if (listScreen) listScreen.classList.add('hidden');
    if (chartScreen) chartScreen.classList.add('hidden');
    if (detailsScreen) detailsScreen.classList.remove('hidden');

    viewerPanel.hidden = false;
    mobileLayout.classList.add('state-viewer');

    if (wineId && window.InventoryMobile && typeof window.InventoryMobile.showWineDetails === 'function') {
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        try {
            await window.InventoryMobile.showWineDetails(wineId);
        } catch (error) {
            window.AppDebug?.log(`[WineCardButtons] ❌ Errore in showWineDetails: ${error.message}`, 'error');
        }
        return;
    }

    window.AppDebug?.log('[WineCardButtons] ❌ InventoryMobile.showWineDetails non disponibile', 'error');
}

/**
 * Setup bottoni modifica e dettagli per wine card info su MOBILE
 * Logica completamente separata da desktop per evitare conflitti
 */
function setupWineCardInfoButtonsMobile(messageElement) {
    if (!messageElement) return;
    
    const isMobile = window.LayoutBoundary?.isMobileNamespace() || 
                     document.documentElement.classList.contains('mobileRoot');
    
    if (!isMobile) {
        window.AppDebug?.log('[WineCardButtons] ⏭️ setupWineCardInfoButtonsMobile: non è mobile, skip', 'warn');
        return; // Solo su mobile
    }

    // Nuovo redesign: i bottoni vengono creati dal WineCardTransformer.
    // Evita di aggiungere i bottoni "vecchi".
    if (window.WineCardTransformer) {
        window.AppDebug?.log('[WineCardButtons] ⏭️ setupWineCardInfoButtonsMobile: redesign attivo, skip bottoni legacy', 'info');
        return;
    }
    
    window.AppDebug?.log('[WineCardButtons] 📱 Setup bottoni info MOBILE', 'info');
    
    const wineCards = messageElement.querySelectorAll('.wine-card');
    
    wineCards.forEach((wineCard) => {
        // Evita setup multiplo
        if (wineCard.dataset.mobileRedesign === 'true') return;
        if (wineCard.dataset.infoButtonsSetup === 'true') return;
        
        const wineId = wineCard.dataset.wineId || wineCard.getAttribute('data-wine-id');
        if (!wineId) return;
        
        const header = wineCard.querySelector('.wine-card-header');
        if (!header) return;
        
        // Verifica se i bottoni esistono già
        let buttonsContainer = wineCard.querySelector('.wine-card-buttons-mobile');
        if (!buttonsContainer) {
            // Crea container bottoni
            buttonsContainer = document.createElement('div');
            buttonsContainer.className = 'wine-card-buttons-mobile';
            
            // Assicura che header sia position: relative per il posizionamento assoluto dei bottoni
            if (window.getComputedStyle(header).position === 'static') {
                header.style.position = 'relative';
            }
            
            header.appendChild(buttonsContainer);
        }
        
        // Crea bottone modifica (matita) - SOLO MOBILE
        const editButton = document.createElement('button');
        editButton.className = 'wine-card-button-mobile wine-card-button-edit';
        editButton.setAttribute('data-wine-id', wineId);
        editButton.setAttribute('data-layout', 'mobile'); // Flag per identificare che è mobile
        editButton.setAttribute('data-button-type', 'info-edit'); // Tipo bottone
        editButton.setAttribute('aria-label', 'Modifica vino');
        editButton.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12.75 2.25C13.05 1.95 13.5 1.95 13.8 2.25L15.75 4.2C16.05 4.5 16.05 4.95 15.75 5.25L8.325 12.675L5.25 13.5L6.075 10.425L13.5 3C13.8 2.7 14.25 2.7 14.55 3L12.75 2.25Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M11.25 3.75L14.25 6.75" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M3.75 15.75H15.75" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;
        
        // Crea bottone dettagli (hamburger) - SOLO MOBILE
        const menuButton = document.createElement('button');
        menuButton.className = 'wine-card-button-mobile wine-card-button-menu';
        menuButton.setAttribute('data-wine-id', wineId);
        menuButton.setAttribute('data-layout', 'mobile'); // Flag per identificare che è mobile
        menuButton.setAttribute('data-button-type', 'info-details'); // Tipo bottone
        menuButton.setAttribute('aria-label', 'Dettagli vino');
        menuButton.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 4.5H15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M3 9H15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M3 13.5H15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;
        
        // Gestione click bottone modifica - HANDLER MOBILE ISOLATO
        editButton.addEventListener('click', async (e) => {
            // Blocca completamente la propagazione per evitare conflitti
            e.stopPropagation();
            e.preventDefault();
            e.stopImmediatePropagation();
            
            // Marca il bottone per prevenire doppia gestione
            if (editButton.dataset.processing === 'true') {
                window.AppDebug?.log('[WineCardButtons] ⏭️ Edit button già in processing, skip', 'warn');
                return;
            }
            editButton.dataset.processing = 'true';
            setTimeout(() => { editButton.dataset.processing = 'false'; }, 1000);
            
            window.AppDebug?.log(`[WineCardButtons] 🖊️ Bottone modifica cliccato per vino ID: ${wineId}`, 'info');
            
            // Chiama funzione modifica se disponibile
            if (window.handleWineCardEdit) {
                await window.handleWineCardEdit(wineCard, wineId);
            } else {
                window.AppDebug?.log('[WineCardButtons] ⚠️ handleWineCardEdit non disponibile', 'warn');
                // Fallback: invia messaggio chat per modifica
                const searchMessage = `[wine_id:${wineId}]`;
                if (window.ChatAPI && window.ChatAPI.sendMessage) {
                    const conversationId = (typeof window !== 'undefined' && window.currentConversationId) || null;
                    try {
                        const response = await window.ChatAPI.sendMessage(`Modifica vino ${searchMessage}`, conversationId);
                        if (response && response.message) {
                            const addMessage = window.ChatMobile?.addMessage || window.ChatDesktop?.addMessage;
                            if (addMessage) {
                                addMessage('ai', response.message, false, false, null, response.is_html);
                            }
                        }
                    } catch (error) {
                        window.AppDebug?.log(`[WineCardButtons] ❌ Errore modifica vino: ${error.message}`, 'error');
                    }
                }
            }
        });
        
        // Gestione click bottone dettagli (hamburger) - HANDLER MOBILE ISOLATO
        // IMPORTANTE: Usa capture phase per intercettare PRIMA dell'event delegation
        menuButton.addEventListener('click', async (e) => {
            window.AppDebug?.log(`[WineCardButtons] 🍔🍔🍔 CLICK BOTTONE HAMBURGER - INIZIO (capture)`, 'info');
            window.AppDebug?.log(`[WineCardButtons] WineId: ${wineId}`, 'info');
            window.AppDebug?.log(`[WineCardButtons] Event: ${e.type}, target: ${e.target.tagName}, currentTarget: ${e.currentTarget?.tagName}`, 'info');
            
            // Verifica layout PRIMA di bloccare eventi
            const isMobileLayout = window.LayoutBoundary?.isMobileNamespace() || 
                                 document.documentElement.classList.contains('mobileRoot');
            window.AppDebug?.log(`[WineCardButtons] Layout verificato: ${isMobileLayout ? 'MOBILE' : 'DESKTOP'}`, isMobileLayout ? 'info' : 'error');
            
            if (!isMobileLayout) {
                window.AppDebug?.log('[WineCardButtons] ❌ ERRORE: Bottone mobile cliccato su desktop! Skip', 'error');
                return;
            }
            
            // Blocca completamente la propagazione PER PRIMO (capture phase)
            // Questo previene che l'event delegation o altri handler processino il click
            e.stopPropagation();
            e.preventDefault();
            e.stopImmediatePropagation();
            window.AppDebug?.log('[WineCardButtons] ✅ Eventi bloccati PRIMA di altri handler (stopPropagation, preventDefault, stopImmediatePropagation)', 'success');
            
            // Marca il bottone per prevenire doppia gestione
            if (menuButton.dataset.processing === 'true') {
                window.AppDebug?.log('[WineCardButtons] ⏭️ Menu button già in processing, skip', 'warn');
                return;
            }
            menuButton.dataset.processing = 'true';
            setTimeout(() => { menuButton.dataset.processing = 'false'; }, 1000);
            
            window.AppDebug?.log(`[WineCardButtons] 🍔 Bottone dettagli cliccato per vino ID: ${wineId}`, 'info');
            
            // Apri schermata inventario mobile se non è già aperta
            window.AppDebug?.log('[WineCardButtons] 🔍 Cercando viewerPanel e mobileLayout...', 'info');
            const viewerPanel = document.getElementById('viewerPanel');
            const mobileLayout = document.getElementById('mobile-layout') || document.querySelector('.mobileRoot');
            
            window.AppDebug?.log(`[WineCardButtons] viewerPanel trovato: ${!!viewerPanel}, hidden: ${viewerPanel?.hidden}`, viewerPanel ? 'info' : 'error');
            window.AppDebug?.log(`[WineCardButtons] mobileLayout trovato: ${!!mobileLayout}`, mobileLayout ? 'info' : 'error');
            
            if (viewerPanel && mobileLayout) {
                window.AppDebug?.log('[WineCardButtons] ✅ Elementi trovati, procedo con apertura', 'success');
                // Assicurati che la schermata dettagli sia quella che verrà mostrata
                // Nascondi la lista PRIMA di aprire il viewerPanel (previene che initInventoryMobile mostri la lista)
                const listScreen = document.getElementById('inventory-screen-list');
                const detailsScreen = document.getElementById('inventory-screen-details');
                const chartScreen = document.getElementById('inventory-screen-chart');
                
                window.AppDebug?.log('[WineCardButtons] 🔍 Verifica schermate...', 'info');
                window.AppDebug?.log(`[WineCardButtons] listScreen: ${!!listScreen}, hidden: ${listScreen?.classList.contains('hidden')}`, 'info');
                window.AppDebug?.log(`[WineCardButtons] detailsScreen: ${!!detailsScreen}, hidden: ${detailsScreen?.classList.contains('hidden')}`, 'info');
                window.AppDebug?.log(`[WineCardButtons] chartScreen: ${!!chartScreen}, hidden: ${chartScreen?.classList.contains('hidden')}`, 'info');
                
                // NASCONDI lista e chart PRIMA di aprire viewerPanel
                if (listScreen) {
                    listScreen.classList.add('hidden');
                    window.AppDebug?.log('[WineCardButtons] ✅ Lista inventario nascosta', 'success');
                } else {
                    window.AppDebug?.log('[WineCardButtons] ❌ listScreen non trovato!', 'error');
                }
                if (chartScreen) {
                    chartScreen.classList.add('hidden');
                    window.AppDebug?.log('[WineCardButtons] ✅ Chart nascosto', 'info');
                }
                // Mostra esplicitamente details screen PRIMA
                if (detailsScreen) {
                    detailsScreen.classList.remove('hidden');
                    window.AppDebug?.log('[WineCardButtons] ✅ Schermata dettagli mostrata PRIMA di aprire viewerPanel', 'success');
                } else {
                    window.AppDebug?.log('[WineCardButtons] ❌ detailsScreen non trovato!', 'error');
                }
                
                // POI mostra viewerPanel e attiva state-viewer
                window.AppDebug?.log(`[WineCardButtons] Aprendo viewerPanel (hidden prima: ${viewerPanel.hidden})...`, 'info');
                viewerPanel.hidden = false;
                mobileLayout.classList.add('state-viewer');
                window.AppDebug?.log(`[WineCardButtons] viewerPanel hidden dopo: ${viewerPanel.hidden}`, 'info');
                window.AppDebug?.log(`[WineCardButtons] state-viewer classe presente: ${mobileLayout.classList.contains('state-viewer')}`, 'info');
                
                window.AppDebug?.log('[WineCardButtons] ✅ ViewerPanel aperto con schermata dettagli già attiva', 'success');
            } else {
                window.AppDebug?.log('[WineCardButtons] ❌ ERRORE: viewerPanel o mobileLayout non trovati!', 'error');
            }
            
            // Naviga alla pagina dettagli vino mobile
            window.AppDebug?.log('[WineCardButtons] 🔍 Verifica InventoryMobile.showWineDetails...', 'info');
            window.AppDebug?.log(`[WineCardButtons] InventoryMobile disponibile: ${!!window.InventoryMobile}`, 'info');
            window.AppDebug?.log(`[WineCardButtons] showWineDetails funzione disponibile: ${!!(window.InventoryMobile && typeof window.InventoryMobile.showWineDetails === 'function')}`, 'info');
            
            if (window.InventoryMobile && typeof window.InventoryMobile.showWineDetails === 'function') {
                window.AppDebug?.log('[WineCardButtons] ⏳ Aspetto frame per assicurarmi che viewerPanel sia visibile...', 'info');
                // Aspetta un frame per assicurarsi che il viewerPanel sia visibile
                await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                
                window.AppDebug?.log('[WineCardButtons] ✅ Frame completato, procedo con showWineDetails', 'info');
                
                // IMPORTANTE: Mostra esplicitamente la schermata dettagli PRIMA di chiamare showWineDetails
                // Questo previene che loadInventory() o altri handler mostrino la lista
                if (detailsScreen) {
                    detailsScreen.classList.remove('hidden');
                    window.AppDebug?.log('[WineCardButtons] ✅ Schermata dettagli esplicitamente mostrata PRIMA di showWineDetails', 'success');
                }
                
                window.AppDebug?.log(`[WineCardButtons] 🚀 CHIAMATA showWineDetails(${wineId})`, 'info');
                try {
                    // showWineDetails chiamerà showInventoryScreen('details') internamente, ma è già fatto sopra
                    await window.InventoryMobile.showWineDetails(wineId);
                    window.AppDebug?.log(`[WineCardButtons] ✅ showWineDetails(${wineId}) completata`, 'success');
                } catch (error) {
                    window.AppDebug?.log(`[WineCardButtons] ❌ Errore in showWineDetails: ${error.message}`, 'error');
                    window.AppDebug?.log(`[WineCardButtons] Stack: ${error.stack}`, 'error');
                }
            } else {
                window.AppDebug?.log('[WineCardButtons] ❌ InventoryMobile.showWineDetails non disponibile!', 'error');
                // Fallback: naviga direttamente senza inviare messaggio chat
                // Per evitare che venga aggiunto un messaggio con wine card che apre il viewer desktop
                window.AppDebug?.log('[WineCardButtons] ⚠️ Fallback: non disponibile - apri manualmente dettagli vino', 'error');
            }
            
            window.AppDebug?.log(`[WineCardButtons] 🍔🍔🍔 CLICK BOTTONE HAMBURGER - FINE`, 'info');
        }, true); // IMPORTANTE: usa capture phase per intercettare PRIMA
        
        // Aggiungi bottoni al container (solo se non esistono già)
        if (!buttonsContainer.querySelector('.wine-card-button-edit')) {
            buttonsContainer.appendChild(editButton);
        }
        if (!buttonsContainer.querySelector('.wine-card-button-menu')) {
            buttonsContainer.appendChild(menuButton);
        }
        
        wineCard.dataset.infoButtonsSetup = 'true';
        window.AppDebug?.log(`[WineCardButtons] ✅ Bottoni info aggiunti a wine card ID: ${wineId}`, 'success');
    });
}

/**
 * Setup bottoni modifica e dettagli per wine card info su DESKTOP
 * Logica completamente separata da mobile
 */
function setupWineCardInfoButtonsDesktop(messageElement) {
    if (!messageElement) return;
    
    const isMobile = window.LayoutBoundary?.isMobileNamespace() || 
                     document.documentElement.classList.contains('mobileRoot');
    
    if (isMobile) {
        window.AppDebug?.log('[WineCardButtons] ⏭️ setupWineCardInfoButtonsDesktop: è mobile, skip', 'warn');
        return; // Solo su desktop
    }
    
    window.AppDebug?.log('[WineCardButtons] 🖥️ Setup bottoni info DESKTOP', 'info');
    // TODO: Implementa logica desktop se necessaria
}

/**
 * Wrapper che chiama la funzione corretta in base al layout
 */
function setupWineCardInfoButtons(messageElement) {
    const isMobile = window.LayoutBoundary?.isMobileNamespace() || 
                     document.documentElement.classList.contains('mobileRoot');
    
    if (isMobile) {
        setupWineCardInfoButtonsMobile(messageElement);
    } else {
        setupWineCardInfoButtonsDesktop(messageElement);
    }
}

// Export per uso globale
if (typeof window !== 'undefined') {
    window.WineCardButtons = {
        setup: setupWineCardMovementButtons,
        setupInfoButtons: setupWineCardInfoButtons,
        setupInfoButtonsMobile: setupWineCardInfoButtonsMobile,
        setupInfoButtonsDesktop: setupWineCardInfoButtonsDesktop
    };
    
    // Auto-setup quando vengono aggiunti messaggi HTML con bottoni
    // Observer per rilevare nuovi messaggi HTML aggiunti al DOM
    const setupObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) { // Element node
                    // Cerca bottoni wine card nei nuovi nodi
                    const buttons = node.querySelectorAll?.('.chat-button, .wines-list-item-button');
                    const wineCards = node.querySelectorAll?.('.wine-card');
                    
                    // Se ci sono wine cards, setup bottoni info
                    if (wineCards && wineCards.length > 0) {
                        let messageElement = node;
                        if (!messageElement.classList?.contains('chat-message')) {
                            messageElement = node.closest?.('.chat-message') || 
                                           node.querySelector?.('.chat-message') ||
                                           (node.parentElement?.closest?.('.chat-message'));
                        }
                        if (messageElement) {
                            setTimeout(() => {
                                setupWineCardInfoButtons(messageElement);
                            }, 100);
                        }
                    }
                    
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
                                    setupWineCardInfoButtons(messageElement); // Setup anche bottoni info su mobile
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
                                        setupWineCardInfoButtons(node); // Setup anche bottoni info su mobile
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
        // USA CAPTURE PHASE per intercettare PRIMA degli handler diretti
        document.addEventListener('click', async (e) => {
            window.AppDebug?.log(`[WineCardButtons] 🎯🎯🎯 EVENT DELEGATION - INIZIO (capture phase)`, 'info');
            window.AppDebug?.log(`[WineCardButtons] Target: ${e.target?.tagName}, className: ${e.target?.className}`, 'info');
            
            // ESCLUDI COMPLETAMENTE bottoni mobile info - hanno handler diretti isolati
            // Controlla PRIMA se è un bottone mobile info (edit o menu/hamburger)
            const clickedButton = e.target.closest?.('.wine-card-action-btn, .wine-card-button-mobile, .chat-button, .wines-list-item-button');
            if (clickedButton) {
                window.AppDebug?.log(`[WineCardButtons] 🎯 Event delegation: bottone trovato, verifica esclusione...`, 'info');
                window.AppDebug?.log(`[WineCardButtons]   - classe: ${clickedButton.className}`, 'info');
                window.AppDebug?.log(`[WineCardButtons]   - data-layout: ${clickedButton.dataset.layout}`, 'info');
                window.AppDebug?.log(`[WineCardButtons]   - data-button-type: ${clickedButton.dataset.buttonType}`, 'info');
                window.AppDebug?.log(`[WineCardButtons]   - contiene wine-card-button-edit: ${clickedButton.classList.contains('wine-card-button-edit')}`, 'info');
                window.AppDebug?.log(`[WineCardButtons]   - contiene wine-card-button-menu: ${clickedButton.classList.contains('wine-card-button-menu')}`, 'info');
                
                // ESCLUDI se è un bottone mobile info (edit o menu/hamburger/inventory)
                // Controlla sia per data attributes che per classi
                const isMobileInfoButton = 
                    (clickedButton.dataset.layout === 'mobile' && clickedButton.dataset.buttonType) ||
                    clickedButton.classList.contains('wine-card-action-edit') ||
                    clickedButton.classList.contains('wine-card-action-details') ||
                    clickedButton.classList.contains('wine-card-button-edit') ||
                    clickedButton.classList.contains('wine-card-button-menu') ||
                    clickedButton.classList.contains('wine-card-button-inventory'); // Bottone hamburger/inventory
                
                if (isMobileInfoButton) {
                    window.AppDebug?.log('[WineCardButtons] ✅ Click su bottone mobile info (nuovi bottoni), gestione diretta', 'info');
                    e.stopPropagation();
                    e.preventDefault();
                    e.stopImmediatePropagation();

                    if (clickedButton.classList.contains('wine-card-action-edit')) {
                        await handleMobileActionEdit(clickedButton);
                        return;
                    }
                    if (clickedButton.classList.contains('wine-card-action-details')) {
                        await handleMobileActionDetails(clickedButton);
                        return;
                    }

                    // fallback per eventuali bottoni legacy
                    return;
                } else {
                    window.AppDebug?.log('[WineCardButtons] ✅ Bottone NON è mobile info, procedo con delegation', 'info');
                }
            } else {
                window.AppDebug?.log(`[WineCardButtons] ⚠️ Nessun bottone wine card trovato nel click`, 'info');
            }

            const downloadButton = e.target.closest?.('[data-movements-download]');
            if (downloadButton) {
                e.stopPropagation();
                e.preventDefault();

                const card = downloadButton.closest('.movements-period-card');
                const startDate = downloadButton.dataset.startDate || card?.dataset?.startDate;
                const endDate = downloadButton.dataset.endDate || card?.dataset?.endDate;
                const periodLabel = downloadButton.dataset.periodLabel || card?.dataset?.periodLabel || 'periodo';

                const token =
                    (typeof window !== 'undefined' && window.authToken) ||
                    (typeof authToken !== 'undefined' ? authToken : null) ||
                    localStorage.getItem('authToken') ||
                    localStorage.getItem('auth_token') ||
                    sessionStorage.getItem('authToken') ||
                    sessionStorage.getItem('auth_token');
                const apiUrl = (typeof window !== 'undefined' && window.API_BASE_URL) ||
                    (typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : null);

                if (!token || !apiUrl) {
                    window.AppDebug?.log('[WineCardButtons] Token o API_BASE_URL non disponibili per download PDF', 'error');
                    return;
                }

                if (!startDate || !endDate) {
                    window.AppDebug?.log('[WineCardButtons] Date periodo non disponibili per download PDF', 'error');
                    return;
                }

                const safeLabel = periodLabel.replace(/[^a-z0-9_-]+/gi, '_');
                const filename = `report_movimenti_${safeLabel}.pdf`;
                const url = `${apiUrl}/api/reports/movements/pdf?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}&period_label=${encodeURIComponent(periodLabel)}`;

                try {
                    const response = await fetch(url, {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });

                    if (!response.ok) {
                        const errorText = await response.text().catch(() => '');
                        throw new Error(`Errore download PDF: ${response.status} ${errorText ? `- ${errorText.substring(0, 100)}` : ''}`);
                    }

                    const blob = await response.blob();
                    const blobUrl = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = blobUrl;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    URL.revokeObjectURL(blobUrl);
                } catch (error) {
                    console.error('[WineCardButtons] Errore download PDF:', error);
                    window.AppDebug?.log(`[WineCardButtons] Errore download PDF: ${error.message}`, 'error');
                }
                return;
            }
            
            // Cerca se il click è su un bottone wine card
            const button = e.target.closest?.('.chat-button, .wines-list-item-button');
            if (button && (button.classList.contains('wines-list-item-button') || button.classList.contains('chat-button'))) {
                const isMobile = window.LayoutBoundary?.isMobileNamespace() ||
                    document.documentElement.classList.contains('mobileRoot');
                const wineId = button.dataset.wineId || button.getAttribute('data-wine-id');
                const wineText = button.dataset.wineText || button.getAttribute('data-wine-text');
                const movementType = button.dataset.movementType || button.getAttribute('data-movement-type');
                const quantity = button.dataset.quantity || button.getAttribute('data-quantity');
                const chatMessage = button.dataset.chatMessage || button.getAttribute('data-chat-message');
                const chatLabel = button.dataset.chatLabel || button.getAttribute('data-chat-label');
                const datePickerAction = button.dataset.chatDatePicker || button.getAttribute('data-chat-date-picker');

                if (datePickerAction) {
                    const card = button.closest('.movements-period-card') || button.closest('.wine-card');
                    const day = card?.querySelector('[data-chat-date-part="day"]')?.value;
                    const month = card?.querySelector('[data-chat-date-part="month"]')?.value;
                    const year = card?.querySelector('[data-chat-date-part="year"]')?.value;

                    if (!day || !month || !year) {
                        window.AppDebug?.log('[WineCardButtons] Seleziona giorno, mese e anno prima di confermare', 'warn');
                        return;
                    }

                    const formattedDate = `${day}/${month}/${year}`;
                    e.stopPropagation();
                    e.preventDefault();

                    try {
                        if (!window.ChatAPI || !window.ChatAPI.sendMessage) {
                            throw new Error('ChatAPI.sendMessage non disponibile');
                        }

                        const conversationId = (typeof window !== 'undefined' && window.currentConversationId) || null;
                        const response = await window.ChatAPI.sendMessage(formattedDate, conversationId);

                        if (response && response.message) {
                            const addMessage = isMobile
                                ? window.ChatMobile?.addMessage
                                : window.ChatDesktop?.addMessage;
                            if (addMessage) {
                                addMessage('user', `Data: ${formattedDate}`);
                                addMessage('ai', response.message, false, false, null, response.is_html);
                            }
                        }
                    } catch (error) {
                        console.error('[WineCardButtons] Errore invio data specifica:', error);
                        window.AppDebug?.log(`[WineCardButtons] Errore invio data specifica: ${error.message}`, 'error');
                    }
                    return;
                }

                // Fallback: gestione bottoni overview inventario anche senza setup
                if (chatMessage) {
                    const displayLabel = chatLabel || chatMessage;
                    e.stopPropagation();
                    e.preventDefault();

                    try {
                        if (!window.ChatAPI || !window.ChatAPI.sendMessage) {
                            throw new Error('ChatAPI.sendMessage non disponibile');
                        }

                        const conversationId = (typeof window !== 'undefined' && window.currentConversationId) || null;
                        const response = await window.ChatAPI.sendMessage(chatMessage, conversationId);

                        if (response && response.message) {
                            const addMessage = isMobile
                                ? window.ChatMobile?.addMessage
                                : window.ChatDesktop?.addMessage;
                            if (addMessage) {
                                addMessage('user', displayLabel);
                                addMessage('ai', response.message, false, false, null, response.is_html);
                            }
                        }
                    } catch (error) {
                        console.error('[WineCardButtons] Errore invio messaggio custom (delegation):', error);
                        window.AppDebug?.log(`[WineCardButtons] Errore invio messaggio custom (delegation): ${error.message}`, 'error');
                    }
                    return;
                }
                
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
                    
                    // Verifica se il click è già stato gestito (evita doppia gestione)
                    if (button.dataset.clickHandled === 'true') {
                        window.AppDebug?.log('[WineCardButtons] ⏭️ Click già gestito, skip', 'warn');
                        return;
                    }
                    
                    // Marca come gestito PRIMA di processare (evita race condition)
                    button.dataset.clickHandled = 'true';
                    
                    // Ferma la propagazione per evitare che ChatMobile gestisca anche questo click
                    e.stopPropagation();
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    
                    // Reset flag dopo 500ms (permetti nuovo click)
                    setTimeout(() => {
                        button.dataset.clickHandled = 'false';
                    }, 500);
                    
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
                            
                            // Recupera conversationId da variabili globali
                            const conversationId = (typeof window !== 'undefined' && window.currentConversationId) || null;
                            window.AppDebug?.log(`[WineCardButtons] Conversation ID: ${conversationId || 'N/A'}`, 'info');
                            
                            window.AppDebug?.log('[WineCardButtons] ✅ ChatAPI disponibile, invio messaggio...', 'info');
                            const response = await window.ChatAPI.sendMessage(message, conversationId);
                            
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
                        
                        // Usa direttamente wineId se disponibile (ricerca più veloce e precisa)
                        // Formato: [wine_id:123] per ricerca diretta per ID
                        let searchMessage;
                        if (wineId) {
                            // Usa formato speciale per ricerca per ID (più veloce)
                            searchMessage = `[wine_id:${wineId}]`;
                            window.AppDebug?.log(`[WineCardButtons] 🔍 Ricerca per ID: ${wineId} (formato rapido)`, 'info');
                        } else {
                            // Fallback: usa wineText se non abbiamo ID
                            searchMessage = wineText || 'Vino';
                            window.AppDebug?.log(`[WineCardButtons] 🔍 Ricerca per nome: "${searchMessage}" (fallback)`, 'info');
                        }
                        window.AppDebug?.log(`[WineCardButtons] 🔍 Messaggio ricerca costruito: "${searchMessage}"`, 'info');
                        
                        try {
                            window.AppDebug?.log('[WineCardButtons] Verifica ChatAPI disponibilità...', 'info');
                            if (!window.ChatAPI || !window.ChatAPI.sendMessage) {
                                throw new Error('ChatAPI.sendMessage non disponibile');
                            }
                            
                            // Recupera conversationId da variabili globali
                            const conversationId = (typeof window !== 'undefined' && window.currentConversationId) || null;
                            window.AppDebug?.log(`[WineCardButtons] Conversation ID: ${conversationId || 'N/A'}`, 'info');
                            
                            window.AppDebug?.log('[WineCardButtons] ✅ ChatAPI disponibile, invio messaggio ricerca...', 'info');
                            const response = await window.ChatAPI.sendMessage(searchMessage, conversationId);
                            
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
            
            window.AppDebug?.log(`[WineCardButtons] 🎯🎯🎯 EVENT DELEGATION - FINE`, 'info');
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
                        setupWineCardInfoButtons(msg); // Setup anche bottoni info
                        msg.dataset.wineButtonsSetup = 'true';
                    }
                }
                
                // Setup anche wine cards info senza bottoni movimento
                const wineCards = msg.querySelectorAll('.wine-card');
                if (wineCards && wineCards.length > 0) {
                    setupWineCardInfoButtons(msg);
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


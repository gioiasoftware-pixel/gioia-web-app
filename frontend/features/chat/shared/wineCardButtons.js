/**
 * Wine Card Buttons - Gestione bottoni wine cards (mobile e desktop)
 * Funzioni condivise per setup e gestione click bottoni wine cards
 */

/**
 * Mostra popup di test per feedback visivo
 */
function showWineCardTestPopup(title, message, type = 'info') {
    // Crea popup temporaneo
    const popup = document.createElement('div');
    popup.className = 'wine-card-test-popup';
    popup.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 99999;
        font-size: 14px;
        font-weight: 500;
        max-width: 90%;
        text-align: center;
        animation: slideDownPopup 0.3s ease-out;
        pointer-events: none;
    `;
    
    popup.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 4px;">${title}</div>
        <div style="font-size: 12px; opacity: 0.9;">${message}</div>
    `;
    
    // Aggiungi animazione CSS se non esiste
    if (!document.getElementById('wine-card-popup-style')) {
        const style = document.createElement('style');
        style.id = 'wine-card-popup-style';
        style.textContent = `
            @keyframes slideDownPopup {
                from {
                    opacity: 0;
                    transform: translateX(-50%) translateY(-20px);
                }
                to {
                    opacity: 1;
                    transform: translateX(-50%) translateY(0);
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(popup);
    
    // Rimuovi dopo 3 secondi
    setTimeout(() => {
        popup.style.animation = 'slideDownPopup 0.3s ease-out reverse';
        setTimeout(() => {
            if (popup.parentNode) {
                popup.remove();
            }
        }, 300);
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
                isMobile
            });
            
            // Leggi data attributes al momento del click (per sicurezza)
            const clickWineId = newBtn.dataset.wineId || newBtn.getAttribute('data-wine-id');
            const clickWineText = newBtn.dataset.wineText || newBtn.getAttribute('data-wine-text');
            const clickMovementType = newBtn.dataset.movementType || newBtn.getAttribute('data-movement-type');
            const clickQuantity = newBtn.dataset.quantity || newBtn.getAttribute('data-quantity');
            
            // MOSTRA POPUP DI TEST
            if (clickMovementType && clickQuantity && clickWineId) {
                showWineCardTestPopup(
                    '✅ Movimento rilevato',
                    `${clickMovementType} di ${clickQuantity} bottiglie per vino ID: ${clickWineId}`,
                    'success'
                );
            } else {
                showWineCardTestPopup(
                    '✅ Click rilevato',
                    `Ricerca info per: ${clickWineText || 'vino'}`,
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


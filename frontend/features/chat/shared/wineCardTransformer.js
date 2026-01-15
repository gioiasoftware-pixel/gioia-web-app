/**
 * Wine Card Transformer - Trasforma wine cards HTML per mobile
 * 
 * Trasforma le wine cards generate dal backend in versioni mobile-specific
 * con bottoni e handler completamente isolati da desktop.
 * 
 * INTERCETTAZIONE: Intercetta addChatMessage per trasformare HTML automaticamente su mobile
 */

// Intercetta addChatMessage se esiste globalmente
let originalAddChatMessage = null;
if (typeof window !== 'undefined' && typeof window.addChatMessage === 'function') {
    originalAddChatMessage = window.addChatMessage;
    window.addChatMessage = function(role, content, isLoading, isError, wineData, isHtml) {
        // Se è HTML e siamo su mobile, trasforma prima
        if (isHtml && role === 'ai') {
            const isMobile = window.LayoutBoundary?.isMobileNamespace() || 
                           document.documentElement.classList.contains('mobileRoot');
            if (isMobile && window.WineCardTransformer) {
                content = window.WineCardTransformer.transformForMobile(content);
            }
        }
        // Chiama funzione originale
        return originalAddChatMessage(role, content, isLoading, isError, wineData, isHtml);
    };
    window.AppDebug?.log('[WineCardTransformer] ✅ addChatMessage intercettato', 'success');
}

/**
 * Trasforma wine cards HTML da formato backend a formato mobile
 * @param {string} htmlContent - HTML content con wine cards
 * @returns {string} - HTML trasformato per mobile (o originale se desktop)
 */
function transformWineCardsForMobile(htmlContent) {
    window.AppDebug?.log('[WineCardTransformer] 🔄 Trasformazione wine cards per mobile', 'info');
    
    // Se non siamo su mobile, ritorna HTML originale
    const isMobile = window.LayoutBoundary?.isMobileNamespace() || 
                     document.documentElement.classList.contains('mobileRoot');
    
    if (!isMobile) {
        window.AppDebug?.log('[WineCardTransformer] ⏭️ Non è mobile, ritorno HTML originale', 'info');
        return htmlContent;
    }
    
    window.AppDebug?.log('[WineCardTransformer] 📱 Layout mobile rilevato, procedo con trasformazione', 'info');
    
    // Usa un div temporaneo per parsare e modificare HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    
    // Trova tutte le wine cards
    const wineCards = tempDiv.querySelectorAll('.wine-card');
    window.AppDebug?.log(`[WineCardTransformer] Trovate ${wineCards.length} wine cards da trasformare`, 'info');
    
    wineCards.forEach((wineCard, index) => {
        const wineId = wineCard.getAttribute('data-wine-id');
        if (!wineId) {
            window.AppDebug?.log(`[WineCardTransformer] ⚠️ Wine card ${index + 1} senza data-wine-id, skip`, 'warn');
            return;
        }
        
        window.AppDebug?.log(`[WineCardTransformer] 🔄 Trasformazione wine card ${index + 1} (ID: ${wineId})`, 'info');
        
        // Aggiungi classe mobile-specific per identificazione
        wineCard.classList.add('wine-card-mobile');
        
        // Aggiungi container bottoni mobile se non esiste già
        const header = wineCard.querySelector('.wine-card-header');
        if (!header) {
            window.AppDebug?.log(`[WineCardTransformer] ⚠️ Wine card ${index + 1} senza header, skip bottoni`, 'warn');
            return;
        }
        
        // Verifica se i bottoni esistono già (per evitare duplicati)
        if (header.querySelector('.wine-card-buttons-mobile')) {
            window.AppDebug?.log(`[WineCardTransformer] ⏭️ Wine card ${index + 1} ha già bottoni mobile, skip`, 'info');
            return;
        }
        
        // Crea container bottoni
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'wine-card-buttons-mobile';
        
        // Crea bottone edit
        const editBtn = createMobileEditButton(wineId);
        // Crea bottone hamburger/inventory
        const inventoryBtn = createMobileInventoryButton(wineId);
        
        buttonsContainer.appendChild(editBtn);
        buttonsContainer.appendChild(inventoryBtn);
        
        // Assicura che header sia position: relative per posizionamento assoluto
        if (window.getComputedStyle(header).position === 'static') {
            header.style.position = 'relative';
        }
        
        header.appendChild(buttonsContainer);
        window.AppDebug?.log(`[WineCardTransformer] ✅ Bottoni mobile aggiunti a wine card ${index + 1}`, 'success');
    });
    
    // Ritorna HTML trasformato
    const transformedHtml = tempDiv.innerHTML;
    window.AppDebug?.log(`[WineCardTransformer] ✅ Trasformazione completata`, 'success');
    return transformedHtml;
}

/**
 * Crea bottone edit per mobile
 */
function createMobileEditButton(wineId) {
    const btn = document.createElement('button');
    btn.className = 'wine-card-button-mobile wine-card-button-edit';
    btn.setAttribute('data-wine-id', wineId);
    btn.setAttribute('data-layout', 'mobile');
    btn.setAttribute('data-button-type', 'info-edit');
    btn.setAttribute('aria-label', 'Modifica vino');
    
    btn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12.75 2.25C13.05 1.95 13.5 1.95 13.8 2.25L15.75 4.2C16.05 4.5 16.05 4.95 15.75 5.25L8.325 12.675L5.25 13.5L6.075 10.425L13.5 3C13.8 2.7 14.25 2.7 14.55 3L12.75 2.25Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M11.25 3.75L14.25 6.75" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M3.75 15.75H15.75" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
    `;
    
    // Handler diretto isolato (capture phase)
    btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();
        e.stopImmediatePropagation();

        window.AppDebug?.log(
            `[WineCardTransformer] 🧭 AZIONE: EDIT (mobile) wineId=${wineId}`,
            'info'
        );
        
        window.AppDebug?.log(`[WineCardTransformer] 🖊️ Bottone edit cliccato (ID: ${wineId})`, 'info');
        
        // Chiama funzione modifica se disponibile
        const wineCard = e.target.closest('.wine-card');
        if (window.handleWineCardEdit && typeof window.handleWineCardEdit === 'function') {
            await window.handleWineCardEdit(wineCard, wineId);
        } else {
            window.AppDebug?.log('[WineCardTransformer] ⚠️ handleWineCardEdit non disponibile', 'warn');
        }
    }, true); // Capture phase
    
    return btn;
}

/**
 * Crea bottone hamburger/inventory per mobile
 * Questo bottone apre direttamente il viewer mobile con dettagli vino
 */
function createMobileInventoryButton(wineId) {
    const btn = document.createElement('button');
    btn.className = 'wine-card-button-mobile wine-card-button-inventory';
    btn.setAttribute('data-wine-id', wineId);
    btn.setAttribute('data-layout', 'mobile');
    btn.setAttribute('data-button-type', 'info-details');
    btn.setAttribute('aria-label', 'Dettagli vino');
    
    btn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 4.5H15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M3 9H15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M3 13.5H15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
    `;
    
    // Handler diretto isolato (capture phase) - NON invia messaggi alla chat
    btn.addEventListener('click', async (e) => {
        window.AppDebug?.log(`[WineCardTransformer] 🍔🍔🍔 BOTTONE INVENTORY CLICK - INIZIO (ID: ${wineId})`, 'info');
        
        // Blocca completamente la propagazione PER PRIMO (capture phase)
        e.stopPropagation();
        e.preventDefault();
        e.stopImmediatePropagation();
        
        window.AppDebug?.log('[WineCardTransformer] ✅ Eventi bloccati PRIMA di altri handler', 'success');

        window.AppDebug?.log(
            `[WineCardTransformer] 🧭 AZIONE: DETTAGLI (mobile) wineId=${wineId}`,
            'info'
        );
        
        // Verifica layout
        const isMobileLayout = window.LayoutBoundary?.isMobileNamespace() || 
                             document.documentElement.classList.contains('mobileRoot');
        
        if (!isMobileLayout) {
            window.AppDebug?.log('[WineCardTransformer] ❌ ERRORE: Bottone mobile cliccato su desktop!', 'error');
            return;
        }
        
        // Prepara schermate
        const viewerPanel = document.getElementById('viewerPanel');
        const mobileLayout = document.getElementById('mobile-layout') || document.querySelector('.mobileRoot');
        const listScreen = document.getElementById('inventory-screen-list');
        const detailsScreen = document.getElementById('inventory-screen-details');
        const chartScreen = document.getElementById('inventory-screen-chart');
        
        window.AppDebug?.log(`[WineCardTransformer] Elementi trovati: viewerPanel=${!!viewerPanel}, mobileLayout=${!!mobileLayout}`, 'info');
        
        if (!viewerPanel || !mobileLayout) {
            window.AppDebug?.log('[WineCardTransformer] ❌ viewerPanel o mobileLayout non trovati', 'error');
            return;
        }
        
        // NASCONDI lista e chart PRIMA di aprire viewerPanel
        if (listScreen) {
            listScreen.classList.add('hidden');
            window.AppDebug?.log('[WineCardTransformer] ✅ Lista inventario nascosta', 'info');
        }
        if (chartScreen) {
            chartScreen.classList.add('hidden');
        }
        
        // Mostra esplicitamente details screen PRIMA
        if (detailsScreen) {
            detailsScreen.classList.remove('hidden');
            window.AppDebug?.log('[WineCardTransformer] ✅ Schermata dettagli mostrata PRIMA di aprire viewerPanel', 'info');
        }
        
        // POI mostra viewerPanel e attiva state-viewer
        viewerPanel.hidden = false;
        mobileLayout.classList.add('state-viewer');
        window.AppDebug?.log('[WineCardTransformer] ✅ ViewerPanel aperto con schermata dettagli attiva', 'success');
        
        // Naviga alla pagina dettagli vino mobile
        if (window.InventoryMobile && typeof window.InventoryMobile.showWineDetails === 'function') {
            // Aspetta un frame per assicurarsi che il viewerPanel sia visibile
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            
            window.AppDebug?.log(`[WineCardTransformer] 🚀 Chiamata showWineDetails(${wineId})`, 'info');
            try {
                await window.InventoryMobile.showWineDetails(wineId);
                window.AppDebug?.log(`[WineCardTransformer] ✅ showWineDetails(${wineId}) completata`, 'success');
            } catch (error) {
                window.AppDebug?.log(`[WineCardTransformer] ❌ Errore in showWineDetails: ${error.message}`, 'error');
            }
        } else {
            window.AppDebug?.log('[WineCardTransformer] ❌ InventoryMobile.showWineDetails non disponibile', 'error');
        }
        
        window.AppDebug?.log(`[WineCardTransformer] 🍔🍔🍔 BOTTONE INVENTORY CLICK - FINE`, 'info');
    }, true); // IMPORTANTE: Capture phase per intercettare PRIMA
    
    return btn;
}

/**
 * Inizializza observer per trasformare wine cards aggiunte dinamicamente
 */
function initWineCardObserver() {
    const isMobile = window.LayoutBoundary?.isMobileNamespace() || 
                     document.documentElement.classList.contains('mobileRoot');
    
    if (!isMobile) {
        return; // Solo su mobile
    }
    
    // Observer per intercettare wine cards aggiunte dinamicamente
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    // Cerca wine cards nel nodo aggiunto
                    const wineCards = node.querySelectorAll?.('.wine-card:not(.wine-card-mobile)');
                    if (wineCards && wineCards.length > 0) {
                        window.AppDebug?.log(`[WineCardTransformer] 🔍 Observer: trovata ${wineCards.length} wine card(s) aggiunta dinamicamente`, 'info');
                        wineCards.forEach((wineCard) => {
                            transformSingleWineCard(wineCard);
                        });
                    }
                    // Se il nodo stesso è una wine card
                    if (node.classList?.contains('wine-card') && !node.classList.contains('wine-card-mobile')) {
                        window.AppDebug?.log('[WineCardTransformer] 🔍 Observer: nodo stesso è una wine card', 'info');
                        transformSingleWineCard(node);
                    }
                }
            });
        });
    });
    
    // Inizia osservazione su tutto il document
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    window.AppDebug?.log('[WineCardTransformer] ✅ MutationObserver attivo per wine cards', 'success');
}

/**
 * Trasforma una singola wine card element (non HTML string)
 */
function transformSingleWineCard(wineCardElement) {
    const wineId = wineCardElement.getAttribute('data-wine-id');
    if (!wineId) {
        return;
    }
    
    // Aggiungi classe mobile
    wineCardElement.classList.add('wine-card-mobile');
    
    // Aggiungi bottoni se non esistono
    const header = wineCardElement.querySelector('.wine-card-header');
    if (!header || header.querySelector('.wine-card-buttons-mobile')) {
        return;
    }
    
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'wine-card-buttons-mobile';
    
    const editBtn = createMobileEditButton(wineId);
    const inventoryBtn = createMobileInventoryButton(wineId);
    
    buttonsContainer.appendChild(editBtn);
    buttonsContainer.appendChild(inventoryBtn);
    
    if (window.getComputedStyle(header).position === 'static') {
        header.style.position = 'relative';
    }
    
    header.appendChild(buttonsContainer);
    window.AppDebug?.log(`[WineCardTransformer] ✅ Wine card trasformata dinamicamente (ID: ${wineId})`, 'success');
}

// Export per uso globale
if (typeof window !== 'undefined') {
    window.WineCardTransformer = {
        transformForMobile: transformWineCardsForMobile
    };
    
    // Inizializza observer quando DOM è pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initWineCardObserver);
    } else {
        initWineCardObserver();
    }
    
    window.AppDebug?.log('[WineCardTransformer] ✅ Modulo inizializzato con observer', 'success');
}


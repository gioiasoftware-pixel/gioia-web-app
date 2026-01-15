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
        rebuildMobileWineCard(wineCard, wineId);
    });
    
    // Ritorna HTML trasformato
    const transformedHtml = tempDiv.innerHTML;
    window.AppDebug?.log(`[WineCardTransformer] ✅ Trasformazione completata`, 'success');
    return transformedHtml;
}

function rebuildMobileWineCard(wineCardElement, wineId) {
    wineCardElement.classList.add('wine-card-mobile', 'wine-card-mobile-redesign');
    wineCardElement.dataset.mobileRedesign = 'true';

    const title = wineCardElement.querySelector('.wine-card-title')?.textContent?.trim() || '';
    const producer = wineCardElement.querySelector('.wine-card-producer')?.textContent?.trim() || '';
    const badge = wineCardElement.querySelector('.wine-card-badge')?.textContent?.trim() || '';
    const errorMessage = wineCardElement.querySelector('.wine-card-error-message')?.textContent?.trim() || '';

    const fields = Array.from(wineCardElement.querySelectorAll('.wine-card-field')).map((field) => {
        const label = field.querySelector('.wine-card-field-label')?.textContent?.trim() || '';
        const value = field.querySelector('.wine-card-field-value')?.textContent?.trim() || '';
        return { label, value };
    });

    wineCardElement.innerHTML = '';

    const shell = document.createElement('div');
    shell.className = 'wine-card-mobile-shell';

    const header = document.createElement('div');
    header.className = 'wine-card-mobile-header';
    const titleEl = document.createElement('div');
    titleEl.className = 'wine-card-mobile-title';
    titleEl.textContent = title || 'Vino';
    header.appendChild(titleEl);

    if (producer) {
        const producerEl = document.createElement('div');
        producerEl.className = 'wine-card-mobile-producer';
        producerEl.textContent = producer;
        header.appendChild(producerEl);
    }

    if (badge) {
        const badgeEl = document.createElement('div');
        badgeEl.className = 'wine-card-mobile-badge';
        badgeEl.textContent = badge;
        header.appendChild(badgeEl);
    }

    const body = document.createElement('div');
    body.className = 'wine-card-mobile-body';

    if (errorMessage) {
        const alertEl = document.createElement('div');
        alertEl.className = 'wine-card-mobile-alert';
        alertEl.textContent = errorMessage;
        body.appendChild(alertEl);
    }

    fields.forEach((field) => {
        if (!field.label && !field.value) return;
        const row = document.createElement('div');
        row.className = 'wine-card-mobile-field';
        const labelEl = document.createElement('span');
        labelEl.className = 'wine-card-mobile-label';
        labelEl.textContent = field.label;
        const valueEl = document.createElement('span');
        valueEl.className = 'wine-card-mobile-value';
        valueEl.textContent = field.value;
        row.appendChild(labelEl);
        row.appendChild(valueEl);
        body.appendChild(row);
    });

    const actions = document.createElement('div');
    actions.className = 'wine-card-mobile-actions';
    actions.appendChild(createMobileEditButton(wineId));
    actions.appendChild(createMobileInventoryButton(wineId));

    shell.appendChild(header);
    shell.appendChild(body);
    shell.appendChild(actions);
    wineCardElement.appendChild(shell);

    window.AppDebug?.log(
        `[WineCardTransformer] ✅ Wine card mobile ridisegnata (wineId=${wineId})`,
        'success'
    );
}

/**
 * Crea bottone edit per mobile
 */
function createMobileEditButton(wineId) {
    const btn = document.createElement('button');
    btn.className = 'wine-card-action-btn wine-card-action-edit';
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
        await handleMobileWineCardEdit(e, wineId);
    }, true); // Capture phase
    
    return btn;
}

/**
 * Crea bottone hamburger/inventory per mobile
 * Questo bottone apre direttamente il viewer mobile con dettagli vino
 */
function createMobileInventoryButton(wineId) {
    const btn = document.createElement('button');
    btn.className = 'wine-card-action-btn wine-card-action-details';
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
    
    // Handler diretto isolato (capture phase)
    btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();
        e.stopImmediatePropagation();
        await handleMobileWineCardDetails(e, wineId);
    }, true); // Capture phase
    
    return btn;
}

async function handleMobileWineCardEdit(event, wineId) {
    window.AppDebug?.log(`[WineCardTransformer] 🖊️ Bottone edit cliccato (ID: ${wineId})`, 'info');
    const wineCard = event.target.closest('.wine-card');
    if (window.handleWineCardEdit && typeof window.handleWineCardEdit === 'function') {
        await window.handleWineCardEdit(wineCard, wineId);
        return;
    }
    window.AppDebug?.log('[WineCardTransformer] ⚠️ handleWineCardEdit non disponibile', 'warn');
}

async function handleMobileWineCardDetails(_event, wineId) {
    window.AppDebug?.log(`[WineCardTransformer] 🍔 Bottone dettagli cliccato (ID: ${wineId})`, 'info');
    const isMobileLayout = window.LayoutBoundary?.isMobileNamespace() ||
        document.documentElement.classList.contains('mobileRoot');
    if (!isMobileLayout) {
        window.AppDebug?.log('[WineCardTransformer] ❌ Bottone mobile cliccato su desktop', 'error');
        return;
    }

    const viewerPanel = document.getElementById('viewerPanel');
    const mobileLayout = document.getElementById('mobile-layout') || document.querySelector('.mobileRoot');
    const listScreen = document.getElementById('inventory-screen-list');
    const detailsScreen = document.getElementById('inventory-screen-details');
    const chartScreen = document.getElementById('inventory-screen-chart');

    if (!viewerPanel || !mobileLayout) {
        window.AppDebug?.log('[WineCardTransformer] ❌ viewerPanel o mobileLayout non trovati', 'error');
        return;
    }

    if (listScreen) listScreen.classList.add('hidden');
    if (chartScreen) chartScreen.classList.add('hidden');
    if (detailsScreen) detailsScreen.classList.remove('hidden');

    viewerPanel.hidden = false;
    mobileLayout.classList.add('state-viewer');

    if (window.InventoryMobile && typeof window.InventoryMobile.showWineDetails === 'function') {
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        try {
            await window.InventoryMobile.showWineDetails(wineId);
        } catch (error) {
            window.AppDebug?.log(`[WineCardTransformer] ❌ Errore in showWineDetails: ${error.message}`, 'error');
        }
        return;
    }

    window.AppDebug?.log('[WineCardTransformer] ❌ InventoryMobile.showWineDetails non disponibile', 'error');
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
    if (wineCardElement.dataset.mobileRedesign === 'true') {
        return;
    }
    rebuildMobileWineCard(wineCardElement, wineId);
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


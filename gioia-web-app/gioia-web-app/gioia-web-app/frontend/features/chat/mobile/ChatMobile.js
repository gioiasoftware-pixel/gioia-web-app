/**
 * ChatMobile - Implementazione chat per layout mobile
 * 
 * Gestisce solo il layout mobile, nessuna logica condivisa con desktop
 * Usa ChatAPI per business logic e ChatSelectors per selettori DOM
 */

/**
 * Inizializza la chat mobile
 */
function initChatMobile() {
    // Verifica che siamo nel namespace mobile
    if (!window.LayoutBoundary?.isMobileNamespace()) {
        console.warn('[ChatMobile] Namespace non mobile, skip inizializzazione');
        return;
    }
    
    const selectors = window.ChatSelectors?.get();
    if (!selectors || selectors.layout !== 'mobile') {
        console.warn('[ChatMobile] Selectors non disponibili o layout non mobile');
        return;
    }
    
    // Setup form submit
    const form = selectors.form();
    if (form) {
        // Previeni comportamento di default del form (evita refresh pagina su Android)
        form.setAttribute('onsubmit', 'return false;');
        form.addEventListener('submit', handleChatSubmitMobile, { passive: false });
    }
    
    // Setup input keydown - IMPORTANTE per Android: previene refresh quando si preme Invio
    const input = selectors.input();
    if (input) {
        input.addEventListener('keydown', (e) => {
            // Su Android, Enter può causare submit del form e refresh pagina
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.stopPropagation();
                form?.dispatchEvent(new Event('submit'));
            }
        }, { passive: false });
        
        // Previeni anche keypress per maggiore sicurezza su Android
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.stopPropagation();
            }
        }, { passive: false });
    }
    
    // Setup send button
    const sendButton = selectors.sendButton();
    if (sendButton) {
        sendButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            form?.dispatchEvent(new Event('submit'));
        }, { passive: false });
    }
    
    // Setup header action buttons
    setupHeaderActionButtons();
    
    // Setup sidebar
    setupSidebar();
    
    // Setup inventory back button
    setupInventoryBackButton();
    
    console.log('[ChatMobile] Inizializzato');
}

/**
 * Gestisce il submit del form chat mobile
 */
async function handleChatSubmitMobile(e) {
    // Previeni comportamento di default (refresh pagina) - CRITICO per Android
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    
    const selectors = window.ChatSelectors?.get();
    const input = selectors?.input();
    const form = selectors?.form();
    
    if (!input || !form) {
        console.error('[ChatMobile] Input o form non trovati');
        return false; // Previeni submit
    }
    
    const message = input.value.trim();
    if (!message) {
        return false; // Previeni submit se messaggio vuoto
    }
    
    // Pulisci input
    input.value = '';
    
    // Aggiungi messaggio utente
    addChatMessageMobile('user', message);
    
    // Invia al server
    try {
        const response = await window.ChatAPI?.sendMessage(message);
        if (response && response.message) {
            addChatMessageMobile('ai', response.message, false, false, null, response.is_html);
        }
    } catch (error) {
        console.error('[ChatMobile] Errore invio messaggio:', error);
        addChatMessageMobile('ai', 'Errore invio messaggio', false, true);
    }
    
    return false; // Previeni submit
}

/**
 * Aggiunge un messaggio alla chat mobile
 */
function addChatMessageMobile(role, content, isLoading = false, isError = false, wineData = null, isHtml = false) {
    const selectors = window.ChatSelectors?.get();
    const scrollContainer = selectors?.scrollContainer();
    
    if (!scrollContainer) {
        console.error('[ChatMobile] Scroll container non trovato');
        return null;
    }
    
    // Usa la funzione esistente addChatMessage che gestisce entrambi i layout
    return addChatMessage(role, content, isLoading, isError, wineData, isHtml);
}

/**
 * Setup header action buttons (inventario, aggiungi vino)
 */
function setupHeaderActionButtons() {
    // Bottone inventario
    const inventoryBtn = document.getElementById('inventory-btn-mobile');
    if (inventoryBtn) {
        inventoryBtn.addEventListener('click', () => {
            openInventoryMobile();
        });
    }
    
    // Bottone aggiungi vino
    const addWineBtn = document.getElementById('add-wine-btn-mobile');
    if (addWineBtn) {
        addWineBtn.addEventListener('click', () => {
            // TODO: Implementare modal aggiungi vino mobile
            console.log('[ChatMobile] Aggiungi vino mobile - da implementare');
        });
    }
}

/**
 * Apre l'inventario mobile
 */
function openInventoryMobile() {
    const viewerPanel = document.getElementById('viewerPanel');
    const mobileLayout = document.getElementById('mobile-layout');
    
    if (!viewerPanel || !mobileLayout) {
        console.error('[ChatMobile] viewerPanel o mobile-layout non trovati');
        return;
    }
    
    // Mostra viewer panel
    viewerPanel.hidden = false;
    
    // Cambia stato app a viewer
    mobileLayout.classList.remove('state-chat', 'state-settings', 'state-modal');
    mobileLayout.classList.add('state-viewer');
    
    // Inizializza inventario mobile se non già fatto
    if (window.InventoryMobile && typeof window.InventoryMobile.init === 'function') {
        window.InventoryMobile.init();
    }
}

/**
 * Setup sidebar mobile
 */
function setupSidebar() {
    const selectors = window.ChatSelectors?.get();
    const sidebarToggle = selectors?.sidebarToggle();
    const sidebarClose = document.getElementById('sidebar-close-btn-mobile');
    const newChatBtn = selectors?.newChatButton();
    
    // Toggle sidebar
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            const sidebar = selectors?.sidebar();
            if (sidebar) {
                sidebar.classList.toggle('open');
            }
        });
    }
    
    // Close sidebar
    if (sidebarClose) {
        sidebarClose.addEventListener('click', () => {
            const sidebar = selectors?.sidebar();
            if (sidebar) {
                sidebar.classList.remove('open');
            }
        });
    }
    
    // New chat button
    if (newChatBtn) {
        newChatBtn.addEventListener('click', () => {
            // TODO: Implementare nuova chat
            console.log('[ChatMobile] Nuova chat - da implementare');
        });
    }
}

/**
 * Setup inventory back button
 */
function setupInventoryBackButton() {
    const backBtn = document.getElementById('inventory-back-btn-mobile');
    if (!backBtn) return;
    
    backBtn.addEventListener('click', () => {
        const viewerPanel = document.getElementById('viewerPanel');
        const mobileLayout = document.getElementById('mobile-layout');
        
        if (!viewerPanel || !mobileLayout) return;
        
        // Gestisce navigazione tra schermate inventario
        if (window.InventoryMobile && typeof window.InventoryMobile.handleBackClick === 'function') {
            window.InventoryMobile.handleBackClick();
        } else {
            // Fallback: chiudi inventario
            viewerPanel.hidden = true;
            mobileLayout.classList.remove('state-viewer');
            mobileLayout.classList.add('state-chat');
        }
    });
}

// Export per uso globale
if (typeof window !== 'undefined') {
    window.ChatMobile = {
        init: initChatMobile,
        handleSubmit: handleChatSubmitMobile,
        addMessage: addChatMessageMobile,
        openInventory: openInventoryMobile
    };
    
    // Auto-inizializzazione quando DOM è pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initChatMobile();
        });
    } else {
        // DOM già caricato
        initChatMobile();
    }
}

/**
 * ChatMobile - Implementazione completa layout mobile
 * 
 * Gestisce solo il layout mobile, nessuna logica condivisa con desktop
 * State machine per gestire stati: CHAT, SIDEBAR_OPEN, VIEWER_OPEN, MODAL_OPEN
 * Tap isolation per evitare tap-through
 * Scroll policy: un solo scroll container attivo per stato
 * 
 * Usa ChatAPI per business logic e ChatSelectors per selettori DOM
 */

// ============================================
// STATE MACHINE
// ============================================

const MOBILE_STATES = {
    CHAT: 'chat',
    SIDEBAR_OPEN: 'sidebar',
    VIEWER_OPEN: 'viewer',
    MODAL_OPEN: 'modal'
};

let currentMobileState = MOBILE_STATES.CHAT;
let previousMobileState = null; // Per tornare allo stato precedente dopo modal

// ============================================
// STATE MANAGEMENT
// ============================================

/**
 * Imposta lo stato mobile corrente
 * @param {string} newState - Nuovo stato (MOBILE_STATES.*)
 */
function setMobileState(newState) {
    const mApp = document.querySelector('.mApp');
    if (!mApp) {
        return;
    }
    
    // Salva stato precedente se non è MODAL_OPEN
    if (currentMobileState !== MOBILE_STATES.MODAL_OPEN) {
        previousMobileState = currentMobileState;
    }
    
    // Rimuovi tutte le classi stato
    mApp.classList.remove('state-chat', 'state-sidebar', 'state-viewer', 'state-modal');
    
    // Applica nuovo stato
    mApp.classList.add(`state-${newState}`);
    currentMobileState = newState;
    
    // Gestisci transizioni specifiche
    handleStateTransition(newState);
}

/**
 * Gestisce le transizioni tra stati
 * @param {string} newState - Nuovo stato
 */
function handleStateTransition(newState) {
    switch (newState) {
        case MOBILE_STATES.SIDEBAR_OPEN:
            // Chiudi viewer se aperto
            if (previousMobileState === MOBILE_STATES.VIEWER_OPEN) {
                closeViewerInternal();
            }
            openSidebarInternal();
            break;
            
        case MOBILE_STATES.VIEWER_OPEN:
            // Chiudi sidebar se aperto
            if (previousMobileState === MOBILE_STATES.SIDEBAR_OPEN) {
                closeSidebarInternal();
            }
            openViewerInternal();
            break;
            
        case MOBILE_STATES.MODAL_OPEN:
            openModalInternal();
            break;
            
        case MOBILE_STATES.CHAT:
            // Chiudi tutto
            closeSidebarInternal();
            closeViewerInternal();
            closeModalInternal();
            break;
    }
}

// ============================================
// SIDEBAR MANAGEMENT (Drawer)
// ============================================

/**
 * Apre la sidebar drawer
 */
function openSidebar() {
    setMobileState(MOBILE_STATES.SIDEBAR_OPEN);
}

/**
 * Chiude la sidebar drawer
 */
function closeSidebar() {
    setMobileState(MOBILE_STATES.CHAT);
}

/**
 * Toggle sidebar (apri/chiudi)
 */
function toggleSidebar() {
    if (currentMobileState === MOBILE_STATES.SIDEBAR_OPEN) {
        closeSidebar();
    } else {
        openSidebar();
    }
}

/**
 * Implementazione interna: apre sidebar (chiamata da state machine)
 */
function openSidebarInternal() {
    const sidebar = document.getElementById('chatSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (!sidebar || !overlay) {
        return;
    }
    
    sidebar.classList.add('is-open');
    overlay.classList.add('is-open');
}

/**
 * Implementazione interna: chiude sidebar (chiamata da state machine)
 */
function closeSidebarInternal() {
    const sidebar = document.getElementById('chatSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (!sidebar || !overlay) return;
    
    sidebar.classList.remove('is-open');
    overlay.classList.remove('is-open');
}

/**
 * Setup overlay click handler per chiudere sidebar
 */
function setupSidebarOverlay() {
    const overlay = document.getElementById('sidebarOverlay');
    if (!overlay) return;
    
    // Rimuovi listener esistenti (se presenti)
    const newOverlay = overlay.cloneNode(true);
    overlay.parentNode.replaceChild(newOverlay, overlay);
    
    newOverlay.addEventListener('click', () => {
        if (currentMobileState === MOBILE_STATES.SIDEBAR_OPEN) {
            closeSidebar();
        }
    });
}

// ============================================
// VIEWER MANAGEMENT (Sheet)
// ============================================

/**
 * Apre il viewer sheet
 * @param {Object} wineData - Dati vino da visualizzare (opzionale)
 */
function openViewer(wineData = null) {
    setMobileState(MOBILE_STATES.VIEWER_OPEN);
    
    if (wineData) {
        // Popola contenuto viewer (da implementare se necessario)
    }
}

/**
 * Chiude il viewer sheet
 */
function closeViewer() {
    setMobileState(MOBILE_STATES.CHAT);
}

/**
 * Implementazione interna: apre viewer (chiamata da state machine)
 */
function openViewerInternal() {
    const viewer = document.getElementById('viewerPanel');
    if (!viewer) {
        return;
    }
    
    viewer.removeAttribute('hidden');
}

/**
 * Implementazione interna: chiude viewer (chiamata da state machine)
 */
function closeViewerInternal() {
    const viewer = document.getElementById('viewerPanel');
    if (!viewer) return;
    
    viewer.setAttribute('hidden', '');
}

/**
 * Setup viewer close button
 */
function setupViewerClose() {
    const viewer = document.getElementById('viewerPanel');
    if (!viewer) return;
    
    const closeBtn = viewer.querySelector('.viewer-close-btn');
    if (!closeBtn) return;
    
    // Rimuovi listener esistenti
    const newCloseBtn = closeBtn.cloneNode(true);
    closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
    
    newCloseBtn.addEventListener('click', () => {
        closeViewer();
    });
}

// ============================================
// MODAL MANAGEMENT
// ============================================

/**
 * Apre un modal
 * @param {string} content - HTML content del modal
 * @param {Object} options - Opzioni (onClose callback, ecc.)
 */
function openModal(content, options = {}) {
    setMobileState(MOBILE_STATES.MODAL_OPEN);
    
    const modal = document.getElementById('anyModal');
    if (!modal) {
        return;
    }
    
    // Crea struttura modal se non esiste
    let modalContent = modal.querySelector('.modal-content');
    if (!modalContent) {
        modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        modal.appendChild(modalContent);
    }
    
    modalContent.innerHTML = content;
    
    // Setup close button se presente
    const closeBtn = modalContent.querySelector('.modal-close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            closeModal();
            if (options.onClose) {
                options.onClose();
            }
        });
    }
    
    // Click outside per chiudere (solo se non distruttivo)
    if (options.closeOnOutsideClick !== false) {
        modal.addEventListener('click', function modalOutsideClick(e) {
            if (e.target === modal) {
                closeModal();
                modal.removeEventListener('click', modalOutsideClick);
                if (options.onClose) {
                    options.onClose();
                }
            }
        });
    }
    
    modal.removeAttribute('hidden');
}

/**
 * Chiude il modal e torna allo stato precedente
 */
function closeModal() {
    if (previousMobileState) {
        setMobileState(previousMobileState);
        previousMobileState = null;
    } else {
        setMobileState(MOBILE_STATES.CHAT);
    }
}

/**
 * Implementazione interna: apre modal (chiamata da state machine)
 */
function openModalInternal() {
    // Già gestito in openModal()
}

/**
 * Implementazione interna: chiude modal (chiamata da state machine)
 */
function closeModalInternal() {
    const modal = document.getElementById('anyModal');
    if (!modal) return;
    
    modal.setAttribute('hidden', '');
}

// ============================================
// CHAT MANAGEMENT
// ============================================

/**
 * Inizializza la chat mobile
 */
function initChatMobile() {
    const selectors = window.ChatSelectors?.get();
    if (!selectors || selectors.layout !== 'mobile') {
        return;
    }
    
    // Reset stato a CHAT
    setMobileState(MOBILE_STATES.CHAT);
    
    // Setup form submit
    const form = selectors.form();
    if (form) {
        // Rimuovi listener esistenti
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        
        newForm.addEventListener('submit', handleChatSubmitMobile);
    }
    
    // Setup input keydown
    const input = selectors.input();
    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                form?.dispatchEvent(new Event('submit'));
            }
        });
    }
    
    // Setup sidebar toggle
    const sidebarToggle = selectors.sidebarToggle();
    if (sidebarToggle) {
        // Rimuovi listener esistenti
        const newToggle = sidebarToggle.cloneNode(true);
        sidebarToggle.parentNode.replaceChild(newToggle, sidebarToggle);
        
        newToggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleSidebar();
        });
    }
    
    // Setup overlay
    setupSidebarOverlay();
    
    // Setup viewer close
    setupViewerClose();
    
    // Setup conversazioni click (auto-close sidebar)
    setupConversationsClick();
}

/**
 * Setup click su conversazioni per auto-close sidebar
 */
function setupConversationsClick() {
    const sidebarList = document.getElementById('chat-sidebar-list-mobile');
    if (!sidebarList) return;
    
    // Usa event delegation per gestire click su items dinamici
    sidebarList.addEventListener('click', (e) => {
        const item = e.target.closest('.chat-sidebar-item');
        if (item && currentMobileState === MOBILE_STATES.SIDEBAR_OPEN) {
            // Auto-close sidebar quando si seleziona una conversazione
            setTimeout(() => {
                closeSidebar();
            }, 100); // Piccolo delay per permettere al click di propagarsi
        }
    });
}

/**
 * Gestisce il submit del form chat mobile
 */
async function handleChatSubmitMobile(e) {
    e.preventDefault();
    
    // Verifica che siamo in stato CHAT
    if (currentMobileState !== MOBILE_STATES.CHAT) {
        return;
    }
    
    const selectors = window.ChatSelectors?.get();
    const input = selectors?.input();
    const form = selectors?.form();
    
    if (!input || !form) {
        return;
    }
    
    const message = input.value.trim();
    if (!message) return;
    
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
        addChatMessageMobile('ai', 'Errore invio messaggio', false, true);
    }
}

/**
 * Aggiunge un messaggio alla chat mobile
 */
function addChatMessageMobile(role, content, isLoading = false, isError = false, wineData = null, isHtml = false) {
    const selectors = window.ChatSelectors?.get();
    const scrollContainer = selectors?.scrollContainer(); // #chatScroll
    
    if (!scrollContainer) {
        return null;
    }
    
    // Crea elemento messaggio
    const messageElement = document.createElement('div');
    messageElement.className = `chat-message ${role}`;
    
    // Aggiungi contenuto (HTML o testo)
    if (isHtml) {
        messageElement.innerHTML = content;
    } else {
        messageElement.textContent = content;
    }
    
    // Gestione loading state
    if (isLoading) {
        messageElement.classList.add('loading');
        messageElement.innerHTML = '<div class="loading-spinner">Caricamento...</div>';
    }
    
    // Gestione error state
    if (isError) {
        messageElement.classList.add('error');
    }
    
    // Gestione wine cards (da implementare se necessario)
    if (wineData) {
        // ... renderizza wine card ...
    }
    
    // Aggiungi al DOM
    scrollContainer.appendChild(messageElement);
    
    // Scroll automatico
    requestAnimationFrame(() => {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
    });
    
    return messageElement;
}

// ============================================
// CLEANUP
// ============================================

/**
 * Cleanup: rimuove listener e reset stato
 * Chiamato quando si cambia layout da mobile a desktop
 */
function cleanupChatMobile() {
    // Reset stato a CHAT
    setMobileState(MOBILE_STATES.CHAT);
    previousMobileState = null;
    
    // Rimuovi listener clonando elementi (metodo sicuro)
    const form = document.getElementById('chat-form-mobile');
    if (form) {
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
    }
    
    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (sidebarToggle) {
        const newToggle = sidebarToggle.cloneNode(true);
        sidebarToggle.parentNode.replaceChild(newToggle, sidebarToggle);
    }
    
    const overlay = document.getElementById('sidebarOverlay');
    if (overlay) {
        const newOverlay = overlay.cloneNode(true);
        overlay.parentNode.replaceChild(newOverlay, overlay);
    }
    
    // Chiudi tutti i layer aperti
    closeSidebarInternal();
    closeViewerInternal();
    closeModalInternal();
}

// ============================================
// EXPORT
// ============================================

if (typeof window !== 'undefined') {
    window.ChatMobile = {
        init: initChatMobile,
        cleanup: cleanupChatMobile,
        handleSubmit: handleChatSubmitMobile,
        addMessage: addChatMessageMobile,
        
        // State management
        setState: setMobileState,
        getState: () => currentMobileState,
        STATES: MOBILE_STATES,
        
        // Sidebar
        openSidebar,
        closeSidebar,
        toggleSidebar,
        
        // Viewer
        openViewer,
        closeViewer,
        
        // Modal
        openModal,
        closeModal
    };
}

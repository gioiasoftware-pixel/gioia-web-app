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
    
    // Rimuovi hidden e forza display
    viewer.removeAttribute('hidden');
    viewer.style.display = 'flex';
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
    
    // Prova sia con ID che con classe
    let closeBtn = document.getElementById('viewer-close-btn-mobile');
    if (!closeBtn) {
        closeBtn = viewer.querySelector('.viewer-close-btn');
    }
    
    if (!closeBtn) return;
    
    // Rimuovi listener esistenti clonando il bottone
    const newCloseBtn = closeBtn.cloneNode(true);
    closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
    
    // Aggiungi listener
    newCloseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
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
    
    // Setup nuovo chat button
    const newChatBtn = document.getElementById('new-chat-btn-mobile');
    if (newChatBtn) {
        const newBtn = newChatBtn.cloneNode(true);
        newChatBtn.parentNode.replaceChild(newBtn, newChatBtn);
        
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleNewChatMobile();
        });
    }
    
    // Setup pulsante chiudi sidebar
    const closeSidebarBtn = document.getElementById('sidebar-close-btn-mobile');
    if (closeSidebarBtn) {
        const newCloseBtn = closeSidebarBtn.cloneNode(true);
        closeSidebarBtn.parentNode.replaceChild(newCloseBtn, closeSidebarBtn);
        
        newCloseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeSidebar();
        });
    }
    
    // Setup overlay
    setupSidebarOverlay();
    
    // Setup viewer close
    setupViewerClose();
    
    // Setup conversazioni click (auto-close sidebar)
    setupConversationsClick();
    
    // Setup header action buttons
    setupHeaderActionButtons();
    
    // Carica conversazioni e conversazione corrente (con delay per assicurare DOM ready)
    setTimeout(() => {
        loadConversationsMobile().then(() => {
            // Carica conversazione corrente da localStorage se presente
            const savedConversationId = localStorage.getItem('current_conversation_id');
            if (savedConversationId) {
                const convId = parseInt(savedConversationId);
                if (!isNaN(convId)) {
                    window.currentConversationId = convId;
                    loadConversationMessagesMobile(convId);
                } else {
                    showWelcomeMessageMobile();
                }
            } else {
                // Mostra welcome message se nessuna conversazione salvata
                showWelcomeMessageMobile();
            }
        }).catch(err => {
            console.error('[MOBILE] Errore inizializzazione:', err);
            showWelcomeMessageMobile();
        });
    }, 100);
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
 * Setup header action buttons (Add Wine, Inventory)
 */
function setupHeaderActionButtons() {
    // Add Wine Button
    const addWineBtn = document.getElementById('add-wine-btn-mobile');
    if (addWineBtn) {
        // Rimuovi listener esistenti
        const newBtn = addWineBtn.cloneNode(true);
        addWineBtn.parentNode.replaceChild(newBtn, addWineBtn);
        
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openAddWineModalMobile();
        });
    }
    
    // Inventory Button
    const inventoryBtn = document.getElementById('inventory-btn-mobile');
    if (inventoryBtn) {
        // Rimuovi listener esistenti
        const newBtn = inventoryBtn.cloneNode(true);
        inventoryBtn.parentNode.replaceChild(newBtn, inventoryBtn);
        
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openInventoryViewerMobile();
        });
    }
}

// ============================================
// CONVERSATIONS MANAGEMENT
// ============================================

let conversationsMobile = []; // Cache locale conversazioni mobile

/**
 * Helper: Escape HTML per sicurezza
 */
function escapeHtmlMobile(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Helper: Formatta timestamp conversazione
 */
function formatConversationTimeMobile(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Adesso';
    if (diffMins < 60) return `${diffMins}m fa`;
    if (diffHours < 24) return `${diffHours}h fa`;
    if (diffDays < 7) return `${diffDays}g fa`;
    
    return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

/**
 * Carica le conversazioni dalla API
 */
async function loadConversationsMobile() {
    // Usa window.authToken (esposto da app.js) o fallback a variabile globale
    const token = window.authToken || (typeof authToken !== 'undefined' ? authToken : null);
    if (!token) {
        console.warn('[MOBILE] authToken non disponibile');
        return;
    }
    
    const sidebarList = document.getElementById('chat-sidebar-list-mobile');
    if (!sidebarList) {
        console.warn('[MOBILE] sidebarList non trovato');
        return;
    }
    
    sidebarList.innerHTML = '<div class="chat-sidebar-loading">Caricamento chat...</div>';
    
    try {
        // Usa endpoint desktop (/api/chat/conversations) invece di ChatAPI (/api/conversations)
        // perché ChatAPI potrebbe usare endpoint diverso
        const apiBaseUrl = window.API_BASE_URL || (typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'http://localhost:8000');
        const response = await fetch(`${apiBaseUrl}/api/chat/conversations`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('[MOBILE] Errore API:', response.status, errorText);
            throw new Error(`Errore caricamento conversazioni: ${response.status}`);
        }
        
        conversationsMobile = await response.json();
        
        if (!conversationsMobile || !Array.isArray(conversationsMobile)) {
            console.warn('[MOBILE] Risposta API non è un array:', conversationsMobile);
            conversationsMobile = [];
        }
        
        console.log('[MOBILE] Conversazioni caricate:', conversationsMobile.length);
        renderConversationsListMobile();
    } catch (error) {
        console.error('[MOBILE] Errore caricamento conversazioni:', error);
        sidebarList.innerHTML = '<div class="chat-sidebar-error">Errore caricamento chat</div>';
        conversationsMobile = [];
    }
}

/**
 * Renderizza la lista conversazioni nella sidebar mobile
 */
function renderConversationsListMobile() {
    const sidebarList = document.getElementById('chat-sidebar-list-mobile');
    if (!sidebarList) return;
    
    if (!conversationsMobile || conversationsMobile.length === 0) {
        sidebarList.innerHTML = '<div class="chat-sidebar-empty">Nessuna chat ancora</div>';
        return;
    }
    
    // Usa currentConversationId globale se disponibile
    const currentId = window.currentConversationId || null;
    
    sidebarList.innerHTML = conversationsMobile.map(conv => `
        <div class="chat-sidebar-item ${conv.id === currentId ? 'active' : ''}" 
             data-conversation-id="${conv.id}">
            <div class="chat-sidebar-item-content">
                <div class="chat-sidebar-item-title">${escapeHtmlMobile(conv.title || 'Nuova chat')}</div>
                <div class="chat-sidebar-item-time-wrapper">
                    <div class="chat-sidebar-item-time">${formatConversationTimeMobile(conv.last_message_at || conv.updated_at)}</div>
                    <button class="chat-sidebar-item-delete" 
                            data-conversation-id="${conv.id}"
                            title="Cancella chat">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                            <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
    
    // Aggiungi event listeners per selezione conversazione
    sidebarList.querySelectorAll('.chat-sidebar-item').forEach(item => {
        item.addEventListener('pointerup', (e) => {
            // Non selezionare se il click è sul pulsante di cancellazione
            if (e.target.closest('.chat-sidebar-item-delete')) {
                return;
            }
            const conversationId = parseInt(item.dataset.conversationId);
            selectConversationMobile(conversationId);
        });
    });
    
    // Aggiungi event listeners per delete button
    sidebarList.querySelectorAll('.chat-sidebar-item-delete').forEach(btn => {
        btn.addEventListener('pointerup', (e) => {
            e.stopPropagation();
            const conversationId = parseInt(btn.dataset.conversationId);
            deleteConversationMobile(conversationId);
        });
    });
}

/**
 * Seleziona una conversazione e carica i suoi messaggi
 */
async function selectConversationMobile(conversationId) {
    if (conversationId === window.currentConversationId) return;
    
    window.currentConversationId = conversationId;
    localStorage.setItem('current_conversation_id', conversationId.toString());
    
    // Aggiorna UI sidebar mobile
    document.querySelectorAll('#chat-sidebar-list-mobile .chat-sidebar-item').forEach(item => {
        item.classList.toggle('active', parseInt(item.dataset.conversationId) === conversationId);
    });
    
    // Carica messaggi conversazione
    await loadConversationMessagesMobile(conversationId);
    
    // Auto-chiudi sidebar dopo selezione
    if (currentMobileState === MOBILE_STATES.SIDEBAR_OPEN) {
        closeSidebar();
    }
}

/**
 * Carica i messaggi di una conversazione
 */
async function loadConversationMessagesMobile(conversationId) {
    const token = window.authToken || (typeof authToken !== 'undefined' ? authToken : null);
    if (!token || !conversationId) {
        console.warn('[MOBILE] Token o conversationId mancante:', { token: !!token, conversationId });
        return;
    }
    
    // Pulisci messaggi correnti
    clearChatMessagesMobile(false);
    
    try {
        // Usa endpoint desktop (/api/chat/conversations) invece di ChatAPI (/api/conversations)
        const apiBaseUrl = window.API_BASE_URL || (typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'http://localhost:8000');
        const response = await fetch(`${apiBaseUrl}/api/chat/conversations/${conversationId}/messages?limit=50`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('[MOBILE] Errore API caricamento messaggi:', response.status, errorText);
            throw new Error(`Errore caricamento messaggi: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Gestisci sia array diretto che oggetto con proprietà messages
        let messages = Array.isArray(data) ? data : (data?.messages || []);
        
        if (!messages || messages.length === 0) {
            showWelcomeMessageMobile();
            return;
        }
        
        console.log('[MOBILE] Messaggi caricati:', messages.length);
        
        // Renderizza messaggi
        messages.forEach(msg => {
            // Determina se è HTML
            const content = msg.content || '';
            const trimmedContent = content.trim();
            const isHtml = trimmedContent.startsWith('<div') || 
                          trimmedContent.startsWith('&lt;div') ||
                          trimmedContent.includes('class="wine-card"') ||
                          trimmedContent.includes('class="wines-list-card"') ||
                          trimmedContent.includes('class="movement-card"') ||
                          trimmedContent.includes('class="inventory-list-card"') ||
                          trimmedContent.includes('class="stats-card"');
            
            // Decodifica HTML escapato se necessario
            let finalContent = content;
            if (isHtml && trimmedContent.startsWith('&lt;')) {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = content;
                finalContent = tempDiv.innerHTML;
            } else if (isHtml && (trimmedContent.startsWith('<') || trimmedContent.includes('class="'))) {
                finalContent = content;
            }
            
            addChatMessageMobile(msg.role, finalContent, false, false, null, isHtml);
        });
        
        // Scrolla in fondo
        const scrollContainer = document.getElementById('chatScroll');
        if (scrollContainer) {
            requestAnimationFrame(() => {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            });
        }
    } catch (error) {
        console.error('[MOBILE] Errore caricamento messaggi:', error);
        addChatMessageMobile('ai', 'Errore caricamento messaggi', false, true);
    }
}

/**
 * Elimina una conversazione (con modal di conferma)
 */
async function deleteConversationMobile(conversationId) {
    const token = typeof authToken !== 'undefined' ? authToken : window.authToken;
    if (!token) return;
    
    // Mostra modal di conferma invece di confirm()
    const confirmHtml = `
        <div class="modal-content">
            <h3>Conferma cancellazione</h3>
            <p>Sei sicuro di voler cancellare questa chat?</p>
            <div class="modal-actions">
                <button class="btn btn-secondary modal-cancel-btn">Annulla</button>
                <button class="btn btn-danger modal-confirm-btn">Elimina</button>
            </div>
        </div>
    `;
    
    window.ChatMobile.openModal(confirmHtml, {
        closeOnOutsideClick: false,
        onClose: () => {}
    });
    
    // Setup bottoni modal
    const modal = document.getElementById('anyModal');
    const cancelBtn = modal?.querySelector('.modal-cancel-btn');
    const confirmBtn = modal?.querySelector('.modal-confirm-btn');
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            window.ChatMobile.closeModal();
        });
    }
    
    if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
            try {
                await window.ChatAPI?.deleteConversation(conversationId);
                
                // Se era la conversazione corrente, resetta
                if (conversationId === window.currentConversationId) {
                    window.currentConversationId = null;
                    localStorage.removeItem('current_conversation_id');
                    clearChatMessagesMobile(true);
                }
                
                // Ricarica lista conversazioni
                await loadConversationsMobile();
                
                // Chiudi modal
                window.ChatMobile.closeModal();
            } catch (error) {
                console.error('Errore cancellazione chat mobile:', error);
                window.ChatMobile.closeModal();
                // Mostra errore (potresti aggiungere un toast/alert mobile-friendly)
                alert(`Errore: ${error.message || 'Errore cancellazione chat'}`);
            }
        });
    }
}

/**
 * Gestisce la creazione di una nuova conversazione
 */
async function handleNewChatMobile() {
    const token = typeof authToken !== 'undefined' ? authToken : window.authToken;
    if (!token) return;
    
    try {
        // Resetta conversation_id (verrà creata al primo messaggio)
        window.currentConversationId = null;
        localStorage.removeItem('current_conversation_id');
        
        // Pulisci chat corrente e mostra welcome message
        clearChatMessagesMobile(true);
        
        // Aggiorna UI sidebar (rimuovi selezione)
        document.querySelectorAll('#chat-sidebar-list-mobile .chat-sidebar-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Ricarica lista conversazioni per aggiornare UI
        await loadConversationsMobile();
        
        // Chiudi sidebar se aperta
        if (currentMobileState === MOBILE_STATES.SIDEBAR_OPEN) {
            closeSidebar();
        }
    } catch (error) {
        console.error('Errore creazione nuova chat mobile:', error);
    }
}

/**
 * Pulisce i messaggi della chat mobile
 */
function clearChatMessagesMobile(keepWelcome = true) {
    const scrollContainer = document.getElementById('chatScroll');
    if (!scrollContainer) return;
    
    scrollContainer.innerHTML = '';
    
    if (keepWelcome) {
        showWelcomeMessageMobile();
    }
}

/**
 * Mostra il welcome message nella chat mobile
 */
function showWelcomeMessageMobile() {
    const scrollContainer = document.getElementById('chatScroll');
    if (!scrollContainer) return;
    
    scrollContainer.innerHTML = `
        <div class="welcome-message">
            <h2>Ciao! Come posso aiutarti?</h2>
            <p>Chiedimi informazioni sul tuo inventario vini</p>
        </div>
    `;
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
    
    // Verifica token disponibile
    const token = window.authToken || (typeof authToken !== 'undefined' ? authToken : null);
    if (!token) {
        console.error('[MOBILE] authToken non disponibile per invio messaggio');
        addChatMessageMobile('ai', 'Errore: autenticazione non disponibile', false, true);
        return;
    }
    
    // Rimuovi welcome message se presente
    const scrollContainer = document.getElementById('chatScroll');
    if (scrollContainer) {
        const welcomeMsg = scrollContainer.querySelector('.welcome-message');
        if (welcomeMsg) {
            welcomeMsg.remove();
        }
    }
    
    // Pulisci input
    input.value = '';
    
    // Aggiungi messaggio utente
    addChatMessageMobile('user', message);
    
    // Aggiungi messaggio loading AI
    const loadingMessage = addChatMessageMobile('ai', '', true, false);
    
    // Invia al server usando endpoint desktop (/api/chat/message)
    try {
        const apiBaseUrl = window.API_BASE_URL || (typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'http://localhost:8000');
        const conversationId = window.currentConversationId || null;
        
        console.log('[MOBILE] Invio messaggio:', { message, conversationId, apiBaseUrl });
        
        const response = await fetch(`${apiBaseUrl}/api/chat/message`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                message: message,
                conversation_id: conversationId
            })
        });
        
        const data = await response.json();
        
        // Rimuovi messaggio loading
        if (loadingMessage) {
            loadingMessage.remove();
        }
        
        if (!response.ok) {
            console.error('[MOBILE] Errore API invio messaggio:', response.status, data);
            throw new Error(data.detail || `Errore invio messaggio: ${response.status}`);
        }
        
        // Gestisci nuovo conversation_id se ricevuto
        if (data.conversation_id) {
            const newConversationId = data.conversation_id;
            if (newConversationId !== window.currentConversationId) {
                console.log('[MOBILE] Nuovo conversation_id ricevuto:', newConversationId);
                window.currentConversationId = newConversationId;
                localStorage.setItem('current_conversation_id', newConversationId.toString());
                // Ricarica lista conversazioni per aggiornare UI
                await loadConversationsMobile();
            }
        }
        
        // Aggiungi risposta AI
        if (data.message) {
            addChatMessageMobile('ai', data.message, false, false, null, data.is_html);
        } else {
            console.warn('[MOBILE] Nessun messaggio nella risposta:', data);
        }
    } catch (error) {
        console.error('[MOBILE] Errore invio messaggio:', error);
        // Rimuovi messaggio loading
        if (loadingMessage) {
            loadingMessage.remove();
        }
        addChatMessageMobile('ai', `Errore invio messaggio: ${error.message || 'Errore sconosciuto'}`, false, true);
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
    
    // Setup bottoni wine card se è HTML con wine card
    if (isHtml && role === 'ai') {
        setTimeout(() => {
            setupWineCardButtonsMobile(messageElement);
        }, 100);
    }
    
    // Scroll automatico
    requestAnimationFrame(() => {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
    });
    
    return messageElement;
}

// ============================================
// WINE CARD BUTTONS MOBILE
// ============================================

/**
 * Setup bottoni circolari grigi per wine cards su mobile
 * I bottoni sono parte integrante della wine card (non segnalibri esterni)
 */
function setupWineCardButtonsMobile(messageEl) {
    // Cerca la card vino dentro il messaggio
    const wineCard = messageEl.querySelector('.wine-card[data-wine-id]');
    if (!wineCard) return;
    
    const wineId = wineCard.dataset.wineId;
    if (!wineId) return;
    
    // Controlla se i bottoni sono già stati aggiunti
    if (wineCard.querySelector('.wine-card-buttons-mobile')) {
        return; // Già configurato
    }
    
    // Crea container bottoni mobile DENTRO la wine card
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'wine-card-buttons-mobile';
    
    // Bottone "Modifica" - icona matita
    const editButton = document.createElement('button');
    editButton.className = 'wine-card-button-mobile wine-card-button-edit';
    editButton.title = 'Modifica';
    editButton.dataset.action = 'edit';
    editButton.dataset.wineId = wineId;
    editButton.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path d="M11.5 4.5L15.5 8.5M3 17H7L16 8L12 4L3 13V17Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
    `;
    
    // Bottone "Mostra in inventario" - icona inventario/lista
    const inventoryButton = document.createElement('button');
    inventoryButton.className = 'wine-card-button-mobile wine-card-button-inventory';
    inventoryButton.title = 'Mostra in inventario';
    inventoryButton.dataset.action = 'inventory';
    inventoryButton.dataset.wineId = wineId;
    inventoryButton.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path d="M3 5H17M3 10H17M3 15H17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
    `;
    
    // Event listeners
    editButton.addEventListener('pointerup', (e) => {
        e.stopPropagation();
        e.preventDefault();
        handleWineCardEditMobile(wineCard, wineId);
    });
    
    inventoryButton.addEventListener('pointerup', (e) => {
        e.stopPropagation();
        e.preventDefault();
        handleWineCardShowInInventoryMobile(wineCard, wineId);
    });
    
    buttonsContainer.appendChild(editButton);
    buttonsContainer.appendChild(inventoryButton);
    
    // Aggiungi container bottoni DENTRO la wine card (non nel wrapper)
    wineCard.appendChild(buttonsContainer);
}

/**
 * Gestisce il click su "Modifica" wine card mobile
 */
async function handleWineCardEditMobile(wineCard, wineId) {
    // Usa funzione desktop esposta su window
    if (typeof window.handleWineCardEdit === 'function') {
        await window.handleWineCardEdit(wineCard, wineId);
    } else {
        console.warn('[MOBILE] handleWineCardEdit non disponibile');
    }
}

/**
 * Gestisce il click su "Mostra in inventario" wine card mobile
 */
async function handleWineCardShowInInventoryMobile(wineCard, wineId) {
    // Usa funzione desktop esposta su window
    if (typeof window.handleWineCardShowInInventory === 'function') {
        await window.handleWineCardShowInInventory(wineCard, wineId);
    } else {
        console.warn('[MOBILE] handleWineCardShowInInventory non disponibile');
    }
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
// ADD WINE MODAL MOBILE
// ============================================

/**
 * Apre il modal per aggiungere un nuovo vino (mobile)
 */
function openAddWineModalMobile() {
    const token = window.authToken || (typeof authToken !== 'undefined' ? authToken : null);
    if (!token) {
        addChatMessageMobile('ai', 'Errore: Token non valido. Effettua il login.', false, true);
        return;
    }
    
    // Crea HTML del form per aggiungere vino
    const formHtml = `
        <div class="modal-header">
            <h2>Aggiungi Nuovo Vino</h2>
            <button class="modal-close-btn" type="button">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
            </button>
        </div>
        <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
            <form id="add-wine-form-mobile" class="add-wine-form-mobile">
                <div class="add-wine-form-grid">
                    <div class="add-wine-field">
                        <label class="add-wine-label">Nome *</label>
                        <input type="text" class="add-wine-input" name="name" required>
                    </div>
                    <div class="add-wine-field">
                        <label class="add-wine-label">Produttore</label>
                        <input type="text" class="add-wine-input" name="producer">
                    </div>
                    <div class="add-wine-field">
                        <label class="add-wine-label">Quantità</label>
                        <input type="number" class="add-wine-input" name="quantity" min="0">
                    </div>
                    <div class="add-wine-field">
                        <label class="add-wine-label">Prezzo Vendita (€)</label>
                        <input type="number" class="add-wine-input" name="selling_price" step="0.01" min="0">
                    </div>
                    <div class="add-wine-field">
                        <label class="add-wine-label">Prezzo Acquisto (€)</label>
                        <input type="number" class="add-wine-input" name="cost_price" step="0.01" min="0">
                    </div>
                    <div class="add-wine-field">
                        <label class="add-wine-label">Annata</label>
                        <input type="text" class="add-wine-input" name="vintage">
                    </div>
                    <div class="add-wine-field">
                        <label class="add-wine-label">Regione</label>
                        <input type="text" class="add-wine-input" name="region">
                    </div>
                    <div class="add-wine-field">
                        <label class="add-wine-label">Paese</label>
                        <input type="text" class="add-wine-input" name="country">
                    </div>
                    <div class="add-wine-field">
                        <label class="add-wine-label">Tipo</label>
                        <input type="text" class="add-wine-input" name="wine_type">
                    </div>
                    <div class="add-wine-field">
                        <label class="add-wine-label">Fornitore</label>
                        <input type="text" class="add-wine-input" name="supplier">
                    </div>
                    <div class="add-wine-field">
                        <label class="add-wine-label">Vitigno</label>
                        <input type="text" class="add-wine-input" name="grape_variety">
                    </div>
                    <div class="add-wine-field">
                        <label class="add-wine-label">Classificazione</label>
                        <input type="text" class="add-wine-input" name="classification">
                    </div>
                    <div class="add-wine-field">
                        <label class="add-wine-label">Gradazione (% vol)</label>
                        <input type="text" class="add-wine-input" name="alcohol_content">
                    </div>
                    <div class="add-wine-field full-width">
                        <label class="add-wine-label">Descrizione</label>
                        <textarea class="add-wine-textarea" name="description"></textarea>
                    </div>
                    <div class="add-wine-field full-width">
                        <label class="add-wine-label">Note</label>
                        <textarea class="add-wine-textarea" name="notes"></textarea>
                    </div>
                </div>
                <div class="add-wine-actions">
                    <button class="add-wine-btn cancel" type="button">Annulla</button>
                    <button class="add-wine-btn save" type="submit">Aggiungi</button>
                </div>
            </form>
        </div>
    `;
    
    // Apri modal con il form
    openModal(formHtml, {
        closeOnOutsideClick: false,
        onClose: () => {
            // Cleanup se necessario
        }
    });
    
    // Setup form submit handler
    const form = document.getElementById('add-wine-form-mobile');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            e.stopPropagation();
            saveAddWineMobile(form);
        });
    }
    
    // Setup cancel button
    const cancelBtn = document.querySelector('.add-wine-btn.cancel');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            closeModal();
        });
    }
}

/**
 * Salva il nuovo vino (mobile)
 */
async function saveAddWineMobile(form) {
    const token = window.authToken || (typeof authToken !== 'undefined' ? authToken : null);
    const apiBase = window.API_BASE_URL || (typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : '');
    
    if (!token || !apiBase) {
        addChatMessageMobile('ai', 'Errore: Configurazione non valida.', false, true);
        return;
    }
    
    const data = {};
    
    // Raccogli tutti i valori dal form
    form.querySelectorAll('input, textarea').forEach(input => {
        const name = input.name;
        const value = input.value.trim();
        
        if (name === 'quantity') {
            data[name] = value === '' ? null : parseInt(value);
        } else if (name === 'selling_price' || name === 'cost_price') {
            data[name] = value === '' ? null : parseFloat(value);
        } else {
            data[name] = value === '' ? null : value;
        }
    });
    
    // Validazione: nome obbligatorio
    if (!data.name || !data.name.trim()) {
        addChatMessageMobile('ai', 'Errore: Il nome del vino è obbligatorio.', false, true);
        return;
    }
    
    // Disabilita form durante il salvataggio
    const saveBtn = form.querySelector('.add-wine-btn.save');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Salvataggio...';
    }
    
    try {
        const response = await fetch(`${apiBase}/api/wines`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(data),
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Errore aggiunta vino' }));
            throw new Error(errorData.detail || 'Errore aggiunta vino');
        }
        
        const result = await response.json();
        
        // Chiudi modal
        closeModal();
        
        // Mostra messaggio successo con wine card HTML
        if (result.wine_card_html) {
            addChatMessageMobile('ai', result.wine_card_html, false, false, null, true);
        } else {
            addChatMessageMobile('ai', `✅ Vino "${data.name}" aggiunto con successo!`, false, false);
        }
        
    } catch (error) {
        addChatMessageMobile('ai', `Errore: ${error.message}`, false, true);
    } finally {
        // Riabilita form
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Aggiungi';
        }
    }
}

// ============================================
// INVENTORY VIEWER MOBILE
// ============================================

/**
 * Apre il viewer inventario (mobile)
 */
// ============================================
// INVENTORY VIEWER MOBILE - 3 Screens Design
// ============================================

// State management per navigazione schermate
let inventoryCurrentScreen = 'list'; // 'list', 'details', 'chart'
let inventoryCurrentWine = null;

async function openInventoryViewerMobile() {
    const viewerMobile = document.getElementById('viewerPanel');
    if (!viewerMobile) {
        console.error('[INVENTORY] viewerPanel non trovato');
        return;
    }
    
    // 1. PRIMA apri il viewer (mostra elementi nel DOM)
    openViewer();
    viewerMobile.removeAttribute('hidden');
    
    // 2. POI setup e mostra schermata (elementi ora accessibili)
    setupInventoryMobileFeatures();
    showInventoryScreen('list'); // Imposta inventoryCurrentScreen = 'list'
    setupInventoryBackButton(); // Setup listener bottone indietro DOPO aver impostato lo screen
    
    // 3. INFINE carica dati inventario
    await loadInventoryDataMobile();
}

/**
 * Setup navigazione tra schermate inventario
 * NOTA: Il bottone indietro viene configurato in setupInventoryBackButton()
 * Questa funzione è lasciata per retrocompatibilità ma non configura più il bottone
 */
function setupInventoryNavigation() {
    // Il bottone indietro viene configurato in setupInventoryBackButton()
    // per evitare duplicazione di listener
}

/**
 * Gestisce click bottone indietro
 */
function handleInventoryBack() {
    console.log('[INVENTORY] handleInventoryBack chiamato, inventoryCurrentScreen:', inventoryCurrentScreen);
    
    if (inventoryCurrentScreen === 'details') {
        // Da dettagli → lista
        console.log('[INVENTORY] Da dettagli → lista');
        showInventoryScreen('list');
    } else if (inventoryCurrentScreen === 'chart') {
        // Da grafico → dettagli
        console.log('[INVENTORY] Da grafico → dettagli');
        showInventoryScreen('details');
    } else {
        // Se siamo nella lista, chiudi viewer e torna alla chat
        console.log('[INVENTORY] Dalla lista → chiudo viewer e torno alla chat');
        closeViewer();
    }
}

/**
 * Mostra una specifica schermata inventario
 */
function showInventoryScreen(screen) {
    try {
        inventoryCurrentScreen = screen;
        
        // Nascondi tutte le schermate
        document.querySelectorAll('.inventory-screen').forEach(el => {
            el.classList.add('hidden');
        });
        
        // Mostra schermata richiesta
        const targetScreen = document.getElementById(`inventory-screen-${screen}`);
        if (targetScreen) {
            targetScreen.classList.remove('hidden');
        } else {
            console.error(`[INVENTORY] Schermata ${screen} non trovata: inventory-screen-${screen}`);
        }
        
        // Aggiorna visibilità bottone indietro (sempre visibile)
        const backBtn = document.getElementById('inventory-back-btn-mobile');
        if (backBtn) {
            backBtn.style.display = 'flex';
        }
    } catch (error) {
        console.error('[INVENTORY] Errore in showInventoryScreen:', error);
    }
}

/**
 * Setup bottone indietro
 */
function setupInventoryBackButton() {
    const backBtn = document.getElementById('inventory-back-btn-mobile');
    if (backBtn) {
        // Rimuovi listener esistenti e aggiungi nuovo
        const newBtn = backBtn.cloneNode(true);
        backBtn.parentNode.replaceChild(newBtn, backBtn);
        newBtn.addEventListener('click', handleInventoryBack);
    }
}

/**
 * Setup funzionalità inventario mobile (ricerca, filtri)
 */
function setupInventoryMobileFeatures() {
    // Setup ricerca
    const searchInput = document.getElementById('inventory-search-input-mobile');
    if (searchInput) {
        const newInput = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newInput, searchInput);
        
        let searchTimeout = null;
        newInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                filterInventoryList();
            }, 300);
        });
    }
    
    // Setup dropdown filtri
    const filtersBtn = document.getElementById('inventory-filters-dropdown-btn');
    if (filtersBtn) {
        const newBtn = filtersBtn.cloneNode(true);
        filtersBtn.parentNode.replaceChild(newBtn, filtersBtn);
        
        newBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const menu = document.getElementById('inventory-filters-dropdown-menu');
            if (menu) {
                menu.classList.toggle('hidden');
            }
        });
    }
    
    // Chiudi dropdown quando si clicca fuori
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.inventory-filters-dropdown-mobile')) {
            const menu = document.getElementById('inventory-filters-dropdown-menu');
            if (menu) {
                menu.classList.add('hidden');
            }
        }
    });
    
    // Setup select filtri
    ['type', 'vintage', 'winery', 'supplier'].forEach(filterType => {
        const select = document.getElementById(`inventory-filter-${filterType}-mobile`);
        if (select) {
            const newSelect = select.cloneNode(true);
            select.parentNode.replaceChild(newSelect, select);
            
            newSelect.addEventListener('change', () => {
                filterInventoryList();
            });
        }
    });
    
    // Setup reset filtri
    const resetBtn = document.getElementById('inventory-filter-reset-btn-mobile');
    if (resetBtn) {
        const newBtn = resetBtn.cloneNode(true);
        resetBtn.parentNode.replaceChild(newBtn, resetBtn);
        
        newBtn.addEventListener('click', () => {
            resetInventoryFilters();
        });
    }
}

// ============================================
// FUNZIONI LEGACY RIMOSSE
// Le seguenti funzioni sono state rimosse perché non più utilizzate
// dalla nuova implementazione inventario mobile a 3 schermate:
// - handleViewerSearchMobile() - sostituita da setupInventoryMobileFeatures()
// - setupViewerFiltersMobile() - non più necessaria
// - resetViewerFiltersMobile() - sostituita da resetInventoryFilters()
// - populateFiltersMobile() - sostituita da populateInventoryFilters()
// - setupFilterItemsMobile() - non più necessaria
// - applyViewerFiltersMobile() - sostituita da filterInventoryList()
// ============================================

// Variabili globali per inventario
let inventoryDataMobile = null;
let inventoryFilteredDataMobile = null;

/**
 * Carica dati inventario mobile
 */
async function loadInventoryDataMobile() {
    const token = window.authToken || (typeof authToken !== 'undefined' ? authToken : null);
    const apiBase = window.API_BASE_URL || (typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : '');
    
    if (!token || !apiBase) {
        const wineList = document.getElementById('inventory-wine-list-mobile');
        if (wineList) {
            wineList.innerHTML = '<div class="inventory-loading">Errore: Configurazione non valida</div>';
        }
        return;
    }
    
    const wineList = document.getElementById('inventory-wine-list-mobile');
    if (!wineList) {
        return;
    }
    
    wineList.innerHTML = '<div class="inventory-loading">Caricamento inventario...</div>';
    
    try {
        const response = await fetch(`${apiBase}/api/viewer/snapshot`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Errore nel caricamento dei dati' }));
            throw new Error(errorData.detail || `Errore ${response.status}`);
        }
        
        const data = await response.json();
        inventoryDataMobile = data;
        inventoryFilteredDataMobile = data.rows || [];
        
        // Popola opzioni filtri
        populateInventoryFilters(data);
        
        // Renderizza lista vini
        renderInventoryList(inventoryFilteredDataMobile);
        
    } catch (error) {
        if (wineList) {
            wineList.innerHTML = `<div class="inventory-loading">Errore: ${escapeHtmlMobile(error.message || 'Errore nel caricamento')}</div>`;
        }
    }
}

/**
 * Popola opzioni filtri da dati inventario
 */
function populateInventoryFilters(data) {
    if (!data || !data.facets) return;
    
    // Mappatura filtri HTML -> facets API
    // I facets API restituiscono: 'type', 'vintage', 'winery' (ma i dati rows usano 'type' e 'winery')
    const facetMapping = {
        'type': 'type',           // facet 'type' -> campo row 'type'
        'vintage': 'vintage',     // OK
        'winery': 'winery',       // facet 'winery' -> campo row 'winery'
        'supplier': 'supplier'    // OK (se presente nei facets)
    };
    
    ['type', 'vintage', 'winery', 'supplier'].forEach(filterType => {
        const select = document.getElementById(`inventory-filter-${filterType}-mobile`);
        if (!select) return;
        
        // Mantieni opzione "Tutte"
        const allOption = select.querySelector('option[value=""]');
        const defaultLabel = filterType === 'supplier' || filterType === 'winery' ? 'Tutti' : 'Tutte';
        select.innerHTML = allOption ? allOption.outerHTML : `<option value="">${defaultLabel}</option>`;
        
        // Usa il nome facet corretto
        const facetKey = facetMapping[filterType] || filterType;
        const facets = data.facets[facetKey] || {};
        const sortedItems = Object.entries(facets).sort((a, b) => b[1] - a[1]);
        
        sortedItems.forEach(([value, count]) => {
            if (!value || value === '') return; // Skip valori vuoti
            const option = document.createElement('option');
            option.value = value;
            option.textContent = `${value} (${count})`;
            select.appendChild(option);
        });
    });
}

/**
 * Renderizza lista vini (schermata 1)
 */
function renderInventoryList(wines) {
    const wineList = document.getElementById('inventory-wine-list-mobile');
    if (!wineList) return;
    
    if (!wines || wines.length === 0) {
        wineList.innerHTML = '<div class="inventory-loading">Nessun vino trovato</div>';
        return;
    }
    
    wineList.innerHTML = wines.map(wine => {
        const name = wine.name || wine.Nome || 'Vino sconosciuto';
        const vintage = wine.vintage || wine.Annata || '';
        const displayName = vintage ? `${name} ${vintage}` : name;
        const wineId = wine.id || wine.ID || '';
        
        return `
            <button type="button" class="inventory-wine-item-btn" data-wine-id="${wineId}" data-wine-data='${JSON.stringify(wine).replace(/'/g, "&apos;")}'>
                ${escapeHtmlMobile(displayName)}
            </button>
        `;
    }).join('');
    
    // Attacca listener click
    wineList.querySelectorAll('.inventory-wine-item-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            try {
                const wineDataStr = btn.dataset.wineData;
                if (!wineDataStr) {
                    console.error('[INVENTORY] data-wine-data non trovato');
                    return;
                }
                
                const wineData = JSON.parse(wineDataStr.replace(/&apos;/g, "'"));
                showWineDetails(wineData);
            } catch (error) {
                console.error('[INVENTORY] Errore parsing wine data:', error);
                alert('Errore nel caricamento dettagli vino. Riprova.');
            }
        });
    });
}

/**
 * Mostra dettagli vino (schermata 2)
 */
function showWineDetails(wine) {
    try {
        if (!wine) {
            console.error('[INVENTORY] showWineDetails: wine è null o undefined');
            return;
        }
        
        inventoryCurrentWine = wine;
        
        // Aggiorna banner
        const wineName = wine.name || wine.Nome || 'Vino sconosciuto';
        const vintage = wine.vintage || wine.Annata || '';
        const displayName = vintage ? `${wineName} ${vintage}` : wineName;
        
        const banner = document.getElementById('inventory-wine-name-banner-mobile');
        if (banner) {
            banner.textContent = displayName;
        } else {
            console.error('[INVENTORY] Banner non trovato: inventory-wine-name-banner-mobile');
        }
        
        // Aggiorna quantità
        const qty = wine.qty !== undefined ? wine.qty : (wine.quantity || 0);
        const qtyValue = document.getElementById('inventory-quantity-value-mobile');
        if (qtyValue) {
            qtyValue.textContent = `${qty} bottiglie`;
        } else {
            console.error('[INVENTORY] Quantità value non trovato: inventory-quantity-value-mobile');
        }
        
        // Renderizza form campi vino
        renderWineForm(wine);
        
        // Setup salvataggio modifiche
        setupWineSaveButton();
        
        // Renderizza grafico preview
        renderWineGraphPreview(wine);
        
        // Carica e renderizza log movimenti
        loadWineMovements(wine);
        
        // Mostra schermata dettagli (questa deve essere l'ultima operazione)
        showInventoryScreen('details');
        
    } catch (error) {
        console.error('[INVENTORY] Errore in showWineDetails:', error);
        alert('Errore nel caricamento dettagli vino. Riprova.');
    }
}

/**
 * Renderizza form campi vino
 */
function renderWineForm(wine) {
    const formContainer = document.getElementById('inventory-wine-form-mobile');
    if (!formContainer) return;
    
    const fields = [
        { key: 'name', label: 'NOME', prop: 'name' },
        { key: 'quantity', label: 'QUANTITÀ', prop: 'qty' },
        { key: 'purchase_price', label: 'PREZZO ACQUISTO (€)', prop: 'purchase_price' },
        { key: 'region', label: 'REGIONE', prop: 'region' },
        { key: 'type', label: 'TIPO', prop: 'type' },
        { key: 'grape_variety', label: 'VITIGNO', prop: 'grape_variety' },
        { key: 'alcohol', label: 'GRADAZIONE (% VOL)', prop: 'alcohol' },
        { key: 'producer', label: 'PRODUTTORE', prop: 'producer' },
        { key: 'selling_price', label: 'PREZZO VENDITA (€)', prop: 'selling_price' },
        { key: 'vintage', label: 'ANNATA', prop: 'vintage' },
        { key: 'country', label: 'PAESE', prop: 'country' },
        { key: 'supplier', label: 'FORNITORE', prop: 'supplier' },
        { key: 'classification', label: 'CLASSIFICAZIONE', prop: 'classification' },
    ];
    
    formContainer.innerHTML = fields.map(field => {
        const value = wine[field.prop] || wine[field.key] || '';
        return `
            <div class="inventory-form-field-mobile">
                <label class="inventory-form-label-mobile">${field.label}</label>
                <input type="text" class="inventory-form-input-mobile" 
                       data-field="${field.key}" 
                       value="${escapeHtmlMobile(String(value))}" 
                       ${field.key === 'quantity' || field.key === 'purchase_price' || field.key === 'selling_price' || field.key === 'alcohol' ? 'inputmode="numeric"' : ''}>
            </div>
        `;
    }).join('');
}

/**
 * Renderizza grafico preview (cliccabile)
 */
function renderWineGraphPreview(wine) {
    try {
        const previewContainer = document.getElementById('inventory-graph-preview-mobile');
        if (!previewContainer) {
            console.warn('[INVENTORY] Container grafico preview non trovato');
            return;
        }
        
        const wineName = wine.name || wine.Nome || '';
        if (!wineName) {
            console.warn('[INVENTORY] Nome vino non disponibile per grafico');
            return;
        }
        
        // Carica e renderizza grafico reale (stesso sistema desktop)
        loadAndRenderMovementsChartMobile(
            wineName, 
            'week', // preset default per preview
            previewContainer,
            true // isPreview = true
        );
        
        // Attacca listener click per aprire grafico fullscreen (solo una volta)
        if (!previewContainer.dataset.listenerAttached) {
            previewContainer.dataset.listenerAttached = 'true';
            previewContainer.style.cursor = 'pointer';
            previewContainer.addEventListener('click', () => {
                showWineChart(wine);
            });
        }
    } catch (error) {
        console.error('[INVENTORY] Errore in renderWineGraphPreview:', error);
    }
}

/**
 * Carica log movimenti vino
 */
async function loadWineMovements(wine) {
    const logContainer = document.getElementById('inventory-movements-log-mobile');
    if (!logContainer) return;
    
    logContainer.innerHTML = '<div class="inventory-loading">Caricamento movimenti...</div>';
    
    try {
        const wineName = wine.name || wine.Nome || '';
        if (!wineName) {
            console.warn('[INVENTORY] Nome vino non disponibile per caricamento movimenti');
            renderWineMovements([]);
            return;
        }
        
        const token = window.authToken || (typeof authToken !== 'undefined' ? authToken : null);
        const apiBase = window.API_BASE_URL || (typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : '');
        
        if (!token || !apiBase) {
            console.error('[INVENTORY] Token o API base non disponibili');
            logContainer.innerHTML = '<div class="inventory-loading">Errore configurazione</div>';
            return;
        }
        
        // Fetch movimenti da API
        console.log('[INVENTORY] Caricamento movimenti per:', wineName);
        const response = await fetch(`${apiBase}/api/viewer/movements?wine_name=${encodeURIComponent(wineName)}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('[INVENTORY] Dati movimenti ricevuti:', data);
        
        // Estrai movimenti dalla risposta
        const movements = data.movements || [];
        
        // Renderizza movimenti
        renderWineMovements(movements);
        
    } catch (error) {
        console.error('[INVENTORY] Errore caricamento movimenti:', error);
        logContainer.innerHTML = `<div class="inventory-loading">Errore: ${error.message}</div>`;
    }
}

/**
 * Renderizza log movimenti
 */
function renderWineMovements(movements) {
    const logContainer = document.getElementById('inventory-movements-log-mobile');
    if (!logContainer) return;
    
    if (!movements || movements.length === 0) {
        logContainer.innerHTML = '<div class="inventory-loading">Nessun movimento registrato</div>';
        return;
    }
    
    // Ordina movimenti per data (più recenti prima)
    const sortedMovements = [...movements].sort((a, b) => {
        const dateA = new Date(a.at || a.date || 0);
        const dateB = new Date(b.at || b.date || 0);
        return dateB - dateA; // Ordine decrescente (più recente prima)
    });
    
    logContainer.innerHTML = sortedMovements.map((mov, index) => {
        // Determina tipo movimento
        const movementType = mov.type || '';
        const isConsumo = movementType.toLowerCase() === 'consumo' || movementType.toLowerCase() === 'consumption';
        const type = isConsumo ? 'consumed' : 'refilled';
        const label = isConsumo ? 'CONSUMATO' : 'RIFORNITO';
        
        // Quantità
        const qtyChange = Math.abs(mov.quantity_change || mov.quantity || 0);
        const qtyBefore = mov.quantity_before || 0;
        const qtyAfter = mov.quantity_after || 0;
        
        // Data e ora
        const dateStr = mov.at || mov.date || mov.created_at || '';
        let formattedDate = 'N/A';
        let formattedTime = '';
        
        if (dateStr) {
            try {
                const date = new Date(dateStr);
                if (!isNaN(date.getTime())) {
                    formattedDate = date.toLocaleDateString('it-IT', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                    });
                    formattedTime = date.toLocaleTimeString('it-IT', {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                }
            } catch (e) {
                console.warn('[INVENTORY] Errore formattazione data movimento:', e);
                formattedDate = dateStr;
            }
        }
        
        return `
            <div class="inventory-movement-card-mobile ${type}">
                <div class="inventory-movement-header-mobile">
                    <div class="inventory-movement-label-mobile">${label}</div>
                    <div class="inventory-movement-quantity-mobile">${qtyChange} bottiglie</div>
                </div>
                <div class="inventory-movement-details-mobile">
                    <div class="inventory-movement-stock-mobile">
                        Da ${qtyBefore} → ${qtyAfter} bottiglie
                    </div>
                    <div class="inventory-movement-date-mobile">
                        ${formattedDate} ${formattedTime ? 'alle ' + formattedTime : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Mostra grafico fullscreen (schermata 3)
 */
function showWineChart(wine) {
    inventoryCurrentWine = wine;
    
    // Aggiorna banner
    const wineName = wine.name || wine.Nome || 'Vino sconosciuto';
    const vintage = wine.vintage || wine.Annata || '';
    const displayName = vintage ? `${wineName} ${vintage}` : wineName;
    
    const banner = document.getElementById('inventory-wine-name-chart-mobile');
    if (banner) {
        banner.textContent = displayName;
    }
    
    // Renderizza grafico
    renderWineChartFullscreen(wine);
    
    // Mostra schermata grafico
    showInventoryScreen('chart');
}

// Variabile globale per gestire istanza grafico fullscreen
let currentMobileChartInstance = null;

/**
 * Renderizza grafico fullscreen
 */
function renderWineChartFullscreen(wine, period = 'week') {
    try {
        const container = document.getElementById('inventory-chart-container-mobile');
        if (!container) {
            console.error('[INVENTORY] Container grafico fullscreen non trovato');
            return;
        }
        
        const wineName = wine.name || wine.Nome || '';
        if (!wineName) {
            console.error('[INVENTORY] Nome vino non disponibile per grafico');
            return;
        }
        
        // Setup filtri periodo
        setupPeriodFilters();
        
        // Carica e renderizza grafico reale (stesso sistema desktop)
        loadAndRenderMovementsChartMobile(
            wineName,
            period,
            container,
            false // isPreview = false (fullscreen)
        );
    } catch (error) {
        console.error('[INVENTORY] Errore in renderWineChartFullscreen:', error);
    }
}

/**
 * Carica e renderizza grafico movimenti (usando stesso sistema desktop)
 */
async function loadAndRenderMovementsChartMobile(wineName, preset, container, isPreview = false) {
    try {
        const token = window.authToken || (typeof authToken !== 'undefined' ? authToken : null);
        const apiBase = window.API_BASE_URL || (typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : '');
        
        if (!token || !apiBase) {
            console.error('[INVENTORY] Token o API base non disponibili');
            container.innerHTML = '<div class="inventory-loading">Errore configurazione</div>';
            return;
        }
        
        // Mostra loading
        container.innerHTML = '<div class="inventory-loading">Caricamento movimenti...</div>';
        
        // Fetch movimenti
        console.log('[INVENTORY] Caricamento movimenti per:', wineName);
        const response = await fetch(`${apiBase}/api/viewer/movements?wine_name=${encodeURIComponent(wineName)}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('[INVENTORY] Dati movimenti ricevuti:', data);
        
        // Distruggi grafico precedente se esiste (sia preview che fullscreen)
        if (currentMobileChartInstance) {
            try {
                if (typeof currentMobileChartInstance.destroy === 'function') {
                    currentMobileChartInstance.destroy();
                }
            } catch (e) {
                console.warn('[INVENTORY] Errore distruzione grafico precedente:', e);
            }
            currentMobileChartInstance = null;
        }
        
        // Verifica che Chart.js e AnchoredFlowStockChart siano disponibili
        if (!window.Chart) {
            console.error('[INVENTORY] Chart.js non disponibile');
            container.innerHTML = '<div class="inventory-loading">Chart.js non caricato</div>';
            return;
        }
        
        if (!window.AnchoredFlowStockChart || !window.AnchoredFlowStockChart.create) {
            console.error('[INVENTORY] AnchoredFlowStockChart non disponibile');
            container.innerHTML = '<div class="inventory-loading">Componente grafico non disponibile</div>';
            return;
        }
        
        // Pulisci container e crea canvas
        container.innerHTML = '<canvas></canvas>';
        const canvas = container.querySelector('canvas');
        
        if (!canvas) {
            console.error('[INVENTORY] Canvas non creato');
            return;
        }
        
        // Per preview, usa dimensioni fisse piccole
        // Per fullscreen, usa dimensioni container
        if (isPreview) {
            // Preview: dimensioni fisse compatte
            const previewWidth = 300;
            const previewHeight = 150;
            canvas.width = previewWidth;
            canvas.height = previewHeight;
            canvas.style.width = previewWidth + 'px';
            canvas.style.height = previewHeight + 'px';
        } else {
            // Fullscreen: aspetta che container sia visibile e abbia dimensioni
            const ensureContainerReady = () => {
                const rect = container.getBoundingClientRect();
                const hasDimensions = rect.width > 0 && rect.height > 0;
                return hasDimensions;
            };
            
            // Se container non è pronto, aspetta
            if (!ensureContainerReady()) {
                await new Promise(resolve => {
                    const checkReady = () => {
                        if (ensureContainerReady()) {
                            resolve();
                        } else {
                            requestAnimationFrame(checkReady);
                        }
                    };
                    checkReady();
                });
            }
            
            const containerRect = container.getBoundingClientRect();
            const containerHeight = Math.max(400, window.innerHeight * 0.5);
            canvas.style.width = '100%';
            canvas.style.height = containerHeight + 'px';
            canvas.width = containerRect.width || container.clientWidth || 800;
            canvas.height = containerHeight;
        }
        
        // Crea grafico usando stesso componente desktop
        console.log('[INVENTORY] Creazione grafico con preset:', preset);
        currentMobileChartInstance = window.AnchoredFlowStockChart.create(container, data, {
            preset: preset,
            now: new Date(),
        });
        
        if (!currentMobileChartInstance) {
            throw new Error('Grafico non creato (ritornato null)');
        }
        
        console.log('[INVENTORY] Grafico creato con successo');
        
    } catch (error) {
        console.error('[INVENTORY] Errore caricamento/rendering grafico:', error);
        container.innerHTML = `<div class="inventory-loading">Errore: ${error.message}</div>`;
    }
}

/**
 * Filtra lista inventario
 */
function filterInventoryList() {
    if (!inventoryDataMobile || !inventoryDataMobile.rows) return;
    
    let filtered = [...inventoryDataMobile.rows];
    
    // Ricerca testuale (nome, produttore, annata, tipo)
    const searchInput = document.getElementById('inventory-search-input-mobile');
    if (searchInput && searchInput.value.trim()) {
        const query = searchInput.value.toLowerCase().trim();
        filtered = filtered.filter(wine => {
            // Supporta sia nomi nuovi (da API snapshot) che vecchi (retrocompatibilità)
            const name = (wine.name || wine.Nome || '').toLowerCase();
            const vintage = String(wine.vintage || wine.Annata || '').toLowerCase();
            const producer = (wine.producer || wine.winery || '').toLowerCase();
            const wineType = (wine.type || wine.wine_type || '').toLowerCase();
            const supplier = (wine.supplier || '').toLowerCase();
            
            // Cerca in nome, annata, produttore, tipo, fornitore
            return name.includes(query) || 
                   vintage.includes(query) || 
                   producer.includes(query) ||
                   wineType.includes(query) ||
                   supplier.includes(query);
        });
    }
    
    // Filtri - i dati rows usano: 'type', 'winery', 'vintage', 'supplier'
    // (l'API snapshot mappa wine_type -> type, producer -> winery)
    ['type', 'vintage', 'winery', 'supplier'].forEach(filterType => {
        const select = document.getElementById(`inventory-filter-${filterType}-mobile`);
        if (select && select.value) {
            filtered = filtered.filter(wine => {
                // I dati rows dall'API snapshot usano direttamente 'type', 'winery', 'vintage'
                // Supporta anche nomi alternativi per retrocompatibilità
                const wineValue = wine[filterType] || 
                                  (filterType === 'type' ? (wine.wine_type || wine.type) : null) ||
                                  (filterType === 'winery' ? (wine.producer || wine.winery) : null) ||
                                  '';
                return String(wineValue) === String(select.value);
            });
        }
    });
    
    inventoryFilteredDataMobile = filtered;
    renderInventoryList(filtered);
}

/**
 * Reset filtri inventario
 */
function resetInventoryFilters() {
    const searchInput = document.getElementById('inventory-search-input-mobile');
    if (searchInput) {
        searchInput.value = '';
    }
    
    ['type', 'vintage', 'winery', 'supplier'].forEach(filterType => {
        const select = document.getElementById(`inventory-filter-${filterType}-mobile`);
        if (select) {
            select.value = '';
        }
    });
    
    filterInventoryList();
}

/**
 * Setup salvataggio modifiche vino
 */
function setupWineSaveButton() {
    const saveBtn = document.getElementById('inventory-save-btn-mobile');
    if (saveBtn) {
        const newBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newBtn, saveBtn);
        
        newBtn.addEventListener('click', async () => {
            await saveWineChanges();
        });
    }
}

/**
 * Salva modifiche vino
 */
async function saveWineChanges() {
    if (!inventoryCurrentWine) return;
    
    const formContainer = document.getElementById('inventory-wine-form-mobile');
    if (!formContainer) return;
    
    const inputs = formContainer.querySelectorAll('.inventory-form-input-mobile');
    const changes = {};
    
    inputs.forEach(input => {
        const field = input.dataset.field;
        const value = input.value.trim();
        if (value !== String(inventoryCurrentWine[field] || '')) {
            changes[field] = value;
        }
    });
    
    if (Object.keys(changes).length === 0) {
        alert('Nessuna modifica da salvare');
        return;
    }
    
    // TODO: Implementare salvataggio via API
    console.log('Salvataggio modifiche:', changes);
    alert('Funzionalità salvataggio in sviluppo');
}

/**
 * Setup filtri periodo grafico
 */
function setupPeriodFilters() {
    const periodBtns = document.querySelectorAll('.inventory-period-btn');
    periodBtns.forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        
        newBtn.addEventListener('click', () => {
            // Rimuovi active da tutti
            document.querySelectorAll('.inventory-period-btn').forEach(b => {
                b.classList.remove('active');
            });
            
            // Aggiungi active a quello cliccato
            newBtn.classList.add('active');
            
            // Renderizza grafico con periodo selezionato
            const period = newBtn.dataset.period;
            if (inventoryCurrentWine) {
                renderWineChartFullscreen(inventoryCurrentWine, period);
            }
        });
    });
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
        closeModal,
        
        // Conversations
        loadConversations: loadConversationsMobile,
        selectConversation: selectConversationMobile,
        loadMessages: loadConversationMessagesMobile,
        deleteConversation: deleteConversationMobile,
        newChat: handleNewChatMobile,
        clearMessages: clearChatMessagesMobile,
        showWelcome: showWelcomeMessageMobile,
        
        // Add Wine & Inventory
        openAddWineModal: openAddWineModalMobile,
        openInventoryViewer: openInventoryViewerMobile
    };
}


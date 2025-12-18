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
    
    // Setup overlay
    setupSidebarOverlay();
    
    // Setup viewer close
    setupViewerClose();
    
    // Setup conversazioni click (auto-close sidebar)
    setupConversationsClick();
    
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
        const apiBaseUrl = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : (window.API_BASE_URL || 'http://localhost:8000');
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
    const token = typeof authToken !== 'undefined' ? authToken : window.authToken;
    if (!token || !conversationId) return;
    
    // Pulisci messaggi correnti
    clearChatMessagesMobile(false);
    
    try {
        const response = await window.ChatAPI?.loadMessages(conversationId);
        
        // Gestisci sia array diretto che oggetto con proprietà messages
        let messages = Array.isArray(response) ? response : (response?.messages || []);
        
        if (!messages || messages.length === 0) {
            showWelcomeMessageMobile();
            return;
        }
        
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
        console.error('Errore caricamento messaggi mobile:', error);
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
    
    // Invia al server
    try {
        const response = await window.ChatAPI?.sendMessage(message);
        
        // Rimuovi messaggio loading
        if (loadingMessage) {
            loadingMessage.remove();
        }
        
        // Gestisci nuovo conversation_id se ricevuto
        if (response && response.conversation_id) {
            const newConversationId = response.conversation_id;
            if (newConversationId !== window.currentConversationId) {
                window.currentConversationId = newConversationId;
                localStorage.setItem('current_conversation_id', newConversationId.toString());
                // Ricarica lista conversazioni per aggiornare UI
                await loadConversationsMobile();
            }
        }
        
        if (response && response.message) {
            addChatMessageMobile('ai', response.message, false, false, null, response.is_html);
        }
    } catch (error) {
        // Rimuovi messaggio loading
        if (loadingMessage) {
            loadingMessage.remove();
        }
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
        closeModal,
        
        // Conversations
        loadConversations: loadConversationsMobile,
        selectConversation: selectConversationMobile,
        loadMessages: loadConversationMessagesMobile,
        deleteConversation: deleteConversationMobile,
        newChat: handleNewChatMobile,
        clearMessages: clearChatMessagesMobile,
        showWelcome: showWelcomeMessageMobile
    };
}

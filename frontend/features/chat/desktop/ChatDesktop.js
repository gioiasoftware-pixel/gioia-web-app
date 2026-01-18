/**
 * ChatDesktop - Implementazione chat per layout desktop
 * 
 * Gestisce solo il layout desktop, nessuna logica condivisa con mobile
 * Usa ChatAPI per business logic e ChatSelectors per selettori DOM
 */

/**
 * Inizializza la chat desktop
 */
function initChatDesktop() {
    // Verifica che siamo nel namespace desktop
    if (!window.LayoutBoundary?.isDesktopNamespace()) {
        console.warn('[ChatDesktop] Namespace non desktop, skip inizializzazione');
        return;
    }
    
    const selectors = window.ChatSelectors?.get();
    if (!selectors || selectors.layout !== 'desktop') {
        console.warn('[ChatDesktop] Selectors non disponibili o layout non desktop');
        return;
    }
    
    // Setup form submit
    const form = selectors.form();
    if (form) {
        form.addEventListener('submit', handleChatSubmitDesktop);
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

    window.addEventListener('chat:conversation-changed', (event) => {
        const conversationId = event?.detail?.conversationId;
        if (!conversationId) return;
        ensureConversationSidebarItem(conversationId);
        setActiveConversationSidebarItem(conversationId);
    });
    
    console.log('[ChatDesktop] Inizializzato');
}

/**
 * Gestisce il submit del form chat desktop
 */
async function handleChatSubmitDesktop(e) {
    e.preventDefault();
    
    const selectors = window.ChatSelectors?.get();
    const input = selectors?.input();
    const form = selectors?.form();
    
    if (!input || !form) {
        console.error('[ChatDesktop] Input o form non trovati');
        return;
    }
    
    const message = input.value.trim();
    if (!message) return;
    
    // Pulisci input
    input.value = '';
    
    // Aggiungi messaggio utente
    addChatMessageDesktop('user', message);
    
    // Invia al server
    try {
        const response = await window.ChatAPI?.sendMessage(message);
        if (response && response.message) {
            addChatMessageDesktop('ai', response.message, false, false, null, response.is_html);
        }

        const conversationId = response?.conversation_id;
        if (conversationId !== undefined && conversationId !== null) {
            window.currentConversationId = conversationId;
            ensureConversationSidebarItem(conversationId);
            setActiveConversationSidebarItem(conversationId);
        }
    } catch (error) {
        console.error('[ChatDesktop] Errore invio messaggio:', error);
        addChatMessageDesktop('ai', 'Errore invio messaggio', false, true);
    }
}

/**
 * Aggiunge un messaggio alla chat desktop
 */
function addChatMessageDesktop(role, content, isLoading = false, isError = false, wineData = null, isHtml = false) {
    const selectors = window.ChatSelectors?.get();
    const scrollContainer = selectors?.scrollContainer();
    
    if (!scrollContainer) {
        console.error('[ChatDesktop] Scroll container non trovato');
        return null;
    }
    
    // Desktop: NON trasforma HTML (il transformer trasforma solo su mobile)
    // Usa la funzione esistente addChatMessage che gestisce entrambi i layout
    const messageElement = addChatMessage(role, content, isLoading, isError, wineData, isHtml);
    
            // Setup bottoni wine card se è HTML con wine card
            if (isHtml && role === 'ai' && messageElement && window.WineCardButtons) {
                setTimeout(() => {
                    window.WineCardButtons.setup(messageElement); // Setup bottoni movimento
                    window.WineCardButtons.setupInfoButtons(messageElement); // Setup bottoni info (wrapper sceglie mobile/desktop automaticamente)
                }, 100);
            }
    
    return messageElement;
}

function ensureConversationSidebarItem(conversationId, title = 'Nuova chat') {
    const selectors = window.ChatSelectors?.get();
    const sidebarList = selectors?.sidebarList();
    if (!sidebarList) return;

    const existingItem = sidebarList.querySelector?.(`[data-conversation-id="${conversationId}"]`);
    if (existingItem) return;

    const item = document.createElement('div');
    item.className = 'chat-sidebar-item';
    item.dataset.conversationId = String(conversationId);
    item.setAttribute('data-conversation-id', String(conversationId));

    const content = document.createElement('div');
    const titleEl = document.createElement('div');
    titleEl.className = 'chat-sidebar-item-title';
    titleEl.textContent = title;

    const timeWrapper = document.createElement('div');
    timeWrapper.className = 'chat-sidebar-item-time-wrapper';

    const timeEl = document.createElement('span');
    timeEl.className = 'chat-sidebar-item-time';
    timeEl.textContent = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

    timeWrapper.appendChild(timeEl);
    content.appendChild(titleEl);
    content.appendChild(timeWrapper);

    const deleteButton = document.createElement('button');
    deleteButton.className = 'chat-sidebar-item-delete';
    deleteButton.setAttribute('type', 'button');
    deleteButton.setAttribute('title', 'Elimina chat');
    deleteButton.setAttribute('data-conversation-id', String(conversationId));
    deleteButton.textContent = '×';

    item.appendChild(content);
    item.appendChild(deleteButton);

    sidebarList.prepend(item);
}

function setActiveConversationSidebarItem(conversationId) {
    const selectors = window.ChatSelectors?.get();
    const sidebarList = selectors?.sidebarList();
    if (!sidebarList) return;

    sidebarList.querySelectorAll?.('.chat-sidebar-item').forEach((item) => {
        const isActive = item.getAttribute('data-conversation-id') === String(conversationId);
        item.classList.toggle('active', isActive);
    });
}

// Export per uso globale
if (typeof window !== 'undefined') {
    window.ChatDesktop = {
        init: initChatDesktop,
        handleSubmit: handleChatSubmitDesktop,
        addMessage: addChatMessageDesktop
    };
    
    // Auto-inizializzazione quando DOM è pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initChatDesktop();
        });
    } else {
        // DOM già caricato
        initChatDesktop();
    }
}




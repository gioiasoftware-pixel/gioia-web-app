/**
 * Chat Selectors - Selettori DOM comuni con factory pattern
 * 
 * Fornisce selettori corretti in base al layout attivo (mobile/desktop)
 * Isola la logica di selezione elementi dal resto del codice
 * 
 * REGOLA: Tutti i selettori partono dal root container con data-layout-root
 * per evitare collisioni tra mobile e desktop
 */

/**
 * Ottiene il root container per il layout corrente
 * @returns {HTMLElement|null} Root container con data-layout-root
 */
function getLayoutRoot() {
    // Cerca per data-layout-root
    const mobileRoot = document.querySelector('[data-layout-root="mobile"]');
    const desktopRoot = document.querySelector('[data-layout-root="desktop"]');
    
    // Fallback: usa namespace class
    if (!mobileRoot && !desktopRoot) {
        if (document.documentElement.classList.contains('mobileRoot')) {
            return document.getElementById('mobile-layout');
        }
        if (document.documentElement.classList.contains('desktopRoot')) {
            return document.getElementById('desktop-layout');
        }
    }
    
    return mobileRoot || desktopRoot || null;
}

/**
 * Factory per selettori chat in base al layout
 */
function createChatSelectors() {
    const root = getLayoutRoot();
    const isMobile = root?.getAttribute('data-layout-root') === 'mobile' || 
                     document.documentElement.classList.contains('mobileRoot');
    
    if (isMobile) {
        return {
            // Mobile selectors - partono dal root container
            scrollContainer: () => {
                if (!root) return null;
                return root.querySelector('#chatScroll') || root.querySelector('.mScroller');
            },
            form: () => root?.querySelector('#chat-form-mobile') || null,
            input: () => root?.querySelector('#chat-input-mobile') || null,
            sendButton: () => root?.querySelector('#chat-send-btn-mobile') || null,
            sidebar: () => root?.querySelector('#chatSidebar') || null,
            sidebarList: () => root?.querySelector('#chat-sidebar-list-mobile') || null,
            sidebarToggle: () => root?.querySelector('#sidebar-toggle') || null,
            newChatButton: () => root?.querySelector('#new-chat-btn-mobile') || null,
            layout: 'mobile',
            root: root
        };
    } else {
        return {
            // Desktop selectors - partono dal root container
            scrollContainer: () => {
                if (!root) return null;
                const wrapper = root.querySelector('#chat-messages-scroll-wrapper');
                if (wrapper) return wrapper;
                const container = root.querySelector('#chat-messages');
                if (container) {
                    return container.querySelector('.chat-messages-scroll-wrapper') || container;
                }
                return null;
            },
            form: () => root?.querySelector('#chat-form') || null,
            input: () => root?.querySelector('#chat-input') || null,
            sendButton: () => root?.querySelector('#chat-send-btn') || null,
            sidebar: () => root?.querySelector('#chat-sidebar') || null,
            sidebarList: () => root?.querySelector('#chat-sidebar-list') || null,
            sidebarToggle: () => root?.querySelector('#sidebar-toggle-desktop') || null,
            newChatButton: () => root?.querySelector('#new-chat-btn') || null,
            layout: 'desktop',
            root: root
        };
    }
}

/**
 * Ottiene i selettori correnti (singleton pattern)
 */
let currentSelectors = null;

function getChatSelectors() {
    if (!currentSelectors) {
        currentSelectors = createChatSelectors();
    }
    return currentSelectors;
}

/**
 * Resetta i selettori (da chiamare quando cambia layout)
 */
function resetChatSelectors() {
    currentSelectors = null;
}

/**
 * Inizializza listener per prevenire refresh su Android quando si apre la tastiera
 * CRITICO: Previene il problema di refresh pagina su Android verticale
 */
function initChatFormSubmitPrevention() {
    // Attendi che il DOM sia pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initChatFormSubmitPrevention);
        return;
    }
    
    // Verifica se siamo su mobile
    const isMobile = document.documentElement.classList.contains('mobileRoot') ||
                     document.querySelector('[data-layout-root="mobile"]') !== null;
    
    if (!isMobile) {
        return; // Solo per mobile
    }
    
    // Trova il form chat mobile
    const chatForm = document.getElementById('chat-form-mobile');
    if (!chatForm) {
        // Riprova dopo un breve delay se il form non è ancora disponibile
        setTimeout(initChatFormSubmitPrevention, 100);
        return;
    }
    
    // Listener esplicito con capture e preventDefault per prevenire submit implicito su Android
    // Questo previene il refresh della pagina quando la tastiera si apre
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        console.log('[ChatSelectors] Submit prevenuto (previene refresh Android)');
        return false;
    }, { capture: true, passive: false });
    
    // Aggiungi anche listener sull'input per prevenire comportamenti indesiderati
    const chatInput = document.getElementById('chat-input-mobile');
    if (chatInput) {
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.stopPropagation();
            }
        });
        
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.stopPropagation();
            }
        });
    }
    
    console.log('[ChatSelectors] Listener submit prevenzione aggiunti per Android');
}

// Export per uso globale
if (typeof window !== 'undefined') {
    window.ChatSelectors = {
        get: getChatSelectors,
        reset: resetChatSelectors,
        create: createChatSelectors,
        initFormSubmitPrevention: initChatFormSubmitPrevention
    };
    
    // Auto-inizializza la prevenzione submit quando il file viene caricato
    initChatFormSubmitPrevention();
}




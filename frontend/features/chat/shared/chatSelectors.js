/**
 * Chat Selectors - Selettori DOM comuni con factory pattern
 * 
 * Fornisce selettori corretti in base al layout attivo (mobile/desktop)
 * Isola la logica di selezione elementi dal resto del codice
 */

/**
 * Factory per selettori chat in base al layout
 */
function createChatSelectors() {
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
        return {
            // Mobile selectors
            scrollContainer: () => document.getElementById('chatScroll') || document.querySelector('.mScroller'),
            form: () => document.getElementById('chat-form-mobile'),
            input: () => document.getElementById('chat-input-mobile'),
            sendButton: () => document.getElementById('chat-send-btn-mobile'),
            sidebar: () => document.getElementById('chatSidebar'),
            sidebarList: () => document.getElementById('chat-sidebar-list-mobile'),
            sidebarToggle: () => document.getElementById('sidebar-toggle'),
            newChatButton: () => document.getElementById('new-chat-btn-mobile'),
            layout: 'mobile'
        };
    } else {
        return {
            // Desktop selectors
            scrollContainer: () => {
                let wrapper = document.getElementById('chat-messages-scroll-wrapper');
                if (!wrapper) {
                    const container = document.getElementById('chat-messages');
                    if (container) {
                        wrapper = container.querySelector('.chat-messages-scroll-wrapper');
                    }
                }
                return wrapper || document.getElementById('chat-messages');
            },
            form: () => document.getElementById('chat-form'),
            input: () => document.getElementById('chat-input'),
            sendButton: () => document.getElementById('chat-send-btn'),
            sidebar: () => document.getElementById('chat-sidebar'),
            sidebarList: () => document.getElementById('chat-sidebar-list'),
            sidebarToggle: () => document.getElementById('sidebar-toggle-desktop'),
            newChatButton: () => document.getElementById('new-chat-btn'),
            layout: 'desktop'
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

// Export per uso globale
if (typeof window !== 'undefined') {
    window.ChatSelectors = {
        get: getChatSelectors,
        reset: resetChatSelectors,
        create: createChatSelectors
    };
}

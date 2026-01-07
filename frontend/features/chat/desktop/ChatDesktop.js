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
    
    // Usa la funzione esistente addChatMessage che gestisce entrambi i layout
    // oppure crea una versione desktop-specifica se necessario
    const messageElement = addChatMessage(role, content, isLoading, isError, wineData, isHtml);
    
            // Setup bottoni wine card se è HTML con wine card
            if (isHtml && role === 'ai' && messageElement && window.WineCardButtons) {
                setTimeout(() => {
                    window.WineCardButtons.setup(messageElement); // Setup bottoni movimento
                    window.WineCardButtons.setupInfoButtonsDesktop(messageElement); // Setup bottoni info DESKTOP (funzione wrapper sceglie automaticamente)
                }, 100);
            }
    
    return messageElement;
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




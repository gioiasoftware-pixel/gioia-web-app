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
    const selectors = window.ChatSelectors?.get();
    if (!selectors || selectors.layout !== 'mobile') {
        console.warn('[ChatMobile] Selectors non disponibili o layout non mobile');
        return;
    }
    
    // Setup form submit
    const form = selectors.form();
    if (form) {
        form.addEventListener('submit', handleChatSubmitMobile);
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
    
    console.log('[ChatMobile] Inizializzato');
}

/**
 * Gestisce il submit del form chat mobile
 */
async function handleChatSubmitMobile(e) {
    e.preventDefault();
    
    const selectors = window.ChatSelectors?.get();
    const input = selectors?.input();
    const form = selectors?.form();
    
    if (!input || !form) {
        console.error('[ChatMobile] Input o form non trovati');
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
        console.error('[ChatMobile] Errore invio messaggio:', error);
        addChatMessageMobile('ai', 'Errore invio messaggio', false, true);
    }
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
    // oppure crea una versione mobile-specifica se necessario
    return addChatMessage(role, content, isLoading, isError, wineData, isHtml);
}

// Export per uso globale
if (typeof window !== 'undefined') {
    window.ChatMobile = {
        init: initChatMobile,
        handleSubmit: handleChatSubmitMobile,
        addMessage: addChatMessageMobile
    };
}

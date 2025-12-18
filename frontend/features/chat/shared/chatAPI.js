/**
 * Chat API - Business logic condivisa tra mobile e desktop
 * 
 * Contiene solo logica di business, nessuna responsabilità di layout/UI
 */

/**
 * Invia un messaggio alla chat
 * @param {string} message - Testo del messaggio
 * @returns {Promise<Object>} Risposta dell'API
 */
async function sendChatMessage(message) {
    if (!authToken) {
        throw new Error('Token di autenticazione non disponibile');
    }
    
    const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
            message: message,
            conversation_id: currentConversationId
        })
    });
    
    if (!response.ok) {
        throw new Error(`Errore invio messaggio: ${response.status}`);
    }
    
    return await response.json();
}

/**
 * Carica le conversazioni dell'utente
 * @returns {Promise<Array>} Lista delle conversazioni
 */
async function loadConversationsAPI() {
    if (!authToken) {
        throw new Error('Token di autenticazione non disponibile');
    }
    
    const response = await fetch(`${API_BASE_URL}/api/conversations`, {
        headers: {
            'Authorization': `Bearer ${authToken}`
        }
    });
    
    if (!response.ok) {
        throw new Error(`Errore caricamento conversazioni: ${response.status}`);
    }
    
    return await response.json();
}

/**
 * Carica i messaggi di una conversazione
 * @param {number} conversationId - ID della conversazione
 * @returns {Promise<Array>} Lista dei messaggi
 */
async function loadConversationMessagesAPI(conversationId) {
    if (!authToken) {
        throw new Error('Token di autenticazione non disponibile');
    }
    
    const response = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}/messages`, {
        headers: {
            'Authorization': `Bearer ${authToken}`
        }
    });
    
    if (!response.ok) {
        throw new Error(`Errore caricamento messaggi: ${response.status}`);
    }
    
    return await response.json();
}

/**
 * Elimina una conversazione
 * @param {number} conversationId - ID della conversazione
 * @returns {Promise<void>}
 */
async function deleteConversationAPI(conversationId) {
    if (!authToken) {
        throw new Error('Token di autenticazione non disponibile');
    }
    
    const response = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${authToken}`
        }
    });
    
    if (!response.ok) {
        throw new Error(`Errore eliminazione conversazione: ${response.status}`);
    }
}

// Export per uso globale
if (typeof window !== 'undefined') {
    window.ChatAPI = {
        sendMessage: sendChatMessage,
        loadConversations: loadConversationsAPI,
        loadMessages: loadConversationMessagesAPI,
        deleteConversation: deleteConversationAPI
    };
}

/**
 * Chat API - Business logic condivisa tra mobile e desktop
 * 
 * Contiene solo logica di business, nessuna responsabilità di layout/UI
 */

/**
 * Invia un messaggio alla chat
 * @param {string} message - Testo del messaggio
 * @param {number|null} conversationId - ID conversazione (opzionale, usa window.currentConversationId se non fornito)
 * @returns {Promise<Object>} Risposta dell'API
 */
async function sendChatMessage(message, conversationId = null) {
    // Usa conversationId passato, altrimenti prova a recuperarlo da variabili globali
    const finalConversationId = conversationId || 
                                (typeof window !== 'undefined' && window.currentConversationId) ||
                                (typeof currentConversationId !== 'undefined' ? currentConversationId : null);
    
    const token = (typeof window !== 'undefined' && window.authToken) || 
                  (typeof authToken !== 'undefined' ? authToken : null);
    const apiUrl = (typeof window !== 'undefined' && window.API_BASE_URL) || 
                   (typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : null);
    
    if (!token) {
        throw new Error('Token di autenticazione non disponibile');
    }
    
    if (!apiUrl) {
        throw new Error('API_BASE_URL non disponibile');
    }
    
    // Costruisci body - non includere conversation_id se è null
    const requestBody = {
        message: message
    };
    if (finalConversationId !== null && finalConversationId !== undefined) {
        requestBody.conversation_id = finalConversationId;
    }
    const apiEndpoint = `${apiUrl}/api/chat/message`;
    
    console.log('[ChatAPI] 📤 Invio messaggio:', {
        endpoint: apiEndpoint,
        message: message.substring(0, 50),
        conversation_id: finalConversationId,
        hasToken: !!token
    });
    
    const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error('[ChatAPI] ❌ Errore risposta:', {
            status: response.status,
            statusText: response.statusText,
            url: response.url,
            errorText: errorText.substring(0, 200)
        });
        throw new Error(`Errore invio messaggio: ${response.status} ${errorText ? `- ${errorText.substring(0, 100)}` : ''}`);
    }
    
    const result = await response.json();
    console.log('[ChatAPI] ✅ Messaggio inviato con successo:', {
        hasMessage: !!result.message,
        hasMetadata: !!result.metadata,
        conversationId: result.conversation_id
    });

    if (typeof window !== 'undefined' && result?.conversation_id !== undefined && result?.conversation_id !== null) {
        const previousConversationId = window.currentConversationId;
        window.currentConversationId = result.conversation_id;

        if (previousConversationId !== result.conversation_id) {
            window.dispatchEvent(new CustomEvent('chat:conversation-changed', {
                detail: {
                    conversationId: result.conversation_id,
                    source: 'chat:message'
                }
            }));
        }
    }
    
    return result;
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

/**
 * Invia messaggio audio alla chat
 * @param {Blob} audioBlob - File audio registrato
 * @param {number|null} conversationId - ID conversazione (opzionale)
 * @returns {Promise<Object>} Risposta dell'API
 */
async function sendAudioMessage(audioBlob, conversationId = null) {
    console.log('[ChatAPI] 🎤 sendAudioMessage chiamato:', {
        blobSize: audioBlob.size,
        blobSizeKB: (audioBlob.size / 1024).toFixed(2),
        blobType: audioBlob.type,
        conversationId: conversationId
    });
    
    if (!authToken) {
        console.error('[ChatAPI] ❌ Token di autenticazione non disponibile');
        throw new Error('Token di autenticazione non disponibile');
    }
    
    const formData = new FormData();
    formData.append('audio', audioBlob, 'audio.webm');
    if (conversationId) {
        formData.append('conversation_id', conversationId.toString());
    }
    
    console.log('[ChatAPI] Invio richiesta POST a /api/chat/audio...');
    const startTime = Date.now();
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/chat/audio`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: formData
        });
        
        const duration = Date.now() - startTime;
        console.log(`[ChatAPI] Risposta ricevuta (${duration}ms):`, {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('[ChatAPI] ❌ Errore risposta server:', errorData);
            throw new Error(errorData.detail || `Errore invio audio: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('[ChatAPI] ✅ Risposta audio processata:', {
            hasMessage: !!result.message,
            hasMetadata: !!result.metadata,
            transcribedText: result.metadata?.transcribed_text,
            messageLength: result.message?.length
        });
        
        return result;
    } catch (error) {
        console.error('[ChatAPI] ❌ Errore durante sendAudioMessage:', error);
        throw error;
    }
}

// Export per uso globale
if (typeof window !== 'undefined') {
    window.ChatAPI = {
        sendMessage: sendChatMessage,
        sendAudio: sendAudioMessage,
        loadConversations: loadConversationsAPI,
        loadMessages: loadConversationMessagesAPI,
        deleteConversation: deleteConversationAPI
    };
}


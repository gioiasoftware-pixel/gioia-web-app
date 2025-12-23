/**
 * Chat Audio Handler - Gestisce registrazione e invio audio nella chat
 * Funziona sia per desktop che mobile
 */

// Inizializza handler audio per entrambi i layout
function initChatAudioHandler() {
    // Handler per desktop
    initAudioHandler('desktop');
    
    // Handler per mobile
    initAudioHandler('mobile');
}

function initAudioHandler(layout) {
    const suffix = layout === 'desktop' ? '' : '-mobile';
    const audioBtn = document.getElementById(`chat-audio-btn${suffix}`);
    const audioRecording = document.getElementById(`chat-audio-recording${suffix}`);
    const audioTimer = document.getElementById(`chat-audio-timer${suffix}`);
    const audioCancelBtn = document.getElementById(`chat-audio-cancel-btn${suffix}`);
    const audioSendBtn = document.getElementById(`chat-audio-send-btn${suffix}`);
    const chatInput = document.getElementById(`chat-input${suffix}`);
    const chatForm = document.getElementById(`chat-form${suffix}`);
    const chatSendBtn = document.getElementById(`chat-send-btn${suffix}`);

    if (!audioBtn || !audioRecording || !audioTimer || !audioCancelBtn || !audioSendBtn) {
        console.warn(`[ChatAudioHandler] Elementi audio non trovati per layout ${layout}`);
        return;
    }

    // Verifica supporto browser
    if (!AudioRecorder.isSupported()) {
        audioBtn.style.display = 'none';
        console.warn(`[ChatAudioHandler] Browser non supporta registrazione audio`);
        return;
    }

    const recorder = new AudioRecorder();
    
    // Callback per aggiornare timer UI
    recorder.onUpdate = (duration) => {
        audioTimer.textContent = recorder.formatDuration(duration);
    };

    // Gestione click pulsante audio
    audioBtn.addEventListener('click', async () => {
        try {
            await recorder.startRecording();
            showAudioRecording(layout);
            console.log(`[ChatAudioHandler] Registrazione iniziata (${layout})`);
        } catch (error) {
            console.error(`[ChatAudioHandler] Errore avvio registrazione:`, error);
            alert(error.message || 'Errore avvio registrazione audio');
        }
    });

    // Gestione invio audio
    audioSendBtn.addEventListener('click', async () => {
        try {
            const audioBlob = await recorder.stopRecording();
            hideAudioRecording(layout);
            
            // Ottieni conversation ID
            const conversationId = window.currentConversationId || null;
            
            // Aggiungi messaggio utente che indica invio audio
            const addMessage = layout === 'desktop' 
                ? window.ChatDesktop?.addMessage 
                : window.ChatMobile?.addMessage;
            
            if (addMessage) {
                addMessage('user', '🎤 Invio audio...', false, false);
            }
            
            // Invia audio
            const response = await window.ChatAPI?.sendAudio(audioBlob, conversationId);
            
            if (response && response.message) {
                // Aggiorna messaggio utente con testo trascritto se disponibile
                const transcribedText = response.metadata?.transcribed_text;
                if (transcribedText) {
                    updateLastUserMessage(layout, `🎤 ${transcribedText}`);
                } else {
                    updateLastUserMessage(layout, '🎤 Audio inviato');
                }
                
                // Aggiungi risposta AI
                if (addMessage) {
                    addMessage('ai', response.message, false, false, null, response.is_html);
                }
            }
            
        } catch (error) {
            console.error(`[ChatAudioHandler] Errore invio audio:`, error);
            hideAudioRecording(layout);
            
            const addMessage = layout === 'desktop' 
                ? window.ChatDesktop?.addMessage 
                : window.ChatMobile?.addMessage;
            
            if (addMessage) {
                addMessage('ai', `Errore invio audio: ${error.message}`, false, true);
            }
        }
    });

    // Gestione annullamento
    audioCancelBtn.addEventListener('click', () => {
        recorder.cancelRecording();
        hideAudioRecording(layout);
        console.log(`[ChatAudioHandler] Registrazione annullata (${layout})`);
    });

    // Gestione click fuori per annullare (opzionale)
    document.addEventListener('click', (e) => {
        if (recorder.isRecording && 
            !audioRecording.contains(e.target) && 
            !audioBtn.contains(e.target)) {
            // Non annullare automaticamente, richiede click esplicito
        }
    });
}

function showAudioRecording(layout) {
    const suffix = layout === 'desktop' ? '' : '-mobile';
    const audioBtn = document.getElementById(`chat-audio-btn${suffix}`);
    const audioRecording = document.getElementById(`chat-audio-recording${suffix}`);
    const chatInput = document.getElementById(`chat-input${suffix}`);
    const chatSendBtn = document.getElementById(`chat-send-btn${suffix}`);

    if (audioBtn) audioBtn.style.display = 'none';
    if (audioRecording) audioRecording.style.display = 'flex';
    if (chatInput) chatInput.style.display = 'none';
    if (chatSendBtn) chatSendBtn.style.display = 'none';
}

function hideAudioRecording(layout) {
    const suffix = layout === 'desktop' ? '' : '-mobile';
    const audioBtn = document.getElementById(`chat-audio-btn${suffix}`);
    const audioRecording = document.getElementById(`chat-audio-recording${suffix}`);
    const chatInput = document.getElementById(`chat-input${suffix}`);
    const chatSendBtn = document.getElementById(`chat-send-btn${suffix}`);

    if (audioBtn) audioBtn.style.display = 'flex';
    if (audioRecording) audioRecording.style.display = 'none';
    if (chatInput) chatInput.style.display = 'block';
    if (chatSendBtn) chatSendBtn.style.display = 'flex';
}

function updateLastUserMessage(layout, newText) {
    const selectors = window.ChatSelectors?.get();
    if (!selectors) return;
    
    const scrollContainer = selectors.scrollContainer();
    if (!scrollContainer) return;
    
    const messages = scrollContainer.querySelectorAll('.chat-message.user');
    if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        const contentEl = lastMessage.querySelector('.chat-message-content');
        if (contentEl) {
            contentEl.textContent = newText;
        } else {
            lastMessage.textContent = newText;
        }
    }
}

// Inizializza quando il DOM è pronto
if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initChatAudioHandler);
    } else {
        initChatAudioHandler();
    }
    
    window.ChatAudioHandler = {
        init: initChatAudioHandler
    };
}


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
    console.log(`[ChatAudioHandler] 🔄 Inizializzazione handler audio per layout: ${layout}`);
    
    const suffix = layout === 'desktop' ? '' : '-mobile';
    const audioBtn = document.getElementById(`chat-audio-btn${suffix}`);
    const audioRecording = document.getElementById(`chat-audio-recording${suffix}`);
    const audioTimer = document.getElementById(`chat-audio-timer${suffix}`);
    const audioCancelBtn = document.getElementById(`chat-audio-cancel-btn${suffix}`);
    const audioSendBtn = document.getElementById(`chat-audio-send-btn${suffix}`);
    const chatInput = document.getElementById(`chat-input${suffix}`);
    const chatForm = document.getElementById(`chat-form${suffix}`);
    const chatSendBtn = document.getElementById(`chat-send-btn${suffix}`);

    console.log(`[ChatAudioHandler] Elementi trovati per ${layout}:`, {
        audioBtn: !!audioBtn,
        audioRecording: !!audioRecording,
        audioTimer: !!audioTimer,
        audioCancelBtn: !!audioCancelBtn,
        audioSendBtn: !!audioSendBtn
    });

    if (!audioBtn || !audioRecording || !audioTimer || !audioCancelBtn || !audioSendBtn) {
        console.warn(`[ChatAudioHandler] ⚠️ Elementi audio non trovati per layout ${layout}`);
        return;
    }

    // Verifica supporto browser
    if (!AudioRecorder.isSupported()) {
        audioBtn.style.display = 'none';
        console.warn(`[ChatAudioHandler] ⚠️ Browser non supporta registrazione audio`);
        return;
    }
    
    console.log(`[ChatAudioHandler] ✅ Browser supporta registrazione audio`);

    const recorder = new AudioRecorder();
    
    // Crea elemento visualizzatore spettro
    const visualizerContainer = createAudioVisualizer(layout);
    
    // Callback per aggiornare timer UI
    recorder.onUpdate = (duration) => {
        audioTimer.textContent = recorder.formatDuration(duration);
    };
    
    // Callback per aggiornare visualizzatore spettro
    recorder.onVisualizerUpdate = (dataArray, average) => {
        updateAudioVisualizer(visualizerContainer, dataArray, average);
    };

    // Gestione pulsante audio
    // Mobile: "premi e tieni premuto" (touchstart/touchend come WhatsApp)
    // Desktop: click normale
    if (layout === 'mobile') {
        let isRecording = false;
        let touchStartTime = null;
        
        // Inizia registrazione al touchstart
        audioBtn.addEventListener('touchstart', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (isRecording) return;
            
            try {
                console.log(`[ChatAudioHandler] 📍 Touchstart pulsante audio (mobile)`);
                touchStartTime = Date.now();
                isRecording = true;
                
                const success = await recorder.startRecording();
                console.log(`[ChatAudioHandler] ✅ startRecording risultato:`, success);
                
                showAudioRecording(layout, visualizerContainer);
                console.log(`[ChatAudioHandler] ✅ Registrazione iniziata (mobile - touchstart)`);
                
                // Aggiungi feedback visivo (pressione)
                audioBtn.style.opacity = '0.7';
                audioBtn.style.transform = 'scale(0.95)';
            } catch (error) {
                console.error(`[ChatAudioHandler] ❌ Errore avvio registrazione:`, error);
                isRecording = false;
                audioBtn.style.opacity = '1';
                audioBtn.style.transform = 'scale(1)';
                alert(error.message || 'Errore avvio registrazione audio');
            }
        }, { passive: false });
        
        // Ferma registrazione al touchend o touchcancel
        const stopRecordingOnTouchEnd = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (!isRecording) return;
            
            const recordingDuration = Date.now() - touchStartTime;
            
            // Se la registrazione è troppo corta (< 200ms), annulla
            if (recordingDuration < 200) {
                console.log(`[ChatAudioHandler] ⚠️ Registrazione troppo corta (${recordingDuration}ms), annullata`);
                recorder.cancelRecording();
                hideAudioRecording(layout, visualizerContainer);
                isRecording = false;
                audioBtn.style.opacity = '1';
                audioBtn.style.transform = 'scale(1)';
                return;
            }
            
            try {
                console.log(`[ChatAudioHandler] 📍 Touchend pulsante audio (mobile), durata: ${recordingDuration}ms`);
                
                const audioBlob = await recorder.stopRecording();
                console.log(`[ChatAudioHandler] ✅ Audio blob ottenuto:`, {
                    size: audioBlob.size,
                    sizeKB: (audioBlob.size / 1024).toFixed(2),
                    type: audioBlob.type
                });
                
                hideAudioRecording(layout, visualizerContainer);
                isRecording = false;
                audioBtn.style.opacity = '1';
                audioBtn.style.transform = 'scale(1)';
                
                // Ottieni conversation ID
                const conversationId = window.currentConversationId || null;
                console.log(`[ChatAudioHandler] Conversation ID:`, conversationId);
                
                // Aggiungi messaggio utente che indica invio audio
                const addMessage = window.ChatMobile?.addMessage;
                if (addMessage) {
                    addMessage('user', '🎤 Invio audio...', false, false);
                }
                
                console.log(`[ChatAudioHandler] Invio audio al server...`);
                const startTime = Date.now();
                
                // Invia audio
                const response = await window.ChatAPI?.sendAudio(audioBlob, conversationId);
                
                const duration = Date.now() - startTime;
                console.log(`[ChatAudioHandler] ✅ Risposta server ricevuta (${duration}ms):`, {
                    hasMessage: !!response?.message,
                    hasMetadata: !!response?.metadata,
                    transcribedText: response?.metadata?.transcribed_text,
                    messageLength: response?.message?.length
                });
                
                if (response && response.message) {
                    // Aggiorna messaggio utente con testo trascritto se disponibile
                    const transcribedText = response.metadata?.transcribed_text;
                    if (transcribedText) {
                        console.log(`[ChatAudioHandler] Testo trascritto:`, transcribedText);
                        updateLastUserMessage(layout, `🎤 ${transcribedText}`);
                    } else {
                        console.log(`[ChatAudioHandler] Nessun testo trascritto disponibile`);
                        updateLastUserMessage(layout, '🎤 Audio inviato');
                    }
                    
                    // Aggiungi risposta AI
                    if (addMessage) {
                        addMessage('ai', response.message, false, false, null, response.is_html);
                    }
                } else {
                    console.warn(`[ChatAudioHandler] ⚠️ Risposta server senza messaggio`);
                }
                
            } catch (error) {
                console.error(`[ChatAudioHandler] ❌ Errore invio audio:`, error);
                console.error(`[ChatAudioHandler] Stack trace:`, error.stack);
                hideAudioRecording(layout, visualizerContainer);
                isRecording = false;
                audioBtn.style.opacity = '1';
                audioBtn.style.transform = 'scale(1)';
                
                const addMessage = window.ChatMobile?.addMessage;
                if (addMessage) {
                    addMessage('ai', `Errore invio audio: ${error.message || 'Errore sconosciuto'}`, false, true);
                }
            }
        };
        
        audioBtn.addEventListener('touchend', stopRecordingOnTouchEnd, { passive: false });
        audioBtn.addEventListener('touchcancel', stopRecordingOnTouchEnd, { passive: false });
        
        // Previeni scroll durante la registrazione
        audioBtn.addEventListener('touchmove', (e) => {
            if (isRecording) {
                e.preventDefault();
            }
        }, { passive: false });
        
    } else {
        // Desktop: comportamento click normale
        audioBtn.addEventListener('click', async () => {
            try {
                console.log(`[ChatAudioHandler] 📍 Click pulsante audio (desktop)`);
                console.log(`[ChatAudioHandler] Elementi trovati:`, {
                    audioBtn: !!audioBtn,
                    audioRecording: !!audioRecording,
                    audioTimer: !!audioTimer,
                    visualizerContainer: !!visualizerContainer
                });
                
                const success = await recorder.startRecording();
                console.log(`[ChatAudioHandler] ✅ startRecording risultato:`, success);
                
                showAudioRecording(layout, visualizerContainer);
                console.log(`[ChatAudioHandler] ✅ Registrazione iniziata (desktop)`);
            } catch (error) {
                console.error(`[ChatAudioHandler] ❌ Errore avvio registrazione:`, error);
                console.error(`[ChatAudioHandler] Stack trace:`, error.stack);
                alert(error.message || 'Errore avvio registrazione audio');
            }
        });
    }

    // Gestione invio audio (solo desktop, mobile usa touchend automatico)
    if (layout === 'desktop') {
        audioSendBtn.addEventListener('click', async () => {
            try {
                console.log(`[ChatAudioHandler] 📍 Click invio audio (desktop)`);
            
            const audioBlob = await recorder.stopRecording();
            console.log(`[ChatAudioHandler] ✅ Audio blob ottenuto:`, {
                size: audioBlob.size,
                sizeKB: (audioBlob.size / 1024).toFixed(2),
                type: audioBlob.type
            });
            
            hideAudioRecording(layout, visualizerContainer);
            
            // Ottieni conversation ID
            const conversationId = window.currentConversationId || null;
            console.log(`[ChatAudioHandler] Conversation ID:`, conversationId);
            
            // Aggiungi messaggio utente che indica invio audio
            const addMessage = layout === 'desktop' 
                ? window.ChatDesktop?.addMessage 
                : window.ChatMobile?.addMessage;
            
            if (addMessage) {
                addMessage('user', '🎤 Invio audio...', false, false);
            }
            
            console.log(`[ChatAudioHandler] Invio audio al server...`);
            const startTime = Date.now();
            
            // Invia audio
            const response = await window.ChatAPI?.sendAudio(audioBlob, conversationId);
            
            const duration = Date.now() - startTime;
            console.log(`[ChatAudioHandler] ✅ Risposta server ricevuta (${duration}ms):`, {
                hasMessage: !!response?.message,
                hasMetadata: !!response?.metadata,
                transcribedText: response?.metadata?.transcribed_text,
                messageLength: response?.message?.length
            });
            
            if (response && response.message) {
                // Aggiorna messaggio utente con testo trascritto se disponibile
                const transcribedText = response.metadata?.transcribed_text;
                if (transcribedText) {
                    console.log(`[ChatAudioHandler] Testo trascritto:`, transcribedText);
                    updateLastUserMessage(layout, `🎤 ${transcribedText}`);
                } else {
                    console.log(`[ChatAudioHandler] Nessun testo trascritto disponibile`);
                    updateLastUserMessage(layout, '🎤 Audio inviato');
                }
                
                // Aggiungi risposta AI
                if (addMessage) {
                    addMessage('ai', response.message, false, false, null, response.is_html);
                }
            } else {
                console.warn(`[ChatAudioHandler] ⚠️ Risposta server senza messaggio`);
            }
            
        } catch (error) {
            console.error(`[ChatAudioHandler] ❌ Errore invio audio:`, error);
            console.error(`[ChatAudioHandler] Stack trace:`, error.stack);
            hideAudioRecording(layout, visualizerContainer);
            
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
        console.log(`[ChatAudioHandler] 📍 Click annulla (${layout})`);
        recorder.cancelRecording();
        hideAudioRecording(layout, visualizerContainer);
        console.log(`[ChatAudioHandler] ✅ Registrazione annullata (${layout})`);
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

function showAudioRecording(layout, visualizerContainer) {
    const suffix = layout === 'desktop' ? '' : '-mobile';
    const audioBtn = document.getElementById(`chat-audio-btn${suffix}`);
    const audioRecording = document.getElementById(`chat-audio-recording${suffix}`);
    const chatInput = document.getElementById(`chat-input${suffix}`);
    const chatSendBtn = document.getElementById(`chat-send-btn${suffix}`);

    if (audioBtn) audioBtn.style.display = 'none';
    if (audioRecording) {
        audioRecording.style.display = 'flex';
        // Aggiungi visualizzatore se non presente
        if (visualizerContainer && !audioRecording.querySelector('.audio-visualizer-container')) {
            audioRecording.insertBefore(visualizerContainer, audioRecording.firstChild);
        }
    }
    if (chatInput) chatInput.style.display = 'none';
    if (chatSendBtn) chatSendBtn.style.display = 'none';
}

function hideAudioRecording(layout, visualizerContainer) {
    const suffix = layout === 'desktop' ? '' : '-mobile';
    const audioBtn = document.getElementById(`chat-audio-btn${suffix}`);
    const audioRecording = document.getElementById(`chat-audio-recording${suffix}`);
    const chatInput = document.getElementById(`chat-input${suffix}`);
    const chatSendBtn = document.getElementById(`chat-send-btn${suffix}`);

    if (audioBtn) audioBtn.style.display = 'flex';
    if (audioRecording) {
        audioRecording.style.display = 'none';
        // Reset visualizzatore
        if (visualizerContainer) {
            resetAudioVisualizer(visualizerContainer);
        }
    }
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

/**
 * Crea elemento visualizzatore spettro audio
 */
function createAudioVisualizer(layout) {
    const container = document.createElement('div');
    container.className = 'audio-visualizer-container';
    
    const canvas = document.createElement('canvas');
    canvas.className = 'audio-visualizer-canvas';
    canvas.width = 200;
    canvas.height = 40;
    
    container.appendChild(canvas);
    
    // Salva riferimento canvas per aggiornamenti
    container.canvas = canvas;
    container.ctx = canvas.getContext('2d');
    
    console.log(`[ChatAudioHandler] ✅ Visualizzatore creato (${layout})`);
    
    return container;
}

/**
 * Aggiorna visualizzatore spettro audio
 */
function updateAudioVisualizer(container, dataArray, average) {
    if (!container || !container.canvas || !container.ctx) {
        return;
    }

    const canvas = container.canvas;
    const ctx = container.ctx;
    const width = canvas.width;
    const height = canvas.height;

    // Pulisci canvas
    ctx.clearRect(0, 0, width, height);

    // Colore basato su intensità media
    const intensity = average / 255;
    const hue = 200 + (intensity * 160); // Blu → Rosso
    const color = `hsl(${hue}, 70%, 60%)`;

    // Disegna barre spettro
    const barWidth = width / dataArray.length;
    const barGap = 1;

    for (let i = 0; i < dataArray.length; i++) {
        const barHeight = (dataArray[i] / 255) * height;
        const x = i * barWidth;
        const y = height - barHeight;

        // Colore con opacità variabile
        ctx.fillStyle = color;
        ctx.fillRect(x, y, barWidth - barGap, barHeight);
    }

    // Mostra livello medio come barra orizzontale
    const avgHeight = (average / 255) * height;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(0, height - avgHeight, width, 2);
}

/**
 * Reset visualizzatore
 */
function resetAudioVisualizer(container) {
    if (!container || !container.canvas || !container.ctx) {
        return;
    }
    
    const ctx = container.ctx;
    const width = container.canvas.width;
    const height = container.canvas.height;
    
    ctx.clearRect(0, 0, width, height);
}

// Inizializza quando il DOM è pronto
if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            console.log('[ChatAudioHandler] DOM caricato, inizializzazione...');
            initChatAudioHandler();
        });
    } else {
        console.log('[ChatAudioHandler] DOM già pronto, inizializzazione immediata...');
        initChatAudioHandler();
    }
    
    window.ChatAudioHandler = {
        init: initChatAudioHandler
    };
}


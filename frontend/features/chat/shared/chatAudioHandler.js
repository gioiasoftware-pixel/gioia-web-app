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
        audioBtnId: `chat-audio-btn${suffix}`,
        audioRecording: !!audioRecording,
        audioTimer: !!audioTimer,
        audioCancelBtn: !!audioCancelBtn,
        audioSendBtn: !!audioSendBtn
    });

    if (!audioBtn) {
        console.warn(`[ChatAudioHandler] ⚠️ Pulsante audio non trovato per layout ${layout} (ID: chat-audio-btn${suffix})`);
        return;
    }
    
    if (!audioRecording || !audioTimer || !audioCancelBtn || !audioSendBtn) {
        console.warn(`[ChatAudioHandler] ⚠️ Alcuni elementi audio non trovati per layout ${layout}`);
        // Non ritornare, possiamo comunque attaccare il listener al pulsante
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
        // Rimuovi eventuali listener esistenti clonando il pulsante
        const newAudioBtn = audioBtn.cloneNode(true);
        audioBtn.parentNode.replaceChild(newAudioBtn, audioBtn);
        const cleanAudioBtn = newAudioBtn;
        
        let isRecording = false;
        let touchStartTime = null;
        let currentRecorder = recorder; // Salva riferimento al recorder
        
        console.log(`[ChatAudioHandler] ✅ Pulsante mobile clonato e pronto per listener`);
        
        // Inizia registrazione al touchstart
        const handleTouchStart = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            console.log(`[ChatAudioHandler] 📍 Touchstart pulsante audio (mobile)`, {
                isRecording,
                hasRecorder: !!currentRecorder,
                target: e.target,
                currentTarget: e.currentTarget
            });
            
            if (isRecording) {
                console.warn(`[ChatAudioHandler] ⚠️ Registrazione già in corso, ignoro touchstart`);
                return;
            }
            
            try {
                touchStartTime = Date.now();
                isRecording = true;
                
                console.log(`[ChatAudioHandler] Chiamata startRecording()...`);
                const success = await currentRecorder.startRecording();
                console.log(`[ChatAudioHandler] ✅ startRecording risultato:`, success);
                
                if (!success) {
                    throw new Error('startRecording ha restituito false');
                }
                
                if (audioRecording && visualizerContainer) {
                    showAudioRecording(layout, visualizerContainer);
                }
                console.log(`[ChatAudioHandler] ✅ Registrazione iniziata (mobile - touchstart)`);
                
                // Aggiungi feedback visivo (pressione)
                cleanAudioBtn.style.opacity = '0.7';
                cleanAudioBtn.style.transform = 'scale(0.95)';
            } catch (error) {
                console.error(`[ChatAudioHandler] ❌ Errore avvio registrazione:`, error);
                console.error(`[ChatAudioHandler] Stack:`, error.stack);
                isRecording = false;
                cleanAudioBtn.style.opacity = '1';
                cleanAudioBtn.style.transform = 'scale(1)';
                alert(error.message || 'Errore avvio registrazione audio');
            }
        };
        
        cleanAudioBtn.addEventListener('touchstart', handleTouchStart, { passive: false });
        console.log(`[ChatAudioHandler] ✅ Listener touchstart attaccato al pulsante mobile`);
        
        // Test diretto: verifica che il listener sia attaccato
        console.log(`[ChatAudioHandler] 🔍 Verifica listener:`, {
            element: cleanAudioBtn,
            id: cleanAudioBtn.id,
            hasTouchStart: true, // Non possiamo verificare direttamente, ma sappiamo che l'abbiamo aggiunto
            parent: cleanAudioBtn.parentNode?.id || 'no parent'
        });
        
        // Test manuale: prova a triggerare un evento per verificare che funzioni
        // (solo per debug, rimuovere in produzione se necessario)
        if (window.DEBUG_AUDIO) {
            setTimeout(() => {
                console.log(`[ChatAudioHandler] 🧪 Test manuale: simulazione touchstart`);
                const testEvent = new TouchEvent('touchstart', {
                    bubbles: true,
                    cancelable: true,
                    touches: [new Touch({ identifier: 0, target: cleanAudioBtn, clientX: 0, clientY: 0 })]
                });
                cleanAudioBtn.dispatchEvent(testEvent);
            }, 1000);
        }
        
        // Ferma registrazione al touchend o touchcancel
        const stopRecordingOnTouchEnd = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            console.log(`[ChatAudioHandler] 📍 Touchend/touchcancel (mobile)`, {
                isRecording,
                hasRecorder: !!currentRecorder,
                target: e.target,
                currentTarget: e.currentTarget
            });
            
            if (!isRecording) {
                console.warn(`[ChatAudioHandler] ⚠️ Nessuna registrazione attiva, ignoro touchend`);
                return;
            }
            
            const recordingDuration = Date.now() - touchStartTime;
            
            // Se la registrazione è troppo corta (< 200ms), annulla
            if (recordingDuration < 200) {
                console.log(`[ChatAudioHandler] ⚠️ Registrazione troppo corta (${recordingDuration}ms), annullata`);
                try {
                    currentRecorder.cancelRecording();
                } catch (err) {
                    console.error(`[ChatAudioHandler] Errore cancellazione:`, err);
                }
                if (audioRecording && visualizerContainer) {
                    hideAudioRecording(layout, visualizerContainer);
                }
                isRecording = false;
                cleanAudioBtn.style.opacity = '1';
                cleanAudioBtn.style.transform = 'scale(1)';
                return;
            }
            
            try {
                console.log(`[ChatAudioHandler] 📍 Fermo registrazione, durata: ${recordingDuration}ms`);
                
                const audioBlob = await currentRecorder.stopRecording();
                console.log(`[ChatAudioHandler] ✅ Audio blob ottenuto:`, {
                    size: audioBlob.size,
                    sizeKB: (audioBlob.size / 1024).toFixed(2),
                    type: audioBlob.type
                });
                
                if (audioRecording && visualizerContainer) {
                    hideAudioRecording(layout, visualizerContainer);
                }
                isRecording = false;
                cleanAudioBtn.style.opacity = '1';
                cleanAudioBtn.style.transform = 'scale(1)';
                
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
                if (audioRecording && visualizerContainer) {
                    hideAudioRecording(layout, visualizerContainer);
                }
                isRecording = false;
                cleanAudioBtn.style.opacity = '1';
                cleanAudioBtn.style.transform = 'scale(1)';
                
                const addMessage = window.ChatMobile?.addMessage;
                if (addMessage) {
                    addMessage('ai', `Errore invio audio: ${error.message || 'Errore sconosciuto'}`, false, true);
                }
            }
        };
        
        cleanAudioBtn.addEventListener('touchend', stopRecordingOnTouchEnd, { passive: false });
        cleanAudioBtn.addEventListener('touchcancel', stopRecordingOnTouchEnd, { passive: false });
        console.log(`[ChatAudioHandler] ✅ Listener touchend/touchcancel attaccati al pulsante mobile`);
        
        // Previeni scroll durante la registrazione
        cleanAudioBtn.addEventListener('touchmove', (e) => {
            if (isRecording) {
                e.preventDefault();
                e.stopPropagation();
            }
        }, { passive: false });
        
        // Rimuovi eventuali listener click che potrebbero interferire su mobile
        cleanAudioBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log(`[ChatAudioHandler] ⚠️ Click su mobile ignorato, usa touchstart/touchend`);
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

    // Gestione annullamento (solo desktop, mobile usa touchcancel automatico)
    if (layout === 'desktop') {
        audioCancelBtn.addEventListener('click', () => {
            console.log(`[ChatAudioHandler] 📍 Click annulla (desktop)`);
            recorder.cancelRecording();
            hideAudioRecording(layout, visualizerContainer);
            console.log(`[ChatAudioHandler] ✅ Registrazione annullata (desktop)`);
        });
    }

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


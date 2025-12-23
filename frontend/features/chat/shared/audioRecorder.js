/**
 * Audio Recorder - Gestione registrazione e invio audio
 * Stile Telegram/WhatsApp
 */

class AudioRecorder {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.recordingStartTime = null;
        this.maxDuration = 60000; // 60 secondi max
        this.timerInterval = null;
        this.onUpdate = null; // Callback per aggiornare UI (durata)
        
        // Audio Context per visualizzazione spettro
        this.audioContext = null;
        this.analyser = null;
        this.audioStream = null;
        this.animationFrame = null;
        this.onVisualizerUpdate = null; // Callback per aggiornare visualizzatore
        
        console.log('[AudioRecorder] Inizializzato');
    }

    /**
     * Inizia registrazione audio
     * @returns {Promise<void>}
     */
    async startRecording() {
        try {
            console.log('[AudioRecorder] Richiesta accesso microfono...');
            
            // Richiedi accesso al microfono
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            console.log('[AudioRecorder] Accesso microfono ottenuto:', stream.id);
            this.audioStream = stream;

            // Setup Audio Context per visualizzazione
            this.setupAudioVisualizer(stream);

            // Crea MediaRecorder con formato webm (supportato da Whisper)
            const mimeTypes = [
                'audio/webm;codecs=opus',
                'audio/webm',
                'audio/mp4',
                'audio/mpeg'
            ];
            
            let selectedMimeType = null;
            for (const mimeType of mimeTypes) {
                if (MediaRecorder.isTypeSupported(mimeType)) {
                    selectedMimeType = mimeType;
                    console.log('[AudioRecorder] Formato supportato:', mimeType);
                    break;
                }
            }

            if (!selectedMimeType) {
                console.warn('[AudioRecorder] Nessun formato supportato, uso default');
                this.mediaRecorder = new MediaRecorder(stream);
            } else {
                this.mediaRecorder = new MediaRecorder(stream, {
                    mimeType: selectedMimeType
                });
            }

            this.audioChunks = [];
            this.isRecording = true;
            this.recordingStartTime = Date.now();

            // Gestisci dati audio
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    this.audioChunks.push(event.data);
                    console.log('[AudioRecorder] Dati ricevuti:', event.data.size, 'bytes, totale chunks:', this.audioChunks.length);
                }
            };

            this.mediaRecorder.onerror = (event) => {
                console.error('[AudioRecorder] Errore MediaRecorder:', event.error);
            };

            this.mediaRecorder.onstart = () => {
                console.log('[AudioRecorder] MediaRecorder avviato, stato:', this.mediaRecorder.state);
            };

            // Quando finisce la registrazione
            this.mediaRecorder.onstop = () => {
                console.log('[AudioRecorder] MediaRecorder fermato, totale chunks:', this.audioChunks.length);
                this.stopAudioVisualizer();
                stream.getTracks().forEach(track => {
                    track.stop();
                    console.log('[AudioRecorder] Track fermato:', track.kind, track.label);
                });
            };

            // Avvia registrazione
            this.mediaRecorder.start(100); // Raccogli dati ogni 100ms
            console.log('[AudioRecorder] MediaRecorder.start() chiamato, stato:', this.mediaRecorder.state);

            // Timer per durata
            this.startTimer();

            // Avvia visualizzazione spettro
            this.startVisualization();

            console.log('[AudioRecorder] ✅ Registrazione iniziata con successo');
            return true;

        } catch (error) {
            console.error('[AudioRecorder] ❌ Errore accesso microfono:', error);
            console.error('[AudioRecorder] Dettagli errore:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            throw new Error('Impossibile accedere al microfono. Verifica i permessi.');
        }
    }

    /**
     * Ferma registrazione e ritorna blob audio
     * @returns {Promise<Blob>}
     */
    async stopRecording() {
        return new Promise((resolve, reject) => {
            console.log('[AudioRecorder] stopRecording chiamato, stato:', {
                hasMediaRecorder: !!this.mediaRecorder,
                isRecording: this.isRecording,
                state: this.mediaRecorder?.state
            });

            if (!this.mediaRecorder || !this.isRecording) {
                console.error('[AudioRecorder] ❌ Nessuna registrazione attiva');
                reject(new Error('Nessuna registrazione attiva'));
                return;
            }

            this.isRecording = false;
            this.stopTimer();
            this.stopAudioVisualizer();

            const oldOnStop = this.mediaRecorder.onstop;
            
            this.mediaRecorder.onstop = () => {
                console.log('[AudioRecorder] MediaRecorder.onstop chiamato');
                
                if (this.audioChunks.length === 0) {
                    console.warn('[AudioRecorder] ⚠️ Nessun chunk audio ricevuto!');
                }

                const blobType = this.mediaRecorder.mimeType || 'audio/webm';
                const audioBlob = new Blob(this.audioChunks, { type: blobType });
                
                console.log('[AudioRecorder] ✅ Registrazione completata:', {
                    size: audioBlob.size,
                    sizeKB: (audioBlob.size / 1024).toFixed(2),
                    type: blobType,
                    chunks: this.audioChunks.length,
                    duration: this.getDuration()
                });

                // Ripristina vecchio handler se presente
                if (oldOnStop) {
                    oldOnStop();
                }

                resolve(audioBlob);
            };

            try {
                if (this.mediaRecorder.state === 'recording') {
                    console.log('[AudioRecorder] Chiamata mediaRecorder.stop()...');
                    this.mediaRecorder.stop();
                } else {
                    console.warn('[AudioRecorder] MediaRecorder non in stato recording:', this.mediaRecorder.state);
                    // Forza creazione blob anche se stato non corretto
                    const blobType = this.mediaRecorder.mimeType || 'audio/webm';
                    const audioBlob = new Blob(this.audioChunks, { type: blobType });
                    resolve(audioBlob);
                }
            } catch (error) {
                console.error('[AudioRecorder] ❌ Errore durante stop:', error);
                reject(error);
            }
        });
    }

    /**
     * Cancella registrazione corrente
     */
    cancelRecording() {
        console.log('[AudioRecorder] cancelRecording chiamato');
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.audioChunks = [];
            this.isRecording = false;
            this.stopTimer();
            this.stopAudioVisualizer();
            console.log('[AudioRecorder] ✅ Registrazione cancellata');
        } else {
            console.log('[AudioRecorder] Nessuna registrazione da cancellare');
        }
    }

    /**
     * Ottiene durata registrazione corrente in secondi
     * @returns {number}
     */
    getDuration() {
        if (!this.recordingStartTime) return 0;
        return Math.floor((Date.now() - this.recordingStartTime) / 1000);
    }

    /**
     * Formatta durata in mm:ss
     * @param {number} seconds
     * @returns {string}
     */
    formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Avvia timer per aggiornare UI durata
     */
    startTimer() {
        this.stopTimer();
        this.timerInterval = setInterval(() => {
            const duration = this.getDuration();
            if (this.onUpdate) {
                this.onUpdate(duration);
            }
            
            // Auto-stop dopo max duration
            if (duration * 1000 >= this.maxDuration) {
                this.stopRecording().catch(err => {
                    console.error('[AudioRecorder] Errore auto-stop:', err);
                });
            }
        }, 100);
    }

    /**
     * Ferma timer
     */
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    /**
     * Setup Audio Context per visualizzazione spettro
     */
    setupAudioVisualizer(stream) {
        try {
            console.log('[AudioRecorder] Setup visualizzatore audio...');
            
            // Crea Audio Context
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) {
                console.warn('[AudioRecorder] AudioContext non supportato');
                return;
            }

            this.audioContext = new AudioContextClass();
            
            // Crea source dal stream
            const source = this.audioContext.createMediaStreamSource(stream);
            
            // Crea AnalyserNode
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256; // Risoluzione spettro (più alto = più dettagliato)
            this.analyser.smoothingTimeConstant = 0.8; // Smussamento visualizzazione
            
            source.connect(this.analyser);
            
            console.log('[AudioRecorder] ✅ Visualizzatore audio configurato:', {
                sampleRate: this.audioContext.sampleRate,
                fftSize: this.analyser.fftSize,
                frequencyBinCount: this.analyser.frequencyBinCount
            });
        } catch (error) {
            console.error('[AudioRecorder] ❌ Errore setup visualizzatore:', error);
        }
    }

    /**
     * Avvia visualizzazione spettro audio
     */
    startVisualization() {
        if (!this.analyser || !this.onVisualizerUpdate) {
            return;
        }

        console.log('[AudioRecorder] Avvio visualizzazione spettro...');
        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

        const updateVisualization = () => {
            if (!this.isRecording || !this.analyser) {
                return;
            }

            // Ottieni dati frequenza (spettro)
            this.analyser.getByteFrequencyData(dataArray);

            // Calcola valore medio per mostrare livello generale
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
            }
            const average = sum / dataArray.length;

            // Callback con dati spettro
            if (this.onVisualizerUpdate) {
                this.onVisualizerUpdate(dataArray, average);
            }

            this.animationFrame = requestAnimationFrame(updateVisualization);
        };

        updateVisualization();
    }

    /**
     * Ferma visualizzazione spettro
     */
    stopAudioVisualizer() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
            console.log('[AudioRecorder] Visualizzazione fermata');
        }
        
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close().then(() => {
                console.log('[AudioRecorder] AudioContext chiuso');
            }).catch(err => {
                console.error('[AudioRecorder] Errore chiusura AudioContext:', err);
            });
        }
    }

    /**
     * Verifica se il browser supporta registrazione audio
     * @returns {boolean}
     */
    static isSupported() {
        const supported = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && MediaRecorder);
        console.log('[AudioRecorder] Supporto browser:', {
            supported,
            hasMediaDevices: !!navigator.mediaDevices,
            hasGetUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
            hasMediaRecorder: !!MediaRecorder
        });
        return supported;
    }
}

// Export globale
if (typeof window !== 'undefined') {
    window.AudioRecorder = AudioRecorder;
}


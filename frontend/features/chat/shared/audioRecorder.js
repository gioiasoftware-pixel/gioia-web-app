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
    }

    /**
     * Inizia registrazione audio
     * @returns {Promise<void>}
     */
    async startRecording() {
        try {
            // Richiedi accesso al microfono
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            // Crea MediaRecorder con formato webm (supportato da Whisper)
            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });

            this.audioChunks = [];
            this.isRecording = true;
            this.recordingStartTime = Date.now();

            // Gestisci dati audio
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            // Quando finisce la registrazione
            this.mediaRecorder.onstop = () => {
                stream.getTracks().forEach(track => track.stop());
            };

            // Avvia registrazione
            this.mediaRecorder.start(100); // Raccogli dati ogni 100ms

            // Timer per durata
            this.startTimer();

            console.log('[AudioRecorder] Registrazione iniziata');
            return true;

        } catch (error) {
            console.error('[AudioRecorder] Errore accesso microfono:', error);
            throw new Error('Impossibile accedere al microfono. Verifica i permessi.');
        }
    }

    /**
     * Ferma registrazione e ritorna blob audio
     * @returns {Promise<Blob>}
     */
    async stopRecording() {
        return new Promise((resolve, reject) => {
            if (!this.mediaRecorder || !this.isRecording) {
                reject(new Error('Nessuna registrazione attiva'));
                return;
            }

            this.isRecording = false;
            this.stopTimer();

            this.mediaRecorder.onstop = () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                console.log('[AudioRecorder] Registrazione completata:', audioBlob.size, 'bytes');
                resolve(audioBlob);
            };

            this.mediaRecorder.stop();
        });
    }

    /**
     * Cancella registrazione corrente
     */
    cancelRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.audioChunks = [];
            this.isRecording = false;
            this.stopTimer();
            console.log('[AudioRecorder] Registrazione cancellata');
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
     * Verifica se il browser supporta registrazione audio
     * @returns {boolean}
     */
    static isSupported() {
        return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && MediaRecorder);
    }
}

// Export globale
if (typeof window !== 'undefined') {
    window.AudioRecorder = AudioRecorder;
}


/**
 * Debug Overlay - Finestra di log permanente per debug
 * 
 * Overlay sempre visibile con Shadow DOM isolato da CSS esterni
 * Disponibile sia su mobile che desktop
 */

(function() {
    'use strict';
    
    let overlayHost = null;
    let shadowRoot = null;
    let logContainer = null;
    let isEnabled = true;
    let isExpanded = true;
    const MAX_LOG_LINES = 300;
    
    /**
     * Crea e inizializza l'overlay
     */
    function initDebugOverlay() {
        // Crea host fisso
        overlayHost = document.createElement('div');
        overlayHost.id = 'app-debug-overlay-host';
        overlayHost.style.cssText = `
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: ${isExpanded ? '180px' : '24px'};
            z-index: 2147483647;
            pointer-events: none;
            font-family: monospace;
        `;
        
        // Crea Shadow DOM per isolamento completo
        shadowRoot = overlayHost.attachShadow({ mode: 'open' });
        
        // Inietta CSS nel shadow
        const style = document.createElement('style');
        style.textContent = `
            * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
            }
            
            .debug-container {
                position: relative;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.85);
                backdrop-filter: blur(10px);
                border-top: 2px solid #3b82f6;
                display: flex;
                flex-direction: column;
                pointer-events: auto;
                transition: height 0.3s ease;
            }
            
            .debug-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 4px 8px;
                background: rgba(59, 130, 246, 0.2);
                border-bottom: 1px solid rgba(59, 130, 246, 0.3);
                min-height: 24px;
                flex-shrink: 0;
            }
            
            .debug-title {
                font-size: 11px;
                font-weight: bold;
                color: #60a5fa;
                text-transform: uppercase;
                letter-spacing: 1px;
            }
            
            .debug-status {
                font-size: 10px;
                color: #10b981;
                margin-left: 8px;
                font-weight: bold;
            }
            
            .debug-status.off {
                color: #ef4444;
            }
            
            .debug-controls {
                display: flex;
                gap: 6px;
                align-items: center;
            }
            
            .debug-btn {
                padding: 2px 8px;
                font-size: 10px;
                background: rgba(59, 130, 246, 0.3);
                border: 1px solid rgba(59, 130, 246, 0.5);
                border-radius: 4px;
                color: #e0e7ff;
                cursor: pointer;
                font-family: monospace;
                transition: background 0.2s;
            }
            
            .debug-btn:hover {
                background: rgba(59, 130, 246, 0.5);
            }
            
            .debug-btn:active {
                background: rgba(59, 130, 246, 0.7);
            }
            
            .debug-log-area {
                flex: 1;
                overflow-y: auto;
                padding: 4px 8px;
                font-size: 11px;
                line-height: 1.4;
                color: #e0e7ff;
                display: ${isExpanded ? 'block' : 'none'};
            }
            
            .debug-log-line {
                margin-bottom: 2px;
                word-break: break-word;
                white-space: pre-wrap;
            }
            
            .debug-log-line.info {
                color: #93c5fd;
            }
            
            .debug-log-line.success {
                color: #10b981;
            }
            
            .debug-log-line.warn {
                color: #fbbf24;
            }
            
            .debug-log-line.error {
                color: #f87171;
                font-weight: bold;
            }
            
            .debug-log-timestamp {
                color: #6b7280;
                margin-right: 6px;
            }
            
            .debug-log-level {
                font-weight: bold;
                margin-right: 6px;
                text-transform: uppercase;
                font-size: 10px;
            }
            
            /* Scrollbar personalizzata */
            .debug-log-area::-webkit-scrollbar {
                width: 6px;
            }
            
            .debug-log-area::-webkit-scrollbar-track {
                background: rgba(0, 0, 0, 0.3);
            }
            
            .debug-log-area::-webkit-scrollbar-thumb {
                background: rgba(59, 130, 246, 0.5);
                border-radius: 3px;
            }
            
            .debug-log-area::-webkit-scrollbar-thumb:hover {
                background: rgba(59, 130, 246, 0.7);
            }
        `;
        shadowRoot.appendChild(style);
        
        // Crea struttura HTML
        const container = document.createElement('div');
        container.className = 'debug-container';
        
        // Header
        const header = document.createElement('div');
        header.className = 'debug-header';
        
        const titleContainer = document.createElement('div');
        titleContainer.style.display = 'flex';
        titleContainer.style.alignItems = 'center';
        
        const title = document.createElement('span');
        title.className = 'debug-title';
        title.textContent = 'DEBUG';
        
        const status = document.createElement('span');
        status.className = 'debug-status';
        status.id = 'debug-status';
        status.textContent = 'ON';
        
        titleContainer.appendChild(title);
        titleContainer.appendChild(status);
        
        // Controlli
        const controls = document.createElement('div');
        controls.className = 'debug-controls';
        
        const clearBtn = document.createElement('button');
        clearBtn.className = 'debug-btn';
        clearBtn.textContent = 'Clear';
        clearBtn.title = 'Pulisci log';
        clearBtn.addEventListener('click', () => {
            window.AppDebug?.clear();
        });
        
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'debug-btn';
        toggleBtn.textContent = isExpanded ? '−' : '+';
        toggleBtn.title = isExpanded ? 'Riduci' : 'Espandi';
        toggleBtn.addEventListener('click', () => {
            isExpanded = !isExpanded;
            overlayHost.style.height = isExpanded ? '180px' : '24px';
            logContainer.style.display = isExpanded ? 'block' : 'none';
            toggleBtn.textContent = isExpanded ? '−' : '+';
            toggleBtn.title = isExpanded ? 'Riduci' : 'Espandi';
        });
        
        controls.appendChild(clearBtn);
        controls.appendChild(toggleBtn);
        
        header.appendChild(titleContainer);
        header.appendChild(controls);
        
        // Area log
        logContainer = document.createElement('div');
        logContainer.className = 'debug-log-area';
        logContainer.id = 'debug-log-area';
        
        container.appendChild(header);
        container.appendChild(logContainer);
        
        shadowRoot.appendChild(container);
        
        // Appendi al body
        document.body.appendChild(overlayHost);
        
        console.log('[AppDebug] ✅ Overlay inizializzato');
    }
    
    /**
     * Formatta timestamp
     */
    function getTimestamp() {
        const now = new Date();
        return now.toLocaleTimeString('it-IT', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
        });
    }
    
    /**
     * Formatta messaggio (supporta oggetti)
     */
    function formatMessage(message) {
        if (typeof message === 'object') {
            try {
                return JSON.stringify(message, null, 2);
            } catch (e) {
                return String(message);
            }
        }
        return String(message);
    }
    
    /**
     * Aggiunge una riga di log
     */
    function addLogLine(message, level = 'info') {
        if (!logContainer) return;
        
        // Rimuovi righe vecchie se necessario
        const lines = logContainer.querySelectorAll('.debug-log-line');
        if (lines.length >= MAX_LOG_LINES) {
            lines[0].remove();
        }
        
        // Crea nuova riga
        const line = document.createElement('div');
        line.className = `debug-log-line ${level}`;
        
        const timestamp = document.createElement('span');
        timestamp.className = 'debug-log-timestamp';
        timestamp.textContent = `[${getTimestamp()}]`;
        
        const levelSpan = document.createElement('span');
        levelSpan.className = 'debug-log-level';
        levelSpan.textContent = level.toUpperCase();
        
        const messageSpan = document.createElement('span');
        messageSpan.textContent = formatMessage(message);
        
        line.appendChild(timestamp);
        line.appendChild(levelSpan);
        line.appendChild(messageSpan);
        
        logContainer.appendChild(line);
        
        // Auto-scroll alla fine
        logContainer.scrollTop = logContainer.scrollHeight;
    }
    
    /**
     * API globale AppDebug
     */
    window.AppDebug = {
        /**
         * Aggiunge un log
         * @param {string|object} message - Messaggio da loggare
         * @param {string} level - Livello: 'info', 'success', 'warn', 'error'
         */
        log(message, level = 'info') {
            if (!isEnabled) return;
            
            // Log anche in console normale per compatibilità
            const consoleMethod = level === 'error' ? console.error 
                                : level === 'warn' ? console.warn 
                                : console.log;
            consoleMethod(`[AppDebug]`, message);
            
            // Aggiungi all'overlay
            addLogLine(message, level);
        },
        
        /**
         * Pulisce tutti i log
         */
        clear() {
            if (!logContainer) return;
            logContainer.innerHTML = '';
            console.log('[AppDebug] Log puliti');
        },
        
        /**
         * Abilita/disabilita logging
         * @param {boolean} enabled - true per abilitare, false per disabilitare
         */
        setEnabled(enabled) {
            isEnabled = enabled;
            const statusEl = shadowRoot?.getElementById('debug-status');
            if (statusEl) {
                statusEl.textContent = enabled ? 'ON' : 'OFF';
                statusEl.className = enabled ? 'debug-status' : 'debug-status off';
            }
            console.log(`[AppDebug] ${enabled ? 'Abilitato' : 'Disabilitato'}`);
        },
        
        /**
         * Verifica se è inizializzato
         */
        isInitialized() {
            return !!overlayHost && !!shadowRoot;
        }
    };
    
    // Inizializza quando DOM è pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDebugOverlay);
    } else {
        // DOM già pronto
        initDebugOverlay();
    }
    
    // Log iniziale
    setTimeout(() => {
        if (window.AppDebug.isInitialized()) {
            window.AppDebug.log('AppDebug overlay inizializzato', 'success');
        }
    }, 100);
    
})();


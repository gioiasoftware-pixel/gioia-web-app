/**
 * Chat Selectors - Selettori DOM comuni con factory pattern
 * 
 * Fornisce selettori corretti in base al layout attivo (mobile/desktop)
 * Isola la logica di selezione elementi dal resto del codice
 * 
 * REGOLA: Tutti i selettori partono dal root container con data-layout-root
 * per evitare collisioni tra mobile e desktop
 */

/**
 * Ottiene il root container per il layout corrente
 * @returns {HTMLElement|null} Root container con data-layout-root
 */
function getLayoutRoot() {
    // Cerca per data-layout-root
    const mobileRoot = document.querySelector('[data-layout-root="mobile"]');
    const desktopRoot = document.querySelector('[data-layout-root="desktop"]');
    
    // Fallback: usa namespace class
    if (!mobileRoot && !desktopRoot) {
        if (document.documentElement.classList.contains('mobileRoot')) {
            return document.getElementById('mobile-layout');
        }
        if (document.documentElement.classList.contains('desktopRoot')) {
            return document.getElementById('desktop-layout');
        }
    }
    
    return mobileRoot || desktopRoot || null;
}

/**
 * Factory per selettori chat in base al layout
 */
function createChatSelectors() {
    const root = getLayoutRoot();
    const isMobile = root?.getAttribute('data-layout-root') === 'mobile' || 
                     document.documentElement.classList.contains('mobileRoot');
    
    if (isMobile) {
        return {
            // Mobile selectors - partono dal root container
            scrollContainer: () => {
                if (!root) return null;
                return root.querySelector('#chatScroll') || root.querySelector('.mScroller');
            },
            form: () => root?.querySelector('#chat-form-mobile') || null,
            input: () => root?.querySelector('#chat-input-mobile') || null,
            sendButton: () => root?.querySelector('#chat-send-btn-mobile') || null,
            sidebar: () => root?.querySelector('#chatSidebar') || null,
            sidebarList: () => root?.querySelector('#chat-sidebar-list-mobile') || null,
            sidebarToggle: () => root?.querySelector('#sidebar-toggle') || null,
            newChatButton: () => root?.querySelector('#new-chat-btn-mobile') || null,
            layout: 'mobile',
            root: root
        };
    } else {
        return {
            // Desktop selectors - partono dal root container
            scrollContainer: () => {
                if (!root) return null;
                const wrapper = root.querySelector('#chat-messages-scroll-wrapper');
                if (wrapper) return wrapper;
                const container = root.querySelector('#chat-messages');
                if (container) {
                    return container.querySelector('.chat-messages-scroll-wrapper') || container;
                }
                return null;
            },
            form: () => root?.querySelector('#chat-form') || null,
            input: () => root?.querySelector('#chat-input') || null,
            sendButton: () => root?.querySelector('#chat-send-btn') || null,
            sidebar: () => root?.querySelector('#chat-sidebar') || null,
            sidebarList: () => root?.querySelector('#chat-sidebar-list') || null,
            sidebarToggle: () => root?.querySelector('#sidebar-toggle-desktop') || null,
            newChatButton: () => root?.querySelector('#new-chat-btn') || null,
            layout: 'desktop',
            root: root
        };
    }
}

/**
 * Ottiene i selettori correnti (singleton pattern)
 */
let currentSelectors = null;

function getChatSelectors() {
    if (!currentSelectors) {
        currentSelectors = createChatSelectors();
    }
    return currentSelectors;
}

/**
 * Resetta i selettori (da chiamare quando cambia layout)
 */
function resetChatSelectors() {
    currentSelectors = null;
}

/**
 * Inizializza listener per prevenire refresh su Android quando si apre la tastiera
 * CRITICO: Previene il problema di refresh pagina su Android verticale
 */
function initChatFormSubmitPrevention() {
    // Attendi che il DOM sia pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initChatFormSubmitPrevention);
        return;
    }
    
    // Verifica se siamo su mobile
    const isMobile = document.documentElement.classList.contains('mobileRoot') ||
                     document.querySelector('[data-layout-root="mobile"]') !== null;
    
    if (!isMobile) {
        window.AppDebug?.log('[ChatSelectors] Non è mobile, skip prevenzione submit', 'info');
        return; // Solo per mobile
    }
    
    window.AppDebug?.log('[ChatSelectors] 🚀 Inizializzazione prevenzione refresh Android', 'info');
    
    // Trova il form chat mobile
    const chatForm = document.getElementById('chat-form-mobile');
    if (!chatForm) {
        window.AppDebug?.log('[ChatSelectors] ⏳ Form non trovato, riprovo tra 100ms', 'warn');
        // Riprova dopo un breve delay se il form non è ancora disponibile
        setTimeout(initChatFormSubmitPrevention, 100);
        return;
    }
    
    window.AppDebug?.log('[ChatSelectors] ✅ Form trovato, aggiungo listener', 'success');
    
    // Listener esplicito con capture e preventDefault per prevenire submit implicito su Android
    // Questo previene il refresh della pagina quando la tastiera si apre
    chatForm.addEventListener('submit', (e) => {
        window.AppDebug?.log('[ChatSelectors] 🛑 SUBMIT INTERCETTATO - prevengo refresh', 'warn');
        window.AppDebug?.log(`[ChatSelectors] Event details: type=${e.type}, target=${e.target?.id}, defaultPrevented=${e.defaultPrevented}`, 'info');
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        window.AppDebug?.log('[ChatSelectors] ✅ Submit prevenuto con successo', 'success');
        return false;
    }, { capture: true, passive: false });
    
    // Aggiungi anche listener sull'input per prevenire comportamenti indesiderati
    const chatInput = document.getElementById('chat-input-mobile');
    if (chatInput) {
        window.AppDebug?.log('[ChatSelectors] ✅ Input trovato, aggiungo listener focus/blur/resize', 'success');
        
        const ua = navigator.userAgent || '';
        const isIOS = /iPad|iPhone|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const isAndroid = /Android/i.test(ua) && !isIOS;

        // Logging focus/blur per tracciare quando si apre la tastiera
        chatInput.addEventListener('focus', (e) => {
            const viewportInfo = {
                innerHeight: window.innerHeight,
                innerWidth: window.innerWidth,
                outerHeight: window.outerHeight,
                outerWidth: window.outerWidth,
                visualViewport: window.visualViewport ? {
                    height: window.visualViewport.height,
                    width: window.visualViewport.width,
                    scale: window.visualViewport.scale,
                    offsetTop: window.visualViewport.offsetTop
                } : null,
                orientation: screen.orientation ? screen.orientation.angle : null
            };
            window.AppDebug?.log('[ChatSelectors] 🎯 INPUT FOCUS - Tastiera potrebbe aprirsi', 'info');
            window.AppDebug?.log(`[ChatSelectors] Viewport info: ${JSON.stringify(viewportInfo)}`, 'info');
            
            if (!isAndroid) {
                // Assicura che non restino padding dal passato
                document.body.style.paddingBottom = '';
                document.documentElement.style.paddingBottom = '';
                return;
            }

            const adjustBodyForKeyboard = () => {
                if (!chatInput || document.activeElement !== chatInput) return;

                if (window.visualViewport) {
                    const vvp = window.visualViewport;
                    const windowHeight = window.innerHeight;
                    const viewportHeight = vvp.height;
                    const keyboardHeight = windowHeight - viewportHeight;

                    if (keyboardHeight > 100) {
                        const body = document.body;
                        const html = document.documentElement;
                        const paddingBottom = keyboardHeight + 20;

                        body.style.paddingBottom = `${paddingBottom}px`;
                        html.style.paddingBottom = `${paddingBottom}px`;

                        window.AppDebug?.log(`[ChatSelectors] 📏 Aggiunto padding-bottom ${paddingBottom}px al body (tastiera: ${keyboardHeight}px)`, 'info');

                        setTimeout(() => {
                            chatInput.scrollIntoView({ behavior: 'smooth', block: 'end', inline: 'nearest' });
                            window.AppDebug?.log('[ChatSelectors] 📜 Scrollato input in view', 'info');
                        }, 100);
                    }
                } else {
                    const estimatedKeyboardHeight = 300;
                    const body = document.body;
                    const html = document.documentElement;

                    body.style.paddingBottom = `${estimatedKeyboardHeight + 20}px`;
                    html.style.paddingBottom = `${estimatedKeyboardHeight + 20}px`;

                    window.AppDebug?.log(`[ChatSelectors] 📏 Aggiunto padding-bottom stimato ${estimatedKeyboardHeight + 20}px (fallback)`, 'info');

                    setTimeout(() => {
                        chatInput.scrollIntoView({ behavior: 'smooth', block: 'end', inline: 'nearest' });
                        window.AppDebug?.log('[ChatSelectors] 📜 Scrollato input in view (fallback)', 'info');
                    }, 100);
                }
            };

            adjustBodyForKeyboard();
            setTimeout(adjustBodyForKeyboard, 200);
            setTimeout(adjustBodyForKeyboard, 400);
            setTimeout(adjustBodyForKeyboard, 600);
        }, { passive: true });
        
        chatInput.addEventListener('blur', (e) => {
            const viewportInfo = {
                innerHeight: window.innerHeight,
                innerWidth: window.innerWidth,
                outerHeight: window.outerHeight,
                outerWidth: window.outerWidth,
                visualViewport: window.visualViewport ? {
                    height: window.visualViewport.height,
                    width: window.visualViewport.width,
                    scale: window.visualViewport.scale
                } : null
            };
            window.AppDebug?.log('[ChatSelectors] 📱 INPUT BLUR - Tastiera potrebbe chiudersi', 'info');
            window.AppDebug?.log(`[ChatSelectors] Viewport info: ${JSON.stringify(viewportInfo)}`, 'info');
            
            if (!isAndroid) {
                return;
            }

            setTimeout(() => {
                if (window.visualViewport) {
                    const vvp = window.visualViewport;
                    const windowHeight = window.innerHeight;
                    const viewportHeight = vvp.height;
                    const keyboardHeight = windowHeight - viewportHeight;

                    if (keyboardHeight < 50) {
                        const body = document.body;
                        const html = document.documentElement;
                        body.style.paddingBottom = '';
                        html.style.paddingBottom = '';
                        window.AppDebug?.log('[ChatSelectors] 📏 Rimosso padding-bottom (tastiera chiusa)', 'info');
                    }
                } else {
                    const body = document.body;
                    const html = document.documentElement;
                    body.style.paddingBottom = '';
                    html.style.paddingBottom = '';
                    window.AppDebug?.log('[ChatSelectors] 📏 Rimosso padding-bottom (fallback)', 'info');
                }
            }, 300);
        }, { passive: true });
        
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                window.AppDebug?.log('[ChatSelectors] ⌨️ Enter keydown - prevengo default', 'info');
                e.preventDefault();
                e.stopPropagation();
            }
        });
        
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                window.AppDebug?.log('[ChatSelectors] ⌨️ Enter keypress - prevengo default', 'info');
                e.preventDefault();
                e.stopPropagation();
            }
        });
    } else {
        window.AppDebug?.log('[ChatSelectors] ⚠️ Input non trovato', 'warn');
    }
    
    // Monitora cambi viewport (potrebbe indicare apertura/chiusura tastiera)
    let lastViewportHeight = window.innerHeight;
    let resizeTimeout = null;
    let isKeyboardOpen = false;
    let keyboardOpenTime = null;
    
    window.addEventListener('resize', () => {
        const currentHeight = window.innerHeight;
        const heightDiff = lastViewportHeight - currentHeight;
        
        // Debounce per evitare troppi log
        if (resizeTimeout) clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            window.AppDebug?.log(`[ChatSelectors] 📐 RESIZE: ${lastViewportHeight}px → ${currentHeight}px (diff: ${heightDiff}px)`, 'info');
            
            if (Math.abs(heightDiff) > 100) {
                window.AppDebug?.log(`[ChatSelectors] ⚠️ Cambio viewport significativo (${Math.abs(heightDiff)}px) - potrebbe essere tastiera`, 'warn');
                
                // Se il viewport si riduce drasticamente, probabilmente è la tastiera che si apre
                if (heightDiff > 100) {
                    isKeyboardOpen = true;
                    keyboardOpenTime = Date.now();
                    window.AppDebug?.log('[ChatSelectors] 🎹 TASTIERA APERTA - attivo protezione anti-refresh', 'warn');
                } else if (heightDiff < -100) {
                    isKeyboardOpen = false;
                    keyboardOpenTime = null;
                    window.AppDebug?.log('[ChatSelectors] 🎹 TASTIERA CHIUSA', 'info');
                }
            }
            
            lastViewportHeight = currentHeight;
        }, 100);
    }, { passive: true });
    
    // Monitora visual viewport se disponibile (più accurato per tastiera)
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', () => {
            const vvp = window.visualViewport;
            window.AppDebug?.log(`[ChatSelectors] 👁️ Visual Viewport resize: ${vvp.width}x${vvp.height} (scale: ${vvp.scale})`, 'info');
            
            if (!isAndroid) {
                return;
            }
            if (chatInput && document.activeElement === chatInput) {
                const windowHeight = window.innerHeight;
                const viewportHeight = vvp.height;
                const keyboardHeight = windowHeight - viewportHeight;

                if (keyboardHeight > 100) {
                    const body = document.body;
                    const html = document.documentElement;
                    const paddingBottom = keyboardHeight + 20;

                    body.style.paddingBottom = `${paddingBottom}px`;
                    html.style.paddingBottom = `${paddingBottom}px`;

                    window.AppDebug?.log(`[ChatSelectors] 📏 Aggiustato padding-bottom a ${paddingBottom}px (tastiera: ${keyboardHeight}px)`, 'info');

                    setTimeout(() => {
                        chatInput.scrollIntoView({ behavior: 'smooth', block: 'end', inline: 'nearest' });
                    }, 50);
                }
            }
        }, { passive: true });
        
        window.visualViewport.addEventListener('scroll', () => {
            window.AppDebug?.log(`[ChatSelectors] 👁️ Visual Viewport scroll: offsetTop=${window.visualViewport.offsetTop}`, 'info');
        }, { passive: true });
    }
    
    // Monitora orientation change (potrebbe causare refresh su Android)
    window.addEventListener('orientationchange', () => {
        window.AppDebug?.log('[ChatSelectors] 🔄 ORIENTATION CHANGE rilevato', 'warn');
        window.AppDebug?.log(`[ChatSelectors] New orientation: ${screen.orientation ? screen.orientation.angle : 'unknown'}`, 'info');
    }, { passive: true });
    
    // Monitora page visibility (potrebbe indicare refresh)
    document.addEventListener('visibilitychange', () => {
        window.AppDebug?.log(`[ChatSelectors] 👁️ VISIBILITY CHANGE: ${document.visibilityState}`, 'warn');
        if (document.visibilityState === 'hidden') {
            window.AppDebug?.log('[ChatSelectors] ⚠️ Pagina nascosta - possibile refresh?', 'warn');
            // Se la tastiera è aperta, potrebbe essere un refresh indesiderato
            if (isKeyboardOpen) {
                window.AppDebug?.log('[ChatSelectors] 🛑 Tastiera aperta durante visibility change - possibile refresh indesiderato!', 'error');
            }
        }
    }, { passive: true });
    
    // Monitora pagehide (Android Chrome potrebbe usare questo invece di beforeunload)
    window.addEventListener('pagehide', (e) => {
        const timeSinceKeyboardOpen = keyboardOpenTime ? Date.now() - keyboardOpenTime : Infinity;
        window.AppDebug?.log('[ChatSelectors] 🚪 PAGEHIDE - pagina sta per essere nascosta!', 'error');
        window.AppDebug?.log(`[ChatSelectors] Tastiera aperta: ${isKeyboardOpen}, tempo trascorso: ${timeSinceKeyboardOpen}ms`, 'error');
        
        if (isKeyboardOpen && timeSinceKeyboardOpen < 2000) {
            window.AppDebug?.log('[ChatSelectors] 🛑 PAGEHIDE causato da tastiera - salvo stato', 'error');
            // Salva lo stato
            if (chatInput) {
                const inputValue = chatInput.value;
                if (inputValue) {
                    sessionStorage.setItem('chat-input-backup', inputValue);
                    sessionStorage.setItem('chat-input-backup-time', Date.now().toString());
                    window.AppDebug?.log('[ChatSelectors] 💾 Valore input salvato in sessionStorage', 'info');
                }
            }
        }
    }, { passive: true });
    
    // Ripristina valore input se c'è un backup (dopo un refresh indesiderato)
    window.addEventListener('pageshow', (e) => {
        if (e.persisted) {
            window.AppDebug?.log('[ChatSelectors] 📄 PAGESHOW - pagina ripristinata da cache', 'info');
            const backup = sessionStorage.getItem('chat-input-backup');
            const backupTime = sessionStorage.getItem('chat-input-backup-time');
            if (backup && backupTime && Date.now() - parseInt(backupTime) < 5000) {
                if (chatInput) {
                    chatInput.value = backup;
                    window.AppDebug?.log('[ChatSelectors] ✅ Valore input ripristinato da backup', 'success');
                    sessionStorage.removeItem('chat-input-backup');
                    sessionStorage.removeItem('chat-input-backup-time');
                }
            }
        }
    }, { passive: true });
    
    // Monitora beforeunload - PREVIENI se è causato dalla tastiera
    window.addEventListener('beforeunload', (e) => {
        const timeSinceKeyboardOpen = keyboardOpenTime ? Date.now() - keyboardOpenTime : Infinity;
        
        window.AppDebug?.log('[ChatSelectors] 🚪 BEFOREUNLOAD - pagina sta per ricaricarsi!', 'error');
        window.AppDebug?.log(`[ChatSelectors] Tastiera aperta: ${isKeyboardOpen}, tempo trascorso: ${timeSinceKeyboardOpen}ms`, 'error');
        
        // Se la tastiera è appena stata aperta (negli ultimi 2 secondi), previeni il reload
        if (isKeyboardOpen && timeSinceKeyboardOpen < 2000) {
            window.AppDebug?.log('[ChatSelectors] 🛑 PREVENGO RELOAD - causato da apertura tastiera!', 'error');
            // Previeni il reload solo se è causato dalla tastiera
            e.preventDefault();
            e.stopImmediatePropagation();
            // Salva lo stato per evitare perdita dati
            if (chatInput) {
                const inputValue = chatInput.value;
                if (inputValue) {
                    sessionStorage.setItem('chat-input-backup', inputValue);
                    window.AppDebug?.log('[ChatSelectors] 💾 Valore input salvato in sessionStorage', 'info');
                }
            }
            return false;
        }
        
        window.AppDebug?.log('[ChatSelectors] ⚠️ Questo potrebbe essere causato da refresh indesiderato su Android', 'error');
    }, { capture: true });
    
    // Monitoraggio: intercetta qualsiasi tentativo di navigazione/reload per logging
    // Su Android, quando la tastiera si apre, il browser potrebbe tentare di navigare
    // Loggiamo ma non blocchiamo (per evitare problemi con reload legittimi)
    const originalLocationReload = window.location.reload;
    window.location.reload = function(...args) {
        window.AppDebug?.log('[ChatSelectors] 🛑 INTERCETTATO window.location.reload()!', 'error');
        window.AppDebug?.log('[ChatSelectors] ⚠️ Stack trace per capire chi ha chiamato reload:', 'error');
        if (window.AppDebug?.log) {
            try {
                throw new Error('Stack trace');
            } catch (e) {
                const stackLines = e.stack?.split('\n').slice(0, 5) || [];
                stackLines.forEach(line => window.AppDebug.log(line, 'error'));
            }
        }
        // Chiama il reload originale (non bloccare, solo loggare)
        window.AppDebug?.log('[ChatSelectors] ⚠️ Eseguendo reload (non bloccato per sicurezza)', 'warn');
        return originalLocationReload.apply(window.location, args);
    };
    
    // Monitoraggio per location.assign
    const originalLocationAssign = window.location.assign;
    window.location.assign = function(...args) {
        window.AppDebug?.log('[ChatSelectors] 🛑 INTERCETTATO window.location.assign()!', 'error');
        window.AppDebug?.log(`[ChatSelectors] URL: ${args[0]}`, 'error');
        // Chiama assign originale (non bloccare, solo loggare)
        return originalLocationAssign.apply(window.location, args);
    };
    
    // Monitoraggio per location.replace
    const originalLocationReplace = window.location.replace;
    window.location.replace = function(...args) {
        window.AppDebug?.log('[ChatSelectors] 🛑 INTERCETTATO window.location.replace()!', 'error');
        window.AppDebug?.log(`[ChatSelectors] URL: ${args[0]}`, 'error');
        // Chiama replace originale (non bloccare, solo loggare)
        return originalLocationReplace.apply(window.location, args);
    };
    
    window.AppDebug?.log('[ChatSelectors] ✅ Listener submit prevenzione aggiunti per Android', 'success');
    window.AppDebug?.log('[ChatSelectors] ✅ Listener viewport/resize/orientation aggiunti per monitoraggio', 'success');
    window.AppDebug?.log('[ChatSelectors] ✅ Intercettazione window.location.* aggiunta per prevenire reload', 'success');
}

// Export per uso globale
if (typeof window !== 'undefined') {
    window.ChatSelectors = {
        get: getChatSelectors,
        reset: resetChatSelectors,
        create: createChatSelectors,
        initFormSubmitPrevention: initChatFormSubmitPrevention
    };
    
    // Auto-inizializza la prevenzione submit quando il file viene caricato
    initChatFormSubmitPrevention();
}




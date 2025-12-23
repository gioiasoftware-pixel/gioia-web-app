// Configuration
// Se usi Vite, usa: import.meta.env.VITE_API_URL
// Altrimenti usa questo fallback o configura in index.html
const API_BASE_URL = window.API_BASE_URL || 'http://localhost:8000';
// Esponi su window per accesso da moduli esterni
window.API_BASE_URL = API_BASE_URL;

// State
let authToken = null;
// Esponi authToken su window quando viene caricato/aggiornato
let currentTheme = 'light';
let currentUser = null;
let viewerData = null;
let viewerFilters = {
    type: null,
    vintage: null,
    winery: null,
    supplier: null
};
let viewerSearchQuery = '';
let viewerCurrentPage = 1;
let viewerPageSize = 20;

// Viewer Fullscreen state
let viewerFullscreenData = null;
let viewerFullscreenFilters = {
    type: null,
    vintage: null,
    winery: null,
    supplier: null
};
let viewerFullscreenSearchQuery = '';
let viewerFullscreenCurrentPage = 1;
let viewerFullscreenPageSize = 50;
let viewerFullscreenSearchTimeout = null;
let movementsChart = null;
let currentConversationId = null;
let conversations = [];

// ============================================
// LAYOUT MANAGER - Gestione separata layout desktop/mobile
// ============================================

/**
 * Rileva se siamo su mobile o desktop basandosi sulla larghezza dello schermo
 * @returns {boolean} true se mobile (<= 768px), false se desktop
 */
function isMobileView() {
    return window.innerWidth <= 768;
}

/**
 * Mostra il layout corretto in base alla dimensione dello schermo
 * Nasconde completamente l'altro layout per evitare conflitti CSS
 * 
 * INTEGRAZIONE LayoutBoundary: applica namespace CSS per isolamento HARD
 */
function switchLayout() {
    const mobileLayout = document.getElementById('mobile-layout');
    const desktopLayout = document.getElementById('desktop-layout');
    const isMobile = isMobileView();
    
    if (!mobileLayout || !desktopLayout) {
        console.warn('Layout containers non trovati');
        return;
    }
    
    // Cleanup layout precedente PRIMA di cambiare
    const wasMobile = mobileLayout.style.display !== 'none';
    
    if (wasMobile && !isMobile) {
        // Stava su mobile, passa a desktop: cleanup mobile
        if (typeof window.ChatMobile !== 'undefined' && window.ChatMobile.cleanup) {
            window.ChatMobile.cleanup();
        }
    } else if (!wasMobile && isMobile) {
        // Stava su desktop, passa a mobile: cleanup desktop
        if (typeof window.ChatDesktop !== 'undefined' && window.ChatDesktop.cleanup) {
            window.ChatDesktop.cleanup();
        }
    }
    
    // Cleanup namespace precedente
    if (typeof window.LayoutBoundary !== 'undefined') {
        window.LayoutBoundary.cleanup();
    }
    
    if (isMobile) {
        // Mostra mobile, nascondi desktop
        mobileLayout.style.display = 'grid'; // mApp usa grid
        desktopLayout.style.display = 'none';
        
        // Applica namespace mobile
        if (typeof window.LayoutBoundary !== 'undefined') {
            window.LayoutBoundary.init('mobile');
        }
    } else {
        // Mostra desktop, nascondi mobile
        mobileLayout.style.display = 'none';
        desktopLayout.style.display = 'flex'; // desktop-layout usa flex
        
        // Applica namespace desktop
        if (typeof window.LayoutBoundary !== 'undefined') {
            window.LayoutBoundary.init('desktop');
        }
    }
    
    // Layout switched (debug log rimosso per produzione)
}

/**
 * Inizializza il layout manager
 * Chiama switchLayout all'avvio e al resize della finestra
 */
function initLayoutManager() {
    // Assicurati che i layout esistano prima di procedere
    const mobileLayout = document.getElementById('mobile-layout');
    const desktopLayout = document.getElementById('desktop-layout');
    
    if (!mobileLayout || !desktopLayout) {
        console.warn('Layout containers non trovati, retry dopo DOMContentLoaded');
        // Retry dopo un breve delay se il DOM non è ancora pronto
        setTimeout(() => {
            if (document.getElementById('mobile-layout') && document.getElementById('desktop-layout')) {
                switchLayout();
            }
        }, 100);
        return;
    }
    
    // Switch layout all'avvio
    switchLayout();
    
    // Reset selectors quando cambia layout
    if (typeof window.ChatSelectors !== 'undefined') {
        window.ChatSelectors.reset();
    }
    
    // Inizializza chat per il layout corrente
    initChatForCurrentLayout();
    
    // Switch layout al resize (con debounce per performance)
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            switchLayout();
            
            // Reset selectors e reinizializza chat
            if (typeof window.ChatSelectors !== 'undefined') {
                window.ChatSelectors.reset();
            }
            initChatForCurrentLayout();
            
            // Chiama anche la funzione esistente per gestire sidebar
            if (typeof handleWindowResize === 'function') {
                handleWindowResize();
            }
        }, 150); // Debounce di 150ms
    });
}

/**
 * Inizializza la chat per il layout corrente (mobile o desktop)
 * Assicura cleanup del layout precedente prima di inizializzare il nuovo
 */
function initChatForCurrentLayout() {
    const isMobile = isMobileView();
    
    // Reset selectors prima di inizializzare
    if (typeof window.ChatSelectors !== 'undefined') {
        window.ChatSelectors.reset();
    }
    
    if (isMobile) {
        // Cleanup desktop se presente
        if (typeof window.ChatDesktop !== 'undefined' && window.ChatDesktop.cleanup) {
            window.ChatDesktop.cleanup();
        }
        
        // Init mobile
        if (typeof window.ChatMobile !== 'undefined') {
            // Piccolo delay per assicurarsi che il DOM sia pronto
            setTimeout(() => {
                window.ChatMobile.init();
            }, 50);
        }
    } else {
        // Cleanup mobile se presente
        if (typeof window.ChatMobile !== 'undefined' && window.ChatMobile.cleanup) {
            window.ChatMobile.cleanup();
        }
        
        // Init desktop
        if (typeof window.ChatDesktop !== 'undefined') {
            setTimeout(() => {
                window.ChatDesktop.init();
            }, 50);
        }
    }
}

/**
 * Chiama switchLayout quando la chat page viene mostrata
 * Utile dopo il login quando la pagina viene resa visibile
 */
function refreshLayoutOnShow() {
    // Piccolo delay per assicurarsi che il DOM sia aggiornato
    setTimeout(() => {
        switchLayout();
        
        // Reset selectors e reinizializza chat
        if (typeof window.ChatSelectors !== 'undefined') {
            window.ChatSelectors.reset();
        }
        initChatForCurrentLayout();
    }, 50);
}

// ============================================
// UTILITY FUNCTIONS - Mobile Browser Support
// ============================================

/**
 * Rileva se il dispositivo supporta touch
 * Compatibile con tutti i browser mobile principali
 */
function isTouchDevice() {
    return 'ontouchstart' in window || 
           navigator.maxTouchPoints > 0 || 
           navigator.msMaxTouchPoints > 0 ||
           (window.DocumentTouch && document instanceof window.DocumentTouch);
}

/**
 * Aggiunge event listener universale per click/touch che funziona su tutti i browser mobile
 * Compatibile con: Safari iOS, Chrome Android, Firefox Mobile, Edge Mobile, Opera Mobile
 * Previene doppio trigger su Safari e altri browser che generano sia touch che click
 * NON blocca lo scroll su elementi scrollabili (come chat-messages-container)
 */
function addUniversalEventListener(element, handler, options = {}) {
    if (!element) return;
    
    // Rileva se l'elemento è scrollabile (non deve bloccare scroll)
    const isScrollable = () => {
        const style = window.getComputedStyle(element);
        const overflowY = style.overflowY || style.overflow;
        const hasScroll = element.scrollHeight > element.clientHeight;
        return (overflowY === 'auto' || overflowY === 'scroll') && hasScroll;
    };
    
    // Usa un WeakMap per tracciare lo stato per ogni elemento (evita conflitti)
    if (!window._touchStateMap) {
        window._touchStateMap = new WeakMap();
    }
    
    const getTouchState = () => {
        if (!window._touchStateMap.has(element)) {
            window._touchStateMap.set(element, {
                touchHandled: false,
                touchStartTime: 0,
                touchStartY: 0,
                touchStartX: 0
            });
        }
        return window._touchStateMap.get(element);
    };
    
    const TOUCH_DELAY = 400; // ms - tempo massimo per considerare un tap valido
    const SWIPE_THRESHOLD = 10; // px - movimento minimo per considerare uno swipe
    
    const unifiedHandler = (e) => {
        const eventType = e.type;
        const now = Date.now();
        const state = getTouchState();
        const elementIsScrollable = isScrollable();
        
        // Se è un evento touchstart
        if (eventType === 'touchstart') {
            state.touchStartTime = now;
            state.touchHandled = false;
            const touch = e.touches[0] || e.changedTouches[0];
            if (touch) {
                state.touchStartY = touch.clientY;
                state.touchStartX = touch.clientX;
            }
            // Non chiamare handler su touchstart, aspetta touchend
            return;
        }
        
        // Se è un evento touchend
        if (eventType === 'touchend') {
            const touch = e.changedTouches[0];
            if (!touch) return;
            
            const touchDuration = now - state.touchStartTime;
            const deltaY = Math.abs(touch.clientY - state.touchStartY);
            const deltaX = Math.abs(touch.clientX - state.touchStartX);
            
            // Se è uno swipe (movimento significativo), NON gestirlo come click
            // Permetti lo scroll su elementi scrollabili
            if (elementIsScrollable && (deltaY > SWIPE_THRESHOLD || deltaX > SWIPE_THRESHOLD)) {
                // È uno swipe, non un tap - non fare nulla, lascia che lo scroll funzioni
                return;
            }
            
            // Gestisci solo se è un tap veloce (non long press o swipe)
            if (touchDuration < TOUCH_DELAY && touchDuration > 0 && deltaY < SWIPE_THRESHOLD && deltaX < SWIPE_THRESHOLD) {
                state.touchHandled = true;
                
                // Previeni default SOLO se NON è un elemento scrollabile
                // Su elementi scrollabili, previeni solo se è chiaramente un tap (non swipe)
                if (!elementIsScrollable) {
                    e.preventDefault();
                    e.stopPropagation();
                } else {
                    // Su elementi scrollabili, previeni solo se è un tap molto preciso (quasi nessun movimento)
                    if (deltaY < 5 && deltaX < 5) {
                        e.preventDefault();
                        e.stopPropagation();
                    } else {
                        // C'è movimento, probabilmente è uno scroll - non bloccare
                        return;
                    }
                }
                
                // Chiama handler
                try {
                    handler(e);
                } catch (error) {
                    console.error('[UNIVERSAL_EVENT] Errore in handler:', error);
                }
                
                // Reset flag dopo delay per permettere click successivi
                setTimeout(() => {
                    state.touchHandled = false;
                }, TOUCH_DELAY);
            }
            return;
        }
        
        // Se è un evento click
        if (eventType === 'click') {
            // Se abbiamo già gestito un touch, previeni il click (Safari genera entrambi)
            if (state.touchHandled) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            
            // Altrimenti gestisci il click normalmente (desktop o browser che non genera touch)
            try {
                handler(e);
            } catch (error) {
                console.error('[UNIVERSAL_EVENT] Errore in handler:', error);
            }
        }
    };
    
    // Su dispositivi touch, ascolta entrambi touch e click
    if (isTouchDevice()) {
        // Touch events per mobile
        // Su elementi scrollabili, usa passive: true per migliorare performance scroll
        const passiveForTouch = elementIsScrollable ? true : false;
        element.addEventListener('touchstart', unifiedHandler, { passive: passiveForTouch, ...options });
        element.addEventListener('touchend', unifiedHandler, { passive: passiveForTouch, ...options });
        // Click come fallback per browser che non supportano touch events correttamente
        // o per dispositivi touch che emulano mouse
        element.addEventListener('click', unifiedHandler, { passive: true, ...options });
    } else {
        // Su desktop, solo click
        element.addEventListener('click', unifiedHandler, options);
    }
}

// Initialize
// Funzione helper per log HTML visibile E invio a Railway
async function debugLog(message, type = 'info', context = null) {
    // DISABILITATO: Log verde rimosso
    // Funzione mantenuta per compatibilità ma non fa nulla
    return;
}

// ============================================
// ============================================
// DEBUG SERIO: Identifica layer che rubano i tap
// ============================================
// Usa elementsFromPoint per vedere TUTTO lo stack di elementi sopra il punto toccato
document.addEventListener("pointerup", (e) => {
    const els = document.elementsFromPoint(e.clientX, e.clientY);
    const target = e.target;
    
    // Log stack completo (primi 6 elementi)
    const stackInfo = els.slice(0, 6).map((el, idx) => {
        const id = el.id || 'no-id';
        const className = el.className || 'no-class';
        const tag = el.tagName.toLowerCase();
        const zIndex = window.getComputedStyle(el).zIndex || 'auto';
        const hidden = el.hasAttribute('hidden') ? 'HIDDEN' : '';
        const display = window.getComputedStyle(el).display;
        return `${idx}: ${tag}#${id}.${className.split(' ')[0]} (z:${zIndex}, d:${display}) ${hidden}`;
    }).join('\n');
    
    // Debug stack info (rimosso console.log per produzione)
    
    // Verifica se ci sono layer sospetti (overlay/sidebar/viewer/modal) anche quando dovrebbero essere chiusi
    // Verifica anche se elementi dell'header (tranne hamburger) intercettano tap
    const suspiciousLayers = els.filter(el => {
        const id = el.id || '';
        const className = el.className || '';
        const tag = el.tagName.toLowerCase();
        const isInHeader = el.closest('.mHeader') || el.closest('.chat-header');
        
        // ESCLUDI l'header stesso (.mHeader) - è legittimo e deve essere sempre visibile
        if (tag === 'header' && (className.includes('mHeader') || className.includes('chat-header'))) {
            return false; // L'header stesso è legittimo
        }
        
        // Se è DENTRO l'header mobile, verifica che sia SOLO il pulsante hamburger
        if (isInHeader && window.innerWidth <= 768) {
            // Se è il pulsante hamburger o un suo figlio, è legittimo
            if (id === 'sidebar-toggle' || el.closest('#sidebar-toggle')) {
                return false; // È il pulsante hamburger, è legittimo
            }
            // Se è un altro elemento dell'header (logo, titolo), è sospetto solo se intercetta tap
            // Ma logo e titolo hanno pointer-events: none, quindi non dovrebbero intercettare
            // Se arrivano qui, significa che stanno intercettando - segnala
            return true; // Elemento dell'header che non dovrebbe intercettare
        }
        
        // ESCLUDI elementi legittimi sempre visibili
        if (tag === 'main' || tag === 'footer' || className.includes('mMain') || className.includes('mComposer')) {
            return false; // Elementi legittimi del layout
        }
        
        // Per altri elementi, verifica overlay/sidebar/viewer/modal
        return (
            (id.includes('overlay') || id.includes('Overlay') || className.includes('overlay')) ||
            (id.includes('sidebar') || id.includes('Sidebar') || className.includes('sidebar')) ||
            (id.includes('viewer') || id.includes('Viewer') || className.includes('viewer')) ||
            (id.includes('modal') || id.includes('Modal') || className.includes('modal'))
        );
    });
    
    if (suspiciousLayers.length > 0) {
        const suspiciousInfo = suspiciousLayers.map(el => {
            const id = el.id || 'no-id';
            const hidden = el.hasAttribute('hidden') ? 'HIDDEN' : 'VISIBLE';
            const display = window.getComputedStyle(el).display;
            return `${el.tagName}#${id} (${hidden}, display:${display})`;
        }).join(', ');
    }
    
    // Se il target non è il primo elemento nello stack, c'è intercettazione
    if (els[0] !== target) {
    }
}, { capture: true });

document.addEventListener('DOMContentLoaded', () => {
    // Inizializza il layout manager PRIMA di tutto
    initLayoutManager();
    
    // Rimuovi parametri sensibili dall'URL se presenti (sicurezza)
    if (window.location.search.includes('email=') || window.location.search.includes('password=')) {
        const url = new URL(window.location);
        url.searchParams.delete('email');
        url.searchParams.delete('password');
        window.history.replaceState({}, '', url);
        console.warn('[SECURITY] Rimossi parametri sensibili dall\'URL');
    }
    
    // Check for spectator token in URL (from Control Panel)
    const urlParams = new URLSearchParams(window.location.search);
    const spectatorToken = urlParams.get('spectator_token');
    
    if (spectatorToken) {
        // Salva token spectator e rimuovi parametro dall'URL
        localStorage.setItem('auth_token', spectatorToken);
        localStorage.setItem('is_spectator_mode', 'true');
        authToken = spectatorToken;
        window.authToken = spectatorToken;
        
        // Pulisci URL
        urlParams.delete('spectator_token');
        const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
        window.history.replaceState({}, '', newUrl);
        
        // Modalità spectator attivata (debug log rimosso)
    } else {
        // Check if user is already logged in
        authToken = localStorage.getItem('auth_token');
        window.authToken = authToken; // Esponi su window
    }
    
    // Inizializza tema (giorno/notte)
    const savedTheme = localStorage.getItem('gioia_theme');
    if (savedTheme === 'dark' || savedTheme === 'light') {
        currentTheme = savedTheme;
    }
    applyTheme(currentTheme, false);

    if (authToken) {
        showChatPage();
        loadUserInfo();
        // Mostra banner spectator se in modalità spectator
        if (localStorage.getItem('is_spectator_mode') === 'true') {
            showSpectatorBanner();
        }
    } else {
        showAuthPage();
    }

    setupEventListeners();
    
    // Setup spectator mode banner
    setupSpectatorMode();
});

// ============================================
// SPECTATOR MODE
// ============================================

function showSpectatorBanner() {
    const bannerDesktop = document.getElementById('spectator-banner');
    const bannerMobile = document.getElementById('spectator-banner-mobile');
    
    if (bannerDesktop) {
        bannerDesktop.style.display = 'block';
    }
    if (bannerMobile) {
        bannerMobile.style.display = 'block';
    }
}

function hideSpectatorBanner() {
    const bannerDesktop = document.getElementById('spectator-banner');
    const bannerMobile = document.getElementById('spectator-banner-mobile');
    
    if (bannerDesktop) {
        bannerDesktop.style.display = 'none';
    }
    if (bannerMobile) {
        bannerMobile.style.display = 'none';
    }
}

function setupSpectatorMode() {
    // Bottone torna al control panel (desktop)
    const backBtnDesktop = document.getElementById('spectator-back-btn');
    if (backBtnDesktop) {
        backBtnDesktop.addEventListener('click', () => {
            const controlPanelUrl = localStorage.getItem('control_panel_url') || 'https://controlpaneladmingioia-production.up.railway.app/admin/dashboard';
            // Pulisci spectator mode
            localStorage.removeItem('is_spectator_mode');
            window.location.href = controlPanelUrl;
        });
    }
    
    // Bottone torna al control panel (mobile)
    const backBtnMobile = document.getElementById('spectator-back-btn-mobile');
    if (backBtnMobile) {
        backBtnMobile.addEventListener('click', () => {
            const controlPanelUrl = localStorage.getItem('control_panel_url') || 'https://controlpaneladmingioia-production.up.railway.app/admin/dashboard';
            // Pulisci spectator mode
            localStorage.removeItem('is_spectator_mode');
            window.location.href = controlPanelUrl;
        });
    }
}

// ============================================
// THEME TOGGLE (DAY/NIGHT)
// ============================================

function applyTheme(theme, persist = true) {
    currentTheme = theme === 'dark' ? 'dark' : 'light';
    const body = document.body;
    
    if (currentTheme === 'dark') {
        body.classList.add('dark-theme');
    } else {
        body.classList.remove('dark-theme');
    }

    // Aggiorna logo (versione chiara/scura)
    const logoImgElements = document.querySelectorAll('.logo-container img.logo, .chat-message-avatar img.chat-avatar-logo');
    logoImgElements.forEach(img => {
        if (currentTheme === 'dark') {
            // Usa logo dark se disponibile nello static
            img.src = '/static/assets/logo-dark.png';
        } else {
            img.src = '/static/assets/logo.png';
        }
    });

    if (persist) {
        try {
            localStorage.setItem('gioia_theme', currentTheme);
        } catch (e) {
            console.warn('[THEME] Impossibile salvare tema in localStorage:', e);
        }
    }

    // Aggiorna stato del toggle switch (checked = dark mode)
    const themeCheckbox = document.getElementById('themeToggle');
    if (themeCheckbox) {
        themeCheckbox.checked = currentTheme === 'dark';
        const themeLabel = themeCheckbox.nextElementSibling;
        if (themeLabel && themeLabel.classList.contains('ui-themeToggle__track')) {
            themeLabel.title = currentTheme === 'dark' ? 'Passa alla modalità giorno' : 'Passa alla modalità notte';
        }
    }
}

function toggleTheme() {
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme, true);
}

// ============================================
// AUTHENTICATION
// ============================================

function setupEventListeners() {
    // Auth form switches
    document.getElementById('switch-to-signup')?.addEventListener('click', (e) => {
        e.preventDefault();
        switchToSignup();
    });

    document.getElementById('switch-to-login')?.addEventListener('click', (e) => {
        e.preventDefault();
        switchToLogin();
    });

    // Form submissions
    document.getElementById('login-form-element')?.addEventListener('submit', handleLogin);
    document.getElementById('signup-form-element')?.addEventListener('submit', handleSignup);

    // Chat (desktop)
    document.getElementById('chat-form')?.addEventListener('submit', handleChatSubmit);
    document.getElementById('chat-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            document.getElementById('chat-form').dispatchEvent(new Event('submit'));
        }
    });

    // Chat (mobile) - NUOVA ARCHITETTURA
    document.getElementById('chat-form-mobile')?.addEventListener('submit', handleChatSubmit);
    document.getElementById('chat-input-mobile')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            document.getElementById('chat-form-mobile').dispatchEvent(new Event('submit'));
        }
    });

    // Auto-resize textarea (desktop)
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.addEventListener('input', () => {
            chatInput.style.height = 'auto';
            chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
        });
    }

    // Auto-resize textarea (mobile)
    const chatInputMobile = document.getElementById('chat-input-mobile');
    if (chatInputMobile) {
        chatInputMobile.addEventListener('input', () => {
            chatInputMobile.style.height = 'auto';
            chatInputMobile.style.height = Math.min(chatInputMobile.scrollHeight, 120) + 'px';
        });
    }

    // Logout - usa listener universale per mobile
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        addUniversalEventListener(logoutBtn, handleLogout);
    }

    // Theme toggle switch (giorno/notte) - Desktop
    const themeCheckbox = document.getElementById('themeToggle');
    if (themeCheckbox) {
        themeCheckbox.checked = currentTheme === 'dark';
        themeCheckbox.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            const nextTheme = isChecked ? 'dark' : 'light';
            applyTheme(nextTheme, true);
        });
    }

    // Theme toggle switch mobile
    const themeCheckboxMobile = document.getElementById('themeToggle-mobile');
    if (themeCheckboxMobile) {
        themeCheckboxMobile.checked = currentTheme === 'dark';
        themeCheckboxMobile.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            const nextTheme = isChecked ? 'dark' : 'light';
            applyTheme(nextTheme, true);
        });
    }
    
    // Logout button mobile
    const logoutBtnMobile = document.getElementById('logout-btn-mobile');
    if (logoutBtnMobile) {
        addUniversalEventListener(logoutBtnMobile, handleLogout);
    }
    
    // Bottone aggiungi vino (desktop)
    const addWineBtn = document.getElementById('add-wine-btn');
    if (addWineBtn) {
        addUniversalEventListener(addWineBtn, (e) => {
            e.preventDefault();
            openAddWineModal();
        });
    }
    
    // Quick Actions Bar mobile rimossa dal layout mobile

    // Chat sidebar
    const newChatBtn = document.getElementById('new-chat-btn');
    if (newChatBtn) {
        // Usa pointer events per mobile
        newChatBtn.addEventListener('pointerup', (e) => {
            e.stopPropagation();
            handleNewChat();
        });
    }
    
    // SOLUZIONE BLINDATA: Usa funzione dedicata che funziona anche dopo showChatPage
    attachSidebarToggleListeners();
    // NUOVA ARCHITETTURA MOBILE: Setup overlay sidebar (esiste già nel DOM, gestito con hidden)
    setupSidebarOverlay();
    
    // NUOVA ARCHITETTURA MOBILE: Setup new-chat-btn mobile
    const newChatBtnMobile = document.getElementById('new-chat-btn-mobile');
    if (newChatBtnMobile) {
        newChatBtnMobile.addEventListener('pointerup', (e) => {
            e.stopPropagation();
            handleNewChat();
        });
    }
    
    // Gestisci resize window per mobile/desktop
    window.addEventListener('resize', handleWindowResize);

    // Viewer toggle - usa pointer events per mobile
    const viewerToggle = document.getElementById('viewer-toggle');
    if (viewerToggle) {
        viewerToggle.addEventListener('pointerup', (e) => {
            e.stopPropagation();
            toggleViewer();
        });
    }
    const viewerClose = document.getElementById('viewer-close');
    if (viewerClose) {
        addUniversalEventListener(viewerClose, closeViewer);
    }
    // Setup ricerca viewer - usa listener universale per mobile
    setupViewerSearch();
    setupViewerFilters();
    
    // Viewer Fullscreen - sempre disponibile, ma funziona solo su desktop
    setupViewerFullscreenListeners();
    
    const viewerDownloadBtn = document.getElementById('viewer-download-csv');
    if (viewerDownloadBtn) {
        // Usa pointer events per mobile
        viewerDownloadBtn.addEventListener('pointerup', (e) => {
            e.stopPropagation();
            handleViewerDownloadCSV();
        });
    }
    
    // Modal movimenti - usa pointer events per mobile
    const movementsModalClose = document.getElementById('viewer-movements-modal-close');
    if (movementsModalClose) {
        movementsModalClose.addEventListener('pointerup', (e) => {
            e.stopPropagation();
            closeMovementsModal();
        });
    }
    const movementsModal = document.getElementById('viewer-movements-modal');
    if (movementsModal) {
        movementsModal.addEventListener('pointerup', (e) => {
            if (e.target === movementsModal) {
                closeMovementsModal();
            }
        });
    }
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && movementsModal && !movementsModal.classList.contains('hidden')) {
            closeMovementsModal();
        }
    });
}

function switchToSignup() {
    document.getElementById('login-form').classList.remove('active');
    document.getElementById('signup-form').classList.add('active');
    document.getElementById('login-error').classList.add('hidden');
}

function switchToLogin() {
    document.getElementById('signup-form').classList.remove('active');
    document.getElementById('login-form').classList.add('active');
    document.getElementById('signup-error').classList.add('hidden');
}

async function handleLogin(e) {
    e.preventDefault();
    const errorEl = document.getElementById('login-error');
    errorEl.classList.add('hidden');

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const rememberMe = document.getElementById('remember-me').checked;

    // Validazione base
    if (!email || !password) {
        errorEl.textContent = 'Inserisci email e password';
        errorEl.classList.remove('hidden');
        return;
    }

    // Mostra indicatore di caricamento
    const loginBtn = e.target.querySelector('button[type="submit"]') || document.querySelector('#login-form-element button[type="submit"]');
    const originalBtnText = loginBtn ? loginBtn.textContent : '';
    if (loginBtn) {
        loginBtn.disabled = true;
        loginBtn.textContent = 'Accesso in corso...';
    }

    try {
        console.log('[LOGIN] Tentativo login per:', email);
        const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password, remember_me: rememberMe }),
        });

        console.log('[LOGIN] Risposta ricevuta:', response.status, response.statusText);

        // Prova a parsare la risposta come JSON
        let data;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            try {
                data = await response.json();
                // Dati ricevuti (debug log rimosso)
            } catch (jsonError) {
                console.error('[LOGIN] Errore parsing JSON:', jsonError);
                const textResponse = await response.text();
                console.error('[LOGIN] Risposta non-JSON:', textResponse);
                throw new Error('Risposta del server non valida. Riprova.');
            }
        } else {
            const textResponse = await response.text();
            console.error('[LOGIN] Risposta non-JSON:', textResponse);
            throw new Error('Risposta del server non valida. Riprova.');
        }

        if (!response.ok) {
            // Gestione errori più dettagliata
            let errorMessage = 'Errore durante il login';
            
            if (response.status === 401) {
                errorMessage = 'Email o password non corretti. Verifica le credenziali e riprova.';
            } else if (response.status === 403) {
                errorMessage = 'Accesso negato. Contatta l\'amministratore.';
            } else if (response.status === 404) {
                errorMessage = 'Utente non trovato. Verifica l\'email inserita.';
            } else if (data.detail) {
                errorMessage = data.detail;
            } else if (data.message) {
                errorMessage = data.message;
            }
            
            console.error('[LOGIN] Errore login:', response.status, data);
            throw new Error(errorMessage);
        }

        // Rimuovi parametri sensibili dall'URL se presenti (sicurezza)
        if (window.location.search.includes('email=') || window.location.search.includes('password=')) {
            const url = new URL(window.location);
            url.searchParams.delete('email');
            url.searchParams.delete('password');
            window.history.replaceState({}, '', url);
        }

        authToken = data.access_token;
        window.authToken = authToken; // Esponi su window
        if (!authToken) {
            console.error('[LOGIN] Token non presente nella risposta:', data);
            throw new Error('Token di autenticazione non ricevuto dal server');
        }
        
        localStorage.setItem('auth_token', authToken);
        currentUser = data;
        
        try {
            showChatPage();
            console.log('[LOGIN] showChatPage completata');
        } catch (showError) {
            console.error('[LOGIN] Errore in showChatPage:', showError);
            throw new Error('Errore nel caricamento della pagina. Ricarica la pagina.');
        }
        
        try {
            loadUserInfo();
            // loadUserInfo completata (debug log rimosso)
        } catch (loadError) {
            console.error('[LOGIN] Errore in loadUserInfo:', loadError);
            // Non bloccare il login se loadUserInfo fallisce
        }
    } catch (error) {
        console.error('[LOGIN] Errore durante il login:', error);
        errorEl.textContent = error.message || 'Errore durante il login. Riprova.';
        errorEl.classList.remove('hidden');
    } finally {
        // Ripristina il pulsante
        if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.textContent = originalBtnText;
        }
    }
}

async function handleSignup(e) {
    e.preventDefault();
    const errorEl = document.getElementById('signup-error');
    errorEl.classList.add('hidden');

    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const businessName = document.getElementById('business-name').value;
    const codice = document.getElementById('codice').value;

    // Validate password
    if (password.length < 8) {
        errorEl.textContent = 'La password deve essere di almeno 8 caratteri';
        errorEl.classList.remove('hidden');
        return;
    }

    // Validate codice
    if (!codice || codice.trim() === '') {
        errorEl.textContent = 'Il codice è obbligatorio';
        errorEl.classList.remove('hidden');
        return;
    }

    try {
        const body = {
            email,
            password,
            business_name: businessName,
            codice: parseInt(codice)
        };

        const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || 'Errore durante la registrazione');
        }

        authToken = data.access_token;
        localStorage.setItem('auth_token', authToken);
        currentUser = data;

        showChatPage();
        loadUserInfo();
    } catch (error) {
        errorEl.textContent = error.message;
        errorEl.classList.remove('hidden');
    }
}

async function loadUserInfo() {
    if (!authToken) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
            },
        });

        // Se il token è scaduto o invalido
        if (response.status === 401 || response.status === 403) {
            const isSpectator = localStorage.getItem('is_spectator_mode') === 'true';
            console.warn('[AUTH] Token scaduto o invalido', isSpectator ? '(spectator mode)' : '');
            
            // Se siamo in spectator mode, non mostrare errore di sessione scaduta
            // ma torna al control panel
            if (isSpectator) {
                const controlPanelUrl = localStorage.getItem('control_panel_url') || 'https://controlpaneladmingioia-production.up.railway.app/admin/dashboard';
                console.warn('[SPECTATOR] Token spectator non valido, ritorno al control panel');
                localStorage.removeItem('is_spectator_mode');
                localStorage.removeItem('control_panel_url');
                window.location.href = controlPanelUrl;
                return;
            }
            
            // Comportamento normale: logout e mostra errore
            handleLogout();
            // Mostra messaggio all'utente
            const errorEl = document.getElementById('login-error');
            if (errorEl) {
                errorEl.textContent = 'La sessione è scaduta. Effettua nuovamente il login.';
                errorEl.classList.remove('hidden');
            }
            return;
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('[AUTH] Errore caricamento info utente:', response.status, errorData);
            // Se c'è un errore grave, fai logout
            if (response.status >= 500) {
                handleLogout();
            }
            return;
        }

        currentUser = await response.json();
        // Info utente caricate (debug log rimosso)
    } catch (error) {
        console.error('[AUTH] Errore caricamento info utente:', error);
        // In caso di errore di rete, non fare logout automatico (potrebbe essere temporaneo)
    }
}

function handleLogout() {
    authToken = null;
    window.authToken = null; // Esponi su window
    currentUser = null;
    currentConversationId = null;
    conversations = [];
    
    // Se siamo in spectator mode, torna al control panel invece di mostrare login
    const isSpectator = localStorage.getItem('is_spectator_mode') === 'true';
    const controlPanelUrl = localStorage.getItem('control_panel_url') || 'https://controlpaneladmingioia-production.up.railway.app/admin/dashboard';
    
    localStorage.removeItem('auth_token');
    localStorage.removeItem('current_conversation_id');
    localStorage.removeItem('is_spectator_mode');
    localStorage.removeItem('control_panel_url');
    
    if (isSpectator) {
        // Torna al control panel
        window.location.href = controlPanelUrl;
    } else {
        // Comportamento normale: mostra pagina login
        showAuthPage();
    }
}

function showAuthPage() {
    document.getElementById('auth-page').classList.remove('hidden');
    document.getElementById('chat-page').classList.add('hidden');
}

function showChatPage() {
    document.getElementById('auth-page').classList.add('hidden');
    document.getElementById('chat-page').classList.remove('hidden');
    
    // Mostra banner spectator se in modalità spectator
    if (localStorage.getItem('is_spectator_mode') === 'true') {
        showSpectatorBanner();
    }
    
    // CRITICO: Aggiorna il layout quando la pagina chat viene mostrata
    refreshLayoutOnShow();
    
    // CRITICO: Attacca listener sidebar dopo che la pagina chat è visibile
    // Aspetta un frame per assicurarsi che il DOM sia renderizzato
    setTimeout(() => {
        attachSidebarToggleListeners();
    }, 100);
    
    // Carica stato sidebar
    loadSidebarState();
    // Carica conversazioni e seleziona quella corrente
    loadConversations();
    // Carica conversation_id dal localStorage
    const savedConversationId = localStorage.getItem('current_conversation_id');
    if (savedConversationId) {
        currentConversationId = parseInt(savedConversationId);
        loadConversationMessages(currentConversationId);
    }
    
    // Diagnostica scroll su desktop dopo che tutto è caricato
    setTimeout(() => {
        console.log('[SCROLL DIAG] 🚀 Chiamata funzione diagnoseChatScroll()');
        try {
            diagnoseChatScroll();
        } catch (error) {
            console.error('[SCROLL DIAG] ❌ ERRORE nella funzione diagnoseChatScroll:', error);
            console.error('[SCROLL DIAG] Stack:', error.stack);
        }
    }, 1000);
}

// ============================================
// DIAGNOSTICA SCROLL CHAT DESKTOP
// ============================================

function diagnoseChatScroll() {
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
        return; // Diagnostica solo su desktop
    }
    
    // 1. Verifica esistenza elemento scroll wrapper
    // Cerca prima il wrapper scrollabile (quello corretto)
    let scrollWrapper = document.getElementById('chat-messages-scroll-wrapper');
    
    // Se non trovato, cerca dentro il container
    if (!scrollWrapper) {
        const container = document.getElementById('chat-messages');
        if (container) {
            scrollWrapper = container.querySelector('.chat-messages-scroll-wrapper');
        }
    }
    
    // Se ancora non trovato, usa il container come fallback (non ideale ma meglio di niente)
    if (!scrollWrapper) {
        scrollWrapper = document.getElementById('chat-messages');
    }
    
    if (!scrollWrapper) {
        console.error('[SCROLL DIAG] ❌ PROBLEMA: Scroll wrapper non trovato!');
        console.error('[SCROLL DIAG] 🔍 Cercato: #chat-messages-scroll-wrapper, .chat-messages-scroll-wrapper dentro #chat-messages, e #chat-messages');
        console.error('[SCROLL DIAG] 💡 DESCRIZIONE: L\'elemento che dovrebbe gestire lo scroll non esiste nel DOM');
        return;
    }
    
    // Se abbiamo trovato il container invece del wrapper, avvisa
    if (scrollWrapper.id === 'chat-messages' && !scrollWrapper.classList.contains('chat-messages-scroll-wrapper')) {
        console.warn('[SCROLL DIAG] ⚠️ ATTENZIONE: Trovato container invece del wrapper scrollabile!');
        console.warn('[SCROLL DIAG] 💡 Cercando wrapper dentro il container...');
        const wrapperInside = scrollWrapper.querySelector('.chat-messages-scroll-wrapper');
        if (wrapperInside) {
            scrollWrapper = wrapperInside;
            console.log('[SCROLL DIAG] ✅ Wrapper trovato dentro il container!');
        } else {
            console.warn('[SCROLL DIAG] ⚠️ Wrapper non trovato, userò il container (potrebbe non funzionare correttamente)');
        }
    }
    
    console.log('[SCROLL DIAG] ✅ Scroll wrapper trovato:', scrollWrapper);
    console.log('[SCROLL DIAG]   - ID:', scrollWrapper.id || 'nessun ID');
    console.log('[SCROLL DIAG]   - Class:', scrollWrapper.className);
    
    // 2. Verifica proprietà CSS critiche
    const computedStyle = window.getComputedStyle(scrollWrapper);
    const cssChecks = {
        'overflow-y': computedStyle.overflowY,
        'overflow-x': computedStyle.overflowX,
        'display': computedStyle.display,
        'flex': computedStyle.flex,
        'min-height': computedStyle.minHeight,
        'height': computedStyle.height,
        'max-height': computedStyle.maxHeight,
        'position': computedStyle.position,
        'z-index': computedStyle.zIndex,
        'pointer-events': computedStyle.pointerEvents,
        'touch-action': computedStyle.touchAction,
        'isolation': computedStyle.isolation
    };
    
    // Verifica problemi CSS
    const cssIssues = [];
    if (computedStyle.overflowY !== 'auto' && computedStyle.overflowY !== 'scroll') {
        cssIssues.push(`overflow-y è "${computedStyle.overflowY}" invece di "auto" o "scroll"`);
        // Forza overflow-y se non è corretto
        scrollWrapper.style.overflowY = 'auto';
        scrollWrapper.style.overflowX = 'hidden';
        console.log('[SCROLL DIAG] 🔧 Overflow-y forzato a "auto" via JavaScript');
    }
    if (computedStyle.minHeight !== '0px' && computedStyle.minHeight !== '0') {
        cssIssues.push(`min-height è "${computedStyle.minHeight}" invece di "0" (necessario per flex scroll)`);
    }
    if (computedStyle.pointerEvents === 'none') {
        cssIssues.push(`pointer-events è "none" (blocca eventi)`);
    }
    
    if (cssIssues.length > 0) {
        console.warn('[SCROLL DIAG] ⚠️ PROBLEMI CSS RILEVATI:');
        cssIssues.forEach(issue => console.warn(`[SCROLL DIAG]   - ${issue}`));
    }
    
    // 3. Verifica dimensioni e scrollabilità
    const scrollHeight = scrollWrapper.scrollHeight;
    const clientHeight = scrollWrapper.clientHeight;
    const scrollTop = scrollWrapper.scrollTop;
    const isScrollable = scrollHeight > clientHeight;
    const maxScroll = scrollHeight - clientHeight;
    
    // Dimensioni verificate (debug log rimosso)
    
    if (!isScrollable) {
        console.warn('[SCROLL DIAG] ⚠️ PROBLEMA: Elemento non scrollabile');
        console.warn('[SCROLL DIAG] 💡 DESCRIZIONE: scrollHeight <= clientHeight, non c\'è contenuto da scrollare');
        console.warn('[SCROLL DIAG] 💡 POSSIBILE CAUSA: Messaggi non ancora renderizzati o contenuto troppo corto');
    }
    
    // 4. Verifica elementi sovrapposti
    const rect = scrollWrapper.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const topX = rect.left + rect.width / 2;
    const topY = rect.top + 50;
    const bottomX = rect.left + rect.width / 2;
    const bottomY = rect.bottom - 50;
    
    const elementsAtPoints = [
        { point: 'centro', x: centerX, y: centerY },
        { point: 'alto', x: topX, y: topY },
        { point: 'basso', x: bottomX, y: bottomY }
    ];
    
    console.log('[SCROLL DIAG] 🎯 Verifica elementi sovrapposti:');
    const overlappingElements = [];
    
    elementsAtPoints.forEach(({ point, x, y }) => {
        const elementAtPoint = document.elementFromPoint(x, y);
        const isInsideWrapper = scrollWrapper.contains(elementAtPoint) || elementAtPoint === scrollWrapper;
        
        console.log(`[SCROLL DIAG]   - Punto ${point} (${Math.round(x)}, ${Math.round(y)}):`, {
            element: elementAtPoint?.tagName + (elementAtPoint?.id ? '#' + elementAtPoint.id : '') + (elementAtPoint?.className ? '.' + elementAtPoint.className.split(' ')[0] : ''),
            isInsideWrapper: isInsideWrapper ? '✅' : '❌',
            zIndex: elementAtPoint ? window.getComputedStyle(elementAtPoint).zIndex : 'N/A',
            pointerEvents: elementAtPoint ? window.getComputedStyle(elementAtPoint).pointerEvents : 'N/A'
        });
        
        if (!isInsideWrapper && elementAtPoint && elementAtPoint !== document.body && elementAtPoint !== document.documentElement) {
            overlappingElements.push({ point, element: elementAtPoint });
        }
    });
    
    if (overlappingElements.length > 0) {
        console.error('[SCROLL DIAG] ❌ PROBLEMA: Elementi sovrapposti rilevati!');
        overlappingElements.forEach(({ point, element }) => {
            const elStyle = window.getComputedStyle(element);
            console.error(`[SCROLL DIAG]   - Punto ${point}:`, {
                tag: element.tagName,
                id: element.id || 'nessun ID',
                class: element.className || 'nessuna classe',
                zIndex: elStyle.zIndex,
                position: elStyle.position,
                pointerEvents: elStyle.pointerEvents
            });
        });
        console.error('[SCROLL DIAG] 💡 DESCRIZIONE: Elementi sovrapposti bloccano gli eventi wheel sull\'area scrollabile');
    }
    
    // 5. Test scroll programmatico (solo se non è già al limite)
    let scrollProgrammaticWorks = false;
    if (isScrollable && maxScroll > 0 && scrollTop < maxScroll - 10) {
        const originalScrollTop = scrollWrapper.scrollTop;
        const testScrollAmount = Math.min(10, maxScroll - scrollTop - 1); // Scroll di 10px o meno, senza superare il limite
        
        if (testScrollAmount > 0) {
            scrollWrapper.scrollTop = originalScrollTop + testScrollAmount;
            // Aspetta un frame per permettere al browser di applicare lo scroll
            requestAnimationFrame(() => {
                const newScrollTop = scrollWrapper.scrollTop;
                scrollProgrammaticWorks = Math.abs(newScrollTop - (originalScrollTop + testScrollAmount)) < 2;
                console.log('[SCROLL DIAG]   - Scroll funziona?', scrollProgrammaticWorks ? '✅ SÌ' : '❌ NO');
                
                // Ripristina
                scrollWrapper.scrollTop = originalScrollTop;
                
                if (!scrollProgrammaticWorks) {
                    console.warn('[SCROLL DIAG] ⚠️ ATTENZIONE: Scroll programmatico non funziona (ma potrebbe essere normale se ci sono listener che lo bloccano)');
                }
            });
        } else {
            console.log('[SCROLL DIAG]   - Saltato: già vicino al limite dello scroll');
            scrollProgrammaticWorks = true; // Considera OK se è al limite
        }
    } else {
        scrollProgrammaticWorks = true; // Considera OK se non scrollabile o al limite
    }
    
    // 6. Aggiungi listener per intercettare eventi wheel (solo per logging, senza forzare scroll)
    let wheelEventCount = 0;
    let scrollEventCount = 0;
    let lastWheelTime = 0;
    let lastScrollTime = 0;
    
    // Variabile per tracciare se lo scroll è stato forzato
    let scrollForceAttempted = false;
    
    const wheelHandler = (e) => {
        wheelEventCount++;
        lastWheelTime = Date.now();
        
        const rect = scrollWrapper.getBoundingClientRect();
        const isInside = e.clientX >= rect.left && e.clientX <= rect.right &&
                        e.clientY >= rect.top && e.clientY <= rect.bottom;
        
        console.log(`[SCROLL DIAG] 🎡 Wheel event #${wheelEventCount}:`, {
            deltaY: e.deltaY,
            deltaX: e.deltaX,
            clientX: e.clientX,
            clientY: e.clientY,
            isInsideWrapper: isInside ? '✅' : '❌',
            target: e.target.tagName + (e.target.id ? '#' + e.target.id : ''),
            currentTarget: e.currentTarget === scrollWrapper ? 'scrollWrapper' : 'altro',
            defaultPrevented: e.defaultPrevented,
            cancelable: e.cancelable,
            scrollTop: scrollWrapper.scrollTop,
            scrollHeight: scrollWrapper.scrollHeight,
            clientHeight: scrollWrapper.clientHeight
        });
        
        // Se l'evento è dentro il wrapper scrollabile e non è stato preventDefault
        if (isInside && isScrollable && !e.defaultPrevented && Math.abs(e.deltaY) > 0) {
            const oldScrollTop = scrollWrapper.scrollTop;
            const maxScroll = scrollWrapper.scrollHeight - scrollWrapper.clientHeight;
            
            // Verifica se lo scroll dovrebbe funzionare ma non funziona
            requestAnimationFrame(() => {
                const newScrollTop = scrollWrapper.scrollTop;
                // Se lo scroll non è cambiato dopo l'evento wheel, forzalo
                if (oldScrollTop === newScrollTop && Math.abs(e.deltaY) > 0) {
                    const canScrollDown = oldScrollTop < maxScroll && e.deltaY > 0;
                    const canScrollUp = oldScrollTop > 0 && e.deltaY < 0;
                    
                    if ((canScrollDown || canScrollUp) && !scrollForceAttempted) {
                        scrollForceAttempted = true;
                        const scrollAmount = e.deltaY * 0.5; // Riduci per scroll più fluido
                        const targetScroll = Math.max(0, Math.min(maxScroll, oldScrollTop + scrollAmount));
                        
                        console.warn(`[SCROLL DIAG] ⚠️ Wheel ricevuto ma scroll non avvenuto! Forzo scroll:`, {
                            oldScrollTop: oldScrollTop,
                            targetScroll: targetScroll,
                            deltaY: e.deltaY,
                            scrollAmount: scrollAmount
                        });
                        
                        scrollWrapper.scrollTop = targetScroll;
                        
                        // Reset flag dopo breve delay
                        setTimeout(() => {
                            scrollForceAttempted = false;
                        }, 100);
                    }
                }
            });
        }
    };
    
    const scrollHandler = () => {
        scrollEventCount++;
        lastScrollTime = Date.now();
        
        console.log(`[SCROLL DIAG] 🖱️ Scroll event #${scrollEventCount}:`, {
            scrollTop: scrollWrapper.scrollTop,
            scrollHeight: scrollWrapper.scrollHeight,
            clientHeight: scrollWrapper.clientHeight
        });
    };
    
    scrollWrapper.addEventListener('wheel', wheelHandler, { passive: true });
    scrollWrapper.addEventListener('scroll', scrollHandler, { passive: true });
    
    // Listener su document solo per logging, non forza scroll (evita duplicazione)
    const documentWheelCaptureHandler = (e) => {
        const rect = scrollWrapper.getBoundingClientRect();
        const isInside = e.clientX >= rect.left && e.clientX <= rect.right &&
                        e.clientY >= rect.top && e.clientY <= rect.bottom;
        
        if (isInside && !isMobile && Math.abs(e.deltaY) > 0) {
            console.log('[SCROLL DIAG] 🎯 Document wheel (capture):', {
                deltaY: e.deltaY,
                clientX: e.clientX,
                clientY: e.clientY,
                target: e.target.tagName + (e.target.id ? '#' + e.target.id : ''),
                currentTarget: 'document',
                defaultPrevented: e.defaultPrevented,
                isInsideWrapper: '✅'
            });
            // Non forza scroll qui per evitare duplicazione con wheelHandler
        }
    };
    
    document.addEventListener('wheel', documentWheelCaptureHandler, { passive: true, capture: true });
    
    console.log('[SCROLL DIAG] ✅ Listener wheel e scroll aggiunti');
    console.log('[SCROLL DIAG] ✅ Listener wheel capture su document aggiunto');
    console.log('[SCROLL DIAG] 💡 Prova a scrollare con la rotella del mouse per vedere i log');
    
    // 7. Verifica listener esistenti (non possiamo farlo direttamente, ma possiamo testare)
    console.log('[SCROLL DIAG] 🔍 Verifica listener esistenti:');
    console.log('[SCROLL DIAG]   - Nota: Non possiamo enumerare listener esistenti, ma testeremo il comportamento');
    
    // 8. Riepilogo finale (dopo che l'utente ha avuto tempo di provare a scrollare)
    setTimeout(() => {
        console.log('[SCROLL DIAG] 📊 ========== RIEPILOGO FINALE (dopo 2s) ==========');
        console.log('[SCROLL DIAG]   - Elemento trovato:', scrollWrapper ? '✅' : '❌');
        console.log('[SCROLL DIAG]   - Overflow-y corretto:', (computedStyle.overflowY === 'auto' || computedStyle.overflowY === 'scroll') ? '✅' : '❌');
        console.log('[SCROLL DIAG]   - Min-height corretto:', (computedStyle.minHeight === '0px' || computedStyle.minHeight === '0') ? '✅' : '❌');
        console.log('[SCROLL DIAG]   - È scrollabile:', isScrollable ? '✅' : '❌');
        console.log('[SCROLL DIAG]   - Elementi sovrapposti:', overlappingElements.length === 0 ? '✅ Nessuno' : `❌ ${overlappingElements.length} trovati`);
        console.log('[SCROLL DIAG]   - Wheel events ricevuti:', wheelEventCount > 0 ? `✅ ${wheelEventCount}` : '⚠️ Nessuno (prova a scrollare per vedere se arrivano)');
        console.log('[SCROLL DIAG]   - Scroll events ricevuti:', scrollEventCount > 0 ? `✅ ${scrollEventCount}` : '⚠️ Nessuno (prova a scrollare per vedere se arrivano)');
        
        // Solo mostra errori se ci sono problemi REALI (non solo "nessun evento" perché l'utente non ha ancora provato)
        if (wheelEventCount === 0 && scrollEventCount === 0 && isScrollable) {
            console.warn('[SCROLL DIAG] ⚠️ Nota: Nessun evento ricevuto finora. Prova a scrollare con la rotella del mouse per verificare.');
            console.warn('[SCROLL DIAG] 💡 Se dopo aver scrollato non vedi eventi, potrebbe esserci un problema.');
        } else if (wheelEventCount > 0 && scrollEventCount === 0 && isScrollable) {
            console.error('[SCROLL DIAG] ❌ PROBLEMA: Eventi wheel ricevuti ma scroll non avviene!');
            console.error('[SCROLL DIAG] 💡 DESCRIZIONE: Gli eventi wheel arrivano ma non producono scroll');
            console.error('[SCROLL DIAG] 💡 POSSIBILI CAUSE:');
            console.error('[SCROLL DIAG]     1. preventDefault() chiamato da altro listener');
            console.error('[SCROLL DIAG]     2. CSS overflow che non permette scroll');
            console.error('[SCROLL DIAG]     3. Problema con le dimensioni dell\'elemento');
        } else if (wheelEventCount > 0 && scrollEventCount > 0) {
            console.log('[SCROLL DIAG] ✅ TUTTO OK: Eventi wheel e scroll funzionano correttamente!');
        }
        
        console.log('[SCROLL DIAG] ==========================================');
    }, 2000);
}

// Funzione dedicata per attaccare listener sidebar (chiamata sia in setupEventListeners che in showChatPage)
function attachSidebarToggleListeners() {
    const isMobile = window.innerWidth <= 768;
    let sidebarToggle = null;
    
    if (isMobile) {
        sidebarToggle = document.querySelector('.mHeader #sidebar-toggle');
        console.log('[SIDEBAR] attachSidebarToggleListeners: Cercando in .mHeader:', sidebarToggle);
        if (!sidebarToggle) {
            sidebarToggle = document.getElementById('sidebar-toggle');
            console.log('[SIDEBAR] attachSidebarToggleListeners: Fallback getElementById:', sidebarToggle);
        }
    } else {
        sidebarToggle = document.getElementById('sidebar-toggle');
    }
    
    if (!sidebarToggle) {
        console.warn('[SIDEBAR] attachSidebarToggleListeners: Pulsante non trovato, riprovo tra 500ms...');
        setTimeout(attachSidebarToggleListeners, 500);
        return;
    }
    
    // Verifica se ha già listener (evita duplicati)
    if (sidebarToggle.dataset.listenerAttached === 'true') {
        console.log('[SIDEBAR] Listener già attaccato, skip');
        return;
    }
    
    console.log('[SIDEBAR] attachSidebarToggleListeners: Pulsante trovato, attacco listener');
    console.log('[SIDEBAR] Pulsante details:', {
        id: sidebarToggle.id,
        tagName: sidebarToggle.tagName,
        type: sidebarToggle.type,
        className: sidebarToggle.className,
        rect: sidebarToggle.getBoundingClientRect(),
        parentElement: sidebarToggle.parentElement?.tagName + '#' + (sidebarToggle.parentElement?.id || 'no-id')
    });
    
    // Listener pointerup principale - CON CAPTURE per essere sicuri di catturarlo
    const pointerupHandler = function(e) {
        console.log('[SIDEBAR] ========== pointerup EVENTO CATTURATO ==========');
        console.log('[SIDEBAR] Evento:', {
            type: e.type,
            clientX: e.clientX,
            clientY: e.clientY,
            target: e.target.tagName + '#' + (e.target.id || 'no-id'),
            currentTarget: e.currentTarget.tagName + '#' + (e.currentTarget.id || 'no-id'),
            button: e.button,
            pointerType: e.pointerType
        });
        
        const sidebar = document.getElementById('chatSidebar');
        const isOpen = sidebar?.classList.contains('is-open') || false;
        
        console.log('[SIDEBAR] btn pointerup. isOpen:', isOpen);
        
        e.stopPropagation();
        e.preventDefault();
        
        try {
            console.log('[SIDEBAR] Chiamando toggleSidebar()...');
            toggleSidebar();
        } catch (error) {
            console.error('[SIDEBAR] ERRORE:', error);
        }
    };
    
    sidebarToggle.addEventListener('pointerup', pointerupHandler, { passive: false, capture: true });
    console.log('[SIDEBAR] Listener pointerup ATTACCATO (capture: true)');
    
    // Fallback click - ANCHE CON CAPTURE
    const clickHandler = function(e) {
        console.log('[SIDEBAR] ========== click EVENTO CATTURATO (fallback) ==========');
        e.stopPropagation();
        e.preventDefault();
        toggleSidebar();
    };
    
    sidebarToggle.addEventListener('click', clickHandler, { passive: false, capture: true });
    console.log('[SIDEBAR] Listener click ATTACCATO (capture: true)');
    
    // Fallback touchend per Safari iOS
    const touchendHandler = function(e) {
        console.log('[SIDEBAR] ========== touchend EVENTO CATTURATO (Safari) ==========');
        e.stopPropagation();
        e.preventDefault();
        toggleSidebar();
    };
    
    sidebarToggle.addEventListener('touchend', touchendHandler, { passive: false, capture: true });
    console.log('[SIDEBAR] Listener touchend ATTACCATO (capture: true)');
    
    // Marca come attaccato
    sidebarToggle.dataset.listenerAttached = 'true';
    console.log('[SIDEBAR] ✅ TUTTI I LISTENER ATTACCATI CON SUCCESSO!');
    
    // Test immediato: verifica che il pulsante sia cliccabile
    const testRect = sidebarToggle.getBoundingClientRect();
    console.log('[SIDEBAR] Test posizione pulsante:', {
        visible: testRect.width > 0 && testRect.height > 0,
        inViewport: testRect.top >= 0 && testRect.left >= 0 && testRect.bottom <= window.innerHeight && testRect.right <= window.innerWidth,
        pointerEvents: window.getComputedStyle(sidebarToggle).pointerEvents,
        zIndex: window.getComputedStyle(sidebarToggle).zIndex
    });
}

// ============================================
// CHAT
// ============================================

async function sendChatMessage(message, showUserMessage = true) {
    if (!message || !authToken) return;

    // Add user message to chat solo se richiesto
    if (showUserMessage) {
        addChatMessage('user', message);
    }

    // Show loading
    const loadingId = addChatMessage('ai', '', true);

    try {
        // Invia sempre il conversation_id corrente (se esiste)
        // Se non esiste, il backend ne creerà uno nuovo
        const requestBody = { 
            message,
            conversation_id: currentConversationId || null
        };
        
        console.log('[CHAT] Invio messaggio con conversation_id:', currentConversationId);
        
        const response = await fetch(`${API_BASE_URL}/api/chat/message`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify(requestBody),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || 'Errore durante l\'invio del messaggio');
        }

        // Aggiorna conversation_id se restituito (potrebbe essere nuovo o esistente)
        if (data.conversation_id) {
            const newConversationId = data.conversation_id;
            if (newConversationId !== currentConversationId) {
                console.log('[CHAT] Nuovo conversation_id ricevuto:', newConversationId, 'precedente:', currentConversationId);
                currentConversationId = newConversationId;
                localStorage.setItem('current_conversation_id', currentConversationId.toString());
                
                // Ricarica lista conversazioni per mostrare la nuova conversazione nella sidebar
                await loadConversations();
            }
        }

        // Remove loading and add AI response
        removeChatMessage(loadingId);
        // Debug: verifica is_html e contenuto
        const messageContent = data.message || data.response || 'Nessuna risposta';
        console.log('[CHAT] Response ricevuta:', { 
            is_html: data.is_html, 
            message_length: messageContent.length,
            message_preview: messageContent.substring(0, 200),
            starts_with_div: messageContent.trim().startsWith('<div'),
            contains_lt: messageContent.includes('&lt;'),
            contains_gt: messageContent.includes('&gt;'),
            buttons: data.buttons?.length || 0
        });
        addChatMessage('ai', messageContent, false, false, data.buttons, data.is_html === true);
    } catch (error) {
        removeChatMessage(loadingId);
        addChatMessage('ai', `Errore: ${error.message}`, false, true);
    }
}

async function handleChatSubmit(e) {
    e.preventDefault();
    const isMobile = window.innerWidth <= 768;
    
    // NUOVA ARCHITETTURA MOBILE: Gestisci sia form desktop che mobile
    const input = isMobile 
        ? document.getElementById('chat-input-mobile')
        : document.getElementById('chat-input');
    
    if (!input) {
        console.error('[CHAT] Input non trovato!');
        return;
    }
    
    const message = input.value.trim();

    if (!message || !authToken) return;

    input.value = '';
    input.style.height = 'auto';

    // Invia messaggio mostrando anche il messaggio utente
    await sendChatMessage(message, true);
}

function addChatMessage(role, content, isLoading = false, isError = false, buttons = null, isHtml = false) {
    // NUOVA ARCHITETTURA MOBILE: Usa .mScroller su mobile, altrimenti wrapper desktop
    const isMobile = window.innerWidth <= 768;
    let scrollWrapper;
    if (isMobile) {
        scrollWrapper = document.getElementById('chatScroll') || document.querySelector('.mScroller');
    } else {
        // Cerca prima il wrapper scrollabile (quello corretto)
        scrollWrapper = document.getElementById('chat-messages-scroll-wrapper');
        
        // Se non trovato, cerca dentro il container
        if (!scrollWrapper) {
            const container = document.getElementById('chat-messages');
            if (container) {
                scrollWrapper = container.querySelector('.chat-messages-scroll-wrapper');
            }
        }
        
        // Se ancora non trovato, usa il container come fallback
        if (!scrollWrapper) {
            scrollWrapper = document.getElementById('chat-messages');
        }
    }
    if (!scrollWrapper) {
        console.error('[CHAT] Scroller non trovato!');
        return null;
    }
    const messageId = `msg-${Date.now()}-${Math.random()}`;
    const messageEl = document.createElement('div');
    messageEl.id = messageId;
    messageEl.className = `chat-message ${role}`;

    if (isLoading) {
        messageEl.innerHTML = `
            <div class="chat-message-avatar">
                <img src="/static/assets/logo.png" alt="Gio.ia" class="chat-avatar-logo" onerror="this.style.display='none'; this.parentElement.textContent='G'">
            </div>
            <div class="chat-message-content">
                <div class="chat-message-loading">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;
    } else {
        // Avatar: logo Gio.ia per AI, iniziale email per utente
        let avatarHtml;
        if (role === 'user') {
            const userInitial = currentUser?.email?.[0]?.toUpperCase() || 'U';
            avatarHtml = `<div class="chat-message-avatar">${userInitial}</div>`;
        } else {
            // Logo Gio.ia per risposte AI
            avatarHtml = `<div class="chat-message-avatar"><img src="/static/assets/logo.png" alt="Gio.ia" class="chat-avatar-logo" onerror="this.style.display='none'; this.parentElement.textContent='G'"></div>`;
        }
        
        // Renderizza pulsanti se presenti
        let buttonsHtml = '';
        if (buttons && Array.isArray(buttons) && buttons.length > 0) {
            buttonsHtml = '<div class="chat-buttons">';
            buttons.forEach(button => {
                // Controlla se è un pulsante di conferma movimento
                const isMovementConfirmation = button.data && button.data.movement_type && button.data.wine_id && button.data.quantity;
                
                if (isMovementConfirmation) {
                    // Pulsante di conferma movimento
                    buttonsHtml += `<button class="chat-button" 
                        data-wine-id="${button.data.wine_id}" 
                        data-wine-text="${escapeHtml(button.text)}"
                        data-movement-type="${button.data.movement_type}"
                        data-quantity="${button.data.quantity}">${escapeHtml(button.text)}</button>`;
                } else {
                    // Pulsante normale (ricerca vino)
                    buttonsHtml += `<button class="chat-button" data-wine-id="${button.id}" data-wine-text="${escapeHtml(button.text)}">${escapeHtml(button.text)}</button>`;
                }
            });
            buttonsHtml += '</div>';
        }
        
        // Se isHtml è true, renderizza HTML direttamente (per card)
        // Altrimenti escape HTML per sicurezza
        const contentClass = isHtml ? 'chat-message-content has-card' : 'chat-message-content';
        
        // Crea struttura base
        messageEl.innerHTML = avatarHtml;
        
        // Crea contenitore contenuto
        const contentDiv = document.createElement('div');
        contentDiv.className = contentClass;
        if (isError) {
            contentDiv.style.color = 'var(--color-granaccia)';
        }
        
        if (isHtml) {
            // SOLUZIONE DEFINITIVA: Crea elemento temporaneo FUORI dal DOM, inserisci HTML, poi sposta nodi
            // Questo garantisce che l'HTML venga parsato correttamente prima di essere inserito nel DOM
            const tempContainer = document.createElement('div');
            tempContainer.style.display = 'none'; // Nascondi temporaneamente
            document.body.appendChild(tempContainer); // Aggiungi al DOM (ma nascosto) per permettere parsing
            
            try {
                // Inserisci HTML nel container temporaneo - questo forza il browser a parsare l'HTML
                tempContainer.innerHTML = content;
                
                // Sposta tutti i nodi parsati nel contenitore reale
                while (tempContainer.firstChild) {
                    contentDiv.appendChild(tempContainer.firstChild);
                }
                
                console.log('[CHAT] HTML parsato e inserito, nodi:', contentDiv.children.length);
                // SOLUZIONE 2: Non serve aggiungere listener qui, gli elementi sono nel wrapper scroll
                // e i bookmarks hanno già i loro listener in setupWineCardBookmarks()
                
            } catch (error) {
                console.error('[CHAT] Errore parsing HTML:', error);
                // Fallback: inserisci direttamente
                contentDiv.innerHTML = content;
            } finally {
                // Rimuovi container temporaneo
                document.body.removeChild(tempContainer);
            }
        } else {
            // Testo normale: escape per sicurezza
            // MA: se il contenuto inizia con <div o contiene class="wine-card", potrebbe essere HTML non riconosciuto
            // Fallback: controlla se sembra HTML anche se isHtml è false
            const trimmedContent = content.trim();
            const looksLikeHtml = trimmedContent.startsWith('<div') || 
                                 trimmedContent.startsWith('&lt;div') ||
                                 trimmedContent.includes('class="wine-card"') ||
                                 trimmedContent.includes('class="wines-list-card"') ||
                                 trimmedContent.includes('class="movement-card"');
            
            if (looksLikeHtml) {
                // Sembra HTML ma isHtml era false - prova a renderizzarlo comunque
                console.warn('[CHAT] Contenuto sembra HTML ma isHtml=false, provo rendering comunque');
                const tempContainer = document.createElement('div');
                tempContainer.style.display = 'none';
                document.body.appendChild(tempContainer);
                
                try {
                    // Decodifica se escapato
                    let htmlContent = content;
                    if (trimmedContent.startsWith('&lt;')) {
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = content;
                        htmlContent = tempDiv.innerHTML;
                    }
                    
                    tempContainer.innerHTML = htmlContent;
                    while (tempContainer.firstChild) {
                        contentDiv.appendChild(tempContainer.firstChild);
                    }
                    contentDiv.classList.add('has-card');
                } catch (error) {
                    console.error('[CHAT] Errore rendering HTML fallback:', error);
                    contentDiv.textContent = content;
                } finally {
                    document.body.removeChild(tempContainer);
                }
            } else {
                contentDiv.textContent = content;
            }
        }
        
        // Aggiungi pulsanti separati solo se NON ci sono già pulsanti integrati nelle wine cards
        // Verifica se il contenuto contiene già wines-list-card con pulsanti integrati
        const hasIntegratedButtons = contentDiv.querySelector('.wines-list-card .wines-list-item-button');
        
        if (buttonsHtml && !hasIntegratedButtons) {
            const buttonsDiv = document.createElement('div');
            buttonsDiv.innerHTML = buttonsHtml;
            contentDiv.appendChild(buttonsDiv);
        }
        
        messageEl.appendChild(contentDiv);
        
        // Aggiungi event listeners ai pulsanti - usa pointer events per mobile
        // Include sia .chat-button che .wines-list-item-button
        // I pulsanti possono essere integrati nelle wine cards (già nel DOM) o separati (da buttons array)
        // IMPORTANTE: I listener devono essere aggiunti sempre, anche se i pulsanti sono già nell'HTML
        const buttonElements = messageEl.querySelectorAll('.chat-button, .wines-list-item-button');
        
        if (buttonElements.length > 0) {
            console.log(`[CHAT] Trovati ${buttonElements.length} pulsanti da collegare`);
            buttonElements.forEach((btn, index) => {
                // Rimuovi listener esistenti per evitare duplicati (se presenti)
                const newBtn = btn.cloneNode(true);
                btn.parentNode.replaceChild(newBtn, btn);
                
                // Leggi data attributes dal pulsante
                const wineId = newBtn.dataset.wineId || newBtn.getAttribute('data-wine-id');
                const wineText = newBtn.dataset.wineText || newBtn.getAttribute('data-wine-text');
                const movementType = newBtn.dataset.movementType || newBtn.getAttribute('data-movement-type');
                const quantity = newBtn.dataset.quantity || newBtn.getAttribute('data-quantity');
                
                console.log(`[CHAT] 🔗 Collegamento listener pulsante ${index + 1}:`, {
                    wineId: wineId,
                    wineText: wineText,
                    movementType: movementType,
                    quantity: quantity,
                    hasMovementData: !!(movementType && quantity && wineId),
                    allAttributes: Array.from(newBtn.attributes).map(attr => `${attr.name}="${attr.value}"`).join(', ')
                });
                
                // Aggiungi listener con addUniversalEventListener per supporto mobile
                addUniversalEventListener(newBtn, async (e) => {
                    e.stopPropagation();
                    
                    // Leggi data attributes al momento del click (in caso siano stati modificati)
                    const clickWineId = newBtn.dataset.wineId || newBtn.getAttribute('data-wine-id');
                    const clickWineText = newBtn.dataset.wineText || newBtn.getAttribute('data-wine-text');
                    const clickMovementType = newBtn.dataset.movementType || newBtn.getAttribute('data-movement-type');
                    const clickQuantity = newBtn.dataset.quantity || newBtn.getAttribute('data-quantity');
                    
                    console.log('[CHAT] 🔘 Click pulsante wine card:', { 
                        wineId: clickWineId, 
                        wineText: clickWineText, 
                        movementType: clickMovementType, 
                        quantity: clickQuantity,
                        isMovement: !!(clickMovementType && clickQuantity && clickWineId)
                    });
                    
                    // Se è un pulsante di conferma movimento, processa direttamente senza mostrare messaggio
                    if (clickMovementType && clickQuantity && clickWineId) {
                        console.log('[CHAT] ✅ Processando movimento:', { 
                            movementType: clickMovementType, 
                            quantity: clickQuantity, 
                            wineId: clickWineId 
                        });
                        // Invia direttamente all'API senza mostrare il messaggio nella chat
                        const message = `[movement:${clickMovementType}] [wine_id:${clickWineId}] [quantity:${clickQuantity}]`;
                        console.log('[CHAT] 📤 Invio messaggio movimento:', message);
                        await sendChatMessage(message, false); // false = non mostrare messaggio utente
                        return;
                    }
                    
                    // Pulsante normale: ricerca vino con ID
                    // Gestisci sia desktop che mobile
                    const isMobile = window.innerWidth <= 768;
                    const inputId = isMobile ? 'chat-input-mobile' : 'chat-input';
                    const formId = isMobile ? 'chat-form-mobile' : 'chat-form';
                    
                    const input = document.getElementById(inputId);
                    const form = document.getElementById(formId);
                    
                    if (input && form) {
                        console.log('[CHAT] 📝 Inserimento query vino in input');
                        if (clickWineId) {
                            input.value = `dimmi tutto su ${clickWineText} [wine_id:${clickWineId}]`;
                        } else {
                            // Fallback: solo testo
                            input.value = `dimmi tutto su ${clickWineText}`;
                        }
                        input.dispatchEvent(new Event('input')); // Trigger resize
                        form.dispatchEvent(new Event('submit'));
                    } else {
                        console.error('[CHAT] ❌ Input o form non trovati:', { inputId, formId });
                    }
                });
            });
        } else {
            console.log('[CHAT] Nessun pulsante trovato da collegare');
        }
    }

    // SOLUZIONE 2: Inserisci nel wrapper scroll invece che direttamente nel container
    scrollWrapper.appendChild(messageEl);
    scrollWrapper.scrollTop = scrollWrapper.scrollHeight;

    // Se è una card vino, aggiungi i segnalibri
    // Controlla anche se il contenuto sembra HTML anche se isHtml era false
    const hasWineCard = messageEl.querySelector('.wine-card[data-wine-id]');
    if ((isHtml || hasWineCard) && role === 'ai') {
        setTimeout(() => {
            setupWineCardBookmarks(messageEl);
        }, 100);
    }

    return messageId;
}

function removeChatMessage(messageId) {
    const messageEl = document.getElementById(messageId);
    if (messageEl) {
        messageEl.remove();
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// WINE CARD BOOKMARKS
// ============================================

function setupWineCardBookmarks(messageEl) {
    // Cerca la card vino dentro il messaggio
    const wineCard = messageEl.querySelector('.wine-card[data-wine-id]');
    if (!wineCard) return;
    
    const wineId = wineCard.dataset.wineId;
    if (!wineId) return;
    
    // Controlla se il wrapper esiste già (significa che i bookmarks sono già stati aggiunti)
    if (wineCard.parentElement && wineCard.parentElement.classList.contains('wine-card-wrapper')) {
        return; // Già configurato
    }
    
    // SOLUZIONE: Crea un wrapper esterno che contiene sia la card che i segnalibri
    // Questo permette ai segnalibri di essere nel layer sotto la card
    const wrapper = document.createElement('div');
    wrapper.className = 'wine-card-wrapper';
    
    // Sposta la card nel wrapper
    const parent = wineCard.parentElement;
    parent.insertBefore(wrapper, wineCard);
    wrapper.appendChild(wineCard);
    
    // Crea container bookmarks (ora fuori dalla card, dentro il wrapper)
    const bookmarksContainer = document.createElement('div');
    bookmarksContainer.className = 'wine-card-bookmarks';
    
    // Bookmark "Modifica"
    const editBookmark = document.createElement('button');
    editBookmark.className = 'wine-card-bookmark';
    editBookmark.textContent = 'Modifica';
    editBookmark.title = 'Modifica';
    editBookmark.dataset.action = 'edit';
    editBookmark.dataset.wineId = wineId;
    
    // Bookmark "Mostra in inventario"
    const inventoryBookmark = document.createElement('button');
    inventoryBookmark.className = 'wine-card-bookmark';
    inventoryBookmark.textContent = 'Mostra nell\'inventario';
    inventoryBookmark.title = 'Mostra nell\'inventario';
    inventoryBookmark.dataset.action = 'inventory';
    inventoryBookmark.dataset.wineId = wineId;
    
    // SOLUZIONE 2: Listener sui bookmarks (funzionano normalmente perché non sono nel contesto scroll)
    editBookmark.addEventListener('pointerup', (e) => {
        e.stopPropagation();
        e.preventDefault();
        handleWineCardEdit(wineCard, wineId);
    });
    
    inventoryBookmark.addEventListener('pointerup', (e) => {
        e.stopPropagation();
        e.preventDefault();
        handleWineCardShowInInventory(wineCard, wineId);
    });
    
    bookmarksContainer.appendChild(editBookmark);
    bookmarksContainer.appendChild(inventoryBookmark);
    
    // Aggiungi i segnalibri al wrapper (non alla card)
    wrapper.appendChild(bookmarksContainer);
}

async function handleWineCardEdit(wineCard, wineId) {
    // Trova il wrapper (se esiste)
    const wrapper = wineCard.parentElement?.classList.contains('wine-card-wrapper') 
        ? wineCard.parentElement 
        : null;
    
    // Se già espansa, chiudi
    if (wineCard.classList.contains('expanded')) {
        wineCard.classList.remove('expanded');
        if (wrapper) wrapper.classList.remove('expanded');
        const editForm = wineCard.querySelector('.wine-card-edit-form');
        if (editForm) editForm.remove();
        return;
    }
    
    // Espandi la card e il wrapper
    wineCard.classList.add('expanded');
    if (wrapper) wrapper.classList.add('expanded');
    
    // Carica dati vino dal backend
    try {
        const response = await fetch(`${API_BASE_URL}/api/wines/${wineId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
            },
        });
        
        if (!response.ok) {
            throw new Error('Errore caricamento dati vino');
        }
        
        const wine = await response.json();
        
        // Salva valori originali per confronto dopo salvataggio
        const originalValues = {
            producer: wine.producer || null,
            quantity: wine.quantity !== null && wine.quantity !== undefined ? wine.quantity : null,
            selling_price: wine.selling_price !== null && wine.selling_price !== undefined ? wine.selling_price : null,
            cost_price: wine.cost_price !== null && wine.cost_price !== undefined ? wine.cost_price : null,
            vintage: wine.vintage || null,
            region: wine.region || null,
            country: wine.country || null,
            wine_type: wine.wine_type || null,
            supplier: wine.supplier || null,
            grape_variety: wine.grape_variety || null,
            classification: wine.classification || null,
            alcohol_content: wine.alcohol_content || null,
            description: wine.description || null,
            notes: wine.notes || null
        };
        
        // Crea form di modifica
        const editForm = document.createElement('div');
        editForm.className = 'wine-card-edit-form';
        editForm.dataset.originalValues = JSON.stringify(originalValues);
        
        // Estrai valori esistenti dalla card
        const cardBody = wineCard.querySelector('.wine-card-body');
        const fields = {};
        cardBody.querySelectorAll('.wine-card-field').forEach(field => {
            const label = field.querySelector('.wine-card-field-label')?.textContent.trim();
            const value = field.querySelector('.wine-card-field-value')?.textContent.trim();
            
            if (label === 'Quantità') {
                fields.quantity = parseInt(value) || null;
            } else if (label === 'Prezzo Vendita') {
                fields.selling_price = parseFloat(value.replace('€', '').trim()) || null;
            } else if (label === 'Prezzo Acquisto') {
                fields.cost_price = parseFloat(value.replace('€', '').trim()) || null;
            } else if (label === 'Annata') {
                fields.vintage = value || null;
            } else if (label === 'Regione') {
                fields.region = value || null;
            } else if (label === 'Paese') {
                fields.country = value || null;
            } else if (label === 'Tipo') {
                fields.wine_type = value || null;
            }
        });
        
        // Usa dati dal backend se disponibili, altrimenti usa quelli dalla card
        const wineData = {
            name: wine.name || wineCard.querySelector('.wine-card-title')?.textContent.trim() || '',
            producer: wine.producer || wineCard.querySelector('.wine-card-producer')?.textContent.trim() || '',
            quantity: wine.quantity !== undefined ? wine.quantity : fields.quantity,
            selling_price: wine.selling_price !== undefined ? wine.selling_price : fields.selling_price,
            cost_price: wine.cost_price !== undefined ? wine.cost_price : fields.cost_price,
            vintage: wine.vintage || fields.vintage || '',
            region: wine.region || fields.region || '',
            country: wine.country || fields.country || '',
            wine_type: wine.wine_type || fields.wine_type || '',
            supplier: wine.supplier || '',
            grape_variety: wine.grape_variety || '',
            classification: wine.classification || '',
            alcohol_content: wine.alcohol_content || '',
            description: wine.description || '',
            notes: wine.notes || '',
        };
        
        editForm.innerHTML = `
            <div class="wine-card-edit-form-grid">
                <div class="wine-card-edit-field">
                    <label class="wine-card-edit-label">Nome</label>
                    <input type="text" class="wine-card-edit-input" name="name" value="${escapeHtml(String(wineData.name))}" readonly disabled title="Nome non modificabile">
                </div>
                <div class="wine-card-edit-field">
                    <label class="wine-card-edit-label">Produttore</label>
                    <input type="text" class="wine-card-edit-input" name="producer" value="${escapeHtml(String(wineData.producer))}">
                </div>
                <div class="wine-card-edit-field">
                    <label class="wine-card-edit-label">Quantità</label>
                    <input type="number" class="wine-card-edit-input" name="quantity" value="${wineData.quantity !== null && wineData.quantity !== undefined ? wineData.quantity : ''}" min="0">
                </div>
                <div class="wine-card-edit-field">
                    <label class="wine-card-edit-label">Prezzo Vendita (€)</label>
                    <input type="number" class="wine-card-edit-input" name="selling_price" value="${wineData.selling_price !== null && wineData.selling_price !== undefined ? wineData.selling_price : ''}" step="0.01" min="0">
                </div>
                <div class="wine-card-edit-field">
                    <label class="wine-card-edit-label">Prezzo Acquisto (€)</label>
                    <input type="number" class="wine-card-edit-input" name="cost_price" value="${wineData.cost_price !== null && wineData.cost_price !== undefined ? wineData.cost_price : ''}" step="0.01" min="0">
                </div>
                <div class="wine-card-edit-field">
                    <label class="wine-card-edit-label">Annata</label>
                    <input type="text" class="wine-card-edit-input" name="vintage" value="${escapeHtml(String(wineData.vintage))}">
                </div>
                <div class="wine-card-edit-field">
                    <label class="wine-card-edit-label">Regione</label>
                    <input type="text" class="wine-card-edit-input" name="region" value="${escapeHtml(String(wineData.region))}">
                </div>
                <div class="wine-card-edit-field">
                    <label class="wine-card-edit-label">Paese</label>
                    <input type="text" class="wine-card-edit-input" name="country" value="${escapeHtml(String(wineData.country))}">
                </div>
                <div class="wine-card-edit-field">
                    <label class="wine-card-edit-label">Tipo</label>
                    <input type="text" class="wine-card-edit-input" name="wine_type" value="${escapeHtml(String(wineData.wine_type))}">
                </div>
                <div class="wine-card-edit-field">
                    <label class="wine-card-edit-label">Fornitore</label>
                    <input type="text" class="wine-card-edit-input" name="supplier" value="${escapeHtml(String(wineData.supplier))}">
                </div>
                <div class="wine-card-edit-field">
                    <label class="wine-card-edit-label">Vitigno</label>
                    <input type="text" class="wine-card-edit-input" name="grape_variety" value="${escapeHtml(String(wineData.grape_variety))}">
                </div>
                <div class="wine-card-edit-field">
                    <label class="wine-card-edit-label">Classificazione</label>
                    <input type="text" class="wine-card-edit-input" name="classification" value="${escapeHtml(String(wineData.classification))}">
                </div>
                <div class="wine-card-edit-field">
                    <label class="wine-card-edit-label">Gradazione (% vol)</label>
                    <input type="text" class="wine-card-edit-input" name="alcohol_content" value="${escapeHtml(String(wineData.alcohol_content))}">
                </div>
                <div class="wine-card-edit-field full-width">
                    <label class="wine-card-edit-label">Descrizione</label>
                    <textarea class="wine-card-edit-textarea" name="description">${escapeHtml(String(wineData.description))}</textarea>
                </div>
                <div class="wine-card-edit-field full-width">
                    <label class="wine-card-edit-label">Note</label>
                    <textarea class="wine-card-edit-textarea" name="notes">${escapeHtml(String(wineData.notes))}</textarea>
                </div>
            </div>
            <div class="wine-card-edit-actions">
                <button class="wine-card-edit-btn cancel" type="button">Annulla</button>
                <button class="wine-card-edit-btn save" type="button">Salva</button>
            </div>
        `;
        
        wineCard.appendChild(editForm);
        
        // Event listeners per i pulsanti
        const cancelBtn = editForm.querySelector('.wine-card-edit-btn.cancel');
        const saveBtn = editForm.querySelector('.wine-card-edit-btn.save');
        
        addUniversalEventListener(cancelBtn, () => {
            wineCard.classList.remove('expanded');
            editForm.remove();
        });
        
        addUniversalEventListener(saveBtn, () => {
            saveWineCardEdit(wineId, editForm, wineCard);
        });
        
    } catch (error) {
        console.error('Errore caricamento dati vino:', error);
        addChatMessage('ai', `Errore: ${error.message}`, false, true);
    }
}

async function saveWineCardEdit(wineId, editForm, wineCard) {
    // Recupera valori originali
    const originalValues = JSON.parse(editForm.dataset.originalValues || '{}');
    
    const data = {};
    const newValues = {};
    
    // Raccogli tutti i valori dal form (escludi 'name' che non è modificabile)
    editForm.querySelectorAll('input, textarea').forEach(input => {
        const name = input.name;
        
        // Salta campo 'name' - non modificabile
        if (name === 'name') {
            return;
        }
        
        const value = input.value.trim();
        let parsedValue = null;
        
        if (name === 'quantity') {
            parsedValue = value === '' ? null : parseInt(value);
            data[name] = parsedValue;
            newValues[name] = parsedValue;
        } else if (name === 'selling_price' || name === 'cost_price') {
            parsedValue = value === '' ? null : parseFloat(value);
            data[name] = parsedValue;
            newValues[name] = parsedValue;
        } else {
            parsedValue = value === '' ? null : value;
            data[name] = parsedValue;
            newValues[name] = parsedValue;
        }
    });
    
    // Confronta valori e crea lista modifiche
    const changes = [];
    const fieldLabels = {
        producer: 'Produttore',
        quantity: 'Quantità',
        selling_price: 'Prezzo Vendita',
        cost_price: 'Prezzo Acquisto',
        vintage: 'Annata',
        region: 'Regione',
        country: 'Paese',
        wine_type: 'Tipo',
        supplier: 'Fornitore',
        grape_variety: 'Vitigno',
        classification: 'Classificazione',
        alcohol_content: 'Gradazione',
        description: 'Descrizione',
        notes: 'Note'
    };
    
    Object.keys(newValues).forEach(key => {
        const oldVal = originalValues[key];
        const newVal = newValues[key];
        
        // Normalizza per confronto (tratta null, undefined, '' come equivalenti)
        const normalize = (val) => {
            if (val === null || val === undefined || val === '') return null;
            if (typeof val === 'number') return val;
            return String(val).trim();
        };
        
        const oldNormalized = normalize(oldVal);
        const newNormalized = normalize(newVal);
        
        if (oldNormalized !== newNormalized) {
            // Formatta valori per visualizzazione
            const formatValue = (val, fieldName) => {
                if (val === null || val === undefined || val === '') return '-';
                if (fieldName === 'selling_price' || fieldName === 'cost_price') {
                    // Converti a numero e formatta con virgola come separatore decimale
                    const numVal = typeof val === 'string' ? parseFloat(val.replace(',', '.')) : parseFloat(val);
                    if (isNaN(numVal)) return String(val);
                    return numVal.toFixed(2).replace('.', ',');
                }
                if (fieldName === 'quantity') {
                    return String(val);
                }
                return String(val);
            };
            
            changes.push({
                field: key,
                label: fieldLabels[key] || key,
                oldValue: formatValue(oldVal, key),
                newValue: formatValue(newVal, key)
            });
        }
    });
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/wines/${wineId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify(data),
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Errore salvataggio' }));
            throw new Error(errorData.detail || 'Errore salvataggio');
        }
        
        const result = await response.json();
        
        // Chiudi form e ricarica card
        wineCard.classList.remove('expanded');
        const wrapper = wineCard.parentElement?.classList.contains('wine-card-wrapper') 
            ? wineCard.parentElement 
            : null;
        if (wrapper) wrapper.classList.remove('expanded');
        editForm.remove();
        
        // Mostra messaggio successo con template HTML delle modifiche
        if (changes.length > 0) {
            let changesHtml = '<div class="wine-edit-success-message"><h3>✅ Vino aggiornato con successo!</h3><div class="wine-edit-changes-list">';
            changes.forEach(change => {
                changesHtml += `
                    <div class="wine-edit-change-item">
                        <span class="wine-edit-change-label">${escapeHtml(change.label)}:</span>
                        <span class="wine-edit-change-old">${escapeHtml(change.oldValue)}</span>
                        <span class="wine-edit-change-arrow">→</span>
                        <span class="wine-edit-change-new">${escapeHtml(change.newValue)}</span>
                    </div>
                `;
            });
            changesHtml += '</div></div>';
            addChatMessage('ai', changesHtml, false, false, null, true);
        } else {
            addChatMessage('ai', 'Vino aggiornato con successo! (nessuna modifica rilevata)', false, false);
        }
        
    } catch (error) {
        console.error('Errore salvataggio vino:', error);
        addChatMessage('ai', `Errore: ${error.message}`, false, true);
    }
}

async function handleViewerWineEdit(wineId) {
    if (!wineId || !authToken) {
        console.error('[VIEWER] wineId o authToken mancante');
        return;
    }
    
    // Carica dati vino
    try {
        const response = await fetch(`${API_BASE_URL}/api/wines/${wineId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
            },
        });
        
        if (!response.ok) {
            throw new Error('Errore caricamento dati vino');
        }
        
        const wine = await response.json();
        
        // Salva valori originali per confronto dopo salvataggio
        const originalValues = {
            producer: wine.producer || null,
            quantity: wine.quantity !== null && wine.quantity !== undefined ? wine.quantity : null,
            selling_price: wine.selling_price !== null && wine.selling_price !== undefined ? wine.selling_price : null,
            cost_price: wine.cost_price !== null && wine.cost_price !== undefined ? wine.cost_price : null,
            vintage: wine.vintage || null,
            region: wine.region || null,
            country: wine.country || null,
            wine_type: wine.wine_type || null,
            supplier: wine.supplier || null,
            grape_variety: wine.grape_variety || null,
            classification: wine.classification || null,
            alcohol_content: wine.alcohol_content || null,
            description: wine.description || null,
            notes: wine.notes || null
        };
        
        // Crea modal per modifica
        const modal = document.createElement('div');
        modal.className = 'viewer-edit-modal';
        modal.id = 'viewer-edit-modal';
        modal.dataset.originalValues = JSON.stringify(originalValues);
        modal.innerHTML = `
            <div class="viewer-edit-modal-overlay" onclick="closeViewerEditModal()"></div>
            <div class="viewer-edit-modal-content">
                <div class="viewer-edit-modal-header">
                    <h2>Modifica Vino: ${escapeHtml(wine.name || '')}</h2>
                    <button class="viewer-edit-modal-close" onclick="closeViewerEditModal()" type="button">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                    </button>
                </div>
                <div class="viewer-edit-modal-body">
                    <form class="viewer-edit-form" id="viewer-edit-form">
                        <div class="wine-card-edit-form-grid">
                            <div class="wine-card-edit-field">
                                <label class="wine-card-edit-label">Nome</label>
                                <input type="text" class="wine-card-edit-input" name="name" value="${escapeHtml(String(wine.name || ''))}" readonly disabled title="Nome non modificabile">
                            </div>
                            <div class="wine-card-edit-field">
                                <label class="wine-card-edit-label">Produttore</label>
                                <input type="text" class="wine-card-edit-input" name="producer" value="${escapeHtml(String(wine.producer || ''))}">
                            </div>
                            <div class="wine-card-edit-field">
                                <label class="wine-card-edit-label">Quantità</label>
                                <input type="number" class="wine-card-edit-input" name="quantity" value="${wine.quantity !== null && wine.quantity !== undefined ? wine.quantity : ''}" min="0">
                            </div>
                            <div class="wine-card-edit-field">
                                <label class="wine-card-edit-label">Prezzo Vendita (€)</label>
                                <input type="number" class="wine-card-edit-input" name="selling_price" value="${wine.selling_price !== null && wine.selling_price !== undefined ? wine.selling_price : ''}" step="0.01" min="0">
                            </div>
                            <div class="wine-card-edit-field">
                                <label class="wine-card-edit-label">Prezzo Acquisto (€)</label>
                                <input type="number" class="wine-card-edit-input" name="cost_price" value="${wine.cost_price !== null && wine.cost_price !== undefined ? wine.cost_price : ''}" step="0.01" min="0">
                            </div>
                            <div class="wine-card-edit-field">
                                <label class="wine-card-edit-label">Annata</label>
                                <input type="text" class="wine-card-edit-input" name="vintage" value="${escapeHtml(String(wine.vintage || ''))}">
                            </div>
                            <div class="wine-card-edit-field">
                                <label class="wine-card-edit-label">Regione</label>
                                <input type="text" class="wine-card-edit-input" name="region" value="${escapeHtml(String(wine.region || ''))}">
                            </div>
                            <div class="wine-card-edit-field">
                                <label class="wine-card-edit-label">Paese</label>
                                <input type="text" class="wine-card-edit-input" name="country" value="${escapeHtml(String(wine.country || ''))}">
                            </div>
                            <div class="wine-card-edit-field">
                                <label class="wine-card-edit-label">Tipo</label>
                                <input type="text" class="wine-card-edit-input" name="wine_type" value="${escapeHtml(String(wine.wine_type || ''))}">
                            </div>
                            <div class="wine-card-edit-field">
                                <label class="wine-card-edit-label">Fornitore</label>
                                <input type="text" class="wine-card-edit-input" name="supplier" value="${escapeHtml(String(wine.supplier || ''))}">
                            </div>
                            <div class="wine-card-edit-field">
                                <label class="wine-card-edit-label">Vitigno</label>
                                <input type="text" class="wine-card-edit-input" name="grape_variety" value="${escapeHtml(String(wine.grape_variety || ''))}">
                            </div>
                            <div class="wine-card-edit-field">
                                <label class="wine-card-edit-label">Classificazione</label>
                                <input type="text" class="wine-card-edit-input" name="classification" value="${escapeHtml(String(wine.classification || ''))}">
                            </div>
                            <div class="wine-card-edit-field">
                                <label class="wine-card-edit-label">Gradazione (% vol)</label>
                                <input type="text" class="wine-card-edit-input" name="alcohol_content" value="${escapeHtml(String(wine.alcohol_content || ''))}">
                            </div>
                            <div class="wine-card-edit-field full-width">
                                <label class="wine-card-edit-label">Descrizione</label>
                                <textarea class="wine-card-edit-textarea" name="description">${escapeHtml(String(wine.description || ''))}</textarea>
                            </div>
                            <div class="wine-card-edit-field full-width">
                                <label class="wine-card-edit-label">Note</label>
                                <textarea class="wine-card-edit-textarea" name="notes">${escapeHtml(String(wine.notes || ''))}</textarea>
                            </div>
                        </div>
                        <div class="wine-card-edit-actions">
                            <button class="wine-card-edit-btn cancel" type="button" onclick="closeViewerEditModal()">Annulla</button>
                            <button class="wine-card-edit-btn save" type="button" onclick="saveViewerWineEdit(${wineId}, event)">Salva</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Chiudi modal con ESC
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                closeViewerEditModal();
            }
        };
        document.addEventListener('keydown', handleEsc);
        modal._escHandler = handleEsc;
        
    } catch (error) {
        console.error('Errore caricamento dati vino:', error);
        addChatMessage('ai', `Errore: ${error.message}`, false, true);
    }
}

function closeViewerEditModal() {
    const modal = document.getElementById('viewer-edit-modal');
    if (modal) {
        if (modal._escHandler) {
            document.removeEventListener('keydown', modal._escHandler);
        }
        modal.remove();
    }
}

async function saveViewerWineEdit(wineId, event) {
    event.preventDefault();
    event.stopPropagation();
    
    const modal = document.getElementById('viewer-edit-modal');
    const form = document.getElementById('viewer-edit-form');
    if (!form || !modal) {
        console.error('[VIEWER] Form o modal non trovato');
        return;
    }
    
    // Recupera valori originali
    const originalValues = JSON.parse(modal.dataset.originalValues || '{}');
    
    const data = {};
    const newValues = {};
    
    // Raccogli tutti i valori dal form (escludi 'name')
    form.querySelectorAll('input, textarea').forEach(input => {
        const name = input.name;
        
        // Salta campo 'name' - non modificabile
        if (name === 'name') {
            return;
        }
        
        const value = input.value.trim();
        let parsedValue = null;
        
        if (name === 'quantity') {
            parsedValue = value === '' ? null : parseInt(value);
            data[name] = parsedValue;
            newValues[name] = parsedValue;
        } else if (name === 'selling_price' || name === 'cost_price') {
            parsedValue = value === '' ? null : parseFloat(value);
            data[name] = parsedValue;
            newValues[name] = parsedValue;
        } else {
            parsedValue = value === '' ? null : value;
            data[name] = parsedValue;
            newValues[name] = parsedValue;
        }
    });
    
    // Confronta valori e crea lista modifiche
    const changes = [];
    const fieldLabels = {
        producer: 'Produttore',
        quantity: 'Quantità',
        selling_price: 'Prezzo Vendita',
        cost_price: 'Prezzo Acquisto',
        vintage: 'Annata',
        region: 'Regione',
        country: 'Paese',
        wine_type: 'Tipo',
        supplier: 'Fornitore',
        grape_variety: 'Vitigno',
        classification: 'Classificazione',
        alcohol_content: 'Gradazione',
        description: 'Descrizione',
        notes: 'Note'
    };
    
    Object.keys(newValues).forEach(key => {
        const oldVal = originalValues[key];
        const newVal = newValues[key];
        
        // Normalizza per confronto (tratta null, undefined, '' come equivalenti)
        const normalize = (val) => {
            if (val === null || val === undefined || val === '') return null;
            if (typeof val === 'number') return val;
            return String(val).trim();
        };
        
        const oldNormalized = normalize(oldVal);
        const newNormalized = normalize(newVal);
        
        if (oldNormalized !== newNormalized) {
            // Formatta valori per visualizzazione
            const formatValue = (val, fieldName) => {
                if (val === null || val === undefined || val === '') return '-';
                if (fieldName === 'selling_price' || fieldName === 'cost_price') {
                    // Converti a numero e formatta con virgola come separatore decimale
                    const numVal = typeof val === 'string' ? parseFloat(val.replace(',', '.')) : parseFloat(val);
                    if (isNaN(numVal)) return String(val);
                    return numVal.toFixed(2).replace('.', ',');
                }
                if (fieldName === 'quantity') {
                    return String(val);
                }
                return String(val);
            };
            
            changes.push({
                field: key,
                label: fieldLabels[key] || key,
                oldValue: formatValue(oldVal, key),
                newValue: formatValue(newVal, key)
            });
        }
    });
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/wines/${wineId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify(data),
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Errore salvataggio' }));
            throw new Error(errorData.detail || 'Errore salvataggio');
        }
        
        const result = await response.json();
        
        // Chiudi modal
        closeViewerEditModal();
        
        // Ricarica snapshot viewer
        await loadViewerData();
        
        // Mostra messaggio successo con template HTML delle modifiche
        if (changes.length > 0) {
            let changesHtml = '<div class="wine-edit-success-message"><h3>✅ Vino aggiornato con successo!</h3><div class="wine-edit-changes-list">';
            changes.forEach(change => {
                changesHtml += `
                    <div class="wine-edit-change-item">
                        <span class="wine-edit-change-label">${escapeHtml(change.label)}:</span>
                        <span class="wine-edit-change-old">${escapeHtml(change.oldValue)}</span>
                        <span class="wine-edit-change-arrow">→</span>
                        <span class="wine-edit-change-new">${escapeHtml(change.newValue)}</span>
                    </div>
                `;
            });
            changesHtml += '</div></div>';
            addChatMessage('ai', changesHtml, false, false, null, true);
        } else {
            addChatMessage('ai', 'Vino aggiornato con successo! (nessuna modifica rilevata)', false, false);
        }
        
    } catch (error) {
        console.error('Errore salvataggio vino:', error);
        addChatMessage('ai', `Errore: ${error.message}`, false, true);
    }
}

// ============================================
// ADD WINE MODAL
// ============================================

function openAddWineModal() {
    if (!authToken) {
        alert('Token non valido');
        return;
    }
    
    // Crea modal per aggiungere vino
    const modal = document.createElement('div');
    modal.className = 'viewer-edit-modal';
    modal.id = 'add-wine-modal';
    modal.innerHTML = `
        <div class="viewer-edit-modal-overlay" onclick="closeAddWineModal()"></div>
        <div class="viewer-edit-modal-content">
            <div class="viewer-edit-modal-header">
                <h2>Aggiungi Nuovo Vino</h2>
                <button class="viewer-edit-modal-close" onclick="closeAddWineModal()" type="button">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                </button>
            </div>
            <div class="viewer-edit-modal-body">
                <form class="viewer-edit-form" id="add-wine-form">
                    <div class="wine-card-edit-form-grid">
                        <div class="wine-card-edit-field">
                            <label class="wine-card-edit-label">Nome *</label>
                            <input type="text" class="wine-card-edit-input" name="name" required>
                        </div>
                        <div class="wine-card-edit-field">
                            <label class="wine-card-edit-label">Produttore</label>
                            <input type="text" class="wine-card-edit-input" name="producer">
                        </div>
                        <div class="wine-card-edit-field">
                            <label class="wine-card-edit-label">Quantità</label>
                            <input type="number" class="wine-card-edit-input" name="quantity" min="0">
                        </div>
                        <div class="wine-card-edit-field">
                            <label class="wine-card-edit-label">Prezzo Vendita (€)</label>
                            <input type="number" class="wine-card-edit-input" name="selling_price" step="0.01" min="0">
                        </div>
                        <div class="wine-card-edit-field">
                            <label class="wine-card-edit-label">Prezzo Acquisto (€)</label>
                            <input type="number" class="wine-card-edit-input" name="cost_price" step="0.01" min="0">
                        </div>
                        <div class="wine-card-edit-field">
                            <label class="wine-card-edit-label">Annata</label>
                            <input type="text" class="wine-card-edit-input" name="vintage">
                        </div>
                        <div class="wine-card-edit-field">
                            <label class="wine-card-edit-label">Regione</label>
                            <input type="text" class="wine-card-edit-input" name="region">
                        </div>
                        <div class="wine-card-edit-field">
                            <label class="wine-card-edit-label">Paese</label>
                            <input type="text" class="wine-card-edit-input" name="country">
                        </div>
                        <div class="wine-card-edit-field">
                            <label class="wine-card-edit-label">Tipo</label>
                            <input type="text" class="wine-card-edit-input" name="wine_type">
                        </div>
                        <div class="wine-card-edit-field">
                            <label class="wine-card-edit-label">Fornitore</label>
                            <input type="text" class="wine-card-edit-input" name="supplier">
                        </div>
                        <div class="wine-card-edit-field">
                            <label class="wine-card-edit-label">Vitigno</label>
                            <input type="text" class="wine-card-edit-input" name="grape_variety">
                        </div>
                        <div class="wine-card-edit-field">
                            <label class="wine-card-edit-label">Classificazione</label>
                            <input type="text" class="wine-card-edit-input" name="classification">
                        </div>
                        <div class="wine-card-edit-field">
                            <label class="wine-card-edit-label">Gradazione (% vol)</label>
                            <input type="text" class="wine-card-edit-input" name="alcohol_content">
                        </div>
                        <div class="wine-card-edit-field full-width">
                            <label class="wine-card-edit-label">Descrizione</label>
                            <textarea class="wine-card-edit-textarea" name="description"></textarea>
                        </div>
                        <div class="wine-card-edit-field full-width">
                            <label class="wine-card-edit-label">Note</label>
                            <textarea class="wine-card-edit-textarea" name="notes"></textarea>
                        </div>
                    </div>
                    <div class="wine-card-edit-actions">
                        <button class="wine-card-edit-btn cancel" type="button" onclick="closeAddWineModal()">Annulla</button>
                        <button class="wine-card-edit-btn save" type="button" onclick="saveAddWine(event)">Aggiungi</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Chiudi modal con ESC
    const handleEsc = (e) => {
        if (e.key === 'Escape') {
            closeAddWineModal();
        }
    };
    document.addEventListener('keydown', handleEsc);
    modal._escHandler = handleEsc;
}

function closeAddWineModal() {
    const modal = document.getElementById('add-wine-modal');
    if (modal) {
        if (modal._escHandler) {
            document.removeEventListener('keydown', modal._escHandler);
        }
        modal.remove();
    }
}

async function saveAddWine(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const form = document.getElementById('add-wine-form');
    if (!form) {
        console.error('[ADD_WINE] Form non trovato');
        return;
    }
    
    const data = {};
    
    // Raccogli tutti i valori dal form
    form.querySelectorAll('input, textarea').forEach(input => {
        const name = input.name;
        const value = input.value.trim();
        
        if (name === 'quantity') {
            data[name] = value === '' ? null : parseInt(value);
        } else if (name === 'selling_price' || name === 'cost_price') {
            data[name] = value === '' ? null : parseFloat(value);
        } else {
            data[name] = value === '' ? null : value;
        }
    });
    
    // Validazione: nome obbligatorio
    if (!data.name || !data.name.trim()) {
        alert('Il nome del vino è obbligatorio');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/wines`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify(data),
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Errore aggiunta vino' }));
            throw new Error(errorData.detail || 'Errore aggiunta vino');
        }
        
        const result = await response.json();
        
        // Chiudi modal
        closeAddWineModal();
        
        // Mostra messaggio successo con wine card HTML
        if (result.wine_card_html) {
            addChatMessage('ai', result.wine_card_html, false, false, null, true);
        } else {
            addChatMessage('ai', `✅ Vino "${data.name}" aggiunto con successo!`, false, false);
        }
        
    } catch (error) {
        console.error('Errore aggiunta vino:', error);
        addChatMessage('ai', `Errore: ${error.message}`, false, true);
    }
}

// Make functions available globally
window.handleViewerWineEdit = handleViewerWineEdit;
window.closeViewerEditModal = closeViewerEditModal;
window.saveViewerWineEdit = saveViewerWineEdit;
window.openAddWineModal = openAddWineModal;
window.closeAddWineModal = closeAddWineModal;
window.saveAddWine = saveAddWine;
window.handleWineCardEdit = handleWineCardEdit;
window.handleWineCardShowInInventory = handleWineCardShowInInventory;

async function handleWineCardShowInInventory(wineCard, wineId) {
    // Apri il viewer se non è già aperto
    const panel = document.getElementById('viewer-panel');
    if (!panel.classList.contains('open')) {
        toggleViewer();
    }
    
    // Attendi che il viewer sia aperto e i dati caricati
    // Aspetta fino a quando viewerData è disponibile (max 5 secondi)
    let attempts = 0;
    const maxAttempts = 50; // 50 * 100ms = 5 secondi max
    while (!viewerData && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }
    
    // Carica dati vino per ottenere nome e produttore
    try {
        const response = await fetch(`${API_BASE_URL}/api/wines/${wineId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
            },
        });
        
        if (!response.ok) {
            throw new Error('Errore caricamento dati vino');
        }
        
        const wine = await response.json();
        // Usa solo il nome del vino per la ricerca (non produttore/cantina)
        const searchQuery = wine.name || '';
        
        console.log('[VIEWER] Impostazione ricerca per:', searchQuery);
        
        // Funzione helper per settare la ricerca
        const setSearch = () => {
            const searchInput = document.getElementById('viewer-search');
            if (searchInput) {
                console.log('[VIEWER] Campo ricerca trovato, imposto valore:', searchQuery);
                searchInput.value = searchQuery;
                viewerSearchQuery = searchQuery;
                // Trigger evento input per assicurarsi che il debounce funzioni
                searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                // Applica filtri immediatamente (bypass debounce)
                if (viewerData && viewerData.rows) {
                    applyViewerFilters();
                }
                return true;
            }
            return false;
        };
        
        // Prova a settare la ricerca immediatamente
        if (!setSearch()) {
            // Se l'input non esiste ancora, aspetta e riprova
            console.warn('[VIEWER] Campo ricerca non trovato, riprovo tra 200ms');
            await new Promise(resolve => setTimeout(resolve, 200));
            if (!setSearch()) {
                // Ultimo tentativo dopo un altro attimo
                await new Promise(resolve => setTimeout(resolve, 300));
                setSearch();
            }
        }
        
        // Non aprire fullscreen automaticamente - solo aprire il viewer laterale
        
    } catch (error) {
        console.error('Errore caricamento dati vino:', error);
        addChatMessage('ai', `Errore: ${error.message}`, false, true);
    }
}

// ============================================
// VIEWER
// ============================================

function toggleViewer() {
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
        // NUOVA ARCHITETTURA MOBILE: Usa hidden invece di classi
        const viewerMobile = document.getElementById('viewerPanel');
        const viewerDesktop = document.getElementById('viewer-panel');
        const toggleBtn = document.getElementById('viewer-toggle');
        
        if (!viewerMobile) {
            console.error('[VIEWER] Viewer mobile non trovato!');
            return;
        }
        
        const wasOpen = !viewerMobile.hasAttribute('hidden');
        
        if (wasOpen) {
            closeViewer();
        } else {
            // Apri viewer: rimuovi hidden
            viewerMobile.removeAttribute('hidden');
            if (toggleBtn) toggleBtn.setAttribute('hidden', '');
            
            // Copia contenuto dal viewer desktop al viewer mobile se necessario
            if (viewerDesktop && viewerDesktop.querySelector('.viewer-content')) {
                const desktopContent = viewerDesktop.querySelector('.viewer-content');
                const mobileContent = viewerMobile.querySelector('.viewer-content');
                if (!mobileContent && desktopContent) {
                    viewerMobile.innerHTML = desktopContent.outerHTML;
                }
            }
            
            loadViewerData();
        }
    } else {
        // DESKTOP: Usa classi come prima
        const panel = document.getElementById('viewer-panel');
        const toggleBtn = document.getElementById('viewer-toggle');
        
        if (panel.classList.contains('open')) {
            closeViewer();
        } else {
            panel.classList.add('open');
            if (toggleBtn) toggleBtn.classList.add('hidden');
            loadViewerData();
        }
    }
}

function closeViewer() {
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
        // NUOVA ARCHITETTURA MOBILE: Usa hidden
        const viewerMobile = document.getElementById('viewerPanel');
        const toggleBtn = document.getElementById('viewer-toggle');
        
        if (viewerMobile) viewerMobile.setAttribute('hidden', '');
        if (toggleBtn) toggleBtn.removeAttribute('hidden');
    } else {
        // DESKTOP: Usa classi
        const panel = document.getElementById('viewer-panel');
        const toggleBtn = document.getElementById('viewer-toggle');
        
        if (panel) panel.classList.remove('open');
        if (toggleBtn) toggleBtn.classList.remove('hidden');
    }
}


function setupViewerSearch() {
    // Setup ricerca viewer - usa listener universale per mobile
    const searchInput = document.getElementById('viewer-search');
    if (searchInput) {
        // Rimuovi listener esistenti per evitare duplicati
        const newInput = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newInput, searchInput);
        
        // Collega listener universale per supporto mobile
        addUniversalEventListener(newInput, (e) => {
            handleViewerSearch(e);
        });
        
        // Collega anche listener standard come fallback
        newInput.addEventListener('input', handleViewerSearch);
        
        console.log('[VIEWER] Event listener ricerca collegato');
    } else {
        console.warn('[VIEWER] Campo ricerca non trovato durante setup');
    }
}

function setupViewerFilters() {
    // Setup dropdown buttons
    const filterButtons = document.querySelectorAll('.filter-dropdown-btn');
    console.log('[FILTERS] Trovati', filterButtons.length, 'pulsanti dropdown');
    
    filterButtons.forEach(btn => {
        addUniversalEventListener(btn, (e) => {
            e.stopPropagation();
            const filterType = btn.dataset.filter;
            const dropdown = document.getElementById(`filter-dropdown-${filterType}`);
            
            console.log('[FILTERS] Click su pulsante', filterType, 'dropdown:', !!dropdown);
            
            if (!dropdown) {
                console.error('[FILTERS] Dropdown non trovato per', filterType);
                return;
            }
            
            // Toggle dropdown
            const isOpen = !dropdown.classList.contains('hidden');
            
            // Chiudi tutti gli altri dropdown
            document.querySelectorAll('.filter-dropdown-menu').forEach(menu => {
                menu.classList.add('hidden');
            });
            document.querySelectorAll('.filter-dropdown-btn').forEach(b => {
                b.classList.remove('active');
            });
            
            if (!isOpen) {
                // Apri questo dropdown
                dropdown.classList.remove('hidden');
                btn.classList.add('active');
                console.log('[FILTERS] Dropdown aperto per', filterType);
            } else {
                console.log('[FILTERS] Dropdown chiuso per', filterType);
            }
        });
    });
    
    // Chiudi dropdown quando si clicca fuori
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.filter-dropdown-wrapper')) {
            document.querySelectorAll('.filter-dropdown-menu').forEach(menu => {
                menu.classList.add('hidden');
            });
            document.querySelectorAll('.filter-dropdown-btn').forEach(btn => {
                btn.classList.remove('active');
            });
        }
    });
    
    // Setup reset filters button
    const resetBtn = document.getElementById('reset-filters-btn');
    if (resetBtn) {
        // Usa pointer events per mobile
        resetBtn.addEventListener('pointerup', (e) => {
            e.stopPropagation();
            resetViewerFilters();
        });
    }
}

function resetViewerFilters() {
    // Reset tutti i filtri
    viewerFilters = {
        type: null,
        vintage: null,
        winery: null,
        supplier: null
    };
    
    // Reset ricerca
    viewerSearchQuery = '';
    const searchInput = document.getElementById('viewer-search');
    if (searchInput) {
        searchInput.value = '';
    }
    
    // Rimuovi classe active da tutti gli item
    document.querySelectorAll('.filter-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Chiudi tutti i dropdown
    document.querySelectorAll('.filter-dropdown-menu').forEach(menu => {
        menu.classList.add('hidden');
    });
    document.querySelectorAll('.filter-dropdown-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Reset valori visualizzati sui pulsanti
    const valueType = document.getElementById('filter-value-type');
    const valueVintage = document.getElementById('filter-value-vintage');
    const valueWinery = document.getElementById('filter-value-winery');
    const valueSupplier = document.getElementById('filter-value-supplier');
    
    if (valueType) valueType.textContent = 'Tutte';
    if (valueVintage) valueVintage.textContent = 'Tutte';
    if (valueWinery) valueWinery.textContent = 'Tutte';
    if (valueSupplier) valueSupplier.textContent = 'Tutti';
    
    // Riapplica filtri (che ora sono vuoti)
    applyViewerFilters();
}

async function loadViewerData() {
    if (!authToken) return;

    const tableBody = document.getElementById('viewer-table-body');
    tableBody.innerHTML = '<tr><td colspan="6" class="loading">Caricamento...</td></tr>';

    try {
        // Call viewer snapshot endpoint (uses Bearer token authentication)
        const response = await fetch(`${API_BASE_URL}/api/viewer/snapshot`, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Errore nel caricamento dei dati' }));
            throw new Error(errorData.detail || `Errore ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        viewerData = data;
        
        // Populate filters
        populateFilters(data.facets || {});
        
        // Update meta info se in fullscreen
        updateViewerMeta(data.meta || {});
        
        // Se c'è una query di ricerca, applica i filtri (inclusa la ricerca)
        // Altrimenti renderizza tutti i dati
        if (viewerSearchQuery) {
            applyViewerFilters();
        } else {
            renderViewerTable(data.rows || []);
        }
    } catch (error) {
        console.error('Errore caricamento viewer:', error);
        const errorMsg = error.message || 'Errore nel caricamento dei dati';
        tableBody.innerHTML = `<tr><td colspan="6" class="loading" style="color: var(--color-granaccia);">Errore: ${escapeHtml(errorMsg)}</td></tr>`;
    }
}

function populateFilters(facets) {
    Object.keys(facets).forEach(filterType => {
        const content = document.getElementById(`filter-${filterType}`);
        if (!content) return;

        const items = facets[filterType];
        content.innerHTML = '';

        // Ordina per frequenza (count desc)
        const sortedItems = Object.entries(items).sort((a, b) => b[1] - a[1]);

        sortedItems.forEach(([value, count]) => {
            const item = document.createElement('div');
            item.className = 'filter-item';
            item.dataset.value = value;
            item.innerHTML = `
                <span>${escapeHtml(value)}</span>
                <span class="filter-count">${count}</span>
            `;
            content.appendChild(item);
        });
    });
    
    // Setup filter items dopo aver popolato
    setupFilterItems();
}

function setupFilterItems() {
    const filterItems = document.querySelectorAll('.filter-item');
    console.log('[FILTERS] Setup', filterItems.length, 'filter items');
    
    filterItems.forEach(item => {
        // Usa pointer events per mobile
        item.addEventListener('pointerup', (e) => {
            e.stopPropagation();
            const dropdownContent = item.closest('.filter-dropdown-content');
            if (!dropdownContent) {
                console.error('[FILTERS] filter-dropdown-content non trovato');
                return;
            }
            
            const filterType = dropdownContent.id.replace('filter-', '');
            const value = item.dataset.value;
            const dropdown = item.closest('.filter-dropdown-menu');
            const btn = document.getElementById(`filter-btn-${filterType}`);
            const valueDisplay = document.getElementById(`filter-value-${filterType}`);

            console.log('[FILTERS] Selezione filtro', filterType, '=', value);

            // Imposta filtro
            viewerFilters[filterType] = value;
            
            // Remove active from siblings
            item.parentElement.querySelectorAll('.filter-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            // Aggiorna valore visualizzato sul pulsante
            if (valueDisplay) {
                valueDisplay.textContent = value;
            }
            if (btn) {
                btn.classList.add('active');
            }
            
            // Chiudi dropdown
            if (dropdown) {
                dropdown.classList.add('hidden');
            }

            // Apply filters and re-render
            applyViewerFilters();
        });
    });
}

function applyViewerFilters() {
    if (!viewerData || !viewerData.rows) {
        console.warn('[VIEWER] applyViewerFilters chiamato ma viewerData non disponibile');
        return;
    }

    let filtered = [...viewerData.rows];
    console.log('[VIEWER] Applicazione filtri - righe iniziali:', filtered.length, 'query ricerca:', viewerSearchQuery);

    // Apply filters
    Object.keys(viewerFilters).forEach(key => {
        if (viewerFilters[key]) {
            const beforeCount = filtered.length;
            filtered = filtered.filter(row => {
                const rowValue = row[key] || row[key.toLowerCase()];
                return String(rowValue) === String(viewerFilters[key]);
            });
            console.log(`[VIEWER] Filtro ${key}="${viewerFilters[key]}" - da ${beforeCount} a ${filtered.length} righe`);
        }
    });

    // Apply search
    if (viewerSearchQuery && viewerSearchQuery.trim()) {
        const query = viewerSearchQuery.toLowerCase().trim();
        const beforeCount = filtered.length;
        filtered = filtered.filter(row => {
            // Cerca in tutti i valori dell'oggetto row
            const matches = Object.values(row).some(val => {
                if (val === null || val === undefined) return false;
                return String(val).toLowerCase().includes(query);
            });
            return matches;
        });
        console.log(`[VIEWER] Ricerca "${query}" - da ${beforeCount} a ${filtered.length} righe`);
    }

    console.log('[VIEWER] Render tabella con', filtered.length, 'righe filtrate');
    renderViewerTable(filtered);
}

let viewerSearchTimeout = null;

function handleViewerSearch(e) {
    // Debounce ricerca (300ms)
    clearTimeout(viewerSearchTimeout);
    viewerSearchTimeout = setTimeout(() => {
        const searchValue = e.target ? e.target.value : (e.currentTarget ? e.currentTarget.value : '');
        console.log('[VIEWER] Ricerca:', searchValue, 'viewerData disponibile:', !!viewerData);
        viewerSearchQuery = searchValue;
        if (viewerData && viewerData.rows) {
            applyViewerFilters();
        } else {
            console.warn('[VIEWER] viewerData non disponibile, ricerca non applicata');
        }
    }, 300);
}

function renderViewerTable(rows) {
    const tableBody = document.getElementById('viewer-table-body');
    const mobileCardsContainer = document.getElementById('viewer-mobile-cards');
    const panel = document.getElementById('viewer-panel');
    const isFullscreen = panel && panel.classList.contains('fullscreen');
    const isMobile = window.innerWidth <= 768;
    
    if (rows.length === 0) {
        const colspan = isFullscreen ? 7 : 6;
        // Mostra messaggio diverso se c'è una ricerca attiva
        const message = viewerSearchQuery && viewerSearchQuery.trim()
            ? `Nessun risultato trovato per "${viewerSearchQuery}"`
            : 'Nessun inventario disponibile. Carica un file CSV per iniziare.';
        tableBody.innerHTML = `<tr><td colspan="${colspan}" class="loading" style="color: var(--color-text-secondary); padding: 40px !important;">${escapeHtml(message)}</td></tr>`;
        if (mobileCardsContainer) {
            mobileCardsContainer.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--color-text-secondary);">${escapeHtml(message)}</div>`;
        }
        return;
    }

    // Pagination
    const start = (viewerCurrentPage - 1) * viewerPageSize;
    const end = start + viewerPageSize;
    const paginatedRows = rows.slice(start, end);
    const totalPages = Math.ceil(rows.length / viewerPageSize);
    
    // Genera card mobile se siamo su mobile
    if (isMobile && mobileCardsContainer) {
        let mobileHtml = '';
        paginatedRows.forEach((row, index) => {
            const wineId = row.id || `wine-${index}`;
            const wineNameRaw = row.name || row.Nome || '';
            const wineName = escapeHtml(wineNameRaw);
            const winery = escapeHtml(row.winery || row.Cantina || '');
            const qty = row.qty || row.Quantità || row.quantità || 0;
            const price = (row.price || row.Prezzo || row.prezzo || 0).toFixed(2);
            const supplier = escapeHtml(row.supplier || row.Fornitore || row.fornitore || '');
            const isCritical = row.critical || row['Scorta critica'] || false;
            
            mobileHtml += `
            <div class="viewer-wine-card-mobile" data-wine-id="${wineId}">
                <div class="viewer-wine-card-mobile-header">
                    <h3 class="viewer-wine-card-mobile-title">${wineName}</h3>
                    <div class="viewer-wine-card-mobile-actions">
                        <button type="button" class="viewer-chart-btn" data-wine-name="${wineNameRaw.replace(/"/g, '&quot;')}" title="Visualizza grafico movimenti">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3 3V21H21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M7 12L10 9L14 13L21 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                        <button type="button" class="viewer-edit-btn" data-wine-id="${wineId}" data-wine-name="${wineName}" title="Modifica vino">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M18.5 2.5C18.8978 2.10217 19.4374 1.87868 20 1.87868C20.5626 1.87868 21.1022 2.10217 21.5 2.5C21.8978 2.89782 22.1213 3.43739 22.1213 4C22.1213 4.56261 21.8978 5.10217 21.5 5.5L12 15L8 16L9 12L18.5 2.5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="viewer-wine-card-mobile-body">
                    <div class="viewer-wine-card-mobile-field">
                        <span class="viewer-wine-card-mobile-field-label">Cantina</span>
                        <span class="viewer-wine-card-mobile-field-value">${winery || '-'}</span>
                    </div>
                    <div class="viewer-wine-card-mobile-field">
                        <span class="viewer-wine-card-mobile-field-label">Quantità</span>
                        <span class="viewer-wine-card-mobile-field-value">${qty}</span>
                    </div>
                    <div class="viewer-wine-card-mobile-field">
                        <span class="viewer-wine-card-mobile-field-label">Prezzo</span>
                        <span class="viewer-wine-card-mobile-field-value">€${price}</span>
                    </div>
                    <div class="viewer-wine-card-mobile-field">
                        <span class="viewer-wine-card-mobile-field-label">Fornitore</span>
                        <span class="viewer-wine-card-mobile-field-value">${supplier || '-'}</span>
                    </div>
                </div>
                ${isCritical ? '<div style="margin-top: 12px;"><span class="critical-badge">Scorta Critica</span></div>' : ''}
            </div>
            `;
        });
        mobileCardsContainer.innerHTML = mobileHtml;
        
        // Attacca event listeners per i pulsanti nelle card mobile con pointer events
        mobileCardsContainer.querySelectorAll('.viewer-chart-btn').forEach(btn => {
            btn.addEventListener('pointerup', (e) => {
                e.stopPropagation();
                const wineName = btn.dataset.wineName || '';
                if (wineName) {
                    showMovementsChart(wineName);
                }
            });
        });
        
        mobileCardsContainer.querySelectorAll('.viewer-edit-btn').forEach(btn => {
            btn.addEventListener('pointerup', (e) => {
                e.stopPropagation();
                const wineId = btn.dataset.wineId;
                if (wineId) {
                    handleViewerWineEdit(parseInt(wineId));
                }
            });
        });
    }

    // Genera HTML righe
    let html = '';
    paginatedRows.forEach((row, index) => {
        const wineId = `wine-${index}-${Date.now()}`;
        const wineNameRaw = row.name || row.Nome || '';
        const wineName = escapeHtml(wineNameRaw);
        const isExpanded = false; // Stato iniziale
        
        // Riga principale
        html += `
        <tr class="viewer-wine-row" data-wine-id="${wineId}" data-expanded="false">
            <td class="viewer-wine-name-cell">${wineName}</td>
            <td>${escapeHtml(row.winery || row.Cantina || '')}</td>
            <td>${row.qty || row.Quantità || row.quantità || 0}</td>
            <td>€${(row.price || row.Prezzo || row.prezzo || 0).toFixed(2)}</td>
            <td>${escapeHtml(row.supplier || row.Fornitore || row.fornitore || '')}</td>
            <td style="display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap;">
                ${(row.critical || row['Scorta critica'] || false) ? '<span class="critical-badge">Critica</span>' : ''}
                <button class="viewer-chart-btn" data-wine-name="${wineNameRaw.replace(/"/g, '&quot;')}" title="Visualizza grafico movimenti" type="button">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 3V21H21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M7 12L10 9L14 13L21 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
            </td>
            ${isFullscreen ? `
            <td class="viewer-chart-action-cell" style="text-align: center;">
                <button class="viewer-edit-btn" data-wine-id="${row.id || ''}" data-wine-name="${wineName}" title="Modifica vino" type="button">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M18.5 2.5C18.8978 2.10217 19.4374 1.87868 20 1.87868C20.5626 1.87868 21.1022 2.10217 21.5 2.5C21.8978 2.89782 22.1213 3.43739 22.1213 4C22.1213 4.56261 21.8978 5.10217 21.5 5.5L12 15L8 16L9 12L18.5 2.5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
            </td>
            ` : ''}
        </tr>
        `;
        
        // Riga dettagli (solo in fullscreen)
        if (isFullscreen) {
            html += `
        <tr class="viewer-wine-details-row" data-wine-id="${wineId}" style="display: none;">
            <td colspan="7" class="viewer-wine-details-cell">
                <div class="viewer-wine-details-content">
                    <h3>Dettagli Vino: ${wineName}</h3>
                    <div class="viewer-wine-details-grid">
                        <div class="viewer-detail-item">
                            <span class="viewer-detail-label">Nome:</span>
                            <span class="viewer-detail-value">${wineName}</span>
                        </div>
                        <div class="viewer-detail-item">
                            <span class="viewer-detail-label">Cantina:</span>
                            <span class="viewer-detail-value">${escapeHtml(row.winery || '-')}</span>
                        </div>
                        <div class="viewer-detail-item">
                            <span class="viewer-detail-label">Annata:</span>
                            <span class="viewer-detail-value">${row.vintage || '-'}</span>
                        </div>
                        <div class="viewer-detail-item">
                            <span class="viewer-detail-label">Quantità:</span>
                            <span class="viewer-detail-value">${row.qty || 0} bottiglie</span>
                        </div>
                        <div class="viewer-detail-item">
                            <span class="viewer-detail-label">Prezzo vendita:</span>
                            <span class="viewer-detail-value">€${(row.price || 0).toFixed(2)}</span>
                        </div>
                        <div class="viewer-detail-item">
                            <span class="viewer-detail-label">Fornitore:</span>
                            <span class="viewer-detail-value">${escapeHtml(row.supplier || '-')}</span>
                        </div>
                        <div class="viewer-detail-item">
                            <span class="viewer-detail-label">Tipologia:</span>
                            <span class="viewer-detail-value">${escapeHtml(row.type || '-')}</span>
                        </div>
                    </div>
                </div>
            </td>
        </tr>
        `;
        }
    });

    tableBody.innerHTML = html;
    
    // Mostra/nascondi tabella o card in base al dispositivo
    if (isMobile) {
        const table = document.getElementById('viewer-table');
        if (table) table.style.display = 'none';
        if (mobileCardsContainer) mobileCardsContainer.style.display = 'flex';
    } else {
        const table = document.getElementById('viewer-table');
        if (table) table.style.display = 'table';
        if (mobileCardsContainer) mobileCardsContainer.style.display = 'none';
    }
    
    // Debug: verifica struttura colonne
    if (isFullscreen && !isMobile) {
        const firstRow = tableBody.querySelector('.viewer-wine-row');
        if (firstRow) {
            const cells = firstRow.querySelectorAll('td');
            console.log('[VIEWER] Numero colonne renderizzate:', cells.length);
            console.log('[VIEWER] Colonna SCORTA (6a):', cells[5]?.innerHTML?.substring(0, 100));
            console.log('[VIEWER] Colonna AZIONE (7a):', cells[6]?.innerHTML?.substring(0, 100));
        }
    }

    // Setup click su pulsanti grafico - Usa event delegation per gestire pulsanti creati dinamicamente
    // Rimuovi listener precedenti se esistono
    const viewerPanel = document.getElementById('viewer-panel');
    // tableBody è già dichiarato all'inizio della funzione, non dichiararlo di nuovo
    
    // Usa tableBody come container per event delegation (più specifico)
    const container = tableBody || viewerPanel;
    
    if (container) {
        // Rimuovi listener precedenti se esistono (per evitare duplicati)
        const oldHandler = container._chartBtnHandler;
        if (oldHandler) {
            container.removeEventListener('pointerup', oldHandler);
            container.removeEventListener('click', oldHandler);
        }
        
        // Crea nuovo handler con event delegation
        const chartBtnHandler = (e) => {
            // Verifica se il click è su un pulsante grafico o su un elemento dentro di esso (come SVG)
            const btn = e.target.closest('.viewer-chart-btn');
            if (!btn) {
                // Se non è un pulsante, verifica se è un SVG dentro un pulsante
                const svg = e.target.closest('svg');
                if (svg) {
                    const parentBtn = svg.closest('.viewer-chart-btn');
                    if (parentBtn) {
                        e.stopPropagation();
                        e.preventDefault();
                        
                        let wineName = parentBtn.dataset.wineName;
                        
                        if (!wineName) {
                            const row = parentBtn.closest('.viewer-wine-row') || parentBtn.closest('.viewer-wine-card-mobile');
                            if (row) {
                                const nameCell = row.querySelector('.viewer-wine-name-cell') || row.querySelector('.viewer-wine-card-mobile-title');
                                if (nameCell) {
                                    wineName = nameCell.textContent.trim();
                                }
                            }
                        }
                        
                        if (wineName) {
                            console.log('[VIEWER] Click su pulsante grafico (via SVG) per vino:', wineName);
                            showMovementsChart(wineName);
                        }
                        return;
                    }
                }
                return;
            }
            
            e.stopPropagation();
            e.preventDefault();
            
            console.log('[VIEWER] Click su pulsante grafico', btn, 'data-wine-name:', btn.dataset.wineName);
            
            let wineName = btn.dataset.wineName;
            
            // Fallback: recupera nome dalla riga o card se data attribute non disponibile
            if (!wineName) {
                const row = btn.closest('.viewer-wine-row') || btn.closest('.viewer-wine-card-mobile');
                if (row) {
                    const nameCell = row.querySelector('.viewer-wine-name-cell') || row.querySelector('.viewer-wine-card-mobile-title');
                    if (nameCell) {
                        wineName = nameCell.textContent.trim();
                    }
                }
            }
            
            if (wineName) {
                console.log('[VIEWER] Apertura grafico per vino:', wineName);
                showMovementsChart(wineName);
            } else {
                console.error('[VIEWER] Nome vino non trovato per pulsante grafico', btn);
            }
        };
        
        // Salva handler per poterlo rimuovere in futuro
        container._chartBtnHandler = chartBtnHandler;
        
        // Attacca listener con event delegation
        container.addEventListener('pointerup', chartBtnHandler, true); // Use capture phase
        container.addEventListener('click', chartBtnHandler, true); // Use capture phase
        
        // Debug: verifica quanti pulsanti sono stati trovati
        const chartButtons = container.querySelectorAll('.viewer-chart-btn');
        console.log('[VIEWER] Pulsanti grafico trovati dopo render:', chartButtons.length);
    } else {
        console.error('[VIEWER] Container non trovato per event delegation (tableBody o viewerPanel)');
    }
    
    // Setup click su pulsanti modifica - usa pointer events per mobile
    document.querySelectorAll('.viewer-edit-btn').forEach(btn => {
        btn.addEventListener('pointerup', (e) => {
            e.stopPropagation();
            const wineId = btn.dataset.wineId;
            if (wineId) {
                handleViewerWineEdit(parseInt(wineId));
            }
        });
    });

    // Setup click su righe per espansione (solo fullscreen)
    if (isFullscreen) {
        document.querySelectorAll('.viewer-wine-row').forEach(row => {
            addUniversalEventListener(row, (e) => {
                // Non espandere se il click è sul pulsante grafico o modifica
                if (e.target.closest('.viewer-chart-btn') || e.target.closest('.viewer-edit-btn')) {
                    return;
                }
                
                const wineId = row.dataset.wineId;
                const isExpanded = row.dataset.expanded === 'true';
                const detailsRow = document.querySelector(`.viewer-wine-details-row[data-wine-id="${wineId}"]`);
                
                if (detailsRow) {
                    if (isExpanded) {
                        // Chiudi
                        detailsRow.style.display = 'none';
                        row.dataset.expanded = 'false';
                        row.classList.remove('expanded');
                    } else {
                        // Chiudi tutte le altre righe espanse
                        document.querySelectorAll('.viewer-wine-row[data-expanded="true"]').forEach(expRow => {
                            const expWineId = expRow.dataset.wineId;
                            const expDetailsRow = document.querySelector(`.viewer-wine-details-row[data-wine-id="${expWineId}"]`);
                            if (expDetailsRow) {
                                expDetailsRow.style.display = 'none';
                                expRow.dataset.expanded = 'false';
                                expRow.classList.remove('expanded');
                            }
                        });
                        
                        // Apri questa riga
                        detailsRow.style.display = 'table-row';
                        row.dataset.expanded = 'true';
                        row.classList.add('expanded');
                    }
                }
            });
        });
    }

    // Render pagination
    renderViewerPagination(totalPages);
}

function renderViewerPagination(totalPages) {
    const pagination = document.getElementById('viewer-pagination');
    
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }

    const buttons = [];
    
    // Previous button
    const prevDisabled = viewerCurrentPage === 1 ? 'disabled' : '';
    buttons.push(`
        <button type="button" class="pagination-btn" ${prevDisabled} data-page="${viewerCurrentPage - 1}">
            ←
        </button>
    `);

    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= viewerCurrentPage - 2 && i <= viewerCurrentPage + 2)) {
            const activeClass = i === viewerCurrentPage ? 'active' : '';
            buttons.push(`
                <button type="button" class="pagination-btn ${activeClass}" data-page="${i}">
                    ${i}
                </button>
            `);
        } else if (i === viewerCurrentPage - 3 || i === viewerCurrentPage + 3) {
            buttons.push('<span class="pagination-info">...</span>');
        }
    }

    // Next button
    const nextDisabled = viewerCurrentPage === totalPages ? 'disabled' : '';
    buttons.push(`
        <button type="button" class="pagination-btn" ${nextDisabled} data-page="${viewerCurrentPage + 1}">
            →
        </button>
    `);

    pagination.innerHTML = buttons.join('');
    
    // Attacca event listeners con pointer events per mobile
    pagination.querySelectorAll('.pagination-btn:not([disabled])').forEach(btn => {
        btn.addEventListener('pointerup', (e) => {
            e.stopPropagation();
            const page = parseInt(btn.dataset.page);
            if (page && !btn.disabled) {
                viewerGoToPage(page);
            }
        });
    });
}

function viewerGoToPage(page) {
    viewerCurrentPage = page;
    applyViewerFilters();
    const tableContainer = document.querySelector('.viewer-table-container');
    if (tableContainer) {
        tableContainer.scrollTop = 0;
    }
}

// Make function available globally for onclick handlers
window.viewerGoToPage = viewerGoToPage;

// ============================================
// VIEWER FULLSCREEN FUNCTIONS
// ============================================

function setupViewerFullscreenListeners() {
    const viewerFullscreenBtn = document.getElementById('viewer-fullscreen-btn');
    console.log('[VIEWER] setupViewerFullscreenListeners - pulsante trovato:', !!viewerFullscreenBtn);
    console.log('[VIEWER] Window width:', window.innerWidth, 'Is desktop:', window.innerWidth > 768);
    
    if (viewerFullscreenBtn) {
        // Rimuovi listener esistenti per evitare duplicati
        const newBtn = viewerFullscreenBtn.cloneNode(true);
        viewerFullscreenBtn.parentNode.replaceChild(newBtn, viewerFullscreenBtn);
        
        // Prova anche con addEventListener diretto come fallback
        newBtn.addEventListener('click', (e) => {
            console.log('[VIEWER] Click diretto su pulsante fullscreen rilevato!');
            e.preventDefault();
            e.stopPropagation();
            toggleViewerFullscreen();
        });
        
        addUniversalEventListener(newBtn, (e) => {
            console.log('[VIEWER] Click universale su pulsante fullscreen rilevato!');
            e.preventDefault();
            e.stopPropagation();
            toggleViewerFullscreen();
        });
        console.log('[VIEWER] Event listener collegato al pulsante fullscreen');
    } else {
        console.warn('[VIEWER] Pulsante fullscreen non trovato!');
    }
}

function toggleViewerFullscreen() {
    console.log('[VIEWER] toggleViewerFullscreen chiamato');
    
    // Solo desktop
    if (window.innerWidth <= 768) {
        console.log('[VIEWER] Fullscreen disponibile solo su desktop');
        return;
    }
    
    const panel = document.getElementById('viewer-panel');
    const chartColumn = document.querySelector('.viewer-chart-column');
    const metaEl = document.getElementById('viewer-meta');
    const downloadBtn = document.getElementById('viewer-download-csv');
    
    if (!panel) {
        console.error('[VIEWER] Panel non trovato!');
        return;
    }
    
    // Assicurati che il panel sia aperto prima di entrare in fullscreen
    if (!panel.classList.contains('open')) {
        console.log('[VIEWER] Aprendo panel prima di entrare in fullscreen');
        panel.classList.add('open');
        const toggleBtn = document.getElementById('viewer-toggle');
        if (toggleBtn) toggleBtn.classList.add('hidden');
        
        // Carica dati se non ancora caricati
        if (!viewerData) {
            loadViewerData();
        }
    }
    
    const isFullscreen = panel.classList.contains('fullscreen');
    console.log('[VIEWER] Stato fullscreen attuale:', isFullscreen);
    
    if (isFullscreen) {
        // Esci da fullscreen
        console.log('[VIEWER] Uscendo da fullscreen');
        panel.classList.remove('fullscreen');
        
        // Ripristina icona pulsante fullscreen (entra)
        const fullscreenBtn = document.getElementById('viewer-fullscreen-btn');
        if (fullscreenBtn) {
            fullscreenBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M3 3h5v2H5v3H3V3zm12 0h-5v2h3v3h2V3zm-5 14h5v-5h-2v3h-3v2zm-7 0v-5h2v3h3v2H3z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            `;
            fullscreenBtn.title = "Apri a tutto schermo (solo desktop)";
        }
        
        if (chartColumn) chartColumn.classList.add('hidden');
        if (metaEl) metaEl.classList.add('hidden');
        // Download CSV nascosto di default con CSS, non serve rimuovere classe
        
        // Ricarica tabella senza colonna grafico
        if (viewerData) {
            applyViewerFilters();
        }
    } else {
        // Entra in fullscreen
        console.log('[VIEWER] Entrando in fullscreen');
        panel.classList.add('fullscreen');
        
        // Cambia icona pulsante fullscreen (esci)
        const fullscreenBtn = document.getElementById('viewer-fullscreen-btn');
        if (fullscreenBtn) {
            fullscreenBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M7 7L13 13M13 7L7 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            `;
            fullscreenBtn.title = "Esci da schermo intero";
        }
        
        if (chartColumn) chartColumn.classList.remove('hidden');
        if (metaEl) {
            metaEl.classList.remove('hidden');
            // Aggiorna meta se abbiamo i dati
            if (viewerData && viewerData.meta) {
                updateViewerMeta(viewerData.meta);
            }
        }
        // Download CSV visibile automaticamente in fullscreen tramite CSS
        
        // Ricarica tabella con colonna grafico e funzionalità avanzate
        if (viewerData) {
            applyViewerFilters();
        }
    }
}

function updateViewerMeta(meta) {
    const metaEl = document.getElementById('viewer-meta');
    if (!metaEl) return;
    
    const panel = document.getElementById('viewer-panel');
    const isFullscreen = panel && panel.classList.contains('fullscreen');
    
    if (!isFullscreen) {
        metaEl.classList.add('hidden');
        return;
    }
    
    metaEl.classList.remove('hidden');
    const total = meta.total_rows || viewerData?.rows?.length || 0;
    const lastUpdate = meta.last_update 
        ? formatRelativeTime(meta.last_update)
        : "sconosciuto";
    
    metaEl.textContent = `${total} records • Last updated ${lastUpdate}`;
}

function formatRelativeTime(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "appena ora";
    if (diffMins < 60) return `${diffMins} minuti fa`;
    if (diffHours < 24) return `${diffHours} ore fa`;
    return `${diffDays} giorni fa`;
}

function handleViewerDownloadCSV() {
    if (!authToken) return;
    
    // Download da endpoint backend
    const csvUrl = `${API_BASE_URL}/api/viewer/export.csv`;
    const link = document.createElement('a');
    link.href = csvUrl;
    link.download = 'inventario.csv';
    
    // Aggiungi token come header (non funziona con link diretto, usa fetch)
    fetch(csvUrl, {
        headers: {
            'Authorization': `Bearer ${authToken}`,
        },
    })
    .then(response => {
        if (!response.ok) throw new Error('Errore download CSV');
        return response.blob();
    })
    .then(blob => {
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
    })
    .catch(error => {
        console.error('Errore download CSV:', error);
        alert('Errore durante il download del CSV');
    });
}

// Stato per grafico movimenti
let currentMovementsChart = null;
let currentMovementsWineName = null;
let currentMovementsPreset = 'week';

function showMovementsChart(wineName) {
    if (!authToken) {
        alert('Token non valido');
        return;
    }
    
    const modal = document.getElementById('viewer-movements-modal');
    const modalTitle = document.getElementById('viewer-movements-modal-wine-name');
    const chartContainer = document.getElementById('viewer-movements-chart-container');
    const controlsContainer = document.getElementById('viewer-movements-modal-controls');
    
    if (!modal || !modalTitle || !chartContainer) {
        console.error('[VIEWER] Elementi modal non trovati:', { modal: !!modal, modalTitle: !!modalTitle, chartContainer: !!chartContainer });
        return;
    }
    
    console.log('[VIEWER] Mostrando modal per vino:', wineName);
    modalTitle.textContent = `Movimenti: ${wineName}`;
    modal.classList.remove('hidden');
    // Rimuovi anche lo style inline che potrebbe nascondere il modal
    modal.style.display = '';
    // Forza display flex per assicurarsi che sia visibile
    if (window.getComputedStyle(modal).display === 'none') {
        modal.style.display = 'flex';
    }
    console.log('[VIEWER] Modal display dopo modifica:', window.getComputedStyle(modal).display);
    
    // Salva nome vino corrente
    currentMovementsWineName = wineName;
    
    // Setup controlli periodo (solo su desktop)
    const isDesktop = !isMobileView();
    if (isDesktop && controlsContainer) {
        setupPeriodPresets(controlsContainer, wineName);
    } else if (controlsContainer) {
        controlsContainer.style.display = 'none';
    }
    
    // Carica e mostra grafico
    loadAndRenderMovementsChart(wineName, currentMovementsPreset);
}

function setupPeriodPresets(container, wineName) {
    container.style.display = 'block';
    
    // Rimuovi listener precedenti
    const oldButtons = container.querySelectorAll('.period-preset-btn');
    oldButtons.forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
    });
    
    // Aggiungi listener ai nuovi bottoni
    const buttons = container.querySelectorAll('.period-preset-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = btn.dataset.preset;
            currentMovementsPreset = preset;
            
            // Aggiorna stato attivo
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Ricarica grafico
            if (currentMovementsWineName) {
                loadAndRenderMovementsChart(currentMovementsWineName, preset);
            }
        });
        
        // Imposta attivo se corrisponde al preset corrente
        if (btn.dataset.preset === currentMovementsPreset) {
            btn.classList.add('active');
        }
    });
}

function loadAndRenderMovementsChart(wineName, preset) {
    console.log('[VIEWER] loadAndRenderMovementsChart chiamata:', { wineName, preset });
    const chartContainer = document.getElementById('viewer-movements-chart-container');
    if (!chartContainer) {
        console.error('[VIEWER] Container grafico non trovato');
        return;
    }
    
    // Mostra loading
    chartContainer.innerHTML = '<div class="loading">Caricamento movimenti...</div>';
    
    // Fetch movimenti
    console.log('[VIEWER] Fetch movimenti per:', wineName);
    fetch(`${API_BASE_URL}/api/viewer/movements?wine_name=${encodeURIComponent(wineName)}`, {
        headers: {
            'Authorization': `Bearer ${authToken}`,
        },
    })
    .then(response => {
        console.log('[VIEWER] Risposta fetch:', response.status, response.statusText);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('[VIEWER] Dati ricevuti:', data);
        // Distruggi grafico precedente
        if (currentMovementsChart) {
            currentMovementsChart.destroy();
            currentMovementsChart = null;
        }
        
        // Su desktop, usa nuovo componente ancorato
        const isDesktop = !isMobileView();
        console.log('[VIEWER] Is desktop:', isDesktop);
        console.log('[VIEWER] AnchoredFlowStockChart disponibile:', !!window.AnchoredFlowStockChart);
        console.log('[VIEWER] AnchoredFlowStockChart.create disponibile:', !!(window.AnchoredFlowStockChart && window.AnchoredFlowStockChart.create));
        console.log('[VIEWER] AnchoredFlowStockChartBuilder disponibile:', !!window.AnchoredFlowStockChartBuilder);
        
        if (isDesktop && window.AnchoredFlowStockChart && window.AnchoredFlowStockChart.create) {
            console.log('[VIEWER] Usando nuovo componente desktop');
            
            // Assicura che il container sia visibile e abbia dimensioni prima di creare il grafico
            const ensureContainerReady = () => {
                const rect = chartContainer.getBoundingClientRect();
                const hasDimensions = rect.width > 0 && rect.height > 0;
                console.log('[VIEWER] Container ready check:', {
                    width: rect.width,
                    height: rect.height,
                    hasDimensions,
                    display: window.getComputedStyle(chartContainer).display,
                    visibility: window.getComputedStyle(chartContainer).visibility
                });
                return hasDimensions;
            };
            
            // Se il container non è pronto, aspetta un frame
            if (!ensureContainerReady()) {
                console.log('[VIEWER] Container non pronto, aspetto...');
                requestAnimationFrame(() => {
                    if (!ensureContainerReady()) {
                        // Se ancora non è pronto, aspetta un po' di più
                        setTimeout(() => createChart(), 100);
                        return;
                    }
                    createChart();
                });
            } else {
                createChart();
            }
            
            function createChart() {
                try {
                    currentMovementsChart = window.AnchoredFlowStockChart.create(chartContainer, data, {
                        preset: preset,
                        now: new Date(),
                    });
                    console.log('[VIEWER] Grafico creato:', !!currentMovementsChart);
                    if (!currentMovementsChart) {
                        throw new Error('Grafico non creato (ritornato null)');
                    }
                } catch (error) {
                    console.error('[VIEWER] Errore creazione grafico desktop:', error);
                    console.error('[VIEWER] Stack trace:', error.stack);
                    chartContainer.innerHTML = `<div class="error-state">Errore nel rendering del grafico: ${error.message}<br><small>Usando grafico legacy come fallback...</small></div>`;
                    // Fallback al grafico legacy in caso di errore
                    setTimeout(() => {
                        renderLegacyMovementsChart(chartContainer, data);
                    }, 1000);
                }
            }
        } else {
            console.log('[VIEWER] Usando grafico legacy (fallback)');
            if (isDesktop) {
                console.warn('[VIEWER] Componente desktop non disponibile, usando legacy');
            }
            // Fallback: usa vecchio grafico (mobile o se componente non disponibile)
            renderLegacyMovementsChart(chartContainer, data);
        }
    })
    .catch(error => {
        console.error('[VIEWER] Errore caricamento movimenti:', error);
        chartContainer.innerHTML = `<div class="error-state">Errore nel caricamento dei movimenti: ${error.message}</div>`;
    });
}

function renderLegacyMovementsChart(container, data) {
    const movements = data.movements || [];
    
    if (movements.length === 0) {
        container.innerHTML = '<canvas id="viewer-movements-chart"></canvas>';
        const ctx = document.getElementById('viewer-movements-chart').getContext('2d');
        
        if (movementsChart) {
            movementsChart.destroy();
        }
        
        movementsChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: []
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false },
                    title: {
                        display: true,
                        text: 'Nessun movimento registrato per questo vino',
                        font: { size: 14, color: '#666' }
                    }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
        currentMovementsChart = movementsChart;
        return;
    }
    
    // Prepara dati per grafico di flusso legacy (mobile)
    const labels = [];
    const consumiData = [];
    const rifornimentiData = [];
    const stockData = [];
    
    movements.forEach(mov => {
        const date = new Date(mov.date);
        labels.push(date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }));
        
        if (mov.type === 'consumo') {
            consumiData.push(-Math.abs(mov.quantity_change));
            rifornimentiData.push(0);
        } else {
            consumiData.push(0);
            rifornimentiData.push(Math.abs(mov.quantity_change));
        }
        
        stockData.push(mov.quantity_after || 0);
    });
    
    const avgStock = stockData.length > 0 
        ? stockData.reduce((a, b) => a + b, 0) / stockData.length 
        : 0;
    
    container.innerHTML = '<canvas id="viewer-movements-chart"></canvas>';
    const ctx = document.getElementById('viewer-movements-chart').getContext('2d');
    
    if (movementsChart) {
        movementsChart.destroy();
    }
    
    movementsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Consumi',
                    data: consumiData,
                    backgroundColor: '#9a182e',
                    borderColor: '#9a182e',
                    borderWidth: 1,
                    order: 2
                },
                {
                    label: 'Rifornimenti',
                    data: rifornimentiData,
                    backgroundColor: '#ffb347',
                    borderColor: '#ffb347',
                    borderWidth: 1,
                    order: 2
                },
                {
                    label: 'Stock',
                    data: stockData.map(() => avgStock),
                    type: 'line',
                    borderColor: '#333333',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false,
                    order: 1,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 15
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.datasetIndex === 0) {
                                label += Math.abs(context.parsed.y) + ' bottiglie';
                            } else if (context.datasetIndex === 1) {
                                label += context.parsed.y + ' bottiglie';
                            } else {
                                label += context.parsed.y + ' bottiglie';
                            }
                            return label;
                        }
                    }
                },
                title: {
                    display: false
                }
            },
            scales: {
                x: {
                    stacked: false,
                    title: {
                        display: true,
                        text: 'Data',
                        font: {
                            size: 12,
                            weight: 'bold'
                        }
                    }
                },
                y: {
                    stacked: false,
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: 'Movimenti (bottiglie)',
                        font: {
                            size: 12,
                            weight: 'bold'
                        }
                    },
                    ticks: {
                        callback: function(value) {
                            return Math.abs(value) + '';
                        }
                    },
                    grid: {
                        color: function(context) {
                            if (context.tick.value === 0) {
                                return '#333333';
                            }
                            return '#e0e0e0';
                        },
                        lineWidth: function(context) {
                            if (context.tick.value === 0) {
                                return 2;
                            }
                            return 1;
                        }
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Stock (bottiglie)',
                        font: {
                            size: 12,
                            weight: 'bold'
                        }
                    },
                    grid: {
                        drawOnChartArea: false
                    },
                    ticks: {
                        display: true
                    }
                }
            }
        }
    });
    
    currentMovementsChart = movementsChart;
}

function closeMovementsModal() {
    const modal = document.getElementById('viewer-movements-modal');
    if (modal) {
        modal.classList.add('hidden');
        // Ripristina anche lo style inline per nascondere completamente
        modal.style.display = 'none';
    }
}

// Make functions available globally
window.showMovementsChart = showMovementsChart;
window.toggleViewerFullscreen = toggleViewerFullscreen;

// ============================================
// CONVERSATIONS MANAGEMENT
// ============================================

async function loadConversations() {
    if (!authToken) return;
    
    const sidebarList = document.getElementById('chat-sidebar-list');
    sidebarList.innerHTML = '<div class="chat-sidebar-loading">Caricamento chat...</div>';
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/chat/conversations`, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
            },
        });
        
        if (!response.ok) {
            throw new Error('Errore caricamento conversazioni');
        }
        
        conversations = await response.json();
        renderConversationsList();
    } catch (error) {
        console.error('Errore caricamento conversazioni:', error);
        sidebarList.innerHTML = '<div class="chat-sidebar-error">Errore caricamento chat</div>';
    }
}

function renderConversationsList() {
    const sidebarList = document.getElementById('chat-sidebar-list');
    
    if (conversations.length === 0) {
        sidebarList.innerHTML = '<div class="chat-sidebar-empty">Nessuna chat ancora</div>';
        return;
    }
    
    sidebarList.innerHTML = conversations.map(conv => `
        <div class="chat-sidebar-item ${conv.id === currentConversationId ? 'active' : ''}" 
             data-conversation-id="${conv.id}">
            <div class="chat-sidebar-item-content">
                <div class="chat-sidebar-item-title">${escapeHtml(conv.title || 'Nuova chat')}</div>
                <div class="chat-sidebar-item-time-wrapper">
                    <div class="chat-sidebar-item-time">${formatConversationTime(conv.last_message_at || conv.updated_at)}</div>
                    <button class="chat-sidebar-item-delete" 
                            data-conversation-id="${conv.id}"
                            title="Cancella chat"
                            onclick="event.stopPropagation(); deleteConversation(${conv.id});">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                            <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
    
    // Aggiungi event listeners con pointer events per mobile
    sidebarList.querySelectorAll('.chat-sidebar-item').forEach(item => {
        item.addEventListener('pointerup', (e) => {
            // Non selezionare se il click è sul pulsante di cancellazione
            if (e.target.closest('.chat-sidebar-item-delete')) {
                return;
            }
            const conversationId = parseInt(item.dataset.conversationId);
            selectConversation(conversationId);
        });
    });
    
    // Aggiungi event listeners per delete button
    sidebarList.querySelectorAll('.chat-sidebar-item-delete').forEach(btn => {
        btn.addEventListener('pointerup', (e) => {
            e.stopPropagation();
            const conversationId = parseInt(btn.dataset.conversationId);
            deleteConversation(conversationId);
        });
    });
}

async function deleteConversation(conversationId) {
    if (!authToken) return;
    
    // Conferma cancellazione
    if (!confirm('Sei sicuro di voler cancellare questa chat?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/chat/conversations/${conversationId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`,
            },
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Errore cancellazione chat' }));
            throw new Error(errorData.detail || 'Errore cancellazione chat');
        }
        
        // Se era la conversazione corrente, resetta
        if (conversationId === currentConversationId) {
            currentConversationId = null;
            localStorage.removeItem('current_conversation_id');
            clearChatMessages();
        }
        
        // Ricarica lista conversazioni
        await loadConversations();
        
    } catch (error) {
        console.error('Errore cancellazione chat:', error);
        alert(`Errore: ${error.message}`);
    }
}

// Make function available globally
window.deleteConversation = deleteConversation;

function formatConversationTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Adesso';
    if (diffMins < 60) return `${diffMins}m fa`;
    if (diffHours < 24) return `${diffHours}h fa`;
    if (diffDays < 7) return `${diffDays}g fa`;
    
    return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

async function handleNewChat() {
    if (!authToken) return;
    
    try {
        // NON creare subito una nuova conversazione - aspetta il primo messaggio
        // Questo evita di creare conversazioni vuote
        currentConversationId = null;
        localStorage.removeItem('current_conversation_id');
        
        // Pulisci chat corrente
        clearChatMessages();
        
        // Aggiorna UI sidebar (rimuovi selezione)
        document.querySelectorAll('.chat-sidebar-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Ricarica lista conversazioni per aggiornare UI
        await loadConversations();
        
        console.log('[CHAT] Nuova chat - conversation_id resettato, verrà creata al primo messaggio');
    } catch (error) {
        console.error('Errore creazione nuova chat:', error);
        alert('Errore creazione nuova chat');
    }
}

async function selectConversation(conversationId) {
    if (conversationId === currentConversationId) return;
    
    currentConversationId = conversationId;
    localStorage.setItem('current_conversation_id', conversationId.toString());
    
    // Aggiorna UI sidebar
    document.querySelectorAll('.chat-sidebar-item').forEach(item => {
        item.classList.toggle('active', parseInt(item.dataset.conversationId) === conversationId);
    });
    
    // Carica messaggi conversazione
    await loadConversationMessages(conversationId);
}

async function loadConversationMessages(conversationId) {
    if (!authToken || !conversationId) return;
    
    // Pulisci messaggi correnti SENZA mantenere il welcome message
    clearChatMessages(false);
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/chat/conversations/${conversationId}/messages?limit=50`, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
            },
        });
        
        if (!response.ok) {
            throw new Error('Errore caricamento messaggi');
        }
        
        const data = await response.json();
        const messages = data.messages || [];
        
        // Se non ci sono messaggi, mostra welcome message
        if (messages.length === 0) {
            clearChatMessages(true);
            return;
        }
        
        // Renderizza messaggi
        messages.forEach(msg => {
            // Determina se è HTML (controlla se contiene tag HTML comuni)
            // Controlla sia per contenuto non escapato che escapato
            const content = msg.content || '';
            const trimmedContent = content.trim();
            const isHtml = trimmedContent.startsWith('<div') || 
                          trimmedContent.startsWith('&lt;div') ||
                          trimmedContent.includes('class="wine-card"') ||
                          trimmedContent.includes('class="wines-list-card"') ||
                          trimmedContent.includes('class="movement-card"') ||
                          trimmedContent.includes('class="inventory-list-card"') ||
                          trimmedContent.includes('class="stats-card"');
            
            // Se è HTML escapato, decodifica
            let finalContent = content;
            if (isHtml && trimmedContent.startsWith('&lt;')) {
                // Decodifica HTML escapato
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = content; // Decodifica &lt; in <
                finalContent = tempDiv.innerHTML; // Usa innerHTML, non textContent!
            } else if (isHtml && (trimmedContent.startsWith('<') || trimmedContent.includes('class="'))) {
                // HTML non escapato, usa direttamente
                finalContent = content;
            }
            
            const messageId = addChatMessage(msg.role, finalContent, false, false, null, isHtml);
            
            // Setup bookmarks per card vino dopo il rendering
            if (isHtml && msg.role === 'ai') {
                setTimeout(() => {
                    const messageEl = document.getElementById(messageId);
                    if (messageEl) {
                        setupWineCardBookmarks(messageEl);
                    }
                }, 100);
            }
        });
        
        // Scrolla in fondo
        const messagesContainer = document.getElementById('chat-messages');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } catch (error) {
        console.error('Errore caricamento messaggi:', error);
        addChatMessage('ai', 'Errore caricamento messaggi', false, true);
    }
}

function clearChatMessages(keepWelcome = true) {
    const messagesContainer = document.getElementById('chat-messages');
    messagesContainer.innerHTML = '';
    
    // Mantieni o ricrea welcome message solo se richiesto
    if (keepWelcome) {
        messagesContainer.innerHTML = `
            <div class="welcome-message">
                <h2>Ciao! Come posso aiutarti?</h2>
                <p>Chiedimi informazioni sul tuo inventario vini</p>
            </div>
        `;
    }
}

function toggleSidebar() {
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
        // DELEGA al nuovo codice mobile (ChatMobile.js)
        if (typeof window.ChatMobile !== 'undefined' && window.ChatMobile.toggleSidebar) {
            window.ChatMobile.toggleSidebar();
        } else {
            // Fallback legacy (da rimuovere quando ChatMobile è sempre disponibile)
            const sidebar = document.getElementById('chatSidebar');
            const overlay = document.getElementById('sidebarOverlay');
            if (sidebar && overlay) {
                const isOpen = sidebar.classList.contains('is-open');
                if (isOpen) {
                    sidebar.classList.remove('is-open');
                    overlay.classList.remove('is-open');
                } else {
                    sidebar.classList.add('is-open');
                    overlay.classList.add('is-open');
                }
            }
        }
    } else {
        // DESKTOP: usa classe 'collapsed' per collassare/espandere
        const sidebar = document.getElementById('chat-sidebar');
        if (!sidebar) {
            return;
        }
        sidebar.classList.toggle('collapsed');
        const isCollapsed = sidebar.classList.contains('collapsed');
        localStorage.setItem('chat-sidebar-collapsed', isCollapsed.toString());
    }
}

// NUOVA ARCHITETTURA: Overlay gestito da ChatMobile.js
// Questa funzione legacy viene chiamata ma delega a ChatMobile se disponibile
function setupSidebarOverlay() {
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
        // Su mobile, ChatMobile.js gestisce già l'overlay in setupSidebarOverlay()
        // Questa funzione legacy viene mantenuta per compatibilità ma non fa nulla
        // perché ChatMobile.init() chiama già setupSidebarOverlay()
        return;
    }
    
    // Desktop: gestione legacy (se necessario)
    const overlay = document.getElementById('sidebar-overlay');
    if (overlay) {
        const newOverlay = overlay.cloneNode(true);
        overlay.parentNode.replaceChild(newOverlay, overlay);
        
        newOverlay.addEventListener('pointerup', (e) => {
            e.stopPropagation();
            toggleSidebar();
        }, { passive: true });
    }
}

// Carica stato sidebar al caricamento pagina
function loadSidebarState() {
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
        // MOBILE: Gestito da ChatMobile.js
        // Assicurati che sidebar mobile sia SEMPRE chiusa di default
        const sidebarMobile = document.getElementById('chatSidebar');
        const overlayMobile = document.getElementById('sidebarOverlay');
        
        if (sidebarMobile) {
            sidebarMobile.classList.remove('is-open');
        }
        
        if (overlayMobile) {
            overlayMobile.classList.remove('is-open');
        }
    } else {
        // DESKTOP: usa collapsed
        const sidebar = document.getElementById('chat-sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        
        if (sidebar) {
            const savedState = localStorage.getItem('chat-sidebar-collapsed');
            if (savedState === 'true') {
                sidebar.classList.add('collapsed');
            } else {
                sidebar.classList.remove('collapsed');
            }
            // Rimuovi 'open' se presente (da mobile)
            sidebar.classList.remove('open');
        }
        
        if (overlay) {
            overlay.classList.remove('active');
        }
    }
}

// Chiudi sidebar quando si clicca sull'overlay (solo mobile)
function closeSidebarOnOverlayClick() {
    const overlay = document.getElementById('sidebar-overlay');
    if (overlay) {
        // Usa pointer events per mobile
        overlay.addEventListener('pointerup', (e) => {
            const sidebar = document.getElementById('chat-sidebar');
            if (sidebar && sidebar.classList.contains('open')) {
                sidebar.classList.remove('open');
                overlay.classList.remove('active');
            }
        });
    }
}

// Gestisci resize window per cambiare comportamento mobile/desktop
function handleWindowResize() {
    const sidebar = document.getElementById('chat-sidebar');
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
        // Passato a mobile: rimuovi collapsed, chiudi sempre sidebar
        sidebar.classList.remove('collapsed');
        sidebar.classList.remove('open'); // Su mobile sempre chiusa di default
        // Overlay mobile gestito con hidden, non serve rimuoverlo
    } else {
        // Passato a desktop: rimuovi open, usa collapsed
        sidebar.classList.remove('open');
        // Overlay mobile gestito con hidden, non serve rimuoverlo
        // Ripristina stato collapsed da localStorage
        const savedState = localStorage.getItem('chat-sidebar-collapsed');
        if (savedState === 'true') {
            sidebar.classList.add('collapsed');
        } else {
            sidebar.classList.remove('collapsed');
        }
    }
}


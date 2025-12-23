/**
 * LayoutBoundary - Isolamento HARD tra layout Mobile e Desktop
 * 
 * Applica namespace root (.mobileRoot / .desktopRoot) per isolare completamente
 * CSS, scroll e comportamento tra i due layout.
 * 
 * Regole:
 * - Nessun CSS globale che impatta entrambi i layout
 * - Scroll container chiaramente definito per ogni device
 * - Nessun wrapper condiviso tra MobileLayout e DesktopLayout
 */

const LAYOUT_NAMESPACE = {
    MOBILE: 'mobileRoot',
    DESKTOP: 'desktopRoot'
};

/**
 * Inizializza il LayoutBoundary applicando il namespace corretto
 * @param {string} device - 'mobile' o 'desktop'
 */
function initLayoutBoundary(device) {
    const root = document.documentElement;
    const body = document.body;
    
    // Rimuovi namespace precedenti
    root.classList.remove(LAYOUT_NAMESPACE.MOBILE, LAYOUT_NAMESPACE.DESKTOP);
    body.classList.remove(LAYOUT_NAMESPACE.MOBILE, LAYOUT_NAMESPACE.DESKTOP);
    
    // Applica namespace corretto
    const namespace = device === 'mobile' ? LAYOUT_NAMESPACE.MOBILE : LAYOUT_NAMESPACE.DESKTOP;
    root.classList.add(namespace);
    body.classList.add(namespace);
    
    // Definisce scroll container principale per questo device
    setScrollContainer(device);
    
    console.log(`[LayoutBoundary] Initialized: ${device} (namespace: .${namespace})`);
}

/**
 * Definisce il scroll container principale per il device
 * @param {string} device - 'mobile' o 'desktop'
 */
function setScrollContainer(device) {
    const root = document.documentElement;
    
    if (device === 'mobile') {
        // Mobile: scroll su .mScroller (#chatScroll)
        root.style.setProperty('--scroll-container', '#chatScroll');
        root.style.setProperty('--scroll-container-class', '.mScroller');
    } else {
        // Desktop: scroll su .chat-messages-scroll-wrapper
        root.style.setProperty('--scroll-container', '#chat-messages-scroll-wrapper');
        root.style.setProperty('--scroll-container-class', '.chat-messages-scroll-wrapper');
    }
}

/**
 * Ottiene il namespace corrente
 * @returns {string} 'mobileRoot' o 'desktopRoot'
 */
function getCurrentNamespace() {
    if (document.documentElement.classList.contains(LAYOUT_NAMESPACE.MOBILE)) {
        return LAYOUT_NAMESPACE.MOBILE;
    }
    if (document.documentElement.classList.contains(LAYOUT_NAMESPACE.DESKTOP)) {
        return LAYOUT_NAMESPACE.DESKTOP;
    }
    return null;
}

/**
 * Verifica se siamo nel namespace mobile
 * @returns {boolean}
 */
function isMobileNamespace() {
    return getCurrentNamespace() === LAYOUT_NAMESPACE.MOBILE;
}

/**
 * Verifica se siamo nel namespace desktop
 * @returns {boolean}
 */
function isDesktopNamespace() {
    return getCurrentNamespace() === LAYOUT_NAMESPACE.DESKTOP;
}

/**
 * Cleanup: rimuove namespace quando si cambia layout
 */
function cleanupLayoutBoundary() {
    const root = document.documentElement;
    const body = document.body;
    
    root.classList.remove(LAYOUT_NAMESPACE.MOBILE, LAYOUT_NAMESPACE.DESKTOP);
    body.classList.remove(LAYOUT_NAMESPACE.MOBILE, LAYOUT_NAMESPACE.DESKTOP);
    
    root.style.removeProperty('--scroll-container');
    root.style.removeProperty('--scroll-container-class');
}

// Export per uso globale
if (typeof window !== 'undefined') {
    window.LayoutBoundary = {
        init: initLayoutBoundary,
        cleanup: cleanupLayoutBoundary,
        getCurrentNamespace,
        isMobileNamespace,
        isDesktopNamespace,
        NAMESPACE: LAYOUT_NAMESPACE
    };
}


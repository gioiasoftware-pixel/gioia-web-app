// Configuration
// Se usi Vite, usa: import.meta.env.VITE_API_URL
// Altrimenti usa questo fallback o configura in index.html
const API_BASE_URL = window.API_BASE_URL || 'http://localhost:8000';

// State
let authToken = null;
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
document.addEventListener('DOMContentLoaded', () => {
    // Check if user is already logged in
    authToken = localStorage.getItem('auth_token');
    if (authToken) {
        showChatPage();
        loadUserInfo();
    } else {
        showAuthPage();
    }

    setupEventListeners();
});

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

    // Chat
    document.getElementById('chat-form')?.addEventListener('submit', handleChatSubmit);
    document.getElementById('chat-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            document.getElementById('chat-form').dispatchEvent(new Event('submit'));
        }
    });

    // Auto-resize textarea
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.addEventListener('input', () => {
            chatInput.style.height = 'auto';
            chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
        });
    }

    // Logout - usa listener universale per mobile
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        addUniversalEventListener(logoutBtn, handleLogout);
    }

    // Chat sidebar
    const newChatBtn = document.getElementById('new-chat-btn');
    if (newChatBtn) {
        addUniversalEventListener(newChatBtn, handleNewChat);
    }
    
    // Setup pulsante hamburger con supporto universale mobile
    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (sidebarToggle) {
        console.log('[DEBUG] Sidebar toggle button trovato, touch device:', isTouchDevice());
        addUniversalEventListener(sidebarToggle, (e) => {
            console.log('[DEBUG] Toggle chiamato, tipo evento:', e.type);
            toggleSidebar();
        });
    } else {
        console.error('[DEBUG] Sidebar toggle button NON trovato!');
    }
    closeSidebarOnOverlayClick(); // Setup overlay click handler
    
    // Gestisci resize window per mobile/desktop
    window.addEventListener('resize', handleWindowResize);

    // Viewer - usa listener universale per mobile
    const viewerToggle = document.getElementById('viewer-toggle');
    if (viewerToggle) {
        addUniversalEventListener(viewerToggle, toggleViewer);
    }
    const viewerClose = document.getElementById('viewer-close');
    if (viewerClose) {
        addUniversalEventListener(viewerClose, closeViewer);
    }
    document.getElementById('viewer-search')?.addEventListener('input', handleViewerSearch);
    setupViewerFilters();
    
    // Viewer Fullscreen (solo desktop)
    if (window.innerWidth > 768) {
        const viewerFullscreenBtn = document.getElementById('viewer-fullscreen-btn');
        if (viewerFullscreenBtn) {
            addUniversalEventListener(viewerFullscreenBtn, openViewerFullscreen);
        }
        const viewerFullscreenClose = document.getElementById('viewer-fullscreen-close');
        if (viewerFullscreenClose) {
            addUniversalEventListener(viewerFullscreenClose, closeViewerFullscreen);
        }
        const viewerFullscreenSearch = document.getElementById('viewer-fullscreen-search');
        if (viewerFullscreenSearch) {
            viewerFullscreenSearch.addEventListener('input', handleViewerFullscreenSearch);
        }
        const viewerFullscreenDownload = document.getElementById('viewer-fullscreen-download-csv');
        if (viewerFullscreenDownload) {
            addUniversalEventListener(viewerFullscreenDownload, handleViewerFullscreenDownloadCSV);
        }
        setupViewerFullscreenFilters();
        
        // Modal movimenti
        const movementsModalClose = document.getElementById('viewer-movements-modal-close');
        if (movementsModalClose) {
            addUniversalEventListener(movementsModalClose, closeMovementsModal);
        }
        const movementsModal = document.getElementById('viewer-movements-modal');
        if (movementsModal) {
            addUniversalEventListener(movementsModal, (e) => {
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

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const rememberMe = document.getElementById('remember-me').checked;

    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password, remember_me: rememberMe }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || 'Errore durante il login');
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

async function handleSignup(e) {
    e.preventDefault();
    const errorEl = document.getElementById('signup-error');
    errorEl.classList.add('hidden');

    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const businessName = document.getElementById('business-name').value;
    const telegramId = document.getElementById('telegram-id').value;

    // Validate password
    if (password.length < 8) {
        errorEl.textContent = 'La password deve essere di almeno 8 caratteri';
        errorEl.classList.remove('hidden');
        return;
    }

    try {
        const body = {
            email,
            password,
            business_name: businessName,
        };

        if (telegramId) {
            body.telegram_id = parseInt(telegramId);
        }

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

        if (response.ok) {
            currentUser = await response.json();
        }
    } catch (error) {
        console.error('Error loading user info:', error);
    }
}

function handleLogout() {
    authToken = null;
    currentUser = null;
    currentConversationId = null;
    conversations = [];
    localStorage.removeItem('auth_token');
    localStorage.removeItem('current_conversation_id');
    showAuthPage();
}

function showAuthPage() {
    document.getElementById('auth-page').classList.remove('hidden');
    document.getElementById('chat-page').classList.add('hidden');
}

function showChatPage() {
    document.getElementById('auth-page').classList.add('hidden');
    document.getElementById('chat-page').classList.remove('hidden');
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
}

// ============================================
// CHAT
// ============================================

async function handleChatSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const message = input.value.trim();

    if (!message || !authToken) return;

    // Add user message to chat
    addChatMessage('user', message);
    input.value = '';
    input.style.height = 'auto';

    // Show loading
    const loadingId = addChatMessage('ai', '', true);

    try {
        const response = await fetch(`${API_BASE_URL}/api/chat/message`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify({ message }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || 'Errore durante l\'invio del messaggio');
        }

        // Remove loading and add AI response
        removeChatMessage(loadingId);
        // Debug: verifica is_html
        console.log('Chat response data:', { message: data.message?.substring(0, 100), is_html: data.is_html, buttons: data.buttons });
        addChatMessage('ai', data.message || data.response || 'Nessuna risposta', false, false, data.buttons, data.is_html === true);
    } catch (error) {
        removeChatMessage(loadingId);
        addChatMessage('ai', `Errore: ${error.message}`, false, true);
    }
}

function addChatMessage(role, content, isLoading = false, isError = false, buttons = null, isHtml = false) {
    const messagesContainer = document.getElementById('chat-messages');
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
        const contentHtml = isHtml ? content : escapeHtml(content);
        const contentClass = isHtml ? 'chat-message-content has-card' : 'chat-message-content';
        
        // Debug
        if (isHtml) {
            console.log('Rendering HTML card:', content.substring(0, 200));
        }
        
        messageEl.innerHTML = `
            ${avatarHtml}
            <div class="${contentClass}" style="${isError ? 'color: var(--color-granaccia);' : ''}">${contentHtml}${buttonsHtml}</div>
        `;
        
        // Aggiungi event listeners ai pulsanti
        if (buttons && buttons.length > 0) {
            const buttonElements = messageEl.querySelectorAll('.chat-button');
            buttonElements.forEach(btn => {
                btn.addEventListener('click', () => {
                    const wineId = btn.dataset.wineId;
                    const wineText = btn.dataset.wineText;
                    const movementType = btn.dataset.movementType;
                    const quantity = btn.dataset.quantity;
                    
                    const input = document.getElementById('chat-input');
                    
                    // Se è un pulsante di conferma movimento, invia messaggio con formato speciale
                    if (movementType && quantity && wineId) {
                        // Formato: [movement:consumo/rifornimento] [wine_id:123] [quantity:3]
                        input.value = `[movement:${movementType}] [wine_id:${wineId}] [quantity:${quantity}]`;
                    } else if (wineId) {
                        // Pulsante normale: ricerca vino con ID
                        input.value = `dimmi tutto su ${wineText} [wine_id:${wineId}]`;
                    } else {
                        // Fallback: solo testo
                        input.value = `dimmi tutto su ${wineText}`;
                    }
                    input.dispatchEvent(new Event('input')); // Trigger resize
                    document.getElementById('chat-form').dispatchEvent(new Event('submit'));
                });
            });
        }
    }

    messagesContainer.appendChild(messageEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

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
// VIEWER
// ============================================

function toggleViewer() {
    const panel = document.getElementById('viewer-panel');
    const toggleBtn = document.getElementById('viewer-toggle');
    
    if (panel.classList.contains('open')) {
        closeViewer();
    } else {
        panel.classList.add('open');
        toggleBtn.classList.add('hidden');
        loadViewerData();
    }
}

function closeViewer() {
    const panel = document.getElementById('viewer-panel');
    const toggleBtn = document.getElementById('viewer-toggle');
    
    panel.classList.remove('open');
    toggleBtn.classList.remove('hidden');
}


function setupViewerFilters() {
    const filterHeaders = document.querySelectorAll('.filter-header');
    filterHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const filterType = header.dataset.filter;
            const content = document.getElementById(`filter-${filterType}`);
            const icon = header.querySelector('.filter-icon');
            
            if (content.classList.contains('hidden')) {
                content.classList.remove('hidden');
                icon.classList.add('expanded');
            } else {
                content.classList.add('hidden');
                icon.classList.remove('expanded');
            }
        });
    });
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
        
        // Render table
        renderViewerTable(data.rows || []);
        
        // Setup filter items
        setupFilterItems();
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

        // Ordina per frequenza (count desc) - solo se ci sono items
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
}

function setupFilterItems() {
    const filterItems = document.querySelectorAll('.filter-item');
    filterItems.forEach(item => {
        addUniversalEventListener(item, () => {
            const filterType = item.closest('.filter-content').id.replace('filter-', '');
            const value = item.dataset.value;

            // Toggle filter
            if (viewerFilters[filterType] === value) {
                viewerFilters[filterType] = null;
                item.classList.remove('active');
            } else {
                viewerFilters[filterType] = value;
                // Remove active from siblings
                item.parentElement.querySelectorAll('.filter-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
            }

            // Apply filters and re-render
            applyViewerFilters();
        });
    });
}

function applyViewerFilters() {
    if (!viewerData || !viewerData.rows) return;

    let filtered = [...viewerData.rows];

    // Apply filters
    Object.keys(viewerFilters).forEach(key => {
        if (viewerFilters[key]) {
            filtered = filtered.filter(row => {
                const rowValue = row[key] || row[key.toLowerCase()];
                return String(rowValue) === String(viewerFilters[key]);
            });
        }
    });

    // Apply search
    if (viewerSearchQuery) {
        const query = viewerSearchQuery.toLowerCase();
        filtered = filtered.filter(row => {
            return Object.values(row).some(val => 
                String(val).toLowerCase().includes(query)
            );
        });
    }

    renderViewerTable(filtered);
}

let viewerSearchTimeout = null;

function handleViewerSearch(e) {
    // Debounce ricerca (300ms)
    clearTimeout(viewerSearchTimeout);
    viewerSearchTimeout = setTimeout(() => {
        viewerSearchQuery = e.target.value;
        applyViewerFilters();
    }, 300);
}

function renderViewerTable(rows) {
    const tableBody = document.getElementById('viewer-table-body');
    const panel = document.getElementById('viewer-panel');
    const isFullscreen = panel && panel.classList.contains('fullscreen');
    
    if (rows.length === 0) {
        const colspan = isFullscreen ? 7 : 6;
        tableBody.innerHTML = `<tr><td colspan="${colspan}" class="loading" style="color: var(--color-text-secondary); padding: 40px !important;">Nessun inventario disponibile. Carica un file CSV per iniziare.</td></tr>`;
        return;
    }

    // Pagination
    const start = (viewerCurrentPage - 1) * viewerPageSize;
    const end = start + viewerPageSize;
    const paginatedRows = rows.slice(start, end);
    const totalPages = Math.ceil(rows.length / viewerPageSize);

    // Genera HTML righe
    let html = '';
    paginatedRows.forEach((row, index) => {
        const wineId = `wine-${index}-${Date.now()}`;
        const wineName = escapeHtml(row.name || row.Nome || '');
        const isExpanded = false; // Stato iniziale
        
        // Riga principale
        html += `
        <tr class="viewer-wine-row" data-wine-id="${wineId}" data-expanded="false">
            <td class="viewer-wine-name-cell">${wineName}</td>
            <td>${escapeHtml(row.winery || row.Cantina || '')}</td>
            <td>${row.qty || row.Quantità || row.quantità || 0}</td>
            <td>€${(row.price || row.Prezzo || row.prezzo || 0).toFixed(2)}</td>
            <td>${escapeHtml(row.supplier || row.Fornitore || row.fornitore || '')}</td>
            <td>${(row.critical || row['Scorta critica'] || false) ? '<span class="critical-badge">Critica</span>' : ''}</td>
            ${isFullscreen ? `
            <td class="viewer-chart-action-cell">
                <button class="viewer-chart-btn" data-wine-name="${wineName}" title="Visualizza grafico movimenti" type="button" onclick="event.stopPropagation(); showMovementsChart('${wineName}');">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 3V21H21" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M7 16L12 11L16 15L21 10" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M21 10V4H15" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
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

    // Setup click su righe per espansione (solo fullscreen)
    if (isFullscreen) {
        document.querySelectorAll('.viewer-wine-row').forEach(row => {
            addUniversalEventListener(row, (e) => {
                // Non espandere se il click è sul pulsante grafico
                if (e.target.closest('.viewer-chart-btn')) {
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
    buttons.push(`
        <button class="pagination-btn" ${viewerCurrentPage === 1 ? 'disabled' : ''} onclick="viewerGoToPage(${viewerCurrentPage - 1})">
            ←
        </button>
    `);

    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= viewerCurrentPage - 2 && i <= viewerCurrentPage + 2)) {
            buttons.push(`
                <button class="pagination-btn ${i === viewerCurrentPage ? 'active' : ''}" onclick="viewerGoToPage(${i})">
                    ${i}
                </button>
            `);
        } else if (i === viewerCurrentPage - 3 || i === viewerCurrentPage + 3) {
            buttons.push('<span class="pagination-info">...</span>');
        }
    }

    // Next button
    buttons.push(`
        <button class="pagination-btn" ${viewerCurrentPage === totalPages ? 'disabled' : ''} onclick="viewerGoToPage(${viewerCurrentPage + 1})">
            →
        </button>
    `);

    pagination.innerHTML = buttons.join('');
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

function toggleViewerFullscreen() {
    // Solo desktop
    if (window.innerWidth <= 768) return;
    
    const panel = document.getElementById('viewer-panel');
    const chartColumn = document.querySelector('.viewer-chart-column');
    const metaEl = document.getElementById('viewer-meta');
    const downloadBtn = document.getElementById('viewer-download-csv');
    
    if (!panel) return;
    
    const isFullscreen = panel.classList.contains('fullscreen');
    
    if (isFullscreen) {
        // Esci da fullscreen
        panel.classList.remove('fullscreen');
        if (chartColumn) chartColumn.classList.add('hidden');
        if (metaEl) metaEl.classList.add('hidden');
        if (downloadBtn) downloadBtn.classList.add('hidden');
        
        // Ricarica tabella senza colonna grafico
        if (viewerData) {
            applyViewerFilters();
        }
    } else {
        // Entra in fullscreen
        panel.classList.add('fullscreen');
        if (chartColumn) chartColumn.classList.remove('hidden');
        if (metaEl) metaEl.classList.remove('hidden');
        if (downloadBtn) downloadBtn.classList.remove('hidden');
        
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

function showMovementsChart(wineName) {
    if (!authToken) {
        alert('Token non valido');
        return;
    }
    
    const modal = document.getElementById('viewer-movements-modal');
    const modalTitle = document.getElementById('viewer-movements-modal-wine-name');
    const chartContainer = document.getElementById('viewer-movements-chart-container');
    
    if (!modal || !modalTitle || !chartContainer) return;
    
    modalTitle.textContent = `Movimenti: ${wineName}`;
    modal.classList.remove('hidden');
    
    // Mostra loading
    chartContainer.innerHTML = '<div class="loading">Caricamento movimenti...</div>';
    
    // Fetch movimenti (endpoint da implementare nel backend)
    fetch(`${API_BASE_URL}/api/viewer/movements?wine_name=${encodeURIComponent(wineName)}`, {
        headers: {
            'Authorization': `Bearer ${authToken}`,
        },
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
    })
    .then(data => {
        const movements = data.movements || [];
        
        if (movements.length === 0) {
            // Mostra grafico vuoto
            chartContainer.innerHTML = '<canvas id="viewer-movements-chart"></canvas>';
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
            return;
        }
        
        // Prepara dati per grafico
        const labels = [];
        const consumiData = [];
        const rifornimentiData = [];
        const quantitaData = [];
        
        movements.forEach(mov => {
            const date = new Date(mov.date);
            labels.push(date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }));
            
            if (mov.type === 'consumo') {
                consumiData.push(Math.abs(mov.quantity_change));
                rifornimentiData.push(null);
            } else {
                consumiData.push(null);
                rifornimentiData.push(mov.quantity_change);
            }
            
            quantitaData.push(mov.quantity_after);
        });
        
        // Crea grafico
        chartContainer.innerHTML = '<canvas id="viewer-movements-chart"></canvas>';
        const ctx = document.getElementById('viewer-movements-chart').getContext('2d');
        
        // Distruggi grafico precedente se esiste
        if (movementsChart) {
            movementsChart.destroy();
        }
        
        movementsChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Consumi',
                        data: consumiData,
                        borderColor: '#9a182e',
                        backgroundColor: 'rgba(154, 24, 46, 0.1)',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Rifornimenti',
                        data: rifornimentiData,
                        borderColor: '#28a745',
                        backgroundColor: 'rgba(40, 167, 69, 0.1)',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Quantità Stock',
                        data: quantitaData,
                        borderColor: '#007bff',
                        backgroundColor: 'rgba(0, 123, 255, 0.1)',
                        tension: 0.4,
                        fill: false,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    title: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Bottiglie (Consumi/Rifornimenti)'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Stock'
                        },
                        grid: {
                            drawOnChartArea: false
                        }
                    }
                }
            }
        });
        
    })
    .catch(error => {
        console.error('[VIEWER] Errore caricamento movimenti:', error);
        chartContainer.innerHTML = `<div class="error-state">Errore nel caricamento dei movimenti: ${error.message}</div>`;
    });
}

function closeMovementsModal() {
    const modal = document.getElementById('viewer-movements-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Make functions available globally
window.showMovementsChart = showMovementsChart;

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
            <div class="chat-sidebar-item-title">${escapeHtml(conv.title || 'Nuova chat')}</div>
            <div class="chat-sidebar-item-time">${formatConversationTime(conv.last_message_at || conv.updated_at)}</div>
        </div>
    `).join('');
    
    // Aggiungi event listeners con supporto universale mobile
    sidebarList.querySelectorAll('.chat-sidebar-item').forEach(item => {
        addUniversalEventListener(item, () => {
            const conversationId = parseInt(item.dataset.conversationId);
            selectConversation(conversationId);
        });
    });
}

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
        const response = await fetch(`${API_BASE_URL}/api/chat/conversations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify({ title: null }),  // Titolo generato dal primo messaggio
        });
        
        if (!response.ok) {
            throw new Error('Errore creazione nuova chat');
        }
        
        const data = await response.json();
        currentConversationId = data.conversation_id;
        localStorage.setItem('current_conversation_id', currentConversationId.toString());
        
        // Pulisci chat corrente
        clearChatMessages();
        
        // Ricarica lista conversazioni
        await loadConversations();
        
        // Scrolla alla nuova conversazione
        const newItem = document.querySelector(`[data-conversation-id="${currentConversationId}"]`);
        if (newItem) {
            newItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
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
            // Determina se è HTML (controlla se inizia con <div)
            const isHtml = msg.content && msg.content.trim().startsWith('<div');
            addChatMessage(msg.role, msg.content, false, false, null, isHtml);
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
    console.log('[DEBUG] toggleSidebar chiamato');
    const sidebar = document.getElementById('chat-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    
    if (!sidebar) {
        console.error('[DEBUG] Sidebar non trovata!');
        return;
    }
    
    // Rileva se siamo su mobile (larghezza <= 768px)
    const isMobile = window.innerWidth <= 768;
    console.log('[DEBUG] isMobile:', isMobile, 'window.innerWidth:', window.innerWidth);
    
    if (isMobile) {
        // Su mobile: usa classe 'open' per mostrare/nascondere
        const wasOpen = sidebar.classList.contains('open');
        sidebar.classList.toggle('open');
        const isNowOpen = sidebar.classList.contains('open');
        console.log('[DEBUG] Mobile - sidebar era aperta:', wasOpen, 'ora è aperta:', isNowOpen);
        
        // Mostra/nascondi overlay quando sidebar è aperta
        if (overlay) {
            if (isNowOpen) {
                overlay.classList.add('active');
                console.log('[DEBUG] Overlay attivato');
            } else {
                overlay.classList.remove('active');
                console.log('[DEBUG] Overlay disattivato');
            }
        }
    } else {
        // Su desktop: usa classe 'collapsed' per collassare/espandere
        sidebar.classList.toggle('collapsed');
        // Salva stato nel localStorage solo su desktop
        const isCollapsed = sidebar.classList.contains('collapsed');
        localStorage.setItem('chat-sidebar-collapsed', isCollapsed.toString());
        console.log('[DEBUG] Desktop - sidebar collapsed:', isCollapsed);
    }
}

// Carica stato sidebar al caricamento pagina (solo desktop)
function loadSidebarState() {
    const sidebar = document.getElementById('chat-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    // Su mobile, la sidebar è sempre nascosta di default
    const isMobile = window.innerWidth <= 768;
    if (!isMobile) {
        // Desktop: usa collapsed
        const savedState = localStorage.getItem('chat-sidebar-collapsed');
        if (savedState === 'true') {
            sidebar.classList.add('collapsed');
        } else {
            sidebar.classList.remove('collapsed');
        }
        // Rimuovi 'open' se presente (da mobile)
        sidebar.classList.remove('open');
        if (overlay) {
            overlay.classList.remove('active');
        }
    } else {
        // Mobile: assicurati che sia SEMPRE chiusa di default
        sidebar.classList.remove('open');
        sidebar.classList.remove('collapsed');
        if (overlay) {
            overlay.classList.remove('active');
        }
    }
}

// Chiudi sidebar quando si clicca sull'overlay (solo mobile)
function closeSidebarOnOverlayClick() {
    const overlay = document.getElementById('sidebar-overlay');
    if (overlay) {
        addUniversalEventListener(overlay, (e) => {
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
    const overlay = document.getElementById('sidebar-overlay');
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
        // Passato a mobile: rimuovi collapsed, chiudi sempre sidebar
        sidebar.classList.remove('collapsed');
        sidebar.classList.remove('open'); // Su mobile sempre chiusa di default
        if (overlay) {
            overlay.classList.remove('active');
        }
    } else {
        // Passato a desktop: rimuovi open, usa collapsed
        sidebar.classList.remove('open');
        if (overlay) {
            overlay.classList.remove('active');
        }
        // Ripristina stato collapsed da localStorage
        const savedState = localStorage.getItem('chat-sidebar-collapsed');
        if (savedState === 'true') {
            sidebar.classList.add('collapsed');
        } else {
            sidebar.classList.remove('collapsed');
        }
    }
}


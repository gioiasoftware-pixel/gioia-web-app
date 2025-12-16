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

    // Logout
    document.getElementById('logout-btn')?.addEventListener('click', handleLogout);

    // Viewer
    document.getElementById('viewer-toggle')?.addEventListener('click', toggleViewer);
    document.getElementById('viewer-close')?.addEventListener('click', closeViewer);
    document.getElementById('viewer-search')?.addEventListener('input', handleViewerSearch);
    setupViewerDrag();
    setupViewerFilters();
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
    localStorage.removeItem('auth_token');
    showAuthPage();
}

function showAuthPage() {
    document.getElementById('auth-page').classList.remove('hidden');
    document.getElementById('chat-page').classList.add('hidden');
}

function showChatPage() {
    document.getElementById('auth-page').classList.add('hidden');
    document.getElementById('chat-page').classList.remove('hidden');
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
        addChatMessage('ai', data.response || data.message || 'Nessuna risposta');
    } catch (error) {
        removeChatMessage(loadingId);
        addChatMessage('ai', `Errore: ${error.message}`, false, true);
    }
}

function addChatMessage(role, content, isLoading = false, isError = false) {
    const messagesContainer = document.getElementById('chat-messages');
    const messageId = `msg-${Date.now()}-${Math.random()}`;
    const messageEl = document.createElement('div');
    messageEl.id = messageId;
    messageEl.className = `chat-message ${role}`;

    if (isLoading) {
        messageEl.innerHTML = `
            <div class="chat-message-avatar">AI</div>
            <div class="chat-message-content">
                <div class="chat-message-loading">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;
    } else {
        const avatar = role === 'user' ? (currentUser?.email?.[0]?.toUpperCase() || 'U') : 'AI';
        messageEl.innerHTML = `
            <div class="chat-message-avatar">${avatar}</div>
            <div class="chat-message-content" style="${isError ? 'color: var(--color-granaccia);' : ''}">${escapeHtml(content)}</div>
        `;
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

function setupViewerDrag() {
    const handle = document.getElementById('viewer-drag-handle');
    const panel = document.getElementById('viewer-panel');
    let isDragging = false;
    let startX = 0;
    let startWidth = 0;

    handle.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startWidth = panel.offsetWidth;
        document.addEventListener('mousemove', handleDrag);
        document.addEventListener('mouseup', stopDrag);
        e.preventDefault();
    });

    function handleDrag(e) {
        if (!isDragging) return;
        const diff = startX - e.clientX;
        const newWidth = Math.max(400, Math.min(1000, startWidth + diff));
        panel.style.width = `${newWidth}px`;
    }

    function stopDrag() {
        isDragging = false;
        document.removeEventListener('mousemove', handleDrag);
        document.removeEventListener('mouseup', stopDrag);
    }
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
            throw new Error('Errore nel caricamento dei dati');
        }

        const data = await response.json();
        viewerData = data;
        
        // Populate filters
        populateFilters(data.facets || {});
        
        // Render table
        renderViewerTable(data.rows || []);
        
        // Setup filter items
        setupFilterItems();
    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="6" class="loading">Errore: ${error.message}</td></tr>`;
    }
}

function populateFilters(facets) {
    Object.keys(facets).forEach(filterType => {
        const content = document.getElementById(`filter-${filterType}`);
        if (!content) return;

        const items = facets[filterType];
        content.innerHTML = '';

        Object.entries(items).forEach(([value, count]) => {
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
        item.addEventListener('click', () => {
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

function handleViewerSearch(e) {
    viewerSearchQuery = e.target.value;
    applyViewerFilters();
}

function renderViewerTable(rows) {
    const tableBody = document.getElementById('viewer-table-body');
    
    if (rows.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="loading">Nessun risultato</td></tr>';
        return;
    }

    // Pagination
    const start = (viewerCurrentPage - 1) * viewerPageSize;
    const end = start + viewerPageSize;
    const paginatedRows = rows.slice(start, end);
    const totalPages = Math.ceil(rows.length / viewerPageSize);

    tableBody.innerHTML = paginatedRows.map(row => `
        <tr>
            <td>${escapeHtml(row.name || row.Nome || '')}</td>
            <td>${escapeHtml(row.winery || row.Cantina || '')}</td>
            <td>${row.qty || row.Quantità || row.quantità || 0}</td>
            <td>${(row.price || row.Prezzo || row.prezzo || 0).toFixed(2)}</td>
            <td>${escapeHtml(row.supplier || row.Fornitore || row.fornitore || '')}</td>
            <td>${(row.critical || row['Scorta critica'] || false) ? '<span class="critical-badge">Critica</span>' : ''}</td>
        </tr>
    `).join('');

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
